// Calculateur de temps de vie QME : combien d'heures de travail représentent tes dépenses.
// Règles de calcul dans calculs.js (window.TDV_CALCUL), testées par outils/templates/temps-de-vie.test.mjs.
// Trois accès : clé de licence (application complète, données synchronisées), démo (données fictives, tout ouvert),
// découverte gratuite (ton revenu et quelques dépenses, sur cet appareil seulement).
(() => {
  'use strict';
  const B = window.BASE;
  const C = window.TDV_CALCUL;
  const API = '/api/templates';
  const PRODUIT = 'TDV';
  const CLE_CODE = 'qme-tdv-code';
  const CLE_CACHE = 'qme-tdv-cache';
  const CLE_DEMO = 'qme-tdv-demo';
  const CLE_DECOUVERTE = 'qme-tdv-decouverte';
  const CLE_ACCUEIL = 'qme-tdv-ecran-accueil';
  const CODE_DEMO = 'DEMO';
  const CODE_DECOUVERTE = 'DECOUVERTE';
  const PAGE_OFFRE = '/catalogue/temps-de-vie/';
  const PRIX = '19 €';
  const MAX_SCENARIOS = 3;
  const MAX_ACHATS = 6;
  const LETTRES = ['A', 'B', 'C'];

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const NF2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pluriel = (n, s, p) => `${NF.format(n)} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const auj = () => iso(new Date());
  const ilYa = (jours) => { const d = new Date(); d.setDate(d.getDate() - jours); return iso(d); };
  const fmtDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, (m || 1) - 1, j || 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const euros = (n) => `${NF.format(Math.round(Number(n) || 0))} €`;
  const eurosPrecis = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : `${Math.abs(n) < 100 ? NF2.format(n) : NF.format(Math.round(n))}\u00a0€`);
  const pct = (x) => `${NF.format(Math.round((Number(x) || 0) * 100))} %`;
  const lireNombre = (v) => { const s = String(v ?? '').replace(/[\s  €%]/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const champNombre = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));
  // Durées : minutes sous une heure, une décimale sous 100 heures.
  const heures = (h) => { if (h === null || h === undefined || !Number.isFinite(h)) return '—'; const a = Math.abs(h); if (a < 1) return `${NF.format(Math.round(a * 60))} min`; return `${a < 100 ? NF1.format(a) : NF.format(Math.round(a))} h`; };
  const jours = (j) => (j === null || !Number.isFinite(j) ? '—' : `${j < 100 ? NF1.format(j) : NF.format(Math.round(j))} ${j >= 2 ? 'jours' : 'jour'}`);
  const semaines = (s) => (s === null || !Number.isFinite(s) ? '—' : `${s < 100 ? NF1.format(s) : NF.format(Math.round(s))} ${s >= 2 ? 'semaines' : 'semaine'}`);
  const mois = (m) => (m === null || !Number.isFinite(m) ? '—' : `${m < 100 ? NF1.format(m) : NF.format(Math.round(m))} mois`);
  const telecharger = (nom, contenu, type) => {
    const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, decouverte: false, base: null, memoriser: true };
  let vue = 'calculer';
  let annulation = null;
  const complet = () => !session.decouverte;

  const profilVide = () => ({ type: 'salarie', revenuMensuel: null, revenuAnnuel: null, moisTravailles: null, heuresSemaine: null, joursSemaine: null, conges: null, nonTravailles: null, trajetMinutes: null, fraisPro: null, inclureTransport: true });
  const scenarioVide = (i) => ({ id: uid(), nom: `Scénario ${LETTRES[i] || i + 1}`, lignes: [] });
  const etatVide = () => ({ version: 1, profil: profilVide(), convention: 'effectif', depenses: [], categoriesPerso: [], sousPerso: {}, scenarios: [], achats: [],
    calcul: { montant: null, periode: 'unique', libelle: '' }, partage: { modeDeVie: true, categorie: true, logement: true, economies: true, horaire: false } });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return { ...v, ...d, profil: { ...v.profil, ...(d.profil || {}) }, convention: B.conventions.some((c) => c.id === d.convention) ? d.convention : 'effectif',
      depenses: Array.isArray(d.depenses) ? d.depenses.map((x) => ({ id: x.id || uid(), libelle: String(x.libelle || 'Dépense'), categorie: x.categorie || 'services', sousCategorie: x.sousCategorie || null,
        montant: Number(x.montant) || 0, periode: B.periodicites.some((p) => p.id === x.periode) ? x.periode : 'unique', date: x.date || auj(), actif: x.actif !== false, note: x.note || '', horaireAuMoment: x.horaireAuMoment ?? null })) : [],
      categoriesPerso: Array.isArray(d.categoriesPerso) ? d.categoriesPerso : [], sousPerso: d.sousPerso && typeof d.sousPerso === 'object' ? d.sousPerso : {},
      scenarios: Array.isArray(d.scenarios) ? d.scenarios.slice(0, MAX_SCENARIOS).map((s, i) => ({ ...scenarioVide(i), ...s, lignes: Array.isArray(s.lignes) ? s.lignes : [] })) : [],
      achats: Array.isArray(d.achats) ? d.achats.slice(0, MAX_ACHATS) : [], calcul: { ...v.calcul, ...(d.calcul || {}) }, partage: { ...v.partage, ...(d.partage || {}) } };
  }
  const taux = (conv = E.convention) => C.taux(E.profil, conv, B.defauts);
  const conv = (id = E.convention) => B.conventions.find((c) => c.id === id);
  const aUnRevenu = () => E && (Number(E.profil.revenuMensuel) > 0 || Number(E.profil.revenuAnnuel) > 0);
  const mdv = () => C.modeDeVie(E.depenses, taux(), B.periodicites, auj());

  // Bibliothèque : catégories intégrées + catégories et sous-catégories ajoutées par l'utilisateur.
  function bibliotheque() {
    const perso = E.sousPerso || {};
    const cats = B.categories.map((c) => ({ ...c, sous: [...c.sous, ...(perso[c.id] || []).map((s) => ({ ...s, perso: true }))] }));
    for (const c of E.categoriesPerso) cats.push({ id: c.id, nom: c.nom, perso: true, sous: (perso[c.id] || []).map((s) => ({ ...s, perso: true })) });
    return cats;
  }
  const categorie = (id) => bibliotheque().find((c) => c.id === id) || { id, nom: 'Autre', sous: [] };
  const sousNom = (cid, sid) => categorie(cid).sous.find((s) => s.id === sid)?.nom || '';
  const per = (id) => B.periodicites.find((p) => p.id === id) || B.periodicites[0];

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';
  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    if (session.decouverte) { stock.ecrire(CLE_DECOUVERTE, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }
  function sauver() {
    cache(true);
    if (session.demo || session.decouverte) return;
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
    if (session.demo || session.decouverte) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees); session.base = corps.donnees.majLe; cache(false); rendre();
        toast('Un autre appareil a modifié tes données entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
      } else if (statut === 401) { deconnecter('Ce code d\'accès n\'est plus valide.'); return; }
      else if (statut !== 200) throw new Error(String(statut));
      else { session.base = corps.majLe; cache(false); }
      majSync('ok');
    } catch { majSync('horsligne'); } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; envoyer(); }
    }
  }
  async function rafraichir() {
    if (session.demo || session.decouverte || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees); session.base = corps.donnees.majLe; cache(false);
        if (!document.activeElement?.matches('input,select,textarea') && !modale().open) rendre();
      }
    } catch { majSync('horsligne'); }
  }
  function majSync(etat) {
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale', decouverte: 'Sur cet appareil' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.'
      : etat === 'decouverte' ? 'Découverte gratuite : tes données restent dans ce navigateur, rien n\'est envoyé.' : libelles[etat];
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
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };
  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut === 403) throw new Error(corps?.erreur || 'Cette clé n\'est plus valide (achat remboursé ou contesté).');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.decouverte = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }
  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      if (aUnRevenu()) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (aUnRevenu()) { cache(false); demarrer(); } else ecranAccueil();
  }
  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.decouverte = false; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && d.profil && Number(d.profil.revenuMensuel) > 0 ? normaliser(d) : donneesDemo();
    cache();
    demarrer();
  }
  function ouvrirDecouverte() {
    session.decouverte = true; session.demo = false; session.code = null; session.jeton = null;
    stock.ecrire(CLE_CODE, CODE_DECOUVERTE);
    E = normaliser(stock.lire(CLE_DECOUVERTE));
    if (aUnRevenu()) demarrer(); else ecranAccueil();
  }
  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo && !session.decouverte) stock.suppr(CLE_CACHE);
    Object.assign(session, { code: null, jeton: null, demo: false, decouverte: false, base: null });
    E = null;
    document.body.classList.remove('app');
    if (modale().open) modale().close();
    ecranConnexion(message);
  }

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const e = etatVide();
    e.profil = { type: 'salarie', revenuMensuel: 3100, revenuAnnuel: null, moisTravailles: 12, heuresSemaine: 35, joursSemaine: 5, conges: 25, nonTravailles: 8, trajetMinutes: 50, fraisPro: 40, inclureTransport: true };
    e.convention = 'effectif';
    const t = C.taux(e.profil, 'effectif', B.defauts);
    const d = (libelle, categorie, sousCategorie, montant, periode, joursAvant = 30, extra = {}) => ({ id: uid(), libelle, categorie, sousCategorie, montant, periode, date: ilYa(joursAvant), actif: true, note: '', horaireAuMoment: Math.round(t.horaire * 100) / 100, ...extra });
    e.depenses = [
      d('Loyer', 'logement', 'loyer', 850, 'mois', 400), d('Charges', 'logement', 'charges', 60, 'mois', 400), d('Électricité', 'logement', 'electricite', 75, 'mois', 400),
      d('Box internet', 'logement', 'internet', 30, 'mois', 300), d('Assurance habitation', 'logement', 'assurance-hab', 18, 'mois', 400),
      d('Crédit voiture', 'mobilite', 'voiture', 220, 'mois', 500), d('Carburant', 'mobilite', 'carburant', 120, 'mois', 200), d('Assurance auto', 'mobilite', 'assurance-auto', 55, 'mois', 300),
      d('Entretien voiture', 'mobilite', 'entretien-auto', 600, 'an', 200), d('Stationnement', 'mobilite', 'stationnement', 35, 'mois', 200),
      d('Courses', 'alimentation', 'courses', 380, 'mois', 100), d('Restaurants', 'alimentation', 'restaurants', 120, 'mois', 100), d('Livraison de repas', 'alimentation', 'livraison', 60, 'mois', 100),
      d('Café au comptoir', 'alimentation', 'cafes', 12, 'semaine', 100),
      d('Salle de sport', 'loisirs', 'sport', 35, 'mois', 250), d('Sorties', 'loisirs', 'sorties', 60, 'mois', 100),
      d('Streaming vidéo', 'services', 'abonnements', 14, 'mois', 300), d('Streaming musical', 'services', 'abonnements', 11, 'mois', 300), d('Forfait mobile', 'services', 'numerique', 20, 'mois', 300),
      d('Frais bancaires', 'services', 'banque', 8, 'mois', 400), d('Stockage en ligne', 'services', 'numerique', 3, 'mois', 300, { actif: false, note: 'Résilié, gardé pour mémoire.' }),
      d('Vêtements', 'equipement', 'vetements', 70, 'mois', 200),
      d('Téléphone', 'equipement', 'telephone', 900, 'unique', 120), d('Vacances d\'été', 'loisirs', 'voyages', 2500, 'unique', 95), d('Canapé', 'equipement', 'mobilier', 1100, 'unique', 410),
      d('Ordinateur portable', 'equipement', 'ordinateur', 1200, 'unique', 430), d('Baskets', 'equipement', 'chaussures', 130, 'unique', 25),
      d('Week-end à la montagne', 'loisirs', 'voyages', 420, 'unique', 40), d('Cours de guitare', 'loisirs', 'activites', 240, 'trimestre', 200),
    ];
    e.scenarios = [
      { id: uid(), nom: 'A · Voiture moins chère', lignes: [{ id: uid(), libelle: 'Voiture à 15 000 € au lieu de 30 000 €', avant: 30000, apres: 15000, periode: 'unique', duree: 8 }, { id: uid(), libelle: 'Assurance auto', avant: 55, apres: 42, periode: 'mois' }] },
      { id: uid(), nom: 'B · Moins de restaurants', lignes: [{ id: uid(), libelle: 'Restaurants', avant: 120, apres: 60, periode: 'mois' }, { id: uid(), libelle: 'Livraison de repas', avant: 60, apres: 20, periode: 'mois' }, { id: uid(), libelle: 'Café au comptoir', avant: 12, apres: 6, periode: 'semaine' }] },
      { id: uid(), nom: 'C · Abonnements et loyer', lignes: [{ id: uid(), libelle: 'Streaming vidéo', avant: 14, apres: 0, periode: 'mois' }, { id: uid(), libelle: 'Streaming musical', avant: 11, apres: 0, periode: 'mois' }, { id: uid(), libelle: 'Loyer plus cher (plus grand)', avant: 850, apres: 980, periode: 'mois' }] },
    ];
    e.achats = [
      { id: uid(), nom: 'Voiture neuve', prix: 30000, frais: 800, dureeMois: 96, entretienAn: 700, utilisationMois: 150, revente: 9000 },
      { id: uid(), nom: 'Voiture d\'occasion', prix: 15000, frais: 600, dureeMois: 72, entretienAn: 950, utilisationMois: 160, revente: 5000 },
      { id: uid(), nom: 'Téléphone haut de gamme', prix: 1200, frais: 40, dureeMois: 48, entretienAn: 0, utilisationMois: 0, revente: 250 },
      { id: uid(), nom: 'Téléphone milieu de gamme', prix: 400, frais: 30, dureeMois: 30, entretienAn: 0, utilisationMois: 0, revente: 60 },
    ];
    e.calcul = { montant: 900, periode: 'unique', libelle: 'Téléphone' };
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  function ecranConnexion(message = '') {
    document.title = 'Temps de vie · QME';
    document.body.classList.remove('app');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="150" cy="150" r="130" fill="#F5B400"/>
          <path d="M150 150 L150 20 A130 130 0 0 1 280 150 Z" fill="#141414"/>
          <rect x="320" y="60" width="90" height="220" rx="10" fill="#1D4E89"/>
          <rect x="430" y="170" width="90" height="110" rx="10" fill="#D9302A"/>
          <rect x="0" y="278" width="560" height="4" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Temps de vie · coût réel des dépenses</p>
          <h1>Combien d'heures de ta vie pour payer ce que tu consommes ?</h1>
          <p>Ton revenu et ton temps de travail transforment chaque dépense en heures et en jours de travail : un achat, une habitude, un abonnement, ton logement, ton mode de vie entier.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div><p class="surtitre">Accès acheteur</p><h2>Ouvre ton calculateur</h2></div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Aucun nom n'est demandé : tes données sont enregistrées en ligne sous ta clé et te suivent sur tous tes appareils.</p>
        <form id="form-code" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon calculateur</button>
        </form>
        <div class="separateur">ou</div>
        <div class="choix-essai">
          <button class="btn" type="button" data-action="decouverte"><b>Essayer gratuitement</b></button>
          <button class="btn" type="button" data-action="demo">Voir un exemple complet</button>
        </div>
        <p class="mention">Découverte gratuite : ton revenu, ton temps de travail et jusqu'à ${B.decouverte.maxDepenses} dépenses, gardés dans ce navigateur, rien n'est envoyé. L'exemple complet utilise des données fictives. Application complète : ${PRIX}, achat unique, sans abonnement (<a href="${PAGE_OFFRE}">voir l'offre</a>). Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const fin = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (fin) champ.setSelectionRange(champ.value.length, champ.value.length);
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon calculateur'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement (revenu et temps de travail) ----------
  let accueil = { type: 'salarie', mensuel: '', annuel: '', heures: '', jours: '' };
  function ecranAccueil() {
    document.title = 'Bienvenue · Temps de vie';
    document.body.classList.remove('app');
    const essai = stock.lire(CLE_DECOUVERTE);
    const reprise = !session.decouverte && !session.demo && essai && essai.profil && (Number(essai.profil.revenuMensuel) > 0 || Number(essai.profil.revenuAnnuel) > 0);
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span>${session.decouverte ? '<span class="etiquette beurre">Découverte gratuite</span>' : ''}</div>
      <p class="surtitre">Bienvenue</p>
      <h1>Combien gagnes-tu, et combien de temps travailles-tu ?</h1>
      <p class="intro">Ces deux informations suffisent pour convertir n'importe quelle dépense en temps de travail. Tu pourras préciser tes congés, ton trajet et tes frais ensuite. Ces données restent privées : elles ne sont jamais affichées dans un partage sans ton accord.</p>
      ${reprise ? `<div class="aide reprise"><b>Un profil a été saisi en découverte gratuite sur cet appareil.</b> <button class="btn petit" data-action="reprendre-essai">Le reprendre avec ses dépenses</button></div>` : ''}
      <h2 class="titre-section">Ta situation</h2>
      <div class="filieres" role="group" aria-label="Situation">${B.profils.map((p) => `<button type="button" class="filiere" data-action="a-type" data-id="${p.id}" aria-pressed="${accueil.type === p.id}"><b>${esc(p.nom)}</b><span>${esc(p.aide)}</span></button>`).join('')}</div>
      <div class="grille-champs" style="margin-top:20px">
        <label class="champ">Revenu mensuel net<small>Ce que tu touches chaque mois.</small><span class="avec-unite"><input id="a-mensuel" inputmode="decimal" value="${esc(accueil.mensuel)}" placeholder="Ex. : 2 000"><span>€</span></span></label>
        <label class="champ">ou revenu annuel net<small>Facultatif : prioritaire s'il est saisi (primes, 13<sup>e</sup> mois).</small><span class="avec-unite"><input id="a-annuel" inputmode="decimal" value="${esc(accueil.annuel)}"><span>€</span></span></label>
        <label class="champ">Heures travaillées par semaine<small>Vide : 35 h (hypothèse affichée).</small><input id="a-heures" inputmode="decimal" value="${esc(accueil.heures)}" placeholder="35"></label>
        <label class="champ">Jours travaillés par semaine<small>Vide : 5 jours (hypothèse affichée).</small><input id="a-jours" inputmode="decimal" value="${esc(accueil.jours)}" placeholder="5"></label>
      </div>
      <p class="erreur" id="a-erreur" role="alert"></p>
      <div class="accueil-pied"><button class="btn" data-action="deconnexion">Retour</button><button class="btn primaire" data-action="accueil-fin">Calculer mon temps</button></div>
      ${session.decouverte ? `<p class="mention">Découverte gratuite : ${B.decouverte.maxDepenses} dépenses enregistrées au plus, gardées dans ce navigateur. L'application complète (${PRIX}, achat unique) ouvre la bibliothèque complète, l'historique, les scénarios, le coût de possession et les exports.</p>` : ''}
    </div>`;
    const lier = (id, cle) => $(id)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-mensuel', 'mensuel'); lier('#a-annuel', 'annuel'); lier('#a-heures', 'heures'); lier('#a-jours', 'jours');
  }
  function terminerAccueil() {
    const m = lireNombre(accueil.mensuel), a = lireNombre(accueil.annuel), h = lireNombre(accueil.heures), j = lireNombre(accueil.jours);
    if (!(m > 0) && !(a > 0)) { $('#a-erreur').textContent = 'Indique ton revenu net, mensuel ou annuel.'; $('#a-mensuel').focus(); return; }
    if ((h !== null && (h <= 0 || h > 100)) || (j !== null && (j <= 0 || j > 7))) { $('#a-erreur').textContent = 'Heures entre 1 et 100 par semaine, jours entre 1 et 7.'; return; }
    if (!E) E = etatVide();
    Object.assign(E.profil, { type: accueil.type, revenuMensuel: m > 0 ? m : null, revenuAnnuel: a > 0 ? a : null, heuresSemaine: h, joursSemaine: j });
    accueil = { type: 'salarie', mensuel: '', annuel: '', heures: '', jours: '' };
    vue = 'calculer';
    history.replaceState(null, '', '#calculer');
    sauver(); demarrer();
  }
  function reprendreEssai() {
    const essai = normaliser(stock.lire(CLE_DECOUVERTE));
    E = { ...etatVide(), profil: essai.profil, convention: essai.convention, depenses: essai.depenses.map((d) => ({ ...d, id: uid() })), calcul: essai.calcul };
    stock.suppr(CLE_DECOUVERTE);
    vue = 'bilan'; history.replaceState(null, '', '#bilan');
    sauver(); demarrer();
    toast('Profil et dépenses de la découverte repris. La copie de découverte a été effacée de cet appareil.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    profil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.5" fill="currentColor"/><path d="M3 21a9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    calculer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor"/><path d="M12 7v5" stroke="currentColor" stroke-width="2"/></svg>',
    depenses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor"/><rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor"/><rect x="17" y="2" width="4" height="19" rx="1" fill="currentColor"/></svg>',
    simuler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10 17 18.5H7Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" rx="1" fill="#F5B400" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="9" width="4" height="6.5" rx="1" fill="#D9302A" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="15" width="4" height="6.5" rx="1" fill="#1D4E89" stroke="currentColor" stroke-width="1.5"/></svg>',
    cadenas: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['profil', 'Profil'], ['calculer', 'Calculer'], ['depenses', 'Dépenses'], ['bilan', 'Bilan'], ['simuler', 'Simuler']];
  const TITRES = { profil: 'Profil', calculer: 'Calculer', depenses: 'Dépenses', bilan: 'Bilan', simuler: 'Simuler' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    const bandeau = session.demo
      ? '<div class="bandeau-demo"><div><b>Exemple complet</b><a class="bientot-demo" href="/catalogue/temps-de-vie/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer l\'exemple</button><button data-action="deconnexion">J\'ai une clé</button></div></div>'
      : session.decouverte ? `<div class="bandeau-demo"><div><b>Découverte gratuite</b><span>${pluriel(B.decouverte.maxDepenses, 'dépense')} au plus, sur cet appareil.</span><a href="${PAGE_OFFRE}">Application complète · ${PRIX}</a><button data-action="deconnexion">J'ai une clé</button></div></div>` : '';
    $('#racine').innerHTML = `${bandeau}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Temps<br>de vie</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, export et confidentialité" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : session.decouverte ? 'decouverte' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }
  const VUES = { profil: () => vueProfil(), calculer: () => vueCalculer(), depenses: () => vueDepenses(), bilan: () => vueBilan(), simuler: () => vueSimuler() };
  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${TITRES[vue]} · Temps de vie`;
    $('#vue').innerHTML = VUES[vue]() + piedApp();
  }
  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  // Rappel de la convention et des hypothèses, affiché sur chaque vue de calcul.
  function bandeauConvention() {
    const t = taux();
    const hyp = t.profil.hypotheses;
    return `<div class="convention-rappel"><span class="etiquette ciel">Convention ${conv().num}</span><span><b>${esc(conv().nom)}</b> · revenu net estimé à <b class="sensible">${eurosPrecis(t.horaire)}</b> par heure · ${heures(t.heuresParJour)} par jour${hyp.length ? ` · <span class="hyp">${hyp.length} hypothèse${hyp.length > 1 ? 's' : ''} par défaut</span>` : ''}</span>
      <button class="lien-pied" data-action="vue" data-vue="profil">modifier</button></div>`;
  }
  function piedApp() {
    return `<footer class="pied-app"><p><b>Équivalence monétaire et temporelle.</b> Les durées indiquent combien d'heures de revenu net représente une dépense, pas le temps que tu as réellement passé à travailler pour elle. Le revenu horaire est une estimation calculée à partir de tes saisies, pas un salaire horaire contractuel.</p>
      <p>Aucun barème fiscal ni taux de prélèvement n'est intégré : tous les montants sont les tiens. Outil d'aide à la réflexion : il ne constitue pas un conseil financier, fiscal ou professionnel. Base QME version ${esc(B.version)}.</p></footer>`;
  }
  const verrou = (titre, texte) => `<div class="verrou"><div class="verrou-forme" aria-hidden="true">${ICONES.cadenas}</div><div><p class="surtitre">Application complète · ${PRIX}, achat unique</p><h2>${titre}</h2><p>${texte}</p>
    <div class="rang"><a class="btn primaire" href="${PAGE_OFFRE}">Découvrir l'application complète</a><button class="btn" data-action="demo-voir">Voir dans l'exemple</button></div></div></div>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" rx="8" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, action) => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${action ? `<div class="actions">${action}</div>` : ''}</div></div>`;
  function barres(items, libelle) {
    const m = Math.max(1e-9, ...items.map((i) => i.valeur));
    return `<ul class="barres" aria-label="${esc(libelle)}">${items.map((i) => `<li><span class="barres-nom">${esc(i.nom)}</span><span class="barres-piste"><span class="barres-val" style="width:${Math.max(0.5, i.valeur / m * 100).toFixed(1)}%"></span></span><span class="barres-txt">${i.texte}</span></li>`).join('')}</ul>`;
  }

  // ---------- Vue : profil ----------
  function vueProfil() {
    const p = E.profil, d = B.defauts;
    const ch = (cle, lib, aide, unite = '', ph = '') => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}${unite ? `<span class="avec-unite"><input data-profil="${cle}" inputmode="decimal" value="${esc(champNombre(p[cle]))}" placeholder="${esc(ph)}"><span>${unite}</span></span>` : `<input data-profil="${cle}" inputmode="decimal" value="${esc(champNombre(p[cle]))}" placeholder="${esc(ph)}">`}</label>`;
    return `<div class="vue-tete"><div><h1>Ton revenu et ton temps</h1><p>Renseigne ce que tu connais : les champs vides prennent une valeur par défaut, signalée comme hypothèse.</p></div></div>
      <div class="edition">
        <div class="formulaire">
          <div class="bloc"><div class="bloc-titre"><span class="num">1</span>Situation et revenu</div>
            <fieldset class="segmente champ"><legend>Situation</legend>${B.profils.map((x) => `<label><input type="radio" name="type" data-profil="type" value="${x.id}" ${p.type === x.id ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</fieldset>
            <p class="note">${esc(B.profils.find((x) => x.id === p.type)?.aide || '')}</p>
            <div class="grille-champs">
              ${ch('revenuMensuel', 'Revenu mensuel net', 'Moyenne de ce que tu touches par mois.', '€')}
              ${ch('revenuAnnuel', 'Revenu annuel net', 'Facultatif. Prioritaire s\'il est saisi (primes, 13e mois, mois sans revenu).', '€')}
              ${ch('fraisPro', 'Dépenses professionnelles', 'Facultatif, par mois : retirées du revenu en convention 2.', '€/mois', '0')}
            </div>
          </div>
          <div class="bloc"><div class="bloc-titre"><span class="num">2</span>Temps de travail</div>
            <div class="grille-champs">
              ${ch('heuresSemaine', 'Heures par semaine', '', 'h', String(d.heuresSemaine))}
              ${ch('joursSemaine', 'Jours par semaine', '', 'j', String(d.joursSemaine))}
              ${ch('moisTravailles', 'Mois travaillés par an', 'Saisonnier, contrat court…', 'mois', String(d.moisTravailles))}
              ${ch('conges', 'Congés par an', 'En jours ouvrés.', 'j', String(d.conges))}
              ${ch('nonTravailles', 'Autres jours non travaillés', 'Jours fériés en semaine, RTT, absences.', 'j', String(d.nonTravailles))}
              ${ch('trajetMinutes', 'Trajet domicile-travail', 'Facultatif, aller et retour, par jour travaillé.', 'min', '0')}
            </div>
            <label class="case"><input type="checkbox" data-profil="inclureTransport" ${p.inclureTransport ? 'checked' : ''}> Compter le trajet dans le temps réellement consacré au travail (convention 2)</label>
          </div>
          <div class="bloc"><div class="bloc-titre"><span class="num">3</span>Convention de calcul</div>
            <div class="statuts">${B.conventions.map((c) => `<label class="statut-choix"><input type="radio" name="convention" data-profil="convention" value="${c.id}" ${E.convention === c.id ? 'checked' : ''}><span><b>${c.num} · ${esc(c.nom)}</b><small>${esc(c.detail)}</small><em data-conv="${c.id}">${eurosPrecis(taux(c.id).horaire || 0)} / h</em></span></label>`).join('')}</div>
          </div>
        </div>
        <aside class="synthese" id="synthese-profil">${syntheseProfil()}</aside>
      </div>`;
  }
  function syntheseProfil() {
    const t = taux();
    if (!t.horaire) return `<p class="surtitre">Résultat</p><p class="synthese-alerte">${t.negatif ? 'Tes dépenses professionnelles dépassent ton revenu : le calcul est impossible dans cette convention.' : 'Indique ton revenu net pour obtenir ton revenu horaire.'}</p>`;
    const p = t.profil;
    const nomsHyp = { moisTravailles: `${p.moisTravailles} mois travaillés`, heuresSemaine: `${p.heuresSemaine} h par semaine`, joursSemaine: `${p.joursSemaine} jours par semaine`, conges: `${p.conges} jours de congés`, nonTravailles: `${p.nonTravailles} jours non travaillés`, trajetMinutes: 'aucun trajet', fraisPro: 'aucune dépense professionnelle' };
    return `<p class="surtitre">Convention ${conv().num} · ${esc(conv().court)}</p>
      <div class="synthese-tjm conseille"><span>Revenu net par heure</span><b>${eurosPrecis(t.horaire)}</b></div>
      <dl class="synthese-liste">
        <div><dt>Par jour</dt><dd>${eurosPrecis(t.journalier)}</dd></div>
        <div><dt>Par semaine</dt><dd>${euros(t.hebdomadaire)}</dd></div>
        <div><dt>Par mois</dt><dd>${euros(t.mensuel)}</dd></div>
        <div><dt>Revenu annuel retenu</dt><dd>${euros(t.revenuAnnuel)}</dd></div>
        <div><dt>Heures par an</dt><dd>${NF.format(Math.round(t.heuresAn))} h${t.heuresTransport ? ` <small>dont ${NF.format(Math.round(t.heuresTransport))} h de trajet</small>` : ''}</dd></div>
        <div><dt>Jours par an</dt><dd>${NF.format(Math.round(t.joursAn))}</dd></div>
        <div><dt>Une journée</dt><dd>${heures(t.heuresParJour)}</dd></div>
      </dl>
      ${p.hypotheses.length ? `<p class="note"><b>Hypothèses par défaut :</b> ${p.hypotheses.map((h) => nomsHyp[h]).join(', ')}.</p>` : '<p class="note">Aucune hypothèse par défaut : tout vient de ta saisie.</p>'}
      <p class="note">${t.sourceRevenu === 'annuel' ? 'Revenu annuel saisi.' : 'Revenu annuel = revenu mensuel × 12.'} Le temps de trajet${E.convention === 'reel' && t.heuresTransport ? ' est compté à part dans les heures, jamais payé' : ' n\'est pas compté dans cette convention'}.</p>`;
  }
  function appliquerProfil(el) {
    const cle = el.dataset.profil;
    if (cle === 'convention') { E.convention = el.value; return; }
    if (cle === 'type') { E.profil.type = el.value; return; }
    if (cle === 'inclureTransport') { E.profil.inclureTransport = el.checked; return; }
    const n = lireNombre(el.value);
    E.profil[cle] = n === null || n < 0 ? null : n;
  }

  // ---------- Vue : calculateur instantané ----------
  function vueCalculer() {
    const c = E.calcul;
    return `<div class="vue-tete"><div><h1>Combien de temps de travail ?</h1><p>Saisis n'importe quelle dépense : le résultat s'affiche en heures, jours et semaines de travail.</p></div></div>
      ${bandeauConvention()}
      <div class="calculateur">
        <div class="bloc">
          <div class="saisie-montant">
            <label class="champ grand">Montant<span class="avec-unite"><input id="calc-montant" data-calc="montant" inputmode="decimal" value="${esc(champNombre(c.montant))}" placeholder="0" autocomplete="off"><span>€</span></span></label>
            <label class="champ">Fréquence<select data-calc="periode">${B.periodicites.map((p) => `<option value="${p.id}" ${c.periode === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}</select></label>
          </div>
          <label class="champ">Libellé <small>Facultatif.</small><input data-calc="libelle" maxlength="60" value="${esc(c.libelle)}" placeholder="Ex. : Nouveau téléphone"></label>
          <div><p class="surtitre" style="margin:6px 0 8px">Exemples fictifs</p><div class="puces">${B.exemples.map((x, i) => `<button class="puce" data-action="exemple" data-i="${i}">${esc(x.libelle)} · ${euros(x.montant)}${per(x.periode).court}</button>`).join('')}</div></div>
        </div>
        <div class="resultat-calc" id="resultat-calc" aria-live="polite">${resultatCalcul()}</div>
      </div>`;
  }
  function resultatCalcul() {
    const c = E.calcul;
    const t = taux();
    const r = C.instantane(c.montant, c.periode, t, B.periodicites);
    if (!r || !(c.montant > 0)) return '<div class="vide-calc"><p>Entre un montant pour voir ce qu\'il représente en temps de travail.</p></div>';
    const u = r.unite;
    const tuiles = (x) => `<div class="temps"><div class="temps-fort"><b>${heures(x.heures)}</b><span>de travail</span></div><div><b>${jours(x.jours)}</b><span>de travail</span></div><div><b>${semaines(x.semaines)}</b><span>de travail</span></div>${x.mois >= 0.5 ? `<div><b>${mois(x.mois)}</b><span>de travail</span></div>` : ''}</div>`;
    return `<p class="surtitre">${esc(c.libelle || 'Cette dépense')} · ${eurosPrecis(c.montant)}${per(c.periode).court}</p>
      ${tuiles(u)}
      ${r.recurrent ? `<h3 class="titre-recurrent">Dépense récurrente : le temps cumulé</h3>
        <div class="defile"><table class="tableau"><thead><tr><th>Sur</th><th class="nb">Montant</th><th class="nb">Heures</th><th class="nb">Jours de travail</th></tr></thead><tbody>
          <tr><td>Un mois</td><td class="nb">${euros(r.mensuel.montant)}</td><td class="nb">${heures(r.mensuel.heures)}</td><td class="nb">${jours(r.mensuel.jours)}</td></tr>
          <tr class="total"><td>Un an</td><td class="nb">${euros(r.annuel.montant)}</td><td class="nb">${heures(r.annuel.heures)}</td><td class="nb">${jours(r.annuel.jours)}</td></tr>
          <tr><td>Cinq ans</td><td class="nb">${euros(r.cinqAns.montant)}</td><td class="nb">${heures(r.cinqAns.heures)}</td><td class="nb">${jours(r.cinqAns.jours)}</td></tr>
          <tr><td>Dix ans</td><td class="nb">${euros(r.dixAns.montant)}</td><td class="nb">${heures(r.dixAns.heures)}</td><td class="nb">${jours(r.dixAns.jours)}</td></tr>
        </tbody></table></div>
        <p class="phrase">Sur dix ans, cette dépense représente <mark>${semaines(r.dixAns.semaines)}</mark> de travail.</p>`
      : `<p class="phrase">${u.jours >= 1 ? `Il te faut travailler <mark>${jours(u.jours)}</mark> pour la financer.` : `Il te faut travailler <mark>${heures(u.heures)}</mark> pour la financer.`}</p>`}
      <div class="rang"><button class="btn primaire" data-action="calc-enregistrer">${c.periode === 'unique' ? 'Ajouter à mon historique d\'achats' : 'Ajouter à mes dépenses récurrentes'}</button><button class="btn" data-action="calc-scenario">Comparer à moins cher</button></div>`;
  }

  // ---------- Vue : dépenses (bibliothèque, récurrentes, historique) ----------
  const peutAjouter = () => !session.decouverte || E.depenses.length < B.decouverte.maxDepenses;
  function limiteAtteinte() {
    ouvrirModale('Limite de la découverte', `<p>La découverte gratuite garde <b>${B.decouverte.maxDepenses} dépenses</b> au plus. Le calculateur instantané reste illimité.</p>
      <p>L'application complète (${PRIX}, achat unique, sans abonnement) ouvre la bibliothèque complète, les dépenses récurrentes sans limite, l'historique des achats, le comparateur de scénarios, le coût de possession, les exports et le rapport imprimable. Ton profil et tes dépenses pourront y être repris.</p>`,
    `<a class="btn primaire" href="${PAGE_OFFRE}">Voir l'application complète</a><button class="btn" value="annuler">Fermer</button>`);
  }
  function vueDepenses() {
    const t = taux();
    const rec = E.depenses.filter((d) => d.periode !== 'unique');
    const pon = E.depenses.filter((d) => d.periode === 'unique').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const bib = bibliotheque();
    const ligne = (d) => {
      const c = C.convertir(d.montant, t);
      const a = C.annuel(d.montant, d.periode, B.periodicites);
      const h = a !== null ? C.convertir(a / 12, t) : null;
      return `<li class="depense${d.actif === false ? ' inactive' : ''}"><button class="depense-corps" data-action="depense" data-id="${d.id}">
        <span class="dep-nom"><b>${esc(d.libelle)}</b><small>${esc(categorie(d.categorie).nom)}${d.sousCategorie ? ` · ${esc(sousNom(d.categorie, d.sousCategorie))}` : ''}${d.actif === false ? ' · inactive' : ''}</small></span>
        <span class="dep-montant">${eurosPrecis(d.montant)}<small>${per(d.periode).court || fmtDate(d.date)}</small></span>
        <span class="dep-temps"><b>${heures(c?.heures)}</b><small>${h ? `${heures(h.heures)} par mois` : d.horaireAuMoment ? `au taux de l'époque : ${heures(d.montant / d.horaireAuMoment)}` : 'de travail'}</small></span>
      </button><button class="btn-suppr" data-action="dep-suppr" data-id="${d.id}" aria-label="Supprimer ${esc(d.libelle)}">×</button></li>`;
    };
    const limite = session.decouverte ? `<p class="aide">Découverte gratuite : ${E.depenses.length} / ${B.decouverte.maxDepenses} dépenses. <a href="${PAGE_OFFRE}">Sans limite avec l'application complète</a>.</p>` : '';
    return `<div class="vue-tete"><div><h1>Tes dépenses</h1><p>Dépenses récurrentes et historique de tes achats, convertis en temps de travail.</p></div>
      <div class="actions">${complet() ? '<button class="btn" data-action="bibliotheque">Gérer la bibliothèque</button><button class="btn" data-action="csv">CSV</button>' : ''}<button class="btn primaire" data-action="dep-ajout">Ajouter une dépense</button></div></div>
      ${bandeauConvention()}${limite}
      <details class="exemples bibliotheque" ${E.depenses.length ? '' : 'open'}><summary>Ajouter depuis la bibliothèque</summary>
        ${bib.map((c) => `<div class="sous"><b>${esc(c.nom)}</b><div class="puces">${complet() ? c.sous.map((s) => `<button class="puce" data-action="dep-ajout" data-cat="${c.id}" data-sous="${s.id}">+ ${esc(s.nom)}</button>`).join('') : `<button class="puce" data-action="dep-ajout" data-cat="${c.id}">+ ${esc(c.nom)}</button>`}</div></div>`).join('')}
        ${complet() ? '' : '<p class="note">Les sous-catégories et les catégories personnelles sont dans l\'application complète.</p>'}
      </details>
      <h2 class="titre-section">Dépenses récurrentes <span>${rec.length ? `${euros(rec.filter((d) => d.actif !== false).reduce((s, d) => s + C.annuel(d.montant, d.periode, B.periodicites), 0) / 12)} par mois` : ''}</span></h2>
      ${rec.length ? `<ul class="depenses">${rec.map(ligne).join('')}</ul>` : '<p class="vide-court">Aucune dépense récurrente : loyer, courses, abonnements…</p>'}
      <h2 class="titre-section">Historique des achats <span>dépenses ponctuelles, les plus récentes en premier</span></h2>
      ${pon.length ? `<ul class="depenses">${pon.map(ligne).join('')}</ul>` : '<p class="vide-court">Aucun achat enregistré.</p>'}`;
  }
  function modaleDepense(id, pre = {}) {
    const d = id ? E.depenses.find((x) => x.id === id) : null;
    if (!d && !peutAjouter()) return limiteAtteinte();
    const bib = bibliotheque();
    const sous = pre.sous ? categorie(pre.cat).sous.find((s) => s.id === pre.sous) : null;
    const v = d || { libelle: pre.libelle || sous?.nom || '', categorie: pre.cat || 'logement', sousCategorie: pre.sous || null, montant: pre.montant ?? null, periode: pre.periode || sous?.periode || 'mois', date: auj(), actif: true, note: '' };
    const optSous = (cid, choix) => `<option value="">—</option>${categorie(cid).sous.map((s) => `<option value="${s.id}" ${s.id === choix ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}`;
    const corps = `
      <label class="champ">Libellé<input name="libelle" required maxlength="60" value="${esc(v.libelle)}"></label>
      <div class="grille-2">
        <label class="champ">Montant<span class="avec-unite"><input name="montant" inputmode="decimal" value="${esc(champNombre(v.montant))}" required><span>€</span></span></label>
        <label class="champ">Fréquence<select name="periode">${B.periodicites.map((p) => `<option value="${p.id}" ${v.periode === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select name="categorie">${bib.map((c) => `<option value="${c.id}" ${v.categorie === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        ${complet() ? `<label class="champ">Sous-catégorie<select name="sousCategorie">${optSous(v.categorie, v.sousCategorie)}</select></label>` : ''}
        <label class="champ">Date <small>D'achat, ou de début.</small><input name="date" type="date" max="${auj()}" value="${esc(v.date)}"></label>
      </div>
      <label class="case"><input type="checkbox" name="actif" ${v.actif !== false ? 'checked' : ''}> Dépense en cours (décoche une dépense arrêtée pour la garder en mémoire sans la compter)</label>
      <label class="champ">Note <small>Facultatif.</small><textarea name="note" maxlength="300">${esc(v.note)}</textarea></label>
      <div class="apercu" id="apercu-dep" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    const pied = d ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(d ? 'Modifier la dépense' : 'Ajouter une dépense', corps, pied, (f, action) => {
      if (action === 'supprimer') { supprimerDepense(d.id); return; }
      const m = lireNombre(f.get('montant'));
      const lib = String(f.get('libelle') || '').trim();
      if (!lib) return 'Indique un libellé.';
      if (m === null || m <= 0) return 'Indique un montant positif.';
      const val = { libelle: lib, montant: m, periode: f.get('periode'), categorie: f.get('categorie'), sousCategorie: f.get('sousCategorie') || null, date: f.get('date') || auj(), actif: !!f.get('actif'), note: String(f.get('note') || '').trim() };
      if (d) { Object.assign(d, val); sauver(); rendre(); toast('Dépense enregistrée.'); return; }
      ajouterDepense(val);
    });
    const form = modale().querySelector('form');
    const apercu = () => {
      const m = lireNombre(form.elements.montant.value);
      const r = C.instantane(m, form.elements.periode.value, taux(), B.periodicites);
      $('#apercu-dep').innerHTML = r && m > 0 ? `<div><small>Une fois</small><b>${heures(r.unite.heures)}</b></div>${r.recurrent ? `<div><small>Par mois</small><b>${heures(r.mensuel.heures)}</b></div><div><small>Par an</small><b>${jours(r.annuel.jours)}</b></div>` : `<div><small>Jours</small><b>${jours(r.unite.jours)}</b></div><div><small>Semaines</small><b>${semaines(r.unite.semaines)}</b></div>`}` : '<p>Saisis un montant pour voir le temps de travail.</p>';
    };
    form.addEventListener('input', apercu);
    form.elements.categorie.addEventListener('change', (e) => { if (form.elements.sousCategorie) form.elements.sousCategorie.innerHTML = optSous(e.target.value, null); });
    form.elements.sousCategorie?.addEventListener('change', (e) => { const s = categorie(form.elements.categorie.value).sous.find((x) => x.id === e.target.value); if (s && !form.elements.libelle.value) form.elements.libelle.value = s.nom; if (s && !d) { form.elements.periode.value = s.periode || 'mois'; apercu(); } });
    apercu();
  }
  function ajouterDepense(val) {
    if (!peutAjouter()) return limiteAtteinte();
    const t = taux();
    const n = { id: uid(), ...val, horaireAuMoment: t.horaire ? Math.round(t.horaire * 100) / 100 : null };
    E.depenses.push(n);
    annulation = () => { E.depenses = E.depenses.filter((x) => x.id !== n.id); };
    sauver(); rendre();
    toast(`« ${n.libelle} » ajouté.`, { libelle: 'Annuler', faire: annuler });
  }
  function supprimerDepense(id) {
    const i = E.depenses.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [d] = E.depenses.splice(i, 1);
    annulation = () => { E.depenses.splice(i, 0, d); };
    if (modale().open) modale().close();
    sauver(); rendre();
    toast(`« ${d.libelle} » supprimé.`, { libelle: 'Annuler', faire: annuler });
  }
  function modaleBibliotheque() {
    const bib = bibliotheque();
    const persos = [...E.categoriesPerso.map((c) => ({ type: 'cat', id: c.id, nom: c.nom, parent: '' })),
      ...Object.entries(E.sousPerso || {}).flatMap(([cid, l]) => l.map((s) => ({ type: 'sous', id: s.id, nom: s.nom, parent: cid })))];
    ouvrirModale('Bibliothèque des dépenses', `<p>La bibliothèque intégrée compte ${B.categories.length} catégories et ${B.categories.reduce((s, c) => s + c.sous.length, 0)} sous-catégories. Complète-la avec les tiennes.</p>
      <div class="grille-2">
        <label class="champ">Nouvelle sous-catégorie<input name="sous" maxlength="40" placeholder="Ex. : Croquettes du chat"></label>
        <label class="champ">dans la catégorie<select name="parent">${bib.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">ou nouvelle catégorie<input name="cat" maxlength="40" placeholder="Ex. : Animaux"></label>
      <p class="erreur" role="alert"></p>
      ${persos.length ? `<div class="groupe"><h3>Tes ajouts</h3><ul class="persos">${persos.map((x) => `<li><span>${esc(x.nom)}${x.parent ? ` <small>· ${esc(categorie(x.parent).nom)}</small>` : ' <small>· catégorie</small>'}</span><button type="button" class="btn-suppr" data-action="bib-suppr" data-type="${x.type}" data-id="${x.id}" data-parent="${x.parent}" aria-label="Supprimer ${esc(x.nom)}">×</button></li>`).join('')}</ul></div>` : ''}`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Fermer</button>', (f) => {
      const sous = String(f.get('sous') || '').trim(), cat = String(f.get('cat') || '').trim();
      if (!sous && !cat) return 'Saisis une sous-catégorie ou une catégorie.';
      if (cat) E.categoriesPerso.push({ id: `p-${uid()}`, nom: cat });
      if (sous) { const p = f.get('parent'); E.sousPerso[p] = [...(E.sousPerso[p] || []), { id: `p-${uid()}`, nom: sous, periode: 'mois' }]; }
      sauver(); rendre(); toast('Bibliothèque complétée.');
    });
  }

  // ---------- Vue : bilan du mode de vie ----------
  function vueBilan() {
    const t = taux();
    const m = mdv();
    if (!m.lignes.length) return `<div class="vue-tete"><div><h1>Ton mode de vie en temps</h1></div></div>${bandeauConvention()}
      ${vide('Aucune dépense à analyser', 'Ajoute tes dépenses récurrentes (logement, transport, alimentation, abonnements) et tes achats : le bilan les convertit en temps de travail.', '<button class="btn primaire" data-action="vue" data-vue="depenses">Ajouter mes dépenses</button>')}`;
    const cat = (id) => m.categories.find((c) => c.id === id);
    const meilleur = complet() ? E.scenarios.map((s) => ({ s, r: C.scenario(s, t, B.periodicites) })).sort((a, b) => b.r.annuelle - a.r.annuelle)[0] : null;
    const phrases = [];
    const ph = (c, texte) => { if (c) phrases.push(texte(c)); };
    ph(cat('logement'), (c) => `Ton logement représente <b>${heures(c.heuresMois)}</b> de travail par mois.`);
    ph(cat('mobilite'), (c) => `Ta mobilité représente <b>${jours(c.joursAn)}</b> de travail par an.`);
    const abos = m.lignes.filter((l) => ['abonnements', 'numerique'].includes(l.depense.sousCategorie));
    if (abos.length) phrases.push(`Tes abonnements représentent <b>${heures(abos.reduce((s, l) => s + l.annuel, 0) / 12 / t.horaire)}</b> de travail par mois.`);
    const resto = m.lignes.filter((l) => ['restaurants', 'livraison', 'repas-exterieur', 'cafes'].includes(l.depense.sousCategorie));
    if (resto.length) phrases.push(`Tes restaurants, cafés et repas livrés représentent <b>${jours(resto.reduce((s, l) => s + l.annuel, 0) / t.horaire / t.heuresParJour)}</b> de travail par an.`);
    phrases.push(`Ton train de vie représente <b>${heures(m.heuresSemaine)}</b> de travail par semaine.`);
    const tuile = (lib, v, txt, cls = '') => `<div class="tuile-chiffre ${cls}"><p class="surtitre">${lib}</p><b>${v}</b><span>${txt}</span></div>`;
    const detail = complet() ? `
      <h2 class="titre-section">Part de chaque catégorie <span>dans le temps nécessaire au financement de ton mode de vie</span></h2>
      ${barres(m.categories.map((c) => ({ nom: categorie(c.id).nom, valeur: c.annuel, texte: `${heures(c.heuresMois)}/mois <small>${pct(c.part)} · ${jours(c.joursAn)}/an</small>` })), 'Heures de travail par catégorie')}
      <details class="valeurs"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Catégorie</th><th class="nb">Par mois</th><th class="nb">Heures par mois</th><th class="nb">Heures par semaine</th><th class="nb">Jours par an</th><th class="nb">Part</th></tr></thead><tbody>
        ${m.categories.map((c) => `<tr><td>${esc(categorie(c.id).nom)}</td><td class="nb">${euros(c.mensuel)}</td><td class="nb">${heures(c.heuresMois)}</td><td class="nb">${heures(c.heuresSemaine)}</td><td class="nb">${jours(c.joursAn)}</td><td class="nb">${pct(c.part)}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="nb">${euros(m.mensuel)}</td><td class="nb">${heures(m.heuresMois)}</td><td class="nb">${heures(m.heuresSemaine)}</td><td class="nb">${jours(m.joursAn)}</td><td class="nb">100 %</td></tr></tbody></table></div></details>
      <h2 class="titre-section">Top 10 des dépenses les plus coûteuses en temps <span>sur un an</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Dépense</th><th>Catégorie</th><th class="nb">Coût annuel</th><th class="nb">Heures par an</th><th class="nb">Jours par an</th></tr></thead><tbody>
        ${m.top10.map((l) => `<tr><td><button class="lien-objet" data-action="depense" data-id="${l.depense.id}">${esc(l.depense.libelle)}</button> <small>${per(l.depense.periode).court || 'achat'}</small></td><td>${esc(categorie(l.depense.categorie).nom)}</td><td class="nb">${euros(l.annuel)}</td><td class="nb">${heures(l.heuresAn)}</td><td class="nb">${jours(l.heuresAn / t.heuresParJour)}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 class="titre-section">Temps potentiellement récupérable</h2>
      ${meilleur && meilleur.r.annuelle > 0 ? `<p class="phrase">Ton meilleur scénario, « ${esc(meilleur.s.nom)} », libérerait <mark>${heures(meilleur.r.heuresAn)}</mark> de travail par an, soit ${jours(meilleur.r.joursAn)}. <button class="lien-pied" data-action="vue" data-vue="simuler">Voir les scénarios</button></p>` : '<p class="vide-court">Aucun scénario d\'économie pour l\'instant. <button class="lien-pied" data-action="vue" data-vue="simuler">Créer un scénario</button></p>'}`
      : `<div class="hero-sec">${verrou('Analyse détaillée du mode de vie', 'Part de chaque catégorie, top 10 des dépenses les plus coûteuses en temps, temps récupérable grâce aux scénarios d\'économie, historique des achats, exports et rapport imprimable.')}</div>`;
    return `<div class="vue-tete"><div><h1>Ton mode de vie en temps</h1><p>Dépenses récurrentes en cours et achats des douze derniers mois, convertis en temps de travail.</p></div>
      <div class="actions"><button class="btn" data-action="partager">Partager le résultat</button>${complet() ? '<button class="btn" data-action="exporter">JSON</button><button class="btn primaire" data-action="imprimer">Rapport imprimable</button>' : ''}</div></div>
      ${bandeauConvention()}
      <div class="hero">
        ${tuile('Ton train de vie', `${heures(m.heuresSemaine)}`, 'de travail par semaine', 'fort')}
        ${tuile('Sur une année', jours(m.joursAn), `de travail · ${euros(m.total)}`, 'jaune')}
        ${tuile('Catégorie la plus coûteuse', esc(categorie(m.premiere.id).nom), `${heures(m.premiere.heuresMois)} par mois · ${pct(m.premiere.part)}`)}
        ${tuile('Part de ton temps de travail', pct(m.partDuTravail), m.partDuTravail > 1 ? 'tes dépenses dépassent ton revenu' : 'consacrée à financer ces dépenses', m.partDuTravail > 1 ? 'rose' : '')}
      </div>
      <ul class="phrases">${phrases.map((p) => `<li>${p}</li>`).join('')}</ul>
      ${detail}`;
  }

  // ---------- Vue : simulateur (scénarios A/B/C et coût de possession) ----------
  function vueSimuler() {
    if (!complet()) return `<div class="vue-tete"><div><h1>Simuler tes choix</h1></div></div>
      ${verrou('Comparateur de scénarios et coût réel d\'un achat', 'Compare jusqu\'à trois scénarios (voiture moins chère, loyer, restaurants, abonnements) en économies mensuelles, annuelles et en heures de travail sur plusieurs années, et calcule le coût total de possession d\'un achat pour comparer deux options de prix et de durée différents.')}`;
    const t = taux();
    if (!E.scenarios.length) E.scenarios.push(scenarioVide(0));
    const res = E.scenarios.map((s) => ({ s, r: C.scenario(s, t, B.periodicites) }));
    return `<div class="vue-tete"><div><h1>Simuler tes choix</h1><p>Combien d'heures de travail une décision te ferait gagner ou perdre, aujourd'hui et sur plusieurs années.</p></div></div>
      ${bandeauConvention()}
      <h2 class="titre-section">Scénarios A, B, C <span>avant / après, en euros et en temps de travail</span></h2>
      <div class="scenarios">${res.map(({ s, r }, i) => carteScenario(s, r, i)).join('')}
        ${E.scenarios.length < MAX_SCENARIOS ? `<button class="scenario-ajout" data-action="sc-nouveau">+ Scénario ${LETTRES[E.scenarios.length]}</button>` : ''}</div>
      <h2 class="titre-section">Comparateur</h2>
      <div class="defile" id="comparateur">${comparateur(res)}</div>
      <h2 class="titre-section">Coût réel d'un achat <span>coût total de possession, revente déduite</span></h2>
      <p class="note" style="margin:-6px 0 12px">Compare deux achats de prix et de durées d'utilisation différents : le moins cher n'est pas toujours celui qui coûte le moins de temps par mois.</p>
      <div class="achats">${E.achats.map(carteAchat).join('')}${E.achats.length < MAX_ACHATS ? '<button class="scenario-ajout" data-action="achat-nouveau">+ Achat à évaluer</button>' : ''}</div>
      ${E.achats.length >= 2 ? `<div class="defile" id="comparateur-achats">${comparateurAchats()}</div>` : ''}`;
  }
  function carteScenario(s, r, i) {
    const ch = (l, cle, unite = '€') => `<span class="avec-unite"><input data-sc="${s.id}" data-ligne="${l.id}" data-cle="${cle}" inputmode="decimal" value="${esc(champNombre(l[cle]))}" aria-label="${cle}"><span>${unite}</span></span>`;
    return `<div class="scenario sc-${i}"><div class="scenario-tete"><input class="titre-scenario" data-sc="${s.id}" data-cle="nom" maxlength="40" value="${esc(s.nom)}" aria-label="Nom du scénario"><button type="button" class="btn-suppr" data-action="sc-suppr" data-id="${s.id}" aria-label="Supprimer le scénario">×</button></div>
      <ul class="lignes-sc">${s.lignes.map((l) => `<li>
        <input class="lib" data-sc="${s.id}" data-ligne="${l.id}" data-cle="libelle" maxlength="60" value="${esc(l.libelle)}" aria-label="Libellé">
        <div class="ligne-sc-chiffres"><label>Avant${ch(l, 'avant')}</label><label>Après${ch(l, 'apres')}</label>
        <label>Fréquence<select data-sc="${s.id}" data-ligne="${l.id}" data-cle="periode">${B.periodicites.map((p) => `<option value="${p.id}" ${l.periode === p.id ? 'selected' : ''}>${p.nom}</option>`).join('')}</select></label>
        ${l.periode === 'unique' ? `<label>Utilisé${ch(l, 'duree', 'ans')}</label>` : ''}
        <button type="button" class="btn-suppr" data-action="ligne-suppr" data-sc="${s.id}" data-id="${l.id}" aria-label="Retirer la ligne">×</button></div></li>`).join('')}</ul>
      <div class="rang"><button class="btn petit" data-action="ligne-ajout" data-id="${s.id}">+ Ligne</button>${E.depenses.length ? `<label class="champ compact"><span class="sr-only">Partir d'une dépense</span><select data-action-change="ligne-depuis" data-id="${s.id}"><option value="">Partir d'une dépense…</option>${E.depenses.filter((d) => d.actif !== false).map((d) => `<option value="${d.id}">${esc(d.libelle)} · ${eurosPrecis(d.montant)}${per(d.periode).court}</option>`).join('')}</select></label>` : ''}</div>
      <dl class="scenario-chiffres" id="res-${s.id}">${chiffresScenario(r)}</dl></div>`;
  }
  const signe = (n, f) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${f(Math.abs(n))}`;
  function chiffresScenario(r) {
    const c5 = r.cumuls.find((c) => c.annees === 5), c10 = r.cumuls.find((c) => c.annees === 10);
    return `<div class="fort"><dt>Économie par mois</dt><dd>${signe(r.mensuelle, euros)}</dd></div><div class="fort"><dt>Par an</dt><dd>${signe(r.annuelle, euros)}</dd></div>
      <div><dt>Heures de travail par an</dt><dd>${signe(r.heuresAn || 0, heures)}</dd></div><div><dt>Jours de travail par an</dt><dd>${signe(r.joursAn || 0, jours)}</dd></div>
      <div><dt>Cumul sur 5 ans</dt><dd>${signe(c5.montant, euros)}</dd></div><div><dt>Cumul sur 10 ans</dt><dd>${signe(c10.montant, euros)}</dd></div>`;
  }
  function comparateur(res) {
    const t = taux();
    const ligne = (lib, f) => `<tr><td>${lib}</td>${res.map(({ r }) => `<td class="nb">${f(r)}</td>`).join('')}</tr>`;
    const meilleur = Math.max(...res.map(({ r }) => r.annuelle));
    return `<table class="tableau"><thead><tr><th></th>${res.map(({ s }) => `<th class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead><tbody>
      ${ligne('Économie mensuelle', (r) => signe(r.mensuelle, euros))}
      ${ligne('Économie annuelle', (r) => `<b ${r.annuelle === meilleur && meilleur > 0 ? 'class="meilleur"' : ''}>${signe(r.annuelle, euros)}</b>`)}
      ${ligne('Heures de travail économisées par an', (r) => signe(r.heuresAn || 0, heures))}
      ${ligne('Jours de travail économisés par an', (r) => signe(r.joursAn || 0, jours))}
      ${[1, 3, 5, 10].map((n) => ligne(`Cumul sur ${pluriel(n, 'an')}`, (r) => { const c = r.cumuls.find((x) => x.annees === n); return `${signe(c.montant, euros)} <small>${signe(c.heures || 0, heures)}</small>`; })).join('')}
    </tbody></table><p class="note">Achat unique : l'écart de prix est réparti sur sa durée d'utilisation (amortissement linéaire), pour l'économie annuelle comme pour les cumuls. Convention ${conv().num} : ${eurosPrecis(t.horaire)} par heure.</p>`;
  }
  function carteAchat(a) {
    const r = C.possession(a, taux());
    const ch = (cle, lib, unite) => `<label class="champ compact-l">${lib}<span class="avec-unite"><input data-achat="${a.id}" data-cle="${cle}" inputmode="decimal" value="${esc(champNombre(a[cle]))}"><span>${unite}</span></span></label>`;
    return `<div class="achat"><div class="scenario-tete"><input class="titre-scenario" data-achat="${a.id}" data-cle="nom" maxlength="40" value="${esc(a.nom)}" aria-label="Nom de l'achat"><button type="button" class="btn-suppr" data-action="achat-suppr" data-id="${a.id}" aria-label="Supprimer l'achat">×</button></div>
      <div class="grille-achat">${ch('prix', 'Prix d\'achat', '€')}${ch('frais', 'Frais annexes', '€')}${ch('dureeMois', 'Durée de possession', 'mois')}${ch('entretienAn', 'Entretien', '€/an')}${ch('utilisationMois', 'Utilisation', '€/mois')}${ch('revente', 'Revente espérée', '€')}</div>
      <dl class="scenario-chiffres" id="tco-${a.id}">${chiffresAchat(r)}</dl></div>`;
  }
  const chiffresAchat = (r) => `<div class="fort"><dt>Coût par mois</dt><dd>${euros(r.mensuel)}</dd></div><div class="fort"><dt>Travail par mois</dt><dd>${heures(r.heuresMois)}</dd></div>
    <div><dt>Coût total</dt><dd>${euros(r.total)}</dd></div><div><dt>Net après revente</dt><dd>${euros(r.net)}</dd></div>
    <div><dt>Coût par jour</dt><dd>${eurosPrecis(r.journalier)}</dd></div><div><dt>Travail au total</dt><dd>${heures(r.heures)} · ${jours(r.jours)}</dd></div>`;
  function comparateurAchats() {
    const t = taux();
    const res = E.achats.map((a) => ({ a, r: C.possession(a, t) }));
    const min = Math.min(...res.map(({ r }) => r.mensuel));
    return `<table class="tableau"><thead><tr><th>Achat</th><th class="nb">Prix</th><th class="nb">Durée</th><th class="nb">Net après revente</th><th class="nb">Par mois</th><th class="nb">Travail par mois</th><th class="nb">Travail au total</th></tr></thead><tbody>
      ${res.map(({ a, r }) => `<tr><td>${esc(a.nom)}</td><td class="nb">${euros(r.prix)}</td><td class="nb">${mois(r.mois)}</td><td class="nb">${euros(r.net)}</td><td class="nb"><b ${r.mensuel === min ? 'class="meilleur"' : ''}>${euros(r.mensuel)}</b></td><td class="nb">${heures(r.heuresMois)}</td><td class="nb">${heures(r.heures)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  function majSimulateur() {
    const t = taux();
    for (const s of E.scenarios) { const el = $(`#res-${s.id}`); if (el) el.innerHTML = chiffresScenario(C.scenario(s, t, B.periodicites)); }
    for (const a of E.achats) { const el = $(`#tco-${a.id}`); if (el) el.innerHTML = chiffresAchat(C.possession(a, t)); }
    const cmp = $('#comparateur'); if (cmp) cmp.innerHTML = comparateur(E.scenarios.map((s) => ({ s, r: C.scenario(s, t, B.periodicites) })));
    const ca = $('#comparateur-achats'); if (ca) ca.innerHTML = comparateurAchats();
  }

  // ---------- Partage (choix des informations, texte et image) ----------
  function elementsPartage() {
    const t = taux(), m = mdv(), p = E.partage;
    const l = [];
    if (p.modeDeVie && m.lignes.length) l.push(['Mon train de vie représente', `${heures(m.heuresSemaine)} de travail par semaine`]);
    if (p.categorie && m.premiere) l.push(['Le poste qui me coûte le plus de temps', `${categorie(m.premiere.id).nom} : ${heures(m.premiere.heuresMois)} par mois`]);
    const lg = m.categories.find((c) => c.id === 'logement');
    if (p.logement && lg && m.premiere?.id !== 'logement') l.push(['Mon logement', `${heures(lg.heuresMois)} de travail par mois`]);
    if (p.economies && complet()) {
      const best = E.scenarios.map((s) => ({ s, r: C.scenario(s, t, B.periodicites) })).sort((a, b) => b.r.annuelle - a.r.annuelle)[0];
      if (best && best.r.annuelle > 0) l.push(['En changeant quelques habitudes', `je libérerais ${heures(best.r.heuresAn)} de travail par an`]);
    }
    if (p.horaire && t.horaire) l.push(['Mon revenu net horaire estimé', eurosPrecis(t.horaire)]);
    return l;
  }
  function textePartage() {
    const l = elementsPartage();
    if (!l.length) return 'Choisis au moins une information à partager.';
    return `${l.map(([a, b]) => `${a} : ${b}.`).join('\n')}\nÉquivalence en temps de travail calculée avec le calculateur Temps de vie QME (estimation, pas un conseil financier).`;
  }
  function modalePartage() {
    const p = E.partage;
    const ca = (cle, lib) => `<label class="case"><input type="checkbox" name="${cle}" ${p[cle] ? 'checked' : ''}> ${lib}</label>`;
    ouvrirModale('Partager le résultat', `<p>Rien n'est publié automatiquement et ton revenu n'apparaît pas, sauf si tu le choisis. Coche ce que tu veux montrer, puis copie le texte ou télécharge l'image.</p>
      <div class="cases">${ca('modeDeVie', 'Heures de travail par semaine pour mon train de vie')}${ca('categorie', 'Ma catégorie la plus coûteuse en temps')}${ca('logement', 'Le temps consacré à mon logement')}${complet() ? ca('economies', 'Le temps récupérable avec mon meilleur scénario') : ''}${ca('horaire', 'Mon revenu net horaire (donnée confidentielle)')}</div>
      <textarea class="apercu-texte" id="partage-texte" readonly rows="5"></textarea>
      <div class="rang"><button class="btn" type="button" data-action="copier">Copier le texte</button><button class="btn primaire" type="button" data-action="image">Télécharger l'image</button></div>`,
    '<button class="btn" value="annuler">Fermer</button>');
    const form = modale().querySelector('form');
    const maj = () => { for (const k of Object.keys(p)) if (form.elements[k]) p[k] = form.elements[k].checked; $('#partage-texte').value = textePartage(); };
    form.addEventListener('change', () => { maj(); sauver(); });
    maj();
  }
  async function copierTexte() {
    const t = $('#partage-texte')?.value || '';
    try { await navigator.clipboard.writeText(t); toast('Texte copié.'); } catch { $('#partage-texte').select(); toast('Sélectionne le texte et copie-le.'); }
  }
  async function imagePartage() {
    const l = elementsPartage();
    if (!l.length) return toast('Choisis au moins une information à partager.');
    const L = 1080, cv = document.createElement('canvas');
    cv.width = L; cv.height = L;
    const x = cv.getContext('2d');
    try { await document.fonts.ready; } catch { /* police système */ }
    const police = (taille, poids = 700) => `${poids} ${taille}px Outfit, system-ui, sans-serif`;
    x.fillStyle = '#FBF7F1'; x.fillRect(0, 0, L, L);
    x.fillStyle = '#FBEBC2'; x.beginPath(); x.arc(L - 150, 170, 240, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2E5A88'; x.beginPath(); x.moveTo(80, 144); x.lineTo(80, 80); x.arc(80, 144, 64, -Math.PI / 2, 0); x.closePath(); x.fill();
    x.fillStyle = '#24221F'; x.font = police(34, 600); x.fillText('Ce que me coûte mon mode de vie', 80, 230);
    let y = 330;
    for (const [a, b] of l.slice(0, 5)) {
      x.fillStyle = '#514C44'; x.font = police(28, 500); x.fillText(a, 80, y);
      x.fillStyle = '#24221F'; x.font = police(l.length > 3 ? 46 : 56, 800);
      x.fillText(b.length > 34 ? `${b.slice(0, 33)}…` : b, 80, y + (l.length > 3 ? 56 : 66));
      y += l.length > 3 ? 130 : 150;
    }
    x.fillStyle = '#6E685F'; x.font = police(22, 500); x.fillText('Équivalence en heures de travail, pas un conseil financier.', 80, L - 90);
    x.fillStyle = '#24221F'; x.font = police(24, 700); x.fillText('Temps de vie · QME', 80, L - 50);
    cv.toBlob((blob) => { telecharger(`mon-temps-de-vie-${auj()}.png`, blob); toast('Image téléchargée.'); }, 'image/png');
  }

  // ---------- Rapport imprimable ----------
  function imprimer() {
    const t = taux(), m = mdv();
    let zone = $('#impression');
    if (!zone) { zone = document.createElement('div'); zone.id = 'impression'; document.body.append(zone); }
    const p = t.profil;
    zone.innerHTML = `<h1>Temps de vie · rapport du ${fmtDate(auj())}</h1>
      <h2>Hypothèses de calcul</h2>
      <p>Convention ${conv().num} · ${esc(conv().nom)} : ${esc(conv().detail)}</p>
      <p>Revenu annuel net retenu ${euros(t.revenuAnnuel)} · ${NF.format(Math.round(t.heuresAn))} heures et ${NF.format(Math.round(t.joursAn))} jours par an · revenu net estimé ${eurosPrecis(t.horaire)} par heure, ${eurosPrecis(t.journalier)} par jour.</p>
      <p>${p.heuresSemaine} h par semaine sur ${p.joursSemaine} jours, ${p.moisTravailles} mois travaillés, ${p.conges} jours de congés, ${p.nonTravailles} autres jours non travaillés, trajet ${p.trajetMinutes} min par jour, dépenses professionnelles ${euros(p.fraisPro)} par mois.${p.hypotheses.length ? ` Valeurs par défaut utilisées : ${p.hypotheses.join(', ')}.` : ''}</p>
      <h2>Mode de vie</h2>
      <p>${euros(m.total)} par an, soit ${heures(m.heuresSemaine)} de travail par semaine, ${jours(m.joursAn)} par an (${pct(m.partDuTravail)} du temps de travail annuel).</p>
      <table><thead><tr><th>Catégorie</th><th>Par mois</th><th>Heures par mois</th><th>Jours par an</th><th>Part</th></tr></thead><tbody>
      ${m.categories.map((c) => `<tr><td>${esc(categorie(c.id).nom)}</td><td>${euros(c.mensuel)}</td><td>${heures(c.heuresMois)}</td><td>${jours(c.joursAn)}</td><td>${pct(c.part)}</td></tr>`).join('')}</tbody></table>
      <h2>Dépenses</h2><table><thead><tr><th>Dépense</th><th>Catégorie</th><th>Montant</th><th>Fréquence</th><th>Date</th><th>Heures</th></tr></thead><tbody>
      ${E.depenses.map((d) => `<tr><td>${esc(d.libelle)}${d.actif === false ? ' (inactive)' : ''}</td><td>${esc(categorie(d.categorie).nom)}</td><td>${eurosPrecis(d.montant)}</td><td>${per(d.periode).nom}</td><td>${fmtDate(d.date)}</td><td>${heures(C.convertir(d.montant, t)?.heures)}</td></tr>`).join('')}</tbody></table>
      <h2>Scénarios</h2><table><thead><tr><th>Scénario</th><th>Par mois</th><th>Par an</th><th>Heures par an</th><th>Cumul 10 ans</th></tr></thead><tbody>
      ${E.scenarios.map((s) => { const r = C.scenario(s, t, B.periodicites); return `<tr><td>${esc(s.nom)}</td><td>${euros(r.mensuelle)}</td><td>${euros(r.annuelle)}</td><td>${heures(r.heuresAn)}</td><td>${euros(r.cumuls.at(-1).montant)}</td></tr>`; }).join('')}</tbody></table>
      <h2>Coût de possession</h2><table><thead><tr><th>Achat</th><th>Net après revente</th><th>Par mois</th><th>Travail par mois</th></tr></thead><tbody>
      ${E.achats.map((a) => { const r = C.possession(a, t); return `<tr><td>${esc(a.nom)}</td><td>${euros(r.net)}</td><td>${euros(r.mensuel)}</td><td>${heures(r.heuresMois)}</td></tr>`; }).join('')}</tbody></table>
      <p>Les durées sont une équivalence monétaire et temporelle (montant ÷ revenu net horaire estimé), pas un temps réellement travaillé. Le revenu horaire est une estimation, pas un salaire contractuel. Ce rapport ne constitue pas un conseil financier, fiscal ou professionnel.</p>`;
    window.print();
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const lieu = session.demo ? 'En exemple, les données fictives restent dans ce navigateur.' : session.decouverte ? 'En découverte, tes données restent dans ce navigateur et ne sont jamais envoyées.' : 'Tes données sont enregistrées en ligne sous ta clé (connexion chiffrée), sans nom ni adresse, avec une copie sur cet appareil pour le hors ligne.';
    ouvrirModale('Réglages', `
      <div class="groupe"><h3>Export complet</h3><p class="aide">${lieu}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Copie complète (JSON)</button>${complet() ? '<button class="btn petit" type="button" data-action="csv">Dépenses (CSV)</button><button class="btn petit" type="button" data-action="imprimer">Rapport imprimable</button>' : ''}
        <label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Confidentialité</h3>
        <p class="aide">Seules les données utiles au calcul sont demandées : aucun nom, aucun employeur, aucune connexion bancaire. Ton revenu n'apparaît jamais dans un partage sans que tu le coches. Sur un appareil partagé, décoche « Rester connecté » à la connexion : la copie locale disparaît à la fermeture du navigateur.</p>
        <div class="rang"><button class="btn petit danger" type="button" data-action="tout-effacer">Effacer toutes mes données</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Exemple complet (données fictives).</p>' : session.decouverte ? `<p>Découverte gratuite. <a href="${PAGE_OFFRE}">Application complète · ${PRIX}</a></p>` : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter l\'exemple' : session.decouverte ? 'Quitter la découverte' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <p class="mention">Outil d'aide à la réflexion : il ne constitue pas un conseil financier, fiscal ou professionnel.</p>`,
    '<button class="btn primaire" value="ok">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!d.profil || !Array.isArray(d.depenses)) throw new Error();
        if (session.decouverte && d.depenses.length > B.decouverte.maxDepenses) { toast(`La découverte garde ${B.decouverte.maxDepenses} dépenses au plus : cette copie en contient ${d.depenses.length}.`); return; }
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.depenses.length, 'dépense')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du calculateur.'); }
    });
  }
  function toutEffacer() {
    if (!confirm(session.decouverte || session.demo ? 'Effacer toutes les données de ce navigateur ?' : 'Effacer ton profil et toutes tes dépenses, en ligne et sur cet appareil ? Pense à télécharger une copie avant : cette action est définitive.')) return;
    if (session.demo) { stock.suppr(CLE_DEMO); modale().close(); deconnecter(); return; }
    if (session.decouverte) { stock.suppr(CLE_DECOUVERTE); modale().close(); deconnecter(); return; }
    E = etatVide();
    modale().close(); sauver();
    toast('Toutes tes données ont été effacées.');
    ecranAccueil();
  }
  function exporter() { telecharger(`temps-de-vie-${auj()}.json`, JSON.stringify(E, null, 2), 'application/json'); toast('Copie téléchargée.'); }
  function exporterCSV() { telecharger(`temps-de-vie-depenses-${auj()}.csv`, C.csv(E.depenses, taux(), { categories: bibliotheque(), periodicites: B.periodicites }, auj()), 'text/csv;charset=utf-8'); toast('Fichier CSV téléchargé (séparateur point-virgule).'); }

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
    const blocs = a === 'ios' ? ETAPES_IOS : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
    const pied = auto ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>' : '<button class="btn primaire" value="ok">Fermer</button>';
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
  function annuler() {
    if (!annulation) return;
    annulation(); annulation = null;
    sauver(); rendre();
    toast('Modification annulée.');
  }

  // ---------- Actions ----------
  const scenarioDe = (id) => E.scenarios.find((s) => s.id === id);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-voir': if (confirm('Ouvrir l\'exemple complet ? Tes données de découverte restent enregistrées dans ce navigateur.')) ouvrirDemo(); break;
      case 'decouverte': ouvrirDecouverte(); break;
      case 'demo-reinit': if (confirm('Effacer les données de l\'exemple et repartir de zéro ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': deconnecter(); break;
      case 'a-type': accueil.type = id; document.querySelectorAll('[data-action="a-type"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'reprendre-essai': reprendreEssai(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': if (complet()) exporterCSV(); break;
      case 'imprimer': if (complet()) { if (modale().open) modale().close(); imprimer(); } break;
      case 'tout-effacer': toutEffacer(); break;
      case 'fermer': modale().close(); break;
      case 'exemple': { const x = B.exemples[Number(el.dataset.i)]; E.calcul = { montant: x.montant, periode: x.periode, libelle: x.libelle, categorie: x.categorie, sous: x.sous }; sauver(); rendre(); break; }
      case 'calc-enregistrer': {
        const c = E.calcul;
        const ex = B.exemples.find((x) => x.libelle === c.libelle);
        modaleDepense(null, { libelle: c.libelle || '', montant: c.montant, periode: c.periode, cat: c.categorie || ex?.categorie || 'equipement', sous: complet() ? (c.sous || ex?.sous) : null });
        break;
      }
      case 'calc-scenario': {
        if (!complet()) { changerVue('simuler'); break; }
        if (!E.scenarios.length) E.scenarios.push(scenarioVide(0));
        const s = E.scenarios.at(-1);
        const c = E.calcul;
        s.lignes.push({ id: uid(), libelle: c.libelle || 'Dépense', avant: c.montant, apres: Math.round(c.montant * 0.6), periode: c.periode, duree: 3 });
        sauver(); changerVue('simuler'); toast(`Ajouté à « ${s.nom} » : ajuste le montant « après ».`); break;
      }
      case 'dep-ajout': modaleDepense(null, { cat: el.dataset.cat, sous: el.dataset.sous }); break;
      case 'depense': modaleDepense(id); break;
      case 'dep-suppr': supprimerDepense(id); break;
      case 'bibliotheque': modaleBibliotheque(); break;
      case 'bib-suppr': {
        if (el.dataset.type === 'cat') { E.categoriesPerso = E.categoriesPerso.filter((c) => c.id !== id); delete E.sousPerso[id]; }
        else E.sousPerso[el.dataset.parent] = (E.sousPerso[el.dataset.parent] || []).filter((s) => s.id !== id);
        sauver(); modale().close(); rendre(); modaleBibliotheque(); break;
      }
      case 'partager': if (!mdv().lignes.length && !taux().horaire) toast('Ajoute d\'abord tes dépenses.'); else modalePartage(); break;
      case 'copier': copierTexte(); break;
      case 'image': imagePartage(); break;
      case 'sc-nouveau': if (E.scenarios.length < MAX_SCENARIOS) { E.scenarios.push(scenarioVide(E.scenarios.length)); sauver(); rendre(); } break;
      case 'sc-suppr': {
        const i = E.scenarios.findIndex((s) => s.id === id); if (i < 0) break;
        const [s] = E.scenarios.splice(i, 1);
        annulation = () => { E.scenarios.splice(i, 0, s); };
        sauver(); rendre(); toast(`« ${s.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'ligne-ajout': { const s = scenarioDe(id); s.lignes.push({ id: uid(), libelle: 'Dépense', avant: null, apres: null, periode: 'mois', duree: 3 }); sauver(); rendre(); break; }
      case 'ligne-suppr': { const s = scenarioDe(el.dataset.sc); s.lignes = s.lignes.filter((l) => l.id !== id); sauver(); rendre(); break; }
      case 'achat-nouveau': if (E.achats.length < MAX_ACHATS) { E.achats.push({ id: uid(), nom: `Achat ${E.achats.length + 1}`, prix: null, frais: null, dureeMois: 36, entretienAn: null, utilisationMois: null, revente: null }); sauver(); rendre(); } break;
      case 'achat-suppr': {
        const i = E.achats.findIndex((a) => a.id === id); if (i < 0) break;
        const [a] = E.achats.splice(i, 1);
        annulation = () => { E.achats.splice(i, 0, a); };
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); break;
      }
      default: break;
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!E) return;
    if (el.dataset.profil && el.type !== 'radio' && el.type !== 'checkbox') { appliquerProfil(el); sauver(); $('#synthese-profil').innerHTML = syntheseProfil(); document.querySelectorAll('[data-conv]').forEach((x) => { x.textContent = `${eurosPrecis(taux(x.dataset.conv).horaire || 0)} / h`; }); return; }
    if (el.dataset.calc && el.tagName !== 'SELECT') { E.calcul[el.dataset.calc] = el.dataset.calc === 'montant' ? lireNombre(el.value) : el.value; sauver(); $('#resultat-calc').innerHTML = resultatCalcul(); return; }
    if (el.dataset.sc && el.tagName !== 'SELECT') {
      const s = scenarioDe(el.dataset.sc);
      if (el.dataset.cle === 'nom') s.nom = el.value.slice(0, 40);
      else { const l = s.lignes.find((x) => x.id === el.dataset.ligne); if (!l) return; l[el.dataset.cle] = el.dataset.cle === 'libelle' ? el.value : lireNombre(el.value); }
      sauver(); majSimulateur(); return;
    }
    if (el.dataset.achat) {
      const a = E.achats.find((x) => x.id === el.dataset.achat);
      a[el.dataset.cle] = el.dataset.cle === 'nom' ? el.value.slice(0, 40) : lireNombre(el.value);
      sauver(); majSimulateur();
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E) return;
    if (el.dataset.profil && (el.type === 'radio' || el.type === 'checkbox')) { appliquerProfil(el); sauver(); rendre(); return; }
    if (el.dataset.calc && el.tagName === 'SELECT') { E.calcul.periode = el.value; sauver(); $('#resultat-calc').innerHTML = resultatCalcul(); return; }
    if (el.dataset.sc && el.tagName === 'SELECT') { const l = scenarioDe(el.dataset.sc).lignes.find((x) => x.id === el.dataset.ligne); l.periode = el.value; sauver(); rendre(); return; }
    if (el.dataset.actionChange === 'ligne-depuis' && el.value) {
      const d = E.depenses.find((x) => x.id === el.value);
      scenarioDe(el.dataset.id).lignes.push({ id: uid(), libelle: d.libelle, avant: d.montant, apres: d.periode === 'unique' ? Math.round(d.montant * 0.6) : 0, periode: d.periode, duree: 3 });
      sauver(); rendre();
    }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.dataset?.profil || e.target.dataset?.sc || e.target.dataset?.achat || e.target.dataset?.calc)) { e.preventDefault(); e.target.blur(); } });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E) rafraichir(); });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    const demoUrl = new URLSearchParams(location.search).has('demo');
    if (demoUrl) history.replaceState(null, '', location.pathname + location.hash);
    if (demoUrl && !code) return ouvrirDemo(false);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    if (code === CODE_DECOUVERTE) return ouvrirDecouverte();
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
        if (aUnRevenu()) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement.
  window.__tdv = { etat: () => E, taux: () => taux(), modeDeVie: () => mdv(), session: () => ({ ...session }) };
  init();
})();
