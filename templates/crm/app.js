// CRM freelance QME : prospects, clients, prochaines actions, affaires, suivi des devis et factures.
// Données synchronisées par clé de licence. Suivi seulement : ce n'est pas un logiciel de facturation.
(() => {
  'use strict';
  const B = globalThis.BASE;
  const R = globalThis.CRM_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'CRM';
  const CLE_CODE = 'qme-crm-code';
  const CLE_CACHE = 'qme-crm-cache';
  const CLE_DEMO = 'qme-crm-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-crm-ecran-accueil';
  const NOM = 'CRM freelance';

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
  const { ajout, ecart, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '');
  const fmtLong = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    if (n < 0 && n > -7) return `il y a ${-n} jours`;
    return fmt(s, { day: 'numeric', month: 'short', year: versDate(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };
  const eur = (n, dec = true) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }).replace(/\u202f/g, '\u00a0');
  const eurCourt = (n) => eur(n, Math.abs(n) < 1000 && Math.round(n) !== n);
  const nombreSaisi = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const etape = (id) => B.etapes.find((e) => e.id === id);
  const action = (id) => B.actions.find((a) => a.id === id);
  const typeEchange = (id) => B.typesEchange.find((t) => t.id === id) || B.typesEchange.at(-1);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let contactOuvert = null;
  let filtreContacts = 'tous';
  let recherche = '';
  let filtreDocs = 'tous';
  let anneeChiffres = null;
  let annulation = null;

  const etatVide = () => ({
    version: 1, nom: '',
    reglages: { delaiPaiement: B.reperes.delaiPaiement.defaut, tva: null, relanceDevis: 7, conservationAns: B.reperes.conservation.ans },
    contacts: [], echanges: [], projets: [], documents: [],
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const liste = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) }, contacts: liste(d.contacts), echanges: liste(d.echanges), projets: liste(d.projets),
      documents: liste(d.documents).map((x) => ({ ...x, paiements: liste(x.paiements) })) };
  };
  const contact = (id) => E.contacts.find((c) => c.id === id);
  const projet = (id) => E.projets.find((p) => p.id === id);
  const documentDe = (id) => E.documents.find((d) => d.id === id);
  const delai = () => E.reglages.delaiPaiement;
  const statutC = (c) => R.statutContact(c, E.projets, E.documents);
  const ctxRgpd = () => ({ echanges: E.echanges, documents: E.documents, projets: E.projets, etapes: B.etapes });
  const aRevoir = (c) => !c.archive && R.aRevoirRGPD(c, ctxRgpd(), auj(), E.reglages.conservationAns);
  // Affaire principale d'un contact : la plus récente encore ouverte, sinon gagnée, sinon la dernière.
  function affairePrincipale(c) {
    const ps = E.projets.filter((p) => p.contactId === c.id).sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));
    return ps.find((p) => etape(p.etape)?.ouverte) || ps.find((p) => p.etape === 'gagne' && p.avancement !== 'termine') || ps[0] || null;
  }
  const couleurContact = (c) => { const p = affairePrincipale(c); return p ? couleur(etape(p.etape)?.couleur) : 'var(--trait)'; };
  const nomComplet = (c) => (c ? `${c.nom}${c.entreprise ? ` · ${c.entreprise}` : ''}` : 'Contact supprimé');

  const memoriserAnnulation = () => { annulation = structuredClone(E); };
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre(); toast('Modification annulée.');
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
        toast('Un autre appareil a modifié ton CRM entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code CRM-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne : préfixe de 3 lettres (le nôtre, ou celui d'un autre template, refusé ensuite par le serveur).
    if (n.startsWith('CRM') || /^[A-Z]{2}[G-Z]|^[A-Z][G-Z]|^[G-Z]/.test(n.slice(0, 3)) && /^[A-Z]{3}/.test(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}[0-9A-Z]{16}$/.test(n) && !/^[0-9A-F]+$/.test(n)) || (/^[0-9A-F]{32}$/.test(n)); };

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
    contactOuvert = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Démo : une consultante fictive, dates relatives à aujourd'hui ----------
  function donneesDemo() {
    const D = etatVide();
    D.nom = 'Camille';
    D.reglages.tva = 20;
    const t = auj();
    const j = (n) => ajout(t, n);
    const C = (nom, entreprise, origine, cree, extra = {}) => {
      const c = { id: uid(), nom, entreprise, email: `${nom.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@example.com`, tel: '', origine, notes: '', creeLe: j(cree), prochaine: null, archive: false, ...extra };
      D.contacts.push(c); return c;
    };
    const X = (c, n, type, resume) => D.echanges.push({ id: uid(), contactId: c.id, date: j(n), type, resume });
    const P = (c, titre, et, montant, cree, extra = {}) => { const p = { id: uid(), contactId: c.id, titre, etape: et, montant, creeLe: j(cree), maj: j(cree), decision: null, avancement: et === 'gagne' ? 'a-venir' : null, motif: '', ...extra }; D.projets.push(p); return p; };
    const F = (c, p, numero, date, objet, ht, extra = {}) => { const d = { id: uid(), type: 'facture', numero, contactId: c.id, projetId: p?.id || null, date: j(date), objet, ht, tva: 20, delai: 30, statut: 'envoyee', paiements: [], ...extra }; D.documents.push(d); return d; };
    const Q = (c, p, numero, date, objet, ht, statut, validite) => { const d = { id: uid(), type: 'devis', numero, contactId: c.id, projetId: p?.id || null, date: j(date), objet, ht, tva: 20, validite: j(validite), statut, paiements: [] }; D.documents.push(d); return d; };
    const pay = (d, date, montant, mode = 'Virement') => d.paiements.push({ id: uid(), date: j(date), montant, mode });
    const an = new Date().getFullYear();
    const num = (l, n, decal = 0) => `${l}-${an + decal}-${String(n).padStart(3, '0')}`;

    // Clients récurrents : historique de factures sur 12 mois.
    const a = C('Hélène Marchal', 'Atelier des Tilleuls', 'Recommandation', -400, { tel: '06 00 00 00 01', notes: 'Préfère le téléphone le matin. Décide seule.' });
    const pa = P(a, 'Refonte de la plaquette commerciale', 'gagne', 4800, -60, { avancement: 'en-cours' });
    a.prochaine = { type: 'point-avancement', date: t, note: 'Valider les maquettes des pages 3 à 6.' };
    X(a, -340, 'rdv', 'Premier rendez-vous : besoin d\'une identité visuelle pour la boutique.');
    X(a, -62, 'appel', 'Nouveau besoin : plaquette commerciale pour le salon de printemps.');
    X(a, -14, 'visio', 'Présentation des premières maquettes, retours positifs.');
    [[-330, 1, 1800], [-250, 4, 1200], [-160, 9, 950], [-95, 14, 600]].forEach(([d, n, ht], i) => { const f = F(a, null, num('F', n, d < -300 && new Date(j(d)).getFullYear() < an ? -1 : 0), d, ['Identité visuelle', 'Déclinaison papeterie', 'Visuels de rentrée', 'Bannières en ligne'][i], ht); pay(f, d + 21, R.ttc(f)); });
    const fa = F(a, pa, num('F', 19), -20, 'Plaquette : acompte 30 %', 1440); pay(fa, -6, 1728);

    const b = C('Julien Ferrand', 'Ferrand & Associés', 'Réseau professionnel', -300);
    const pb = P(b, 'Accompagnement éditorial annuel', 'gagne', 7200, -240, { avancement: 'en-cours' });
    b.prochaine = { type: 'relance-facture', date: j(-2), note: 'Deux factures en retard, dont une payée en partie.' };
    X(b, -235, 'rdv', 'Signature de l\'accompagnement mensuel (12 mois).');
    X(b, -3, 'email', 'Relance courtoise de la facture d\'octobre, pas de réponse.');
    for (let m = 8; m >= 1; m--) {
      const d = -m * 30 - 5;
      const f = F(b, pb, num('F', 20 - m), d, `Accompagnement éditorial, mois ${9 - m}`, 600, { delai: 30 });
      if (m > 2) pay(f, d + 28, 720);
      else if (m === 2) pay(f, d + 40, 300, 'Chèque'); // partielle, en retard
    }

    const c = C('Sophie Garnier', 'Les Jardins de Sophie', 'Site internet', -120);
    const pc = P(c, 'Site vitrine et photos produits', 'gagne', 3900, -110, { avancement: 'termine' });
    c.prochaine = { type: 'temoignage', date: j(3), note: '' };
    X(c, -110, 'appel', 'Demande d\'un site vitrine simple.');
    X(c, -12, 'rdv', 'Livraison du site, cliente ravie.');
    const qc = Q(c, pc, num('D', 3), -108, 'Site vitrine et photos produits', 3900, 'accepte', -78);
    const fc1 = F(c, pc, num('F', 12), -100, 'Site vitrine : acompte', 1170, { devisId: qc.id }); pay(fc1, -92, 1404, 'Carte bancaire');
    F(c, pc, num('F', 21), -10, 'Site vitrine : solde', 2730, { devisId: qc.id });

    // Prospects à toutes les étapes.
    const d = C('Marc Olivier', 'Cabinet Olivier Conseil', 'Salon ou événement', -25);
    const pd = P(d, 'Rapport annuel et infographies', 'proposition', 5600, -20);
    d.prochaine = { type: 'relance-devis', date: t, note: 'Il devait en parler à son associée lundi.' };
    X(d, -25, 'rdv', 'Rencontré au salon, besoin d\'un rapport annuel illustré.');
    X(d, -10, 'email', 'Envoi du devis avec deux options.');
    Q(d, pd, num('D', 6), -10, 'Rapport annuel et infographies', 5600, 'envoye', 20);

    const e = C('Nadia Benali', 'Boulangerie Benali', 'Recommandation', -9);
    const pe = P(e, 'Carte de fidélité et menu', 'qualifie', 900, -9, { decision: j(10) });
    e.prochaine = { type: 'proposition', date: j(-1), note: 'Budget annoncé : environ 1 000 €.' };
    X(e, -8, 'appel', 'Besoin d\'une carte de fidélité et d\'un menu pour la vitrine.');

    const f = C('Thomas Roux', 'Roux Menuiserie', 'Prospection directe', -6);
    P(f, 'Logo et camion', 'piste', 1500, -6);
    f.prochaine = { type: 'premier-contact', date: t, note: 'Vu son camion sans logo, appeler le matin.' };

    const g = C('Élise Caron', 'Studio Caron', 'Réseau professionnel', -40);
    const pg = P(g, 'Charte graphique', 'negociation', 3200, -35, { decision: j(4) });
    g.prochaine = { type: 'point-decision', date: j(2), note: 'Demande une remise de 10 %.' };
    X(g, -35, 'visio', 'Découverte : nouvelle charte pour leurs 10 ans.');
    X(g, -5, 'appel', 'Discussion sur le prix, propose de réduire le nombre de déclinaisons.');
    Q(g, pg, num('D', 5), -15, 'Charte graphique', 3200, 'envoye', -1); // expiré

    const h = C('Paul Lemaire', 'Agence Lemaire Immobilier', 'Plateforme de mise en relation', -70);
    const ph = P(h, 'Brochures des biens', 'perdu', 2400, -65, { motif: 'Prix' });
    X(h, -60, 'email', 'Devis envoyé.');
    X(h, -40, 'appel', 'A choisi une offre moins chère.');
    Q(h, ph, num('D', 4), -60, 'Brochures des biens', 2400, 'refuse', -30);
    h.prochaine = { type: 'recontacter', date: j(140), note: '' };

    const k = C('Inès Morel', 'Association Les Petits Pas', 'Ancien client', -200);
    const pk = P(k, 'Affiche de la fête annuelle', 'qualifie', 650, -15);
    X(k, -15, 'message', 'Demande une affiche pour juin.');
    Q(k, pk, num('D', 7), -2, 'Affiche de la fête annuelle', 650, 'brouillon', 28);
    // Pas de prochaine action : apparaît dans « sans prochaine action ».

    const l = C('Yann Perrot', 'Perrot Transports', 'Salon ou événement', -1300);
    X(l, -1250, 'email', 'Envoi d\'une présentation après le salon, sans suite.');
    // Prospect sans échange depuis plus de 3 ans : signalé pour le RGPD.

    const m = C('Lucie Vidal', 'Café Vidal', 'Site internet', -500, { archive: true });
    X(m, -480, 'appel', 'Projet abandonné, la cliente a vendu son café.');

    const n = C('Romain Giraud', 'Giraud Paysage', 'Recommandation', -18);
    const pn = P(n, 'Flyers de printemps', 'gagne', 750, -18, { avancement: 'a-venir' });
    n.prochaine = { type: 'lancement', date: j(5), note: '' };
    Q(n, pn, num('D', 8), -16, 'Flyers de printemps', 750, 'accepte', 14);
    X(n, -16, 'email', 'Devis accepté par retour de mail.');

    // Une facture annulée (remplacée).
    F(a, null, num('F', 18), -30, 'Erreur de montant, remplacée', 1500, { statut: 'annulee' });
    // Numérotation chronologique par type et par année, comme dans un vrai logiciel de facturation.
    for (const type of ['devis', 'facture']) {
      const compteur = {};
      D.documents.filter((x) => x.type === type).sort((x, y) => x.date.localeCompare(y.date)).forEach((x) => {
        const annee = x.date.slice(0, 4);
        compteur[annee] = (compteur[annee] || 0) + 1;
        x.numero = `${type === 'devis' ? 'D' : 'F'}-${annee}-${String(compteur[annee]).padStart(3, '0')}`;
      });
    }
    return D;
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
          <rect x="10" y="20" width="260" height="260" fill="#F5B400"/>
          <circle cx="140" cy="150" r="70" fill="#141414"/>
          <circle cx="420" cy="150" r="130" fill="#1D4E89"/>
          <path d="M290 280 A130 130 0 0 1 420 150 V280 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">CRM freelance · clients et relances</p>
          <h1>Personne à relancer n'est oublié.</h1>
          <p>Tes prospects, tes clients et leurs échanges, la prochaine action datée de chacun, et ce qui reste à encaisser.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton CRM</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon CRM</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de CRM ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon CRM'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    document.title = `Bienvenue · ${NOM}`;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On prépare ton CRM.</h1>
      <p class="intro">Trois réglages, puis tu ajoutes ton premier contact. Tout reste modifiable dans les réglages.</p>
      <form id="form-accueil" class="accueil-form" novalidate>
        <label class="champ">Ton prénom <small>Facultatif, pour l'accueil du matin.</small><input name="nom" maxlength="40" autocomplete="given-name"></label>
        <label class="champ">Délai de paiement habituel (jours) <small>Sert à calculer l'échéance de tes factures. À défaut d'accord entre professionnels : ${B.reperes.delaiPaiement.defaut} jours (voir l'aide).</small><input name="delai" type="number" min="0" max="120" value="${B.reperes.delaiPaiement.defaut}" inputmode="numeric"></label>
        <label class="champ">Ton taux de TVA habituel (%) <small>Aucun taux n'est intégré : indique le tien (0 si tu es en franchise en base de TVA). Tu peux le changer facture par facture.</small><input name="tva" inputmode="decimal" placeholder="Ex. : 0" required></label>
        <p class="erreur" role="alert"></p>
        <div class="avertissement"><b>Suivi seulement.</b> Ce CRM suit tes devis, factures et encaissements ; il n'émet pas de factures et ne remplace ni ton logiciel de facturation ni ta comptabilité.</div>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer mon CRM</button></div>
      </form>
    </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const d = Number(f.get('delai'));
      const tva = nombreSaisi(f.get('tva'));
      const err = e.target.querySelector('.erreur');
      if (!Number.isInteger(d) || d < 0 || d > 120) { err.textContent = 'Délai : un nombre de jours entre 0 et 120.'; return; }
      if (String(f.get('tva')).trim() === '' || !Number.isFinite(tva) || tva < 0 || tva > 100) { err.textContent = 'Indique ton taux de TVA en % (0 si tu n\'en factures pas).'; return; }
      E = etatVide();
      E.nom = String(f.get('nom') || '').trim();
      E.reglages.delaiPaiement = d; E.reglages.tva = tva;
      sauver(); demarrer();
      setTimeout(() => modaleContact(), 250);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    contacts: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><rect x="2" y="14" width="12" height="7" fill="currentColor"/><rect x="15" y="6" width="7" height="2.5" fill="currentColor"/><rect x="15" y="11" width="7" height="2.5" fill="currentColor"/><rect x="15" y="16" width="5" height="2.5" fill="currentColor"/></svg>',
    affaires: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="5" height="18" fill="currentColor"/><rect x="9.5" y="3" width="5" height="12" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="5" height="7" fill="currentColor"/></svg>',
    factures: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h12l4 4v16H4Z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="9" width="10" height="2" fill="currentColor"/><rect x="7" y="13" width="10" height="2" fill="currentColor"/><rect x="11" y="17" width="6" height="2" fill="currentColor"/></svg>',
    chiffres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['contacts', 'Contacts'], ['affaires', 'Affaires'], ['factures', 'Factures'], ['chiffres', 'Chiffres']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/crm/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">CRM<br>freelance</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, aide et sauvegarde" title="Réglages">${ICONES.reglages}</button>
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
    document.title = `${titres[vue]} · ${NOM}`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, contacts: vueContacts, affaires: vueAffaires, factures: vueFactures, chiffres: vueChiffres }[vue]();
    if (vue === 'chiffres') brancherGraphique();
    const champ = $('#recherche');
    if (champ) champ.addEventListener('input', () => { recherche = champ.value; const pos = champ.selectionStart; rendre(); const c = $('#recherche'); c.focus(); c.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id) {
    vue = v;
    if (id !== undefined) contactOuvert = id;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, boutons = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${boutons ? `<div class="actions">${boutons}</div>` : ''}</div></div>`;
  const PIED = '<footer class="pied-app"><p><b>Suivi commercial</b> : ce CRM n\'émet pas de factures et ne remplace ni un logiciel de facturation ni une comptabilité. Données de clients et de prospects : <button class="lien-texte" data-action="aide">tes obligations (RGPD) et repères</button>.</p></footer>';

  // ----- Aujourd'hui -----
  function vueAujourdhui() {
    const t = auj();
    const dues = R.actionsDues(E.contacts, t);
    const retards = dues.filter((x) => x.retard > 0).length;
    const s = R.synthese(E.documents, t, delai());
    const factRetard = R.facturesEnRetard(E.documents, t, delai());
    const devis = R.devisARelancer(E.documents, t, E.reglages.relanceDevis);
    const sans = R.sansAction(E.contacts, E.projets, B.etapes);
    const avenir = R.actionsAVenir(E.contacts, t, 7);
    const salut = E.nom ? `Bonjour ${esc(E.nom)}. ` : '';
    const titre = !E.contacts.length ? `${salut}Commence par tes contacts.`
      : dues.length ? `${salut}<mark>${pluriel(dues.length, 'relance')}</mark> aujourd'hui.` : `${salut}<mark>Rien à relancer</mark> aujourd'hui.`;
    const carte = `<aside class="encaisser-carte ${s.retard > 0 ? '' : 'calme'}">
        <p class="surtitre">Reste à encaisser</p>
        <div class="compte">${eurCourt(s.reste)}</div>
        <p>${s.nbAEncaisser ? `${pluriel(s.nbAEncaisser, 'facture')}${s.nbRetard ? ` · <b>${eurCourt(s.retard)} en retard</b> (${s.nbRetard})` : ' · aucune en retard'}` : 'Aucune facture en attente.'}</p>
        <p class="petit">Encaissé ce mois-ci : ${eurCourt(s.encaisseMois)} HT</p>
      </aside>`;
    const cartes = dues.map(({ contact: c, retard }) => carteAction(c, retard)).join('');
    const vide = !E.contacts.length
      ? videEtat('Aucun contact pour l\'instant', 'Ajoute un prospect ou un client, avec la prochaine action à faire et sa date : il apparaîtra ici le jour venu.', `<button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Ajouter un contact</button>`)
      : videEtat('Journée sans relance.', avenir.length ? `Prochaine action ${quand(avenir[0].prochaine.date)} : ${esc(action(avenir[0].prochaine.type)?.nom || 'action')} avec ${esc(avenir[0].nom)}.` : 'Aucune action prévue cette semaine. Profites-en pour planifier les suivantes.', '<button class="btn" data-action="vue" data-vue="contacts">Voir les contacts</button>');
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${dues.length ? `<p class="sous">${retards ? `<b style="color:var(--rouge)">${retards} en retard</b> · ` : ''}${avenir.length ? `${pluriel(avenir.length, 'autre action', 'autres actions')} dans les 7 jours` : 'rien d\'autre dans les 7 jours'}</p>` : ''}
          <div class="actions">
            <button class="btn primaire" data-action="echange-nouveau">${ICONES.plus}Noter un échange</button>
            <button class="btn" data-action="contact-nouveau">${ICONES.plus}Contact</button>
          </div>
        </div>
        ${carte}
      </section>
      <h2 class="titre-section">À relancer aujourd'hui <span>${dues.length ? '« Fait » note l\'échange et propose l\'action suivante.' : ''}</span></h2>
      ${dues.length ? `<ul class="cartes">${cartes}</ul>` : vide}
      ${factRetard.length ? `<h2 class="titre-section">Factures en retard <span>Échéance dépassée, solde dû.</span></h2>
        <div class="liste-cadre">${factRetard.map((d) => ligneDocument(d, t, true)).join('')}</div>` : ''}
      ${devis.length ? `<h2 class="titre-section">Devis sans réponse <span>Envoyés depuis ${E.reglages.relanceDevis} jours ou plus.</span></h2>
        <div class="liste-cadre">${devis.map((d) => ligneDocument(d, t, true)).join('')}</div>` : ''}
      ${sans.length ? `<h2 class="titre-section">Sans prochaine action <span>Affaire en cours mais rien de prévu.</span></h2>
        <div class="liste-cadre">${sans.map((c) => `<div class="ligne" style="--c:${couleurContact(c)}"><i></i><div><b>${esc(nomComplet(c))}</b><span>${esc(affairePrincipale(c)?.titre || '')}</span></div><div class="ligne-actions"><button class="btn petit" data-action="planifier" data-id="${c.id}">Planifier</button></div></div>`).join('')}</div>` : ''}
      ${avenir.length ? `<h2 class="titre-section">Dans les 7 jours</h2>
        <div class="liste-cadre">${avenir.map((c) => `<button class="ligne cliquable" style="--c:${couleurContact(c)}" data-action="ouvrir-contact" data-id="${c.id}"><i></i><div><b>${esc(action(c.prochaine.type)?.nom || 'Action')} · ${esc(c.nom)}</b><span>${esc(c.entreprise || '')}${c.prochaine.note ? ` · ${esc(c.prochaine.note)}` : ''}</span></div><span class="quand">${quand(c.prochaine.date)}</span></button>`).join('')}</div>` : ''}
      ${PIED}`;
  }

  function carteAction(c, retard) {
    const a = action(c.prochaine.type);
    const p = affairePrincipale(c);
    return `
      <li class="carte" style="--c:${couleurContact(c)}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-meta-haut">${esc(c.entreprise || statutLibelle(statutC(c)))}${retard > 0 ? `<span class="etiquette rouge">En retard · ${retard} j</span>` : ''}${p ? `<span class="etiquette clair">${esc(etape(p.etape)?.nom)}</span>` : ''}</p>
          <h3>${esc(a?.nom || 'Action')} · ${esc(c.nom)}</h3>
          ${c.prochaine.note ? `<p class="carte-note">${esc(c.prochaine.note)}</p>` : ''}
          ${a ? `<p class="conseil-puce">${esc(a.conseil)}</p>` : ''}
          <p class="carte-liens">${c.tel ? `<span>${esc(c.tel)}</span>` : ''}${c.email ? `<span>${esc(c.email)}</span>` : ''}</p>
        </div>
        <div class="carte-boutons">
          <button class="btn primaire" data-action="fait" data-id="${c.id}">Fait</button>
          <button class="btn" data-action="reporter" data-id="${c.id}">Demain</button>
          <button class="btn lien" data-action="ouvrir-contact" data-id="${c.id}">Fiche</button>
        </div>
      </li>`;
  }

  const statutLibelle = (s) => ({ client: 'Client', prospect: 'Prospect', archive: 'Archivé' }[s]);
  const LIB_DOC = {
    brouillon: ['', 'Brouillon'], envoye: ['bleu', 'Envoyé'], accepte: ['vert', 'Accepté'], refuse: ['', 'Refusé'], expire: ['rouge', 'Expiré'],
    'a-encaisser': ['jaune', 'À encaisser'], partielle: ['jaune', 'Payée en partie'], payee: ['vert', 'Payée'], retard: ['rouge', 'En retard'], annulee: ['', 'Annulée'],
  };
  const etiquetteDoc = (st) => `<span class="etiquette ${LIB_DOC[st][0]}">${LIB_DOC[st][1]}</span>`;

  function ligneDocument(d, t, actions = false) {
    const c = contact(d.contactId);
    const st = R.statutDocument(d, t, delai());
    const facture = d.type === 'facture';
    const sous = facture
      ? (st === 'annulee' ? 'annulée' : st === 'brouillon' ? 'pas encore envoyée' : st === 'retard' ? `échéance ${fmt(R.echeance(d, delai()))} · ${R.joursRetard(d, t, delai())} j de retard` : st === 'payee' ? `payée${d.paiements.length ? ` le ${fmt(d.paiements.at(-1).date)}` : ''}` : `échéance ${fmt(R.echeance(d, delai()))}`)
      : (d.validite ? `valable jusqu'au ${fmt(d.validite)}` : `du ${fmt(d.date)}`);
    const montant = facture && ['retard', 'partielle'].includes(st) ? `${eur(R.solde(d))} <small>dus sur ${eur(R.ttc(d))}</small>` : `${eur(R.ttc(d))} <small>TTC</small>`;
    let boutons = '';
    if (actions && facture) boutons = `<button class="btn petit" data-action="relancer-facture" data-id="${d.id}">Relancer</button><button class="btn petit" data-action="encaisser" data-id="${d.id}">Encaissé</button>`;
    else if (actions) boutons = `<button class="btn petit" data-action="relancer-devis" data-id="${d.id}">Relancer</button>`;
    return `<div class="doc-ligne">
      <button class="doc-principal" data-action="document" data-id="${d.id}">
        <span class="doc-num">${esc(d.numero || (facture ? 'Facture' : 'Devis'))}</span>
        <span class="doc-objet"><b>${esc(c ? (c.entreprise || c.nom) : 'Contact supprimé')}</b><span>${esc(d.objet || '')}${d.objet ? ' · ' : ''}${sous}</span></span>
        <span class="doc-montant">${montant}</span>
        <span class="doc-statut">${etiquetteDoc(st)}</span>
      </button>
      ${boutons ? `<div class="doc-actions">${boutons}</div>` : ''}
    </div>`;
  }

  // ----- Contacts -----
  function vueContacts() {
    const t = auj();
    const q = recherche.trim().toLowerCase();
    const rgpd = E.contacts.filter(aRevoir);
    const filtres = [['tous', 'Tous'], ['prospect', 'Prospects'], ['client', 'Clients'], ['rgpd', `À revoir (${rgpd.length})`], ['archive', 'Archivés']];
    const liste = E.contacts.filter((c) => {
      const s = statutC(c);
      if (filtreContacts === 'tous' && s === 'archive') return false;
      if (['prospect', 'client', 'archive'].includes(filtreContacts) && s !== filtreContacts) return false;
      if (filtreContacts === 'rgpd' && !aRevoir(c)) return false;
      return !q || `${c.nom} ${c.entreprise} ${c.email} ${c.notes}`.toLowerCase().includes(q);
    }).sort((a, b) => (a.prochaine?.date || '9999').localeCompare(b.prochaine?.date || '9999') || a.nom.localeCompare(b.nom, 'fr'));
    const ouvert = contactOuvert ? contact(contactOuvert) : null;
    const items = liste.map((c) => {
      const s = statutC(c);
      const p = c.prochaine;
      return `<button class="contact-item" style="--c:${couleurContact(c)}" data-action="ouvrir-contact" data-id="${c.id}" aria-current="${ouvert?.id === c.id}">
        <i></i><span class="ci-texte"><b>${esc(c.nom)}</b><span>${esc(c.entreprise || statutLibelle(s))}</span></span>
        <span class="ci-quand ${p?.date && p.date < t ? 'retard' : ''}">${p?.date ? quand(p.date) : s === 'archive' ? 'archivé' : '—'}</span>
      </button>`;
    }).join('');
    const tete = `<div class="vue-tete"><div><h1>Contacts</h1><p>${pluriel(E.contacts.filter((c) => !c.archive).length, 'contact')} : ${pluriel(E.contacts.filter((c) => statutC(c) === 'prospect').length, 'prospect')}, ${pluriel(E.contacts.filter((c) => statutC(c) === 'client').length, 'client')}. Triés par prochaine action.</p></div>
      <div class="actions"><button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Contact</button></div></div>`;
    const bandeauRgpd = rgpd.length && filtreContacts !== 'rgpd' ? `<div class="avertissement rgpd"><b>${pluriel(rgpd.length, 'contact')} à revoir :</b> sans échange depuis plus de ${pluriel(E.reglages.conservationAns, 'an')} et sans affaire en cours. Supprime ou archive ce qui n'est plus utile. <button class="lien-texte" data-action="filtre-contacts" data-id="rgpd">Les voir</button> · <button class="lien-texte" data-action="aide">Pourquoi ?</button></div>` : '';
    const listeHtml = `<div class="contacts-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un nom, une entreprise…" value="${esc(recherche)}" autocomplete="off"></label>
        <div class="puces" role="group" aria-label="Filtrer">${filtres.map(([id, nom]) => `<button class="puce" data-action="filtre-contacts" data-id="${id}" aria-pressed="${filtreContacts === id}">${nom}</button>`).join('')}</div>
        <div class="contacts-items">${items || `<p class="vide-texte">${E.contacts.length ? 'Aucun contact ne correspond.' : 'Aucun contact.'}</p>`}</div>
      </div>`;
    const fiche = ouvert ? ficheContact(ouvert) : `<div class="fiche-vide">${E.contacts.length ? videEtat('Choisis un contact', 'Sa fiche réunit ses coordonnées, la prochaine action, l\'historique des échanges, ses affaires et ses factures.') : videEtat('Ton premier contact', 'Un prospect rencontré, un client en cours : note-le avec la prochaine action à faire.', `<button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Ajouter un contact</button>`)}</div>`;
    return `${tete}${bandeauRgpd}<div class="contacts ${ouvert ? 'avec-fiche' : ''}">${listeHtml}<section class="fiche" aria-label="Fiche contact">${fiche}</section></div>${PIED}`;
  }

  function ficheContact(c) {
    const t = auj();
    const s = statutC(c);
    const projets = E.projets.filter((p) => p.contactId === c.id).sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));
    const docs = E.documents.filter((d) => d.contactId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const echanges = E.echanges.filter((e) => e.contactId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const factures = docs.filter(R.factureActive);
    const facture = factures.reduce((x, d) => x + Number(d.ht || 0), 0);
    const encaisse = factures.reduce((x, d) => x + R.encaisse(d), 0);
    const reste = factures.reduce((x, d) => x + Math.max(0, R.solde(d)), 0);
    const p = c.prochaine;
    const a = p ? action(p.type) : null;
    const revoir = aRevoir(c);
    return `
      <div class="fiche-retour"><button class="btn lien" data-action="fermer-contact">← Tous les contacts</button></div>
      <article class="fiche-carte">
        <div class="fiche-tete" style="--c:${couleurContact(c)}">
          <div><p class="surtitre">${statutLibelle(s)}${c.origine ? ` · ${esc(c.origine)}` : ''}</p><h2>${esc(c.nom)}</h2>${c.entreprise ? `<p class="fiche-entreprise">${esc(c.entreprise)}</p>` : ''}</div>
          <button class="btn petit" data-action="contact-modifier" data-id="${c.id}">Modifier</button>
        </div>
        ${revoir ? `<div class="avertissement rgpd">Pas d'échange depuis plus de ${pluriel(E.reglages.conservationAns, 'an')} : garde ce contact seulement s'il est encore utile. <span class="rang-inline"><button class="btn petit" data-action="archiver" data-id="${c.id}">Archiver</button><button class="btn petit danger" data-action="contact-supprimer" data-id="${c.id}">Supprimer</button></span></div>` : ''}
        <p class="fiche-coord">${c.email ? `<span>${esc(c.email)}</span>` : ''}${c.tel ? `<span>${esc(c.tel)}</span>` : ''}${!c.email && !c.tel ? '<span>Aucune coordonnée.</span>' : ''}<span>Ajouté le ${fmtLong(c.creeLe)}</span></p>
        <div class="prochaine ${p && p.date < t ? 'retard' : ''}">
          <p class="surtitre">Prochaine action</p>
          ${p ? `<h3>${esc(a?.nom || 'Action')} · <span>${quand(p.date)}</span></h3>${p.note ? `<p>${esc(p.note)}</p>` : ''}${a ? `<p class="conseil-puce">${esc(a.conseil)}</p>` : ''}
            <div class="rang"><button class="btn primaire petit" data-action="fait" data-id="${c.id}">Fait</button><button class="btn petit" data-action="planifier" data-id="${c.id}">Modifier</button><button class="btn petit" data-action="reporter" data-id="${c.id}">Demain</button></div>`
            : `<p>${c.archive ? 'Contact archivé.' : 'Rien de prévu.'}</p><div class="rang"><button class="btn primaire petit" data-action="planifier" data-id="${c.id}">Planifier une action</button></div>`}
        </div>
        <div class="fiche-chiffres"><div><b>${eurCourt(facture)}</b><span>facturé HT</span></div><div><b>${eurCourt(encaisse)}</b><span>encaissé TTC</span></div><div><b style="${reste > 0 ? 'color:var(--rouge)' : ''}">${eurCourt(reste)}</b><span>reste dû TTC</span></div></div>
        <div class="fiche-bloc">
          <div class="bloc-tete"><h3>Échanges</h3><button class="btn petit" data-action="echange-nouveau" data-id="${c.id}">${ICONES.plus}Échange</button></div>
          ${echanges.length ? `<ol class="historique">${echanges.map((e) => `<li><button data-action="echange-modifier" data-id="${e.id}"><span class="h-date">${fmt(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="h-type">${esc(typeEchange(e.type).nom)}</span><span class="h-texte">${esc(e.resume || '')}</span></button></li>`).join('')}</ol>` : '<p class="vide-texte">Aucun échange noté.</p>'}
        </div>
        <div class="fiche-bloc">
          <div class="bloc-tete"><h3>Affaires</h3><button class="btn petit" data-action="affaire-nouvelle" data-id="${c.id}">${ICONES.plus}Affaire</button></div>
          ${projets.length ? projets.map((x) => `<button class="ligne cliquable" style="--c:${couleur(etape(x.etape)?.couleur)}" data-action="affaire-modifier" data-id="${x.id}"><i></i><div><b>${esc(x.titre)}</b><span>${esc(etape(x.etape)?.nom)}${x.etape === 'gagne' && x.avancement ? ` · ${esc(B.avancements.find((v) => v.id === x.avancement)?.nom)}` : ''}${x.etape === 'perdu' && x.motif ? ` · ${esc(x.motif)}` : ''}</span></div><span class="quand">${eurCourt(x.montant || 0)} HT</span></button>`).join('') : '<p class="vide-texte">Aucune affaire.</p>'}
        </div>
        <div class="fiche-bloc">
          <div class="bloc-tete"><h3>Devis et factures</h3><span class="rang-inline"><button class="btn petit" data-action="document-nouveau" data-type="devis" data-id="${c.id}">${ICONES.plus}Devis</button><button class="btn petit" data-action="document-nouveau" data-type="facture" data-id="${c.id}">${ICONES.plus}Facture</button></span></div>
          ${docs.length ? `<div class="liste-cadre sans-cadre">${docs.map((d) => ligneDocument(d, t)).join('')}</div>` : '<p class="vide-texte">Aucun document suivi.</p>'}
        </div>
        ${c.notes ? `<div class="fiche-bloc"><h3>Notes</h3><p class="notes">${esc(c.notes)}</p></div>` : ''}
      </article>`;
  }

  // ----- Affaires (pipeline) -----
  function vueAffaires() {
    const synth = R.pipeline(E.projets, B.etapes);
    const ouvert = R.montantOuvert(E.projets, B.etapes);
    const colonnes = B.etapes.map((e, i) => {
      const liste = E.projets.filter((p) => p.etape === e.id).sort((a, b) => (b.maj || b.creeLe || '').localeCompare(a.maj || a.creeLe || ''));
      const sy = synth[i];
      return `<section class="colonne" style="--c:${couleur(e.couleur)};--t:${texteSur(e.couleur)}" aria-label="${esc(e.nom)}">
        <div class="colonne-tete"><h2>${esc(e.nom)}</h2><span>${sy.nombre} · ${eurCourt(sy.montant)}</span></div>
        <p class="colonne-detail">${esc(e.detail)}</p>
        <div class="colonne-cartes">${liste.map((p) => carteAffaire(p, e)).join('') || '<p class="vide-texte">Aucune affaire.</p>'}</div>
      </section>`;
    }).join('');
    return `<div class="vue-tete"><div><h1>Affaires</h1><p>${pluriel(E.projets.filter((p) => etape(p.etape)?.ouverte).length, 'affaire ouverte', 'affaires ouvertes')} pour ${eurCourt(ouvert)} HT estimés. Passer une affaire à l'étape suivante propose la prochaine action type.</p></div>
      <div class="actions"><button class="btn primaire" data-action="affaire-nouvelle">${ICONES.plus}Affaire</button></div></div>
      ${E.projets.length ? `<div class="colonnes" tabindex="0" aria-label="Étapes de vente, défilement horizontal">${colonnes}</div>` : videEtat('Aucune affaire', 'Une affaire, c\'est une vente possible avec un contact : un besoin, un montant estimé, une étape. Elle avance de « Piste » à « Gagné » ou « Perdu ».', `<button class="btn primaire" data-action="affaire-nouvelle">${ICONES.plus}Créer une affaire</button>`)}
      ${PIED}`;
  }

  function carteAffaire(p, e) {
    const c = contact(p.contactId);
    const suivante = R.etapeSuivante(B.etapes, p.etape);
    const t = auj();
    return `<article class="affaire">
      <button class="affaire-corps" data-action="affaire-modifier" data-id="${p.id}">
        <b>${esc(p.titre)}</b>
        <span>${esc(c ? (c.entreprise || c.nom) : 'Contact supprimé')}</span>
        <span class="affaire-montant">${eurCourt(p.montant || 0)} HT</span>
        ${p.decision && e.ouverte ? `<span class="${p.decision < t ? 'retard' : ''}">Décision ${quand(p.decision)}</span>` : ''}
        ${p.etape === 'gagne' ? `<span class="etiquette ${p.avancement === 'termine' ? '' : p.avancement === 'en-cours' ? 'bleu' : 'jaune'}">${esc(B.avancements.find((v) => v.id === p.avancement)?.nom || 'À démarrer')}</span>` : ''}
        ${p.etape === 'perdu' && p.motif ? `<span>Motif : ${esc(p.motif)}</span>` : ''}
      </button>
      ${suivante ? `<div class="affaire-pied"><button class="btn petit" data-action="etape-suivante" data-id="${p.id}">→ ${esc(etape(suivante).nom)}</button><button class="btn petit lien" data-action="affaire-perdue" data-id="${p.id}">Perdue</button></div>` : ''}
      ${p.etape === 'gagne' && p.avancement !== 'termine' ? `<div class="affaire-pied"><button class="btn petit" data-action="avancement" data-id="${p.id}">→ ${p.avancement === 'en-cours' ? 'Terminé' : 'En cours'}</button></div>` : ''}
    </article>`;
  }

  // ----- Factures -----
  function vueFactures() {
    const t = auj();
    const annee = t.slice(0, 4);
    const s = R.synthese(E.documents, t, delai());
    const factAnnee = E.documents.filter((d) => R.factureActive(d) && d.date.startsWith(annee)).reduce((x, d) => x + Number(d.ht || 0), 0);
    const filtres = [['tous', 'Tout'], ['devis', 'Devis'], ['facture', 'Factures'], ['attente', 'À encaisser'], ['retard', 'En retard']];
    const liste = E.documents.filter((d) => {
      const st = R.statutDocument(d, t, delai());
      if (filtreDocs === 'devis' || filtreDocs === 'facture') return d.type === filtreDocs;
      if (filtreDocs === 'attente') return d.type === 'facture' && ['a-encaisser', 'partielle', 'retard'].includes(st);
      if (filtreDocs === 'retard') return d.type === 'facture' && st === 'retard';
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || String(b.numero).localeCompare(String(a.numero)));
    const tuiles = [
      [`Facturé ${annee}`, eurCourt(factAnnee), 'HT, factures émises cette année.', 'var(--bleu)', ''],
      ['Reste à encaisser', eurCourt(s.reste), `TTC, ${pluriel(s.nbAEncaisser, 'facture')}.`, 'var(--jaune)', 'rond'],
      ['En retard', eurCourt(s.retard), s.nbRetard ? `${pluriel(s.nbRetard, 'facture')} après échéance.` : 'Aucune facture en retard.', 'var(--rouge)', ''],
      ['Devis en attente', E.documents.filter((d) => d.type === 'devis' && R.statutDevis(d, t) === 'envoye').length, 'Envoyés, sans réponse.', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `<div class="vue-tete"><div><h1>Devis et factures</h1><p>Le suivi de ce que tu as proposé, facturé et encaissé.</p></div>
      <div class="actions"><button class="btn" data-action="document-nouveau" data-type="devis">${ICONES.plus}Devis</button><button class="btn primaire" data-action="document-nouveau" data-type="facture">${ICONES.plus}Facture</button></div></div>
      <div class="avertissement"><b>Suivi seulement, pas un logiciel de facturation.</b> Tes devis et factures sont établis avec ton outil de facturation (mentions obligatoires, numérotation, TVA) ; reporte ici leur numéro, leurs montants et leurs encaissements. <button class="lien-texte" data-action="aide">Facturation électronique et délais de paiement</button></div>
      <div class="tuiles">${tuiles}</div>
      <div class="puces" role="group" aria-label="Filtrer" style="margin-top:24px">${filtres.map(([id, nom]) => `<button class="puce" data-action="filtre-docs" data-id="${id}" aria-pressed="${filtreDocs === id}">${nom}</button>`).join('')}</div>
      ${liste.length ? `<div class="liste-cadre">${liste.map((d) => ligneDocument(d, t, ['retard'].includes(R.statutDocument(d, t, delai())))).join('')}</div>`
        : videEtat(E.documents.length ? 'Rien dans ce filtre' : 'Aucun document suivi', E.documents.length ? 'Change de filtre pour voir les autres documents.' : 'Ajoute un devis envoyé ou une facture émise : montant HT, taux de TVA, date. Les encaissements et les retards se suivent ensuite ici.', E.documents.length ? '' : `<button class="btn primaire" data-action="document-nouveau" data-type="facture">${ICONES.plus}Suivre une facture</button>`)}
      ${PIED}`;
  }

  // ----- Chiffres -----
  const SERIES = [['facture', 'Facturé HT', '#1D4E89'], ['encaisse', 'Encaissé HT', '#F5B400']];

  function graphique(mois) {
    const L = Math.round(Math.min(1100, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 240, g = L < 500 ? 44 : 56, b = 26, hz = H - b - 10;
    const max = Math.max(100, ...mois.flatMap((m) => [m.facture, m.encaisse]));
    const pasBrut = max / 4;
    const p10 = 10 ** Math.floor(Math.log10(pasBrut));
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((k) => k >= pasBrut);
    const haut = pas * 4;
    const larg = (L - g) / mois.length;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const court = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : String(v));
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${court(i * pas)} €</text>`).join('');
    const tous = L >= 560;
    const barres = mois.map((m, i) => {
      const x0 = g + i * larg;
      const w = Math.max(3, (larg - (larg > 30 ? 12 : 6)) / 2);
      const rects = SERIES.map(([k, , c], s) => {
        const v = m[k];
        if (!v) return '';
        const yy = y(v);
        return `<rect x="${x0 + (larg - 2 * w - 2) / 2 + s * (w + 2)}" y="${yy}" width="${w}" height="${Math.max(1, y(0) - yy)}" fill="${c}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const etiq = tous || (mois.length - 1 - i) % 2 === 0 ? `<text class="axe" x="${x0 + larg / 2}" y="${H - 6}" text-anchor="middle">${versDate(`${m.mois}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${x0}" y="0" width="${larg}" height="${H - b}"/><g class="colonne-g" data-i="${i}">${rects}</g>${etiq}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Chiffre d'affaires facturé et encaissé par mois sur 12 mois, détail dans le tableau ci-dessous">${grilles}${barres}</svg>`;
  }

  function vueChiffres() {
    const t = auj();
    const annees = [...new Set(E.documents.map((d) => d.date.slice(0, 4)).concat(t.slice(0, 4)))].sort().reverse();
    if (!anneeChiffres || !annees.includes(anneeChiffres)) anneeChiffres = t.slice(0, 4);
    const mois = R.caParMois(E.documents, R.moisDe(t), 12);
    const tot = mois.reduce((s, m) => ({ facture: s.facture + m.facture, encaisse: s.encaisse + m.encaisse }), { facture: 0, encaisse: 0 });
    const taux = R.tauxTransformation(E.documents, anneeChiffres);
    const clients = R.caParClient(E.documents, E.contacts, anneeChiffres);
    const tuiles = [
      ['Facturé 12 mois', eurCourt(tot.facture), 'HT, factures émises.', 'var(--bleu)', ''],
      ['Encaissé 12 mois', eurCourt(tot.encaisse), 'HT, à la date du paiement.', 'var(--jaune)', 'rond'],
      [`Devis acceptés ${anneeChiffres}`, taux === null ? '–' : `${taux} %`, 'Acceptés sur devis tranchés (acceptés ou refusés).', 'var(--rouge)', ''],
      ['Affaires ouvertes', eurCourt(R.montantOuvert(E.projets, B.etapes)), 'HT estimés, de Piste à Négociation.', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const maxPart = Math.max(1, ...clients.map((l) => l.part));
    return `<div class="vue-tete"><div><h1>Chiffres</h1><p>Chiffre d'affaires facturé et encaissé, par mois et par client. Montants hors taxes, sauf le reste dû (TTC).</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">12 derniers mois</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Chiffre d'affaires par mois</h2><div class="legende">${SERIES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(mois)}
        <div class="infobulle" hidden></div>
        <details class="tableau-details"><summary>Voir le tableau par mois</summary><div class="defile"><table class="tableau"><thead><tr><th>Mois</th><th class="nb">Facturé HT</th><th class="nb">Encaissé HT</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${versDate(`${m.mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td class="nb">${eur(m.facture)}</td><td class="nb">${eur(m.encaisse)}</td></tr>`).join('')}</tbody></table></div></details>
      </figure>
      <h2 class="titre-section">Par client <span><label class="annee">Année <select id="annee" data-action="annee">${annees.map((a) => `<option ${a === anneeChiffres ? 'selected' : ''}>${a}</option>`).join('')}</select></label></span></h2>
      ${clients.length ? `<div class="defile"><table class="tableau clients"><thead><tr><th>Client</th><th class="nb">Facturé HT</th><th class="nb">Encaissé HT</th><th class="nb">Reste dû TTC</th><th>Part du facturé</th></tr></thead><tbody>${clients.map((l) => `<tr><td><button class="lien-texte" data-action="ouvrir-contact" data-id="${l.contactId}"><b>${esc(l.entreprise || l.nom)}</b></button>${l.entreprise ? `<br><small>${esc(l.nom)}</small>` : ''}</td><td class="nb">${eur(l.facture)}</td><td class="nb">${eur(l.encaisse)}</td><td class="nb" style="${l.reste > 0 ? 'color:var(--rouge);font-weight:700' : ''}">${eur(l.reste)}</td><td><span class="part"><i style="width:${(l.part / maxPart) * 100}%"></i></span><small>${l.part.toLocaleString('fr-FR')} %</small></td></tr>`).join('')}</tbody></table></div>`
        : videEtat(`Aucune facture en ${anneeChiffres}`, 'Le chiffre d\'affaires par client se remplit avec les factures suivies dans l\'onglet Factures.')}
      ${PIED}`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    $('#annee')?.addEventListener('change', (e) => { anneeChiffres = e.target.value; rendre(); });
    const bulle = fig.querySelector('.infobulle');
    const mois = R.caParMois(E.documents, R.moisDe(auj()), 12);
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), m = mois[i];
      fig.querySelectorAll('.colonne-g').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>${versDate(`${m.mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${eur(m[k])}</div>`).join('')}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '52px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne-g').forEach((g) => g.classList.remove('active')); });
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

  const optionsActions = (choix) => B.actions.map((a) => `<option value="${a.id}" ${a.id === choix ? 'selected' : ''}>${esc(a.nom)} (J+${a.delai})</option>`).join('');
  const optionsContacts = (choix) => E.contacts.filter((c) => !c.archive || c.id === choix).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((c) => `<option value="${c.id}" ${c.id === choix ? 'selected' : ''}>${esc(nomComplet(c))}</option>`).join('');

  // Bloc « prochaine action » commun aux modales contact et échange.
  function blocProchaine(p, sans = false) {
    return `<fieldset class="groupe-champs"><legend>Prochaine action</legend>
      <label class="case"><input type="checkbox" name="aucune" ${sans ? 'checked' : ''} data-action="bascule-prochaine"> Aucune prochaine action pour l'instant</label>
      <div class="prochaine-champs" ${sans ? 'hidden' : ''}>
        <label class="champ">Action<select name="ptype" data-action="type-action">${optionsActions(p?.type)}</select></label>
        <label class="champ">Date<input type="date" name="pdate" value="${p?.date || auj()}"></label>
        <label class="champ">Note<small>Facultative : ce qu'il faut dire ou préparer.</small><input name="pnote" maxlength="200" value="${esc(p?.note || '')}"></label>
      </div></fieldset>`;
  }
  const lireProchaine = (f) => (f.get('aucune') ? null : { type: f.get('ptype'), date: f.get('pdate') || auj(), note: String(f.get('pnote') || '').trim() });

  function modaleContact(id) {
    const c = id ? contact(id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(c?.nom || '')}" placeholder="Prénom et nom"></label>
      <label class="champ">Entreprise ou organisation<small>Facultatif.</small><input name="entreprise" maxlength="80" value="${esc(c?.entreprise || '')}"></label>
      <div class="deux"><label class="champ">E-mail<input type="email" name="email" maxlength="120" value="${esc(c?.email || '')}" autocomplete="off"></label>
      <label class="champ">Téléphone<input type="tel" name="tel" maxlength="30" value="${esc(c?.tel || '')}" autocomplete="off"></label></div>
      <label class="champ">Origine<select name="origine"><option value="">—</option>${B.origines.map((o) => `<option ${c?.origine === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      <label class="champ">Notes<small>Ce qui est utile à la relation commerciale, rien de plus (pas de santé, d'opinions ni de vie privée).</small><textarea name="notes" maxlength="1000">${esc(c?.notes || '')}</textarea></label>
      ${c ? '' : blocProchaine({ type: 'premier-contact', date: auj() })}
      ${c ? `<label class="case"><input type="checkbox" name="archive" ${c.archive ? 'checked' : ''}> Contact archivé (n'apparaît plus dans les relances)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = c
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le contact' : 'Nouveau contact', corps, pied, (f, act) => {
      if (act === 'supprimer') return supprimerContact(c.id) ? undefined : false;
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du contact.';
      memoriserAnnulation();
      const champs = { nom, entreprise: String(f.get('entreprise') || '').trim(), email: String(f.get('email') || '').trim(), tel: String(f.get('tel') || '').trim(), origine: f.get('origine') || '', notes: String(f.get('notes') || '').trim() };
      if (c) {
        Object.assign(c, champs, { archive: !!f.get('archive') });
        if (c.archive) c.prochaine = null;
        sauver(); rendre(); toast('Contact enregistré.');
      } else {
        const n = { id: uid(), ...champs, creeLe: auj(), prochaine: lireProchaine(f), archive: false };
        E.contacts.push(n);
        contactOuvert = n.id;
        sauver();
        if (vue !== 'contacts') changerVue('contacts'); else rendre();
        toast(`« ${nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
      }
    });
  }

  function supprimerContact(id) {
    const c = contact(id);
    const nb = E.documents.filter((d) => d.contactId === id).length + E.projets.filter((p) => p.contactId === id).length;
    if (!confirm(`Supprimer « ${c.nom} », ses échanges${nb ? `, ses affaires et ses ${pluriel(E.documents.filter((d) => d.contactId === id).length, 'document')} suivis` : ''} ? Son chiffre d'affaires disparaîtra des chiffres. Pour le garder, archive-le plutôt.`)) return false;
    memoriserAnnulation();
    E.contacts = E.contacts.filter((x) => x.id !== id);
    E.echanges = E.echanges.filter((x) => x.contactId !== id);
    E.projets = E.projets.filter((x) => x.contactId !== id);
    E.documents = E.documents.filter((x) => x.contactId !== id);
    if (contactOuvert === id) contactOuvert = null;
    sauver(); rendre(); toast(`« ${c.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
    return true;
  }

  // Échange : nouveau (éventuellement depuis « Fait ») ou modification d'un échange existant.
  function modaleEchange(contactId, echangeId, depuisAction = false) {
    if (!E.contacts.length) { modaleContact(); toast('Ajoute d\'abord un contact.'); return; }
    const e = echangeId ? E.echanges.find((x) => x.id === echangeId) : null;
    const c = contact(e?.contactId || contactId);
    const p = c?.prochaine;
    const fait = depuisAction && p ? action(p.type) : null;
    const typeDefaut = e?.type || (fait && /relance|proposition|temoignage/.test(fait.id) ? 'email' : 'appel');
    const principale = c ? affairePrincipale(c) : null;
    const suite = fait ? R.suiteDe(B.actions, fait.id) : (principale && etape(principale.etape)?.action) || 'relance-silence';
    // Échange libre : la prochaine action déjà prévue est gardée telle quelle.
    const proposee = (!fait && p) ? p : (R.proposerAction(B.actions, suite, auj()) || { type: 'relance-silence', date: ajout(auj(), 5), note: '' });
    const corps = `
      ${e || c ? `<p class="surtitre" style="margin:0">${esc(nomComplet(c))}</p><input type="hidden" name="contact" value="${c.id}">` : `<label class="champ">Contact<select name="contact">${optionsContacts(contactId)}</select></label>`}
      <div class="deux"><label class="champ">Date<input type="date" name="date" value="${e?.date || auj()}" max="${auj()}" required></label>
      <label class="champ">Type<select name="type">${B.typesEchange.map((x) => `<option value="${x.id}" ${x.id === typeDefaut ? 'selected' : ''}>${x.nom}</option>`).join('')}</select></label></div>
      <label class="champ">Résumé<textarea name="resume" maxlength="1000" placeholder="Ce qui a été dit, décidé, promis.">${esc(e?.resume || (fait ? `${fait.nom}${p.note ? ` : ${p.note}` : ''}` : ''))}</textarea></label>
      ${e ? '' : blocProchaine(proposee)}
      ${e ? '' : `<p class="aide" id="conseil-action">${esc(action(proposee.type)?.conseil || '')}</p>`}
      <p class="erreur" role="alert"></p>`;
    const pied = e
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : `<button class="btn primaire" value="ok">${fait ? 'Noter et planifier' : 'Enregistrer'}</button><button class="btn" value="annuler">Annuler</button>`;
    ouvrirModale(e ? 'Modifier l\'échange' : fait ? `Fait : ${esc(fait.nom)}` : 'Noter un échange', corps, pied, (f, act) => {
      memoriserAnnulation();
      if (act === 'supprimer') {
        E.echanges = E.echanges.filter((x) => x.id !== e.id);
        sauver(); rendre(); toast('Échange supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const date = f.get('date');
      if (!date || date > auj()) return 'La date de l\'échange ne peut pas être dans le futur.';
      const champs = { contactId: f.get('contact'), date, type: f.get('type'), resume: String(f.get('resume') || '').trim() };
      if (e) { Object.assign(e, champs); sauver(); rendre(); toast('Échange enregistré.'); return; }
      E.echanges.push({ id: uid(), ...champs });
      const cc = contact(champs.contactId);
      cc.prochaine = lireProchaine(f);
      sauver(); rendre();
      toast(cc.prochaine ? `Noté. Prochaine action ${quand(cc.prochaine.date)} : ${action(cc.prochaine.type)?.nom}.` : 'Échange noté.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePlanifier(id) {
    const c = contact(id);
    const p = c.prochaine || R.proposerAction(B.actions, etape(affairePrincipale(c)?.etape)?.action || 'relance-silence', auj());
    ouvrirModale(`Prochaine action · ${esc(c.nom)}`, `${blocProchaine(p, false)}<p class="aide" id="conseil-action">${esc(action(p.type)?.conseil || '')}</p><p class="erreur" role="alert"></p>`,
      `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
        memoriserAnnulation();
        c.prochaine = lireProchaine(f);
        if (c.archive && c.prochaine) c.archive = false;
        sauver(); rendre();
        toast(c.prochaine ? `Prévu ${quand(c.prochaine.date)}.` : 'Aucune action prévue.', { libelle: 'Annuler', faire: annuler });
      });
  }

  function modaleAffaire(id, contactId) {
    if (!E.contacts.length) { modaleContact(); toast('Ajoute d\'abord un contact.'); return; }
    const p = id ? projet(id) : null;
    const corps = `
      <label class="champ">Contact<select name="contact">${optionsContacts(p?.contactId || contactId || contactOuvert)}</select></label>
      <label class="champ">Titre<input name="titre" required maxlength="100" value="${esc(p?.titre || '')}" placeholder="Ex. : Refonte du site"></label>
      <div class="deux"><label class="champ">Montant estimé (HT)<input name="montant" inputmode="decimal" value="${p?.montant ?? ''}" placeholder="0"></label>
      <label class="champ">Décision attendue<input type="date" name="decision" value="${p?.decision || ''}"></label></div>
      <label class="champ">Étape<select name="etape" data-action="etape-select">${B.etapes.map((e) => `<option value="${e.id}" ${e.id === (p?.etape || 'piste') ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
      <label class="champ" data-si="gagne" ${p?.etape === 'gagne' ? '' : 'hidden'}>Avancement<select name="avancement">${B.avancements.map((a) => `<option value="${a.id}" ${a.id === (p?.avancement || 'a-venir') ? 'selected' : ''}>${a.nom}</option>`).join('')}</select></label>
      <label class="champ" data-si="perdu" ${p?.etape === 'perdu' ? '' : 'hidden'}>Motif<select name="motif"><option value="">—</option>${B.motifsPerte.map((m) => `<option ${p?.motif === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier l\'affaire' : 'Nouvelle affaire', corps, pied, (f, act) => {
      memoriserAnnulation();
      if (act === 'supprimer') {
        if (!confirm(`Supprimer l'affaire « ${p.titre} » ? Les devis et factures liés restent suivis.`)) return false;
        E.projets = E.projets.filter((x) => x.id !== p.id);
        E.documents.forEach((d) => { if (d.projetId === p.id) d.projetId = null; });
        sauver(); rendre(); toast('Affaire supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      const montant = String(f.get('montant') || '').trim() === '' ? 0 : nombreSaisi(f.get('montant'));
      if (!titre) return 'Indique un titre.';
      if (!Number.isFinite(montant) || montant < 0) return 'Montant : un nombre positif, en euros.';
      const champs = { contactId: f.get('contact'), titre, montant: R.arrondi(montant), decision: f.get('decision') || null, etape: f.get('etape'), avancement: f.get('etape') === 'gagne' ? f.get('avancement') : null, motif: f.get('etape') === 'perdu' ? f.get('motif') : '', maj: auj() };
      const avant = p?.etape;
      if (p) Object.assign(p, champs); else E.projets.push({ id: uid(), creeLe: auj(), ...champs });
      const changement = !p || avant !== champs.etape;
      const msg = changement ? proposerSelonEtape(contact(champs.contactId), champs.etape) : '';
      sauver(); rendre();
      toast(`${p ? 'Affaire enregistrée.' : 'Affaire créée.'}${msg}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // À l'entrée d'une étape, propose l'action type si rien n'est prévu plus tôt.
  function proposerSelonEtape(c, idEtape) {
    const e = etape(idEtape);
    if (!c || !e || c.archive) return '';
    const p = R.proposerAction(B.actions, e.action, auj());
    if (c.prochaine && c.prochaine.date <= p.date) return '';
    c.prochaine = p;
    return ` Prochaine action : ${action(p.type).nom}, ${quand(p.date)}.`;
  }

  function modaleDocument(id, type, contactId) {
    if (!E.contacts.length) { modaleContact(); toast('Ajoute d\'abord un contact.'); return; }
    const d = id ? documentDe(id) : null;
    const ty = d?.type || type || 'facture';
    const facture = ty === 'facture';
    const t = auj();
    const cid = d?.contactId || contactId || contactOuvert || E.contacts[0].id;
    const projetsDe = (x) => E.projets.filter((p) => p.contactId === x);
    const st = d ? R.statutDocument(d, t, delai()) : null;
    const tva = d?.tva ?? E.reglages.tva ?? '';
    const corps = `
      <div class="deux"><label class="champ">Numéro<small>Celui de ton logiciel de facturation.</small><input name="numero" maxlength="40" value="${esc(d?.numero || R.numeroSuivant(E.documents, ty, t.slice(0, 4)))}"></label>
      <label class="champ">Date<input type="date" name="date" value="${d?.date || t}" required></label></div>
      <label class="champ">Contact<select name="contact" data-action="doc-contact">${optionsContacts(cid)}</select></label>
      <label class="champ">Affaire<select name="projet"><option value="">—</option>${projetsDe(cid).map((p) => `<option value="${p.id}" ${p.id === d?.projetId ? 'selected' : ''}>${esc(p.titre)}</option>`).join('')}</select></label>
      <label class="champ">Objet<input name="objet" maxlength="120" value="${esc(d?.objet || '')}"></label>
      <div class="deux"><label class="champ">Montant HT (€)<input name="ht" inputmode="decimal" required value="${d?.ht ?? ''}" data-action="calcul-ttc"></label>
      <label class="champ">TVA (%)<small>Ton taux, saisi.</small><input name="tva" inputmode="decimal" required value="${tva}" data-action="calcul-ttc"></label></div>
      <p class="aide" id="ttc">${d ? `TTC : ${eur(R.ttc(d))}` : 'TTC calculé à la saisie.'}</p>
      ${facture
        ? `<label class="champ">Délai de paiement (jours)<small>Échéance = date + délai. Par défaut : ${delai()} jours (réglages).</small><input name="delai" type="number" min="0" max="365" value="${d?.delai ?? delai()}"></label>
           <label class="champ">Statut<select name="statut"><option value="envoyee" ${d?.statut !== 'annulee' && d?.statut !== 'brouillon' ? 'selected' : ''}>Émise (payée ou non selon les encaissements)</option><option value="brouillon" ${d?.statut === 'brouillon' ? 'selected' : ''}>Pas encore envoyée</option><option value="annulee" ${d?.statut === 'annulee' ? 'selected' : ''}>Annulée</option></select></label>`
        : `<label class="champ">Valable jusqu'au<input type="date" name="validite" value="${d?.validite || ajout(t, 30)}"></label>
           <label class="champ">Statut<select name="statut">${[['brouillon', 'Brouillon'], ['envoye', 'Envoyé'], ['accepte', 'Accepté'], ['refuse', 'Refusé']].map(([v, l]) => `<option value="${v}" ${(d?.statut || 'envoye') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${d && facture ? `<div class="groupe"><h3>Encaissements ${etiquetteDoc(st)}</h3>
          ${d.paiements.length ? `<ul class="paiements">${d.paiements.map((p) => `<li><span>${fmt(p.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${esc(p.mode || '')}</span><b>${eur(p.montant)}</b><button type="button" class="lien-texte" data-action="paiement-suppr" data-id="${d.id}" data-p="${p.id}">Retirer</button></li>`).join('')}</ul>` : '<p class="vide-texte">Aucun encaissement.</p>'}
          <p>Reste dû : <b>${eur(Math.max(0, R.solde(d)))}</b> · échéance ${fmtLong(R.echeance(d, delai()))}</p>
          ${R.solde(d) > 0.005 ? `<div class="rang"><button type="button" class="btn petit" data-action="encaisser" data-id="${d.id}">Ajouter un encaissement</button></div>` : ''}</div>` : ''}
      ${d && !facture && d.statut === 'accepte' && !E.documents.some((x) => x.devisId === d.id) ? `<div class="groupe"><h3>Devis accepté</h3><p class="aide">Une fois la facture établie dans ton outil de facturation, reporte-la ici en un clic.</p><div class="rang"><button type="button" class="btn petit" data-action="devis-facture" data-id="${d.id}">Suivre la facture de ce devis</button></div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = d
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(d ? `${facture ? 'Facture' : 'Devis'} ${esc(d.numero || '')}` : facture ? 'Suivre une facture' : 'Suivre un devis', corps, pied, (f, act) => {
      memoriserAnnulation();
      if (act === 'supprimer') {
        if (!confirm(`Retirer ${facture ? 'cette facture' : 'ce devis'} du suivi ?`)) return false;
        E.documents = E.documents.filter((x) => x.id !== d.id);
        sauver(); rendre(); toast('Document retiré du suivi.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const ht = nombreSaisi(f.get('ht'));
      const tx = nombreSaisi(f.get('tva'));
      if (!f.get('date')) return 'Indique la date.';
      if (!Number.isFinite(ht) || ht < 0 || String(f.get('ht')).trim() === '') return 'Montant HT : un nombre positif, en euros.';
      if (!Number.isFinite(tx) || tx < 0 || tx > 100 || String(f.get('tva')).trim() === '') return 'TVA : ton taux en % (0 si tu n\'en factures pas).';
      const champs = { numero: String(f.get('numero') || '').trim(), date: f.get('date'), contactId: f.get('contact'), projetId: f.get('projet') || null, objet: String(f.get('objet') || '').trim(), ht: R.arrondi(ht), tva: tx, statut: f.get('statut') };
      if (facture) {
        const dl = Number(f.get('delai'));
        if (!Number.isInteger(dl) || dl < 0 || dl > 365) return 'Délai de paiement : un nombre de jours entre 0 et 365.';
        champs.delai = dl;
      } else champs.validite = f.get('validite') || null;
      const avant = d?.statut;
      if (d) Object.assign(d, champs); else E.documents.push({ id: uid(), type: ty, paiements: [], ...champs });
      // Un devis accepté fait passer l'affaire liée à « Gagné ».
      let msg = '';
      if (!facture && champs.statut === 'accepte' && avant !== 'accepte' && champs.projetId) {
        const p = projet(champs.projetId);
        if (p && etape(p.etape)?.ouverte) { p.etape = 'gagne'; p.avancement = 'a-venir'; p.maj = auj(); msg = ` Affaire « ${p.titre} » passée à Gagné.${proposerSelonEtape(contact(p.contactId), 'gagne')}`; }
      }
      if (!facture && champs.statut === 'envoye' && avant !== 'envoye' && champs.projetId) {
        const p = projet(champs.projetId);
        if (p && ['piste', 'qualifie'].includes(p.etape)) { p.etape = 'proposition'; p.maj = auj(); msg = ` Affaire passée à « Proposition envoyée ».${proposerSelonEtape(contact(p.contactId), 'proposition')}`; }
      }
      sauver(); rendre();
      toast(`${d ? 'Document enregistré.' : facture ? 'Facture suivie.' : 'Devis suivi.'}${msg}`, { libelle: 'Annuler', faire: annuler });
    });
    majTTC();
  }

  function majTTC() {
    const f = modale().querySelector('form');
    const el = $('#ttc');
    if (!f || !el) return;
    const ht = nombreSaisi(f.ht?.value), tx = nombreSaisi(f.tva?.value);
    if (Number.isFinite(ht) && Number.isFinite(tx) && f.ht.value !== '' && f.tva.value !== '') el.textContent = `TTC : ${eur(R.ttc({ ht, tva: tx }))} (TVA ${eur(R.ttc({ ht, tva: tx }) - ht)})`;
  }

  function modaleEncaissement(id) {
    const d = documentDe(id);
    const reste = Math.max(0, R.solde(d));
    ouvrirModale(`Encaissement · ${esc(d.numero || 'facture')}`, `
      <p class="aide">${esc(nomComplet(contact(d.contactId)))} · ${eur(R.ttc(d))} TTC · reste dû ${eur(reste)}</p>
      <div class="deux"><label class="champ">Date<input type="date" name="date" value="${auj()}" max="${auj()}" required></label>
      <label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${reste.toFixed(2).replace('.', ',')}" required></label></div>
      <label class="champ">Mode<select name="mode">${B.modesPaiement.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = nombreSaisi(f.get('montant'));
      if (!Number.isFinite(m) || m <= 0) return 'Montant : un nombre positif.';
      if (!f.get('date') || f.get('date') > auj()) return 'La date ne peut pas être dans le futur.';
      memoriserAnnulation();
      d.paiements.push({ id: uid(), date: f.get('date'), montant: R.arrondi(m), mode: f.get('mode') });
      const c = contact(d.contactId);
      // Facture soldée : la relance de facture prévue n'a plus lieu d'être.
      if (R.solde(d) <= 0.005 && c?.prochaine?.type === 'relance-facture' && !R.facturesEnRetard(E.documents, auj(), delai()).some((x) => x.contactId === c.id)) c.prochaine = null;
      sauver(); rendre();
      toast(R.solde(d) <= 0.005 ? `${d.numero || 'Facture'} payée.` : `Encaissé. Reste ${eur(R.solde(d))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleAide() {
    const r = B.reperes;
    const consulte = fmtLong(r.consulteLe);
    const source = (x) => `<p class="source">Source : <a href="${x.url}" target="_blank" rel="noopener">${esc(x.source)}</a>, consultée le ${consulte}.</p>`;
    ouvrirModale('Aide et repères', `
      <div class="aide-bloc"><h3>Ce que fait ce CRM</h3><p>Il garde tes prospects et clients, l'historique de vos échanges et la prochaine action datée de chacun. Chaque matin, l'onglet Aujourd'hui liste les relances du jour, les factures en retard et les devis sans réponse. Les étapes de vente et les ${B.actions.length} actions types proposent la suite après chaque échange.</p></div>
      <div class="aide-bloc"><h3>Ce n'est pas un logiciel de facturation</h3><p>Le CRM <b>suit</b> tes devis et factures (montants, dates, encaissements) ; il n'en émet aucun, ne vérifie ni les mentions obligatoires ni ta TVA, et ne remplace pas ta comptabilité. Aucun taux de TVA n'est intégré : tu saisis le tien.</p><p>${esc(r.facturationElectronique.texte)}</p>${source(r.facturationElectronique)}</div>
      <div class="aide-bloc"><h3>Délais de paiement</h3><p>${esc(r.delaiPaiement.texte)} Le délai par défaut du CRM (${delai()} jours) se change dans les réglages ou facture par facture.</p>${source(r.delaiPaiement)}</div>
      <div class="aide-bloc"><h3>Données de tes clients et prospects (RGPD)</h3>
        <p>Ce que tu notes ici concerne d'autres personnes : tu en es responsable. Les données sont enregistrées en ligne avec ta clé, sur l'hébergement du site QME.</p>
        <ul class="puces-texte">
          <li>Ne note que ce qui sert la relation commerciale ; jamais de santé, d'opinions, de vie privée.</li>
          <li>Informe tes prospects de l'usage de leurs coordonnées et respecte leur refus d'être recontactés.</li>
          <li>Sur demande, communique ou supprime les données d'une personne (fiche contact : Modifier, puis Supprimer).</li>
          <li>Ne garde pas indéfiniment : le CRM signale « à revoir » les contacts sans échange depuis ${pluriel(E.reglages.conservationAns, 'an')} (réglable).</li>
        </ul>
        <p>${esc(r.conservation.texte)}</p>${source(r.conservation)}</div>
      <p class="aide">Outil d'aide : ces repères ne sont ni un conseil juridique, ni fiscal, ni comptable. Vérifie-les sur les sites officiels, ils peuvent changer.</p>`,
    '<button class="btn primaire" value="ok">Compris</button>');
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Ton prénom<input name="nom" maxlength="40" value="${esc(E.nom)}"></label>
      <div class="deux"><label class="champ">Délai de paiement par défaut (jours)<input type="number" name="delai" min="0" max="120" value="${r.delaiPaiement}"></label>
      <label class="champ">Taux de TVA habituel (%)<input name="tva" inputmode="decimal" value="${r.tva ?? ''}"></label></div>
      <div class="deux"><label class="champ">Relancer un devis après (jours)<input type="number" name="relance" min="1" max="60" value="${r.relanceDevis}"></label>
      <label class="champ">Contacts « à revoir » après (ans)<small>Référentiel CNIL : 3 ans.</small><input type="number" name="conservation" min="1" max="10" value="${r.conservationAns}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Aide</h3><p class="aide">Facturation, délais de paiement, données de tes contacts (RGPD), avec les sources.</p><div class="rang"><button class="btn petit" type="button" data-action="aide">Aide et repères</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const dl = Number(f.get('delai')), rl = Number(f.get('relance')), cv = Number(f.get('conservation'));
      const tvaTexte = String(f.get('tva') || '').trim();
      const tva = tvaTexte === '' ? null : nombreSaisi(tvaTexte);
      if (!Number.isInteger(dl) || dl < 0 || dl > 120) return 'Délai de paiement : entre 0 et 120 jours.';
      if (tva !== null && (!Number.isFinite(tva) || tva < 0 || tva > 100)) return 'TVA : un pourcentage entre 0 et 100.';
      if (!Number.isInteger(rl) || rl < 1 || rl > 60) return 'Relance des devis : entre 1 et 60 jours.';
      if (!Number.isInteger(cv) || cv < 1 || cv > 10) return 'Durée « à revoir » : entre 1 et 10 ans.';
      E.nom = String(f.get('nom') || '').trim();
      Object.assign(r, { delaiPaiement: dl, tva, relanceDevis: rl, conservationAns: cv });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.contacts) || !Array.isArray(d.documents)) throw new Error();
        if (!confirm(`Remplacer ton CRM actuel par cette copie (${pluriel(d.contacts.length, 'contact')}, ${pluriel(d.documents.length, 'document')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        contactOuvert = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du CRM.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-freelance-${auj()}.json`;
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

  // ---------- Toast ----------
  let minuterieToast = null;
  function toast(texte, act) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${act ? `<button type="button">${esc(act.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (act) el.querySelector('button').onclick = () => { el.hidden = true; act.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, act ? 7000 : 4000);
  }

  // ---------- Actions ----------
  function relancer(c, type, note) {
    memoriserAnnulation();
    c.prochaine = { type, date: auj(), note };
    c.archive = false;
    sauver(); rendre();
    toast(`${action(type).nom} ajouté aux relances du jour pour ${c.nom}.`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); contactOuvert = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'aide': modaleAide(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'contact-nouveau': modaleContact(); break;
      case 'contact-modifier': modaleContact(id); break;
      case 'contact-supprimer': supprimerContact(id); break;
      case 'ouvrir-contact': if (modale().open) modale().close(); if (vue === 'contacts') { contactOuvert = id; rendre(); window.scrollTo({ top: 0 }); } else changerVue('contacts', id); break;
      case 'fermer-contact': contactOuvert = null; rendre(); break;
      case 'filtre-contacts': filtreContacts = id; if (vue !== 'contacts') changerVue('contacts'); else rendre(); break;
      case 'filtre-docs': filtreDocs = id; rendre(); break;
      case 'archiver': { const c = contact(id); memoriserAnnulation(); c.archive = true; c.prochaine = null; sauver(); rendre(); toast(`« ${c.nom} » archivé.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'fait': modaleEchange(id, null, true); break;
      case 'echange-nouveau': modaleEchange(id || (vue === 'contacts' ? contactOuvert : null)); break;
      case 'echange-modifier': modaleEchange(null, id); break;
      case 'planifier': modalePlanifier(id); break;
      case 'reporter': { const c = contact(id); memoriserAnnulation(); c.prochaine = { ...c.prochaine, date: ajout(auj(), 1) }; sauver(); rendre(); toast(`${c.nom} : reporté à demain.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'affaire-nouvelle': modaleAffaire(null, id); break;
      case 'affaire-modifier': modaleAffaire(id); break;
      case 'etape-suivante': {
        const p = projet(id); memoriserAnnulation();
        p.etape = R.etapeSuivante(B.etapes, p.etape); p.maj = auj();
        if (p.etape === 'gagne') p.avancement = 'a-venir';
        const msg = proposerSelonEtape(contact(p.contactId), p.etape);
        sauver(); rendre(); toast(`« ${p.titre} » : ${etape(p.etape).nom}.${msg}`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'affaire-perdue': {
        const p = projet(id); memoriserAnnulation();
        p.etape = 'perdu'; p.maj = auj(); p.avancement = null;
        const msg = proposerSelonEtape(contact(p.contactId), 'perdu');
        sauver(); rendre(); toast(`« ${p.titre} » perdue.${msg} Indique le motif dans l'affaire.`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'avancement': {
        const p = projet(id); memoriserAnnulation();
        p.avancement = p.avancement === 'en-cours' ? 'termine' : 'en-cours'; p.maj = auj();
        let msg = '';
        if (p.avancement === 'termine') { const c = contact(p.contactId); const s = R.proposerAction(B.actions, 'livraison', auj()); if (c && (!c.prochaine || c.prochaine.date > s.date)) { c.prochaine = s; msg = ' Prochaine action : livrer et facturer.'; } }
        sauver(); rendre(); toast(`« ${p.titre} » : ${B.avancements.find((v) => v.id === p.avancement).nom}.${msg}`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'document': modaleDocument(id); break;
      case 'document-nouveau': modaleDocument(null, el.dataset.type, id); break;
      case 'encaisser': modaleEncaissement(id); break;
      case 'paiement-suppr': {
        const d = documentDe(id); memoriserAnnulation();
        d.paiements = d.paiements.filter((p) => p.id !== el.dataset.p);
        sauver(); rendre(); modaleDocument(id); toast('Encaissement retiré.', { libelle: 'Annuler', faire: () => { modale().close(); annuler(); } }); break;
      }
      case 'devis-facture': {
        const d = documentDe(id); memoriserAnnulation();
        const f = R.factureDepuisDevis(d, { id: uid(), numero: R.numeroSuivant(E.documents, 'facture', auj().slice(0, 4)), date: auj(), delai: delai() });
        E.documents.push(f);
        sauver(); rendre(); modaleDocument(f.id); toast('Facture préremplie depuis le devis : vérifie son numéro.', { libelle: 'Annuler', faire: () => { modale().close(); annuler(); } }); break;
      }
      case 'relancer-facture': { const d = documentDe(id); const c = contact(d.contactId); if (c) relancer(c, 'relance-facture', `${d.numero || 'Facture'} : ${eur(R.solde(d))} dus depuis le ${fmt(R.echeance(d, delai()))}.`); break; }
      case 'relancer-devis': { const d = documentDe(id); const c = contact(d.contactId); if (c) relancer(c, 'relance-devis', `${d.numero || 'Devis'} envoyé le ${fmt(d.date)}.`); break; }
      case 'bascule-prochaine': { const b = modale().querySelector('.prochaine-champs'); if (b) b.hidden = el.checked; const ca = $('#conseil-action'); if (ca) ca.hidden = el.checked; break; }
      default: break;
    }
  });

  // Champs dépendants dans les modales.
  document.addEventListener('change', (e) => {
    const el = e.target;
    const act = el.dataset?.action;
    if (act === 'type-action') {
      const a = action(el.value);
      const f = el.form;
      if (a && f?.pdate) f.pdate.value = ajout(auj(), a.delai);
      const ca = $('#conseil-action'); if (ca && a) ca.textContent = a.conseil;
    } else if (act === 'etape-select') {
      modale().querySelectorAll('[data-si]').forEach((x) => { x.hidden = x.dataset.si !== el.value; });
    } else if (act === 'doc-contact') {
      const sel = el.form.projet;
      sel.innerHTML = `<option value="">—</option>${E.projets.filter((p) => p.contactId === el.value).map((p) => `<option value="${p.id}">${esc(p.titre)}</option>`).join('')}`;
    }
  });
  document.addEventListener('input', (e) => { if (e.target.dataset?.action === 'calcul-ttc') majTTC(); });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'aujourdhui' && !modale().open) rendre();
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
  window.__crm = { etat: () => E };
  init();
})();
