// CRM et prospection QME : contacts (prospects et clients), prochaines actions, cadences de relance et scripts,
// pipeline des affaires, suivi des devis et factures, chiffres de conversion et de chiffre d'affaires.
// Né le 22/11/2026 de la fusion du CRM freelance et du Pipeline de prospection B2B (données du CRM reprises sans perte).
// Données synchronisées par clé de licence. Suivi seulement : ce n'est pas un logiciel de facturation, et
// l'application n'envoie aucun message (les scripts se copient et s'envoient depuis ta messagerie).
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
  const NOM = 'CRM et prospection';

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
  const texteSurCouleur = (id) => (['jaune', 'orange'].includes(id) ? 'var(--encre)' : '#fff');
  const etape = (id) => B.etapes.find((e) => e.id === id);
  const action = (id) => B.actions.find((a) => a.id === id);
  const typeEchange = (id) => B.typesEchange.find((t) => t.id === id) || B.typesEchange.at(-1);
  const canalNom = (id) => B.canaux.find((c) => c.id === id)?.nom || '';
  const echangeDuCanal = (id) => B.canaux.find((c) => c.id === id)?.echange || 'email';
  const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}\u00a0%`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let contactOuvert = null;
  let filtreContacts = 'tous';
  let recherche = '';
  let filtreDocs = 'tous';
  let anneeChiffres = null;
  let periode = '365';
  let apercu = '';
  let annulation = null;

  // État : données du CRM freelance d'avant la fusion lues sans perte (regles.js, normaliser).
  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const contact = (id) => E.contacts.find((c) => c.id === id);
  const projet = (id) => E.projets.find((p) => p.id === id);
  const documentDe = (id) => E.documents.find((d) => d.id === id);
  const delai = () => E.reglages.delaiPaiement;
  const statutC = (c) => (c.oppose ? 'oppose' : R.statutContact(c, E.projets, E.documents));
  const ctxRgpd = () => ({ echanges: E.echanges, documents: E.documents, projets: E.projets, etapes: B.etapes, cadences: E.cadences });
  // Prochaine action : relance de la cadence en cours, sinon action datée à la main.
  const prochaine = (c) => R.prochaineDe(c, E.cadences);
  const cadence = (id) => E.cadences.find((x) => x.id === id);
  const script = (id) => E.scripts.find((s) => s.id === id);
  const valeurs = (c) => R.valeursScript(c, { monPrenom: E.nom, monActivite: E.reglages.monActivite });
  const libelleAction = (p) => (p?.relance ? `Relance ${p.relance.index + 1} sur ${p.relance.total} · ${canalNom(p.relance.canal)}` : (action(p?.type)?.nom || 'Action'));
  const conseilAction = (p) => (p?.relance ? (script(p.relance.script)?.titre ? `Script : ${script(p.relance.script).titre}. Prépare le message, envoie-le toi-même, puis touche Envoyé.` : 'Envoie ton message, puis touche Envoyé.') : (action(p?.type)?.conseil || ''));
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
  // L'historique de prospection est simulé avec les vraies règles (cadences, étapes) pour couvrir chaque état :
  // relance du jour, en retard, reportée, cadence terminée sans réponse, réponse reçue, opposition, client récurrent.
  function donneesDemo() {
    const D = etatVide();
    D.nom = 'Camille';
    D.reglages.tva = 20;
    D.reglages.monActivite = 'je conçois l\'identité visuelle et les supports imprimés des commerces et PME de ma région';
    const t = auj();
    const j = (n) => ajout(t, n);
    const C = (nom, entreprise, origine, cree, extra = {}) => {
      const c = { id: uid(), nom, entreprise, fonction: '', canal: '', email: `${nom.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@example.com`, tel: '', origine, notes: '', creeLe: j(cree), prochaine: null, archive: false, cadence: null, oppose: null, ...extra };
      D.contacts.push(c); return c;
    };
    const X = (c, n, type, resume, sens) => D.echanges.push({ id: uid(), contactId: c.id, date: j(n), type, resume, ...(sens ? { sens } : {}) });
    const P = (c, titre, et, montant, cree, extra = {}) => { const p = { id: uid(), contactId: c.id, titre, etape: et, etapeMax: Math.max(0, R.rang(B.etapes, et)), montant, creeLe: j(cree), maj: j(cree), decision: null, avancement: et === 'gagne' ? 'a-venir' : null, motif: '', ...extra }; D.projets.push(p); return p; };
    const F = (c, p, numero, date, objet, ht, extra = {}) => { const d = { id: uid(), type: 'facture', numero, contactId: c.id, projetId: p?.id || null, date: j(date), objet, ht, tva: 20, delai: 30, statut: 'envoyee', paiements: [], ...extra }; D.documents.push(d); return d; };
    const Q = (c, p, numero, date, objet, ht, statut, validite) => { const d = { id: uid(), type: 'devis', numero, contactId: c.id, projetId: p?.id || null, date: j(date), objet, ht, tva: 20, validite: j(validite), statut, paiements: [] }; D.documents.push(d); return d; };
    const pay = (d, date, montant, mode = 'Virement') => d.paiements.push({ id: uid(), date: j(date), montant, mode });
    const an = new Date().getFullYear();
    const num = (l, n, decal = 0) => `${l}-${an + decal}-${String(n).padStart(3, '0')}`;
    // Prospection : cadence démarrée à `debut`, messages envoyés aux jours `envois` (notés comme échanges).
    const prospecter = (c, cad, debut, envois = []) => {
      Object.assign(c, R.demarrerCadence(c, cad, j(debut)));
      for (const n of envois) {
        const r = R.relanceCourante(c, D.cadences);
        if (!r) break;
        X(c, n, echangeDuCanal(r.canal), `Relance ${r.index + 1} sur ${r.total} : ${D.scripts.find((s) => s.id === r.script)?.titre || 'message'}`, 'envoye');
        Object.assign(c, R.enregistrerEnvoi(c, D.cadences, j(n)));
      }
      return c;
    };

    // Clients récurrents : historique de factures sur 12 mois.
    const a = C('Hélène Marchal', 'Atelier des Tilleuls', 'Recommandation', -400, { fonction: 'Gérante', canal: 'recommandation', tel: '06 00 00 00 01', notes: 'Préfère le téléphone le matin. Décide seule.' });
    const pa = P(a, 'Refonte de la plaquette commerciale', 'gagne', 4800, -60, { avancement: 'en-cours' });
    a.prochaine = { type: 'point-avancement', date: t, note: 'Valider les maquettes des pages 3 à 6.' };
    X(a, -340, 'rdv', 'Premier rendez-vous : besoin d\'une identité visuelle pour la boutique.');
    X(a, -62, 'appel', 'Nouveau besoin : plaquette commerciale pour le salon de printemps.', 'recu');
    X(a, -14, 'visio', 'Présentation des premières maquettes, retours positifs.');
    [[-330, 1, 1800], [-250, 4, 1200], [-160, 9, 950], [-95, 14, 600]].forEach(([d, n, ht], i) => { const f = F(a, null, num('F', n, d < -300 && new Date(j(d)).getFullYear() < an ? -1 : 0), d, ['Identité visuelle', 'Déclinaison papeterie', 'Visuels de rentrée', 'Bannières en ligne'][i], ht); pay(f, d + 21, R.ttc(f)); });
    const fa = F(a, pa, num('F', 19), -20, 'Plaquette : acompte 30 %', 1440); pay(fa, -6, 1728);

    const b = C('Julien Ferrand', 'Ferrand & Associés', 'Réseau professionnel', -300, { fonction: 'Associé', canal: 'reseau' });
    const pb = P(b, 'Accompagnement éditorial annuel', 'gagne', 7200, -240, { avancement: 'en-cours' });
    b.prochaine = { type: 'relance-facture', date: j(-2), note: 'Deux factures en retard, dont une payée en partie.' };
    X(b, -235, 'rdv', 'Signature de l\'accompagnement mensuel (12 mois).');
    X(b, -3, 'email', 'Relance courtoise de la facture d\'octobre, pas de réponse.', 'envoye');
    for (let m = 8; m >= 1; m--) {
      const d = -m * 30 - 5;
      const f = F(b, pb, num('F', 20 - m), d, `Accompagnement éditorial, mois ${9 - m}`, 600, { delai: 30 });
      if (m > 2) pay(f, d + 28, 720);
      else if (m === 2) pay(f, d + 40, 300, 'Chèque'); // partielle, en retard
    }

    const c = C('Sophie Garnier', 'Les Jardins de Sophie', 'Site internet', -120, { fonction: 'Fondatrice', canal: 'email' });
    const pc = P(c, 'Site vitrine et photos produits', 'gagne', 3900, -110, { avancement: 'termine' });
    c.prochaine = { type: 'temoignage', date: j(3), note: '' };
    X(c, -110, 'appel', 'Demande d\'un site vitrine simple.', 'recu');
    X(c, -12, 'rdv', 'Livraison du site, cliente ravie.');
    const qc = Q(c, pc, num('D', 3), -108, 'Site vitrine et photos produits', 3900, 'accepte', -78);
    const fc1 = F(c, pc, num('F', 12), -100, 'Site vitrine : acompte', 1170, { devisId: qc.id }); pay(fc1, -92, 1404, 'Carte bancaire');
    F(c, pc, num('F', 21), -10, 'Site vitrine : solde', 2730, { devisId: qc.id });

    // Affaires à toutes les étapes de vente.
    const d = C('Marc Olivier', 'Cabinet Olivier Conseil', 'Salon ou événement', -25, { fonction: 'Directeur associé', canal: 'rencontre' });
    const pd = P(d, 'Rapport annuel et infographies', 'proposition', 5600, -20);
    X(d, -25, 'rdv', 'Rencontré au salon, besoin d\'un rapport annuel illustré.', 'recu');
    X(d, -14, 'email', 'Envoi du devis avec deux options.', 'envoye');
    Q(d, pd, num('D', 6), -14, 'Rapport annuel et infographies', 5600, 'envoye', 20);
    // Cadence « Suivi de proposition » démarrée à l'envoi du devis : deux relances faites, la troisième tombe aujourd'hui.
    prospecter(d, 'suivi', -14, [-11, -7]);

    const e = C('Nadia Benali', 'Boulangerie Benali', 'Recommandation', -9, { fonction: 'Gérante', canal: 'telephone' });
    P(e, 'Carte de fidélité et menu', 'rdv', 900, -9, { decision: j(10) });
    e.prochaine = { type: 'proposition', date: j(-1), note: 'Budget annoncé : environ 1 000 €.' };
    X(e, -8, 'appel', 'Besoin d\'une carte de fidélité et d\'un menu pour la vitrine.', 'recu');

    const g = C('Élise Caron', 'Studio Caron', 'Réseau professionnel', -40, { fonction: 'Directrice artistique', canal: 'reseau' });
    const pg = P(g, 'Charte graphique', 'negociation', 3200, -35, { decision: j(4) });
    g.prochaine = { type: 'point-decision', date: j(2), note: 'Demande une remise de 10 %.' };
    X(g, -35, 'visio', 'Découverte : nouvelle charte pour leurs 10 ans.');
    X(g, -5, 'appel', 'Discussion sur le prix, propose de réduire le nombre de déclinaisons.', 'recu');
    Q(g, pg, num('D', 5), -15, 'Charte graphique', 3200, 'envoye', -1); // expiré

    const h = C('Paul Lemaire', 'Agence Lemaire Immobilier', 'Plateforme de mise en relation', -70, { fonction: 'Directeur d\'agence', canal: 'email' });
    const ph = P(h, 'Brochures des biens', 'perdu', 2400, -65, { motif: 'Prix', etapeMax: R.rang(B.etapes, 'proposition') });
    X(h, -60, 'email', 'Devis envoyé.', 'envoye');
    X(h, -40, 'appel', 'A choisi une offre moins chère.', 'recu');
    Q(h, ph, num('D', 4), -60, 'Brochures des biens', 2400, 'refuse', -30);
    h.prochaine = { type: 'recontacter', date: j(140), note: '' };

    const k = C('Inès Morel', 'Association Les Petits Pas', 'Ancien client', -200, { fonction: 'Présidente', canal: 'email' });
    const pk = P(k, 'Affiche de la fête annuelle', 'echange', 650, -15);
    X(k, -15, 'message', 'Demande une affiche pour juin.', 'recu');
    Q(k, pk, num('D', 7), -2, 'Affiche de la fête annuelle', 650, 'brouillon', 28);
    // Pas de prochaine action : apparaît dans « sans prochaine action ».

    const n = C('Romain Giraud', 'Giraud Paysage', 'Recommandation', -18, { fonction: 'Gérant', canal: 'email' });
    const pn = P(n, 'Flyers de printemps', 'gagne', 750, -18, { avancement: 'a-venir' });
    n.prochaine = { type: 'lancement', date: j(5), note: '' };
    Q(n, pn, num('D', 8), -16, 'Flyers de printemps', 750, 'accepte', 14);
    X(n, -16, 'email', 'Devis accepté par retour de mail.', 'recu');

    // Prospection en cours : cadences à différents stades.
    const premier = (nom, entreprise, fonction, canal, origine, cree, envois, extra = {}) => {
      const x = C(nom, entreprise, origine, cree, { fonction, canal, ...extra });
      P(x, 'Premier contrat', envois.length ? 'contacte' : 'cible', 0, cree);
      return prospecter(x, extra.cadenceId || 'premier', cree, envois);
    };
    premier('Thomas Roux', 'Roux Menuiserie', 'Gérant', 'telephone', 'Prospection directe', 0, [], { notes: 'Vu son camion sans logo, appeler le matin.' });
    premier('Claire Fontaine', 'Fonderie des Trois Vallées', 'Responsable communication', 'email', 'Annuaire', -3, [-3]);
    premier('Hugo Marchand', 'Atelier Marchand Découpe', 'Responsable marketing', 'reseau', 'Réseau professionnel', -12, [-12, -9]); // en retard
    const so = premier('Bruno Caron', 'Forges de l\'Étang', 'Directeur commercial', 'email', 'Annuaire', -14, [-14, -11]);
    so.cadence.reporteAu = j(2); // reporté
    // Cadence terminée sans réponse : à recontacter plus tard ou à classer perdu.
    premier('Julie Perrin', 'Emballages Perrin', 'Responsable marketing', 'email', 'Annuaire', -35, [-35, -32, -28, -21, -7]);
    const douce = premier('Karim Haddad', 'Menuiserie Industrielle du Nord', 'Directeur de site', 'rencontre', 'Salon ou événement', -9, [-6], { cadenceId: 'douce' });
    // Réponse reçue : la cadence s'arrête, l'affaire passe « En échange ».
    X(douce, -2, 'email', 'Intéressé, demande des exemples de supports.', 'recu');
    douce.cadence = null;
    Object.assign(D.projets.find((p) => p.contactId === douce.id), R.changerEtape(D.projets.find((p) => p.contactId === douce.id), 'echange', B.etapes, j(-2)));
    douce.prochaine = { type: 'decouverte', date: j(1), note: 'Lui envoyer trois exemples avant l\'appel.' };
    // Opposition : plus aucune relance, seul le minimum est gardé.
    const op = premier('Lucie Fabre', 'Fabre Électronique', 'Responsable des achats', 'email', 'Annuaire', -18, [-18, -15]);
    Object.assign(op, R.opposer(op, j(-14)));
    D.echanges = D.echanges.filter((x) => x.contactId !== op.id);
    Object.assign(D.projets.find((p) => p.contactId === op.id), { etape: 'perdu', motif: 'Opposition à la prospection', maj: j(-14) });
    // Prospect perdu sans réponse, plus de 3 ans sans contact venant de lui : signalé pour le RGPD.
    const l = C('Yann Perrot', 'Perrot Transports', 'Salon ou événement', -1300, { fonction: 'Directeur', canal: 'email' });
    X(l, -1250, 'email', 'Envoi d\'une présentation après le salon, sans suite.', 'envoye');
    P(l, 'Premier contrat', 'perdu', 0, -1300, { motif: 'Pas de réponse', etapeMax: R.rang(B.etapes, 'contacte'), maj: j(-1200) });

    const m = C('Lucie Vidal', 'Café Vidal', 'Site internet', -500, { archive: true });
    X(m, -480, 'appel', 'Projet abandonné, la cliente a vendu son café.');

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
          <p class="surtitre">CRM et prospection</p>
          <h1>Personne à relancer n'est oublié.</h1>
          <p>Tes prospects et tes clients, la relance du jour calculée selon ta cadence, le message prêt à copier, tes affaires par étape et ce qui reste à encaisser.</p>
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
        <p class="mention">Pas encore de CRM ? <a href="/catalogue/crm/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
      <p class="intro">Quelques réglages, puis tu ajoutes ton premier contact. Tout reste modifiable dans les réglages.</p>
      <form id="form-accueil" class="accueil-form" novalidate>
        <label class="champ">Ton prénom <small>Pour l'accueil du matin et la signature des messages ({mon prénom}).</small><input name="nom" maxlength="40" autocomplete="given-name"></label>
        <label class="champ">Ton activité en une phrase <small>Remplit {mon activité} dans les scripts. Ex. : « j'aide les cabinets comptables à automatiser leurs relances ».</small><input name="activite" maxlength="160"></label>
        <label class="champ">Délai de paiement habituel (jours) <small>Sert à calculer l'échéance de tes factures. À défaut d'accord entre professionnels : ${B.reperes.delaiPaiement.defaut} jours (voir l'aide).</small><input name="delai" type="number" min="0" max="120" value="${B.reperes.delaiPaiement.defaut}" inputmode="numeric"></label>
        <label class="champ">Ton taux de TVA habituel (%) <small>Aucun taux n'est intégré : indique le tien (0 si tu es en franchise en base de TVA). Laisse vide si tu ne suis pas de factures ici.</small><input name="tva" inputmode="decimal" placeholder="Ex. : 0"></label>
        <p class="erreur" role="alert"></p>
        <div class="avertissement"><b>Suivi seulement.</b> Ce CRM suit tes devis, factures et encaissements ; il n'émet pas de factures et ne remplace ni ton logiciel de facturation ni ta comptabilité. Il n'envoie aucun message : tu copies le message préparé et tu l'envoies toi-même.</div>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer mon CRM</button></div>
      </form>
    </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const d = Number(f.get('delai'));
      const tvaTexte = String(f.get('tva') || '').trim();
      const tva = tvaTexte === '' ? null : nombreSaisi(tvaTexte);
      const err = e.target.querySelector('.erreur');
      if (!Number.isInteger(d) || d < 0 || d > 120) { err.textContent = 'Délai : un nombre de jours entre 0 et 120.'; return; }
      if (tva !== null && (!Number.isFinite(tva) || tva < 0 || tva > 100)) { err.textContent = 'TVA : un pourcentage entre 0 et 100 (0 si tu n\'en factures pas).'; return; }
      E = etatVide();
      E.nom = String(f.get('nom') || '').trim();
      E.reglages.monActivite = String(f.get('activite') || '').trim();
      E.reglages.delaiPaiement = d; E.reglages.tva = tva;
      sauver(); demarrer(); // le guide « Comment ça marche » s'ouvre, puis propose d'ajouter le premier contact
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
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['contacts', 'Contacts'], ['affaires', 'Pipeline'], ['factures', 'Factures'], ['chiffres', 'Chiffres']];
  // Sous-vue de l'onglet Pipeline : scripts de messages et cadences de relance.
  const VUES = [...ONGLETS, ['scripts', 'Scripts et cadences']];
  const ongletDe = (v) => (v === 'scripts' ? 'affaires' : v);

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">CRM et<br>prospection</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, aide et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === ongletDe(vue)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(VUES);
    document.title = `${titres[vue]} · ${NOM}`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, contacts: vueContacts, affaires: vueAffaires, scripts: vueScripts, factures: vueFactures, chiffres: vueChiffres }[vue]();
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
  const PIED = '<footer class="pied-app"><p><b>Suivi commercial</b> : ce CRM n\'émet pas de factures, n\'envoie aucun message et ne remplace ni un logiciel de facturation ni une comptabilité. Données de clients et de prospects : <button class="lien-texte" data-action="aide">tes obligations (RGPD) et repères</button>.</p></footer>';

  // ----- Aujourd'hui -----
  function vueAujourdhui() {
    const t = auj();
    const dues = R.actionsDues(E.contacts, t, E.cadences);
    const retards = dues.filter((x) => x.retard > 0).length;
    const s = R.synthese(E.documents, t, delai());
    const factRetard = R.facturesEnRetard(E.documents, t, delai());
    // Un devis dont le contact suit déjà une cadence de relance est relancé par elle.
    const devis = R.devisARelancer(E.documents, t, E.reglages.relanceDevis).filter((d) => !R.relanceCourante(contact(d.contactId), E.cadences));
    const sans = R.sansAction(E.contacts, E.projets, B.etapes, E.cadences);
    const terminees = E.contacts.filter((c) => R.cadenceTerminee(c, E.cadences));
    const avenir = R.actionsAVenir(E.contacts, t, 7, E.cadences);
    const envoyes = E.echanges.filter((x) => x.sens === 'envoye' && x.date === t).length;
    const salut = E.nom ? `Bonjour ${esc(E.nom)}. ` : '';
    const titre = !E.contacts.length ? `${salut}Commence par tes contacts.`
      : dues.length ? `${salut}<mark>${pluriel(dues.length, 'relance')}</mark> aujourd'hui.` : `${salut}<mark>Rien à relancer</mark> aujourd'hui.`;
    const carte = `<aside class="encaisser-carte ${s.retard > 0 ? '' : 'calme'}">
        <p class="surtitre">Reste à encaisser</p>
        <div class="compte">${eurCourt(s.reste)}</div>
        <p>${s.nbAEncaisser ? `${pluriel(s.nbAEncaisser, 'facture')}${s.nbRetard ? ` · <b>${eurCourt(s.retard)} en retard</b> (${s.nbRetard})` : ' · aucune en retard'}` : 'Aucune facture en attente.'}</p>
        <p class="petit">Encaissé ce mois-ci : ${eurCourt(s.encaisseMois)} HT</p>
      </aside>`;
    const cartes = dues.map(({ contact: c, retard, action: p }) => carteAction(c, retard, p)).join('');
    const p0 = avenir.length ? prochaine(avenir[0]) : null;
    const vide = !E.contacts.length
      ? videEtat('Aucun contact pour l\'instant', 'Ajoute un prospect avec sa cadence de relance, ou un client avec la prochaine action à faire : il apparaîtra ici le jour venu.', `<button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Ajouter un contact</button><button class="btn" data-action="contacts-plusieurs">En ajouter plusieurs</button>`)
      : videEtat(envoyes ? 'Relances du jour faites.' : 'Journée sans relance.', p0 ? `Prochaine action ${quand(p0.date)} : ${esc(libelleAction(p0))} avec ${esc(avenir[0].nom)}.` : 'Aucune action prévue cette semaine. Profites-en pour ajouter de nouveaux prospects.', '<button class="btn" data-action="vue" data-vue="contacts">Voir les contacts</button>');
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${dues.length || envoyes ? `<p class="sous">${envoyes ? `${pluriel(envoyes, 'message envoyé', 'messages envoyés')} aujourd'hui · ` : ''}${retards ? `<b style="color:var(--rouge)">${retards} en retard</b> · ` : ''}${avenir.length ? `${pluriel(avenir.length, 'autre action', 'autres actions')} dans les 7 jours` : 'rien d\'autre dans les 7 jours'}</p>` : ''}
          <div class="actions">
            <button class="btn primaire" data-action="echange-nouveau">${ICONES.plus}Noter un échange</button>
            <button class="btn" data-action="contact-nouveau">${ICONES.plus}Contact</button>
          </div>
        </div>
        ${carte}
      </section>
      <h2 class="titre-section">À relancer aujourd'hui <span>${dues.length ? '« Envoyé » fait avancer la cadence ; « Fait » note l\'échange et propose l\'action suivante.' : ''}</span></h2>
      ${dues.length ? `<ul class="cartes">${cartes}</ul>` : vide}
      ${terminees.length ? `<h2 class="titre-section">Cadences terminées sans réponse <span>Recontacte plus tard ou classe l'affaire perdue.</span></h2>
        <div class="liste-cadre">${terminees.map((c) => `<div class="ligne" style="--c:${couleurContact(c)}"><i></i><div><b>${esc(nomComplet(c))}</b><span>${esc(cadence(c.cadence.id)?.nom || 'Cadence')} · dernier message ${c.cadence.dernier ? quand(c.cadence.dernier) : '–'}</span></div><div class="ligne-actions"><button class="btn petit" data-action="recontacter" data-id="${c.id}">Recontacter plus tard</button><button class="btn petit" data-action="classer-perdu" data-id="${c.id}">Classer perdu</button></div></div>`).join('')}</div>` : ''}
      ${factRetard.length ? `<h2 class="titre-section">Factures en retard <span>Échéance dépassée, solde dû.</span></h2>
        <div class="liste-cadre">${factRetard.map((d) => ligneDocument(d, t, true)).join('')}</div>` : ''}
      ${devis.length ? `<h2 class="titre-section">Devis sans réponse <span>Envoyés depuis ${E.reglages.relanceDevis} jours ou plus.</span></h2>
        <div class="liste-cadre">${devis.map((d) => ligneDocument(d, t, true)).join('')}</div>` : ''}
      ${sans.length ? `<h2 class="titre-section">Sans prochaine action <span>Affaire en cours mais rien de prévu.</span></h2>
        <div class="liste-cadre">${sans.map((c) => `<div class="ligne" style="--c:${couleurContact(c)}"><i></i><div><b>${esc(nomComplet(c))}</b><span>${esc(affairePrincipale(c)?.titre || '')}</span></div><div class="ligne-actions"><button class="btn petit" data-action="planifier" data-id="${c.id}">Planifier</button></div></div>`).join('')}</div>` : ''}
      ${avenir.length ? `<h2 class="titre-section">Dans les 7 jours</h2>
        <div class="liste-cadre">${avenir.map((c) => { const p = prochaine(c); return `<button class="ligne cliquable" style="--c:${couleurContact(c)}" data-action="ouvrir-contact" data-id="${c.id}"><i></i><div><b>${esc(libelleAction(p))} · ${esc(c.nom)}</b><span>${esc(c.entreprise || '')}${p.note ? ` · ${esc(p.note)}` : ''}${p.relance && c.cadence?.reporteAu === p.date ? ' · reporté' : ''}</span></div><span class="quand">${quand(p.date)}</span></button>`; }).join('')}</div>` : ''}
      ${PIED}`;
  }

  // Carte d'une action due : relance de cadence (préparer, envoyé, a répondu) ou action datée (fait).
  function carteAction(c, retard, p) {
    const pr = affairePrincipale(c);
    const r = p.relance;
    const boutons = r
      ? `<button class="btn primaire" data-action="envoye" data-id="${c.id}">Envoyé</button>
          <button class="btn" data-action="message" data-id="${c.id}">Préparer</button>
          <button class="btn" data-action="repondu" data-id="${c.id}">A répondu</button>
          <span class="rang-inline"><button class="btn petit lien" data-action="reporter" data-id="${c.id}">Demain</button><button class="btn petit lien" data-action="ouvrir-contact" data-id="${c.id}">Fiche</button></span>`
      : `<button class="btn primaire" data-action="fait" data-id="${c.id}">Fait</button>
          <button class="btn" data-action="reporter" data-id="${c.id}">Demain</button>
          <button class="btn lien" data-action="ouvrir-contact" data-id="${c.id}">Fiche</button>`;
    return `
      <li class="carte" style="--c:${couleurContact(c)}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-meta-haut">${esc(c.entreprise || statutLibelle(statutC(c)))}${retard > 0 ? `<span class="etiquette rouge">En retard · ${retard} j</span>` : ''}${pr ? `<span class="etiquette clair">${esc(etape(pr.etape)?.nom)}</span>` : ''}${r ? `<span class="etiquette jaune">${esc(r.cadence.nom)}</span>` : ''}</p>
          <h3>${esc(libelleAction(p))} · ${esc(c.nom)}</h3>
          ${c.fonction ? `<p class="carte-note">${esc(c.fonction)}</p>` : ''}
          ${p.note ? `<p class="carte-note">${esc(p.note)}</p>` : ''}
          <p class="conseil-puce">${esc(conseilAction(p))}</p>
          <p class="carte-liens">${c.tel ? `<span>${esc(c.tel)}</span>` : ''}${c.email ? `<span>${esc(c.email)}</span>` : ''}</p>
        </div>
        <div class="carte-boutons">${boutons}</div>
      </li>`;
  }

  const statutLibelle = (s) => ({ client: 'Client', prospect: 'Prospect', archive: 'Archivé', oppose: 'Opposé à la prospection' }[s]);
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
    const nbOpposes = E.contacts.filter((c) => c.oppose).length;
    const filtres = [['tous', 'Tous'], ['prospect', 'Prospects'], ['client', 'Clients'], ['cadence', 'En cadence'], ['rgpd', `À revoir (${rgpd.length})`], ['archive', 'Archivés'], ...(nbOpposes ? [['oppose', `Opposés (${nbOpposes})`]] : [])];
    const liste = E.contacts.filter((c) => {
      const s = statutC(c);
      if (filtreContacts === 'tous' && (s === 'archive' || s === 'oppose')) return false;
      if (['prospect', 'client', 'archive', 'oppose'].includes(filtreContacts) && s !== filtreContacts) return false;
      if (filtreContacts === 'cadence' && !R.relanceCourante(c, E.cadences)) return false;
      if (filtreContacts === 'rgpd' && !aRevoir(c)) return false;
      return !q || `${c.nom} ${c.entreprise} ${c.fonction || ''} ${c.email} ${c.notes}`.toLowerCase().includes(q);
    }).sort((a, b) => (prochaine(a)?.date || '9999').localeCompare(prochaine(b)?.date || '9999') || a.nom.localeCompare(b.nom, 'fr'));
    const ouvert = contactOuvert ? contact(contactOuvert) : null;
    const items = liste.map((c) => {
      const s = statutC(c);
      const p = prochaine(c);
      return `<button class="contact-item" style="--c:${couleurContact(c)}" data-action="ouvrir-contact" data-id="${c.id}" aria-current="${ouvert?.id === c.id}">
        <i></i><span class="ci-texte"><b>${esc(c.nom)}</b><span>${esc(c.entreprise || statutLibelle(s))}</span></span>
        <span class="ci-quand ${p?.date && p.date < t ? 'retard' : ''}">${p?.date ? quand(p.date) : s === 'oppose' ? 'opposé' : s === 'archive' ? 'archivé' : R.cadenceTerminee(c, E.cadences) ? 'cadence finie' : '—'}</span>
      </button>`;
    }).join('');
    const tete = `<div class="vue-tete"><div><h1>Contacts</h1><p>${pluriel(E.contacts.filter((c) => !c.archive).length, 'contact')} : ${pluriel(E.contacts.filter((c) => statutC(c) === 'prospect').length, 'prospect')}, ${pluriel(E.contacts.filter((c) => statutC(c) === 'client').length, 'client')}. Triés par prochaine action.</p></div>
      <div class="actions"><button class="btn" data-action="contacts-plusieurs">En ajouter plusieurs</button><button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Contact</button></div></div>`;
    const bandeauRgpd = rgpd.length && filtreContacts !== 'rgpd' ? `<div class="avertissement rgpd"><b>${pluriel(rgpd.length, 'contact')} à revoir :</b> sans nouvelles de leur part depuis plus de ${pluriel(E.reglages.conservationAns, 'an')} et sans affaire en cours. Supprime ou archive ce qui n'est plus utile. <button class="lien-texte" data-action="filtre-contacts" data-id="rgpd">Les voir</button> · <button class="lien-texte" data-action="aide">Pourquoi ?</button></div>` : '';
    const listeHtml = `<div class="contacts-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un nom, une entreprise…" value="${esc(recherche)}" autocomplete="off"></label>
        <div class="puces" role="group" aria-label="Filtrer">${filtres.map(([id, nom]) => `<button class="puce" data-action="filtre-contacts" data-id="${id}" aria-pressed="${filtreContacts === id}">${nom}</button>`).join('')}</div>
        <div class="contacts-items">${items || `<p class="vide-texte">${E.contacts.length ? 'Aucun contact ne correspond.' : 'Aucun contact.'}</p>`}</div>
      </div>`;
    const fiche = ouvert ? ficheContact(ouvert) : `<div class="fiche-vide">${E.contacts.length ? videEtat('Choisis un contact', 'Sa fiche réunit ses coordonnées, sa cadence de relance ou sa prochaine action, l\'historique des échanges, ses affaires et ses factures.') : videEtat('Ton premier contact', 'Un prospect rencontré, un client en cours : note-le avec la prochaine action à faire.', `<button class="btn primaire" data-action="contact-nouveau">${ICONES.plus}Ajouter un contact</button>`)}</div>`;
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
    const p = prochaine(c);
    const revoir = aRevoir(c);
    const fini = R.cadenceTerminee(c, E.cadences);
    const k = c.cadence ? cadence(c.cadence.id) : null;
    const frise = k ? R.frise(k).map((x, i) => `<li class="${i < c.cadence.pas ? 'fait' : i === c.cadence.pas ? 'courant' : ''}"><b>J${x.jour ? `+${x.jour}` : '0'}</b><span>${esc(canalNom(x.canal))}</span></li>`).join('') : '';
    let blocProchaineFiche;
    if (c.oppose) blocProchaineFiche = `<p>Opposition à la prospection le ${fmtLong(c.oppose)} : ne pas recontacter. Seuls le nom, l'organisation et la date sont gardés.</p>`;
    else if (p?.relance) blocProchaineFiche = `<h3>${esc(libelleAction(p))} · <span>${quand(p.date)}</span></h3>
            <p class="aide-ligne">Cadence « ${esc(p.relance.cadence.nom)} »${c.cadence.reporteAu === p.date ? ', relance reportée' : ''}. ${esc(conseilAction(p))}</p>
            <ol class="frise-mini" aria-label="Relances de la cadence">${frise}</ol>
            <div class="rang"><button class="btn primaire petit" data-action="envoye" data-id="${c.id}">Envoyé</button><button class="btn petit" data-action="message" data-id="${c.id}">Préparer le message</button><button class="btn petit" data-action="repondu" data-id="${c.id}">A répondu</button><button class="btn petit" data-action="reporter-date" data-id="${c.id}">Reporter</button><button class="btn petit lien" data-action="planifier" data-id="${c.id}">Arrêter ou changer</button></div>`;
    else if (fini) blocProchaineFiche = `<h3>Cadence terminée · <span>sans réponse</span></h3><p>« ${esc(k?.nom || 'Cadence')} » menée jusqu'au bout${c.cadence.dernier ? `, dernier message ${quand(c.cadence.dernier)}` : ''}.</p>
            <div class="rang"><button class="btn primaire petit" data-action="recontacter" data-id="${c.id}">Recontacter plus tard</button><button class="btn petit" data-action="classer-perdu" data-id="${c.id}">Classer perdu</button><button class="btn petit" data-action="repondu" data-id="${c.id}">A répondu</button></div>`;
    else if (p) blocProchaineFiche = `<h3>${esc(libelleAction(p))} · <span>${quand(p.date)}</span></h3>${p.note ? `<p>${esc(p.note)}</p>` : ''}<p class="conseil-puce">${esc(conseilAction(p))}</p>
            <div class="rang"><button class="btn primaire petit" data-action="fait" data-id="${c.id}">Fait</button><button class="btn petit" data-action="planifier" data-id="${c.id}">Modifier</button><button class="btn petit" data-action="reporter" data-id="${c.id}">Demain</button><button class="btn petit" data-action="message" data-id="${c.id}">Préparer un message</button></div>`;
    else blocProchaineFiche = `<p>${c.archive ? 'Contact archivé.' : 'Rien de prévu.'}</p><div class="rang"><button class="btn primaire petit" data-action="planifier" data-id="${c.id}">Planifier une action ou une cadence</button></div>`;
    return `
      <div class="fiche-retour"><button class="btn lien" data-action="fermer-contact">← Tous les contacts</button></div>
      <article class="fiche-carte">
        <div class="fiche-tete" style="--c:${couleurContact(c)}">
          <div><p class="surtitre">${statutLibelle(s)}${c.origine ? ` · ${esc(c.origine)}` : ''}</p><h2>${esc(c.nom)}</h2>${c.entreprise || c.fonction ? `<p class="fiche-entreprise">${esc([c.fonction, c.entreprise].filter(Boolean).join(' · '))}</p>` : ''}</div>
          ${c.oppose ? '' : `<button class="btn petit" data-action="contact-modifier" data-id="${c.id}">Modifier</button>`}
        </div>
        ${revoir ? `<div class="avertissement rgpd">Pas de nouvelles de sa part depuis plus de ${pluriel(E.reglages.conservationAns, 'an')} : garde ce contact seulement s'il est encore utile. <span class="rang-inline"><button class="btn petit" data-action="archiver" data-id="${c.id}">Archiver</button><button class="btn petit danger" data-action="contact-supprimer" data-id="${c.id}">Supprimer</button></span></div>` : ''}
        <p class="fiche-coord">${c.email ? `<span>${esc(c.email)}</span>` : ''}${c.tel ? `<span>${esc(c.tel)}</span>` : ''}${!c.email && !c.tel ? '<span>Aucune coordonnée.</span>' : ''}${c.canal ? `<span>Canal : ${esc(canalNom(c.canal))}</span>` : ''}<span>Ajouté le ${fmtLong(c.creeLe)}</span></p>
        <div class="prochaine ${p && p.date < t ? 'retard' : ''}">
          <p class="surtitre">${c.oppose ? 'Opposition' : p?.relance || fini ? 'Cadence de relance' : 'Prochaine action'}</p>
          ${blocProchaineFiche}
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
        ${c.oppose ? '' : `<div class="fiche-bloc fiche-opposition"><p class="aide">La personne ne veut plus être sollicitée ? <button class="lien-texte" data-action="opposition" data-id="${c.id}">Enregistrer son opposition</button> : plus aucune relance, coordonnées, notes et échanges effacés.</p></div>`}
      </article>`;
  }

  // ----- Pipeline : affaires par étape, et sous-vue Scripts et cadences -----
  const sousOnglets = () => `<div class="sous-onglets" role="group" aria-label="Pipeline">${[['affaires', 'Affaires par étape'], ['scripts', 'Scripts et cadences']].map(([id, nom]) => `<button type="button" class="puce" data-action="sous-vue" data-vue="${id}" aria-pressed="${vue === id}">${nom}</button>`).join('')}</div>`;

  function vueAffaires() {
    const synth = R.pipeline(E.projets, B.etapes);
    const ouvert = R.montantOuvert(E.projets, B.etapes);
    const colonnes = B.etapes.map((e, i) => {
      const liste = E.projets.filter((p) => p.etape === e.id).sort((a, b) => (b.maj || b.creeLe || '').localeCompare(a.maj || a.creeLe || ''));
      const sy = synth[i];
      return `<section class="colonne" style="--c:${couleur(e.couleur)};--t:${texteSurCouleur(e.couleur)}" aria-label="${esc(e.nom)}">
        <div class="colonne-tete"><h2>${esc(e.nom)}</h2><span>${sy.nombre} · ${eurCourt(sy.montant)}</span></div>
        <p class="colonne-detail">${esc(e.detail)}</p>
        <div class="colonne-cartes">${liste.map((p) => carteAffaire(p, e)).join('') || '<p class="vide-texte">Aucune affaire.</p>'}</div>
      </section>`;
    }).join('');
    return `<div class="vue-tete"><div><h1>Pipeline</h1><p>${pluriel(E.projets.filter((p) => etape(p.etape)?.ouverte).length, 'affaire ouverte', 'affaires ouvertes')} pour ${eurCourt(ouvert)} HT estimés. Changer d'étape propose la prochaine action, démarre ou arrête la cadence de relance.</p></div>
      <div class="actions"><button class="btn primaire" data-action="affaire-nouvelle">${ICONES.plus}Affaire</button></div></div>
      ${sousOnglets()}
      ${E.projets.length ? `<div class="colonnes" tabindex="0" aria-label="Étapes de vente, défilement horizontal">${colonnes}</div>` : videEtat('Aucune affaire', 'Une affaire, c\'est une vente possible avec un contact : un besoin, un montant estimé, une étape. Elle avance de « À contacter » à « Gagné » ou « Perdu ».', `<button class="btn primaire" data-action="affaire-nouvelle">${ICONES.plus}Créer une affaire</button>`)}
      ${PIED}`;
  }

  function carteAffaire(p, e) {
    const c = contact(p.contactId);
    const suivante = R.etapeSuivante(B.etapes, p.etape);
    const t = auj();
    return `<article class="affaire">
      <button class="affaire-corps" data-action="affaire-modifier" data-id="${p.id}">
        ${p.titre === 'Premier contrat' && c ? `<b>${esc(c.entreprise || c.nom)}</b><span>${esc(p.titre)}${c.entreprise ? ` · ${esc(c.nom)}` : ''}</span>` : `<b>${esc(p.titre)}</b><span>${esc(c ? (c.entreprise || c.nom) : 'Contact supprimé')}</span>`}
        ${p.montant ? `<span class="affaire-montant">${eurCourt(p.montant)} HT</span>` : ''}
        ${p.decision && e.ouverte ? `<span class="${p.decision < t ? 'retard' : ''}">Décision ${quand(p.decision)}</span>` : ''}
        ${p.etape === 'gagne' ? `<span class="etiquette ${p.avancement === 'termine' ? '' : p.avancement === 'en-cours' ? 'bleu' : 'jaune'}">${esc(B.avancements.find((v) => v.id === p.avancement)?.nom || 'À démarrer')}</span>` : ''}
        ${p.etape === 'perdu' && p.motif ? `<span>Motif : ${esc(p.motif)}</span>` : ''}
      </button>
      ${suivante ? `<div class="affaire-pied"><button class="btn petit" data-action="etape-suivante" data-id="${p.id}">→ ${esc(etape(suivante).nom)}</button><button class="btn petit lien" data-action="affaire-perdue" data-id="${p.id}">Perdue</button></div>` : ''}
      ${p.etape === 'gagne' && p.avancement !== 'termine' ? `<div class="affaire-pied"><button class="btn petit" data-action="avancement" data-id="${p.id}">→ ${p.avancement === 'en-cours' ? 'Terminé' : 'En cours'}</button></div>` : ''}
    </article>`;
  }

  // ----- Scripts et cadences -----
  function surligner(texte) {
    return esc(texte).replace(/\{([^{}]{1,30})\}/g, (tout, v) => (B.variables.includes(v) ? `<span class="var">{${v}}</span>` : tout)).replace(/\[([^\][]{1,60})\]/g, '<span class="trou">[$1]</span>');
  }

  function vueScripts() {
    const c = apercu ? contact(apercu) : null;
    const rendu = (texte) => (c ? surligner(R.remplirScript(texte, valeurs(c)).texte) : surligner(texte));
    const choix = E.contacts.filter((x) => !x.oppose && !x.archive).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const groupes = B.etapes.map((e) => ({ e, liste: E.scripts.filter((s) => s.etape === e.id) })).filter((g) => g.liste.length);
    const autres = E.scripts.filter((s) => !B.etapes.some((e) => e.id === s.etape));
    return `
      <div class="vue-tete"><div><h1>Scripts et cadences</h1><p>${pluriel(E.scripts.length, 'modèle')} de messages par étape. Les variables entre accolades se remplissent avec la fiche du contact ; ce qui est entre crochets est à compléter toi-même. L'application n'envoie rien : tu copies le message et tu l'envoies depuis ta messagerie.</p></div>
        <div class="actions"><button class="btn" data-action="scripts-origine">Revenir aux scripts d'origine</button><button class="btn primaire" data-action="script-nouveau">${ICONES.plus}Script</button></div></div>
      ${sousOnglets()}
      <h2 class="titre-section">Cadences de relance <span>Délai compté depuis le message précédent réellement envoyé.</span></h2>
      <div class="cadences">${E.cadences.map((k) => {
        const n = E.contacts.filter((x) => x.cadence?.id === k.id && R.relanceCourante(x, E.cadences)).length;
        return `<article class="cadence">
          <div class="cadence-tete"><div><h3>${esc(k.nom)}${E.reglages.cadenceDefaut === k.id ? ' <span class="etiquette jaune">Par défaut</span>' : ''}</h3><p>${esc(k.description || '')}</p></div><button class="btn petit" data-action="cadence-modifier" data-id="${k.id}">Modifier</button></div>
          <ol class="frise-cadence">${R.frise(k).map((r) => `<li><b>J${r.jour ? `+${r.jour}` : '0'}</b><span>${esc(canalNom(r.canal))}</span><small>${esc(script(r.script)?.titre || 'Sans script')}</small></li>`).join('')}</ol>
          <p class="cadence-pied">${n ? `Suivie par ${pluriel(n, 'contact')} en ce moment.` : 'Aucun contact sur cette cadence en ce moment.'}${B.etapes.filter((e) => e.cadence === k.id).map((e) => ` Démarre quand une affaire passe « ${esc(e.nom)} ».`).join('')}</p>
        </article>`;
      }).join('')}<button class="cadence cadence-ajout" data-action="cadence-nouvelle">${ICONES.plus}Nouvelle cadence</button></div>
      <h2 class="titre-section">Scripts de messages</h2>
      <div class="apercu-choix"><label class="champ">Aperçu avec<select id="apercu" data-action="apercu"><option value="">Variables brutes</option>${choix.map((x) => `<option value="${x.id}" ${x.id === apercu ? 'selected' : ''}>${esc(nomComplet(x))}</option>`).join('')}</select></label>
        <p class="aide">Variables : ${B.variables.map((v) => `<span class="var">{${v}}</span>`).join(' ')}. Les tiennes (« mon prénom », « mon activité ») se règlent dans les réglages.</p></div>
      ${[...groupes, ...(autres.length ? [{ e: { nom: 'Autres', couleur: 'encre', id: 'autres' }, liste: autres }] : [])].map(({ e, liste }) => `
        <h3 class="titre-groupe">${esc(e.nom)} <span>${pluriel(liste.length, 'script')}</span></h3>
        <div class="scripts">${liste.map((s) => `
          <article class="script" style="--c:${couleur(e.couleur)};--t:${texteSurCouleur(e.couleur)}">
            <div class="script-tete"><h3>${esc(s.titre)}</h3><span>${esc(canalNom(s.canal))}</span></div>
            ${s.objet ? `<p class="script-objet"><b>Objet :</b> ${rendu(s.objet)}</p>` : ''}
            <div class="script-texte">${rendu(s.texte)}</div>
            <div class="script-pied"><button class="btn petit" data-action="copier-script" data-id="${s.id}">Copier</button><button class="btn petit lien" data-action="script-modifier" data-id="${s.id}">Modifier</button></div>
          </article>`).join('')}</div>`).join('')}
      ${PIED}`;
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

  // Activité de prospection : messages envoyés et réponses reçues par semaine.
  const SERIES_ACT = [['envois', 'Messages envoyés', '#1D4E89'], ['reponses', 'Réponses reçues', '#F5B400']];
  function graphiqueActivite(sem) {
    const L = Math.round(Math.min(1100, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 230, g = 32, b = 26, hz = H - b - 10;
    const max = Math.max(4, ...sem.map((s) => Math.max(s.envois, s.reponses)));
    const pas = Math.ceil(max / 4), haut = pas * 4;
    const larg = (L - g) / sem.length;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const w = Math.max(6, Math.min(26, (larg - 14) / 2));
    const cols = sem.map((s, i) => {
      const x0 = g + i * larg + (larg - (w * 2 + 2)) / 2;
      const rects = SERIES_ACT.map(([k, , c], j) => (s[k] ? `<rect x="${x0 + j * (w + 2)}" y="${y(s[k])}" width="${w}" height="${Math.max(1, y(0) - y(s[k]))}" fill="${c}" stroke="#141414" stroke-width="1.5"/>` : '')).join('');
      const lab = (sem.length - 1 - i) % (L < 500 ? 2 : 1) === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${fmt(s.debut, { day: 'numeric', month: 'short' }).replace('.', '')}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne-g" data-i="${i}">${rects}</g>${lab}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Messages envoyés et réponses reçues par semaine sur 8 semaines, détail dans le tableau ci-dessous">${grilles}${cols}</svg>`;
  }

  const PERIODES = [['90', '90 jours'], ['365', '12 mois'], ['tout', 'Tout']];

  function vueChiffres() {
    const t = auj();
    const annees = [...new Set(E.documents.map((d) => d.date.slice(0, 4)).concat(t.slice(0, 4)))].sort().reverse();
    if (!anneeChiffres || !annees.includes(anneeChiffres)) anneeChiffres = t.slice(0, 4);
    const mois = R.caParMois(E.documents, R.moisDe(t), 12);
    const tot = mois.reduce((s, m) => ({ facture: s.facture + m.facture, encaisse: s.encaisse + m.encaisse }), { facture: 0, encaisse: 0 });
    const taux = R.tauxTransformation(E.documents, anneeChiffres);
    const clients = R.caParClient(E.documents, E.contacts, anneeChiffres);
    // Conversion : affaires créées dans la période.
    const depuis = periode === 'tout' ? null : ajout(t, -Number(periode) + 1);
    const P = R.dansPeriode(E.projets, depuis);
    const f = R.entonnoir(P, B.etapes);
    const k = (id) => f[R.rang(B.etapes, id)];
    const contactees = k('contacte').atteint, reponses = k('echange').atteint, gagnees = k('gagne').atteint;
    const can = R.parCanal(P, E.contacts, B.etapes, B.canaux);
    const act = R.activite(E.echanges, t, 8);
    const motifs = R.motifsPerte(P);
    const maxEnt = Math.max(1, f[0].atteint);
    const tuiles = [
      ['Facturé 12 mois', eurCourt(tot.facture), 'HT, factures émises.', 'var(--bleu)', ''],
      ['Encaissé 12 mois', eurCourt(tot.encaisse), 'HT, à la date du paiement.', 'var(--jaune)', 'rond'],
      ['Taux de réponse', contactees ? pct(reponses / contactees) : '–', `${pluriel(reponses, 'réponse')} sur ${pluriel(contactees, 'affaire contactée', 'affaires contactées')} (période).`, 'var(--rouge)', ''],
      ['Affaires gagnées', gagnees, `${contactees ? `${pct(gagnees / contactees)} des contactées · ` : ''}${taux === null ? 'aucun devis tranché' : `devis acceptés ${anneeChiffres} : ${taux} %`}.`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const maxPart = Math.max(1, ...clients.map((l) => l.part));
    return `<div class="vue-tete"><div><h1>Chiffres</h1><p>De la prospection à l'encaissement : conversion de tes affaires étape par étape et par canal, puis chiffre d'affaires facturé et encaissé. Montants hors taxes, sauf le reste dû (TTC).</p></div>
        <div class="puces periodes" role="group" aria-label="Période de la conversion">${PERIODES.map(([id, nom]) => `<button type="button" class="puce" data-action="periode" data-id="${id}" aria-pressed="${periode === id}">${nom}</button>`).join('')}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Conversion <span>Affaires créées ${depuis ? `depuis le ${fmt(depuis, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'depuis le début'} ayant atteint chaque étape ; une étape atteinte reste comptée si l'affaire est ensuite perdue.</span></h2>
      ${P.length ? `<figure class="entonnoir" aria-label="Entonnoir de conversion, détail dans le tableau ci-dessous">
        ${f.map((x, i) => { const e = etape(x.id); return `<div class="barre-ent" style="--c:${couleur(e.couleur)}">
          <span class="ent-nom">${esc(e.court || x.nom)}</span>
          <span class="ent-piste"><i style="width:${Math.max(x.atteint ? 1.5 : 0, (x.atteint / maxEnt) * 100)}%"></i><b>${x.atteint}</b></span>
          <span class="ent-taux">${i < f.length - 1 ? `${pct(x.passage)} <small>passent</small>` : ''}</span></div>`; }).join('')}
      </figure>
      <details class="tableau-details"><summary>Voir le tableau de conversion</summary><div class="defile"><table class="tableau"><thead><tr><th>Étape</th><th class="nb">Atteinte</th><th class="nb">Passage à la suivante</th><th class="nb">Depuis « À contacter »</th></tr></thead><tbody>${f.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.atteint}</td><td class="nb">${pct(x.passage)}</td><td class="nb">${pct(x.depuisDebut)}</td></tr>`).join('')}</tbody></table></div></details>`
        : videEtat('Aucune affaire dans cette période', 'L\'entonnoir se remplit avec les affaires du pipeline : chaque prospect ajouté avec une affaire « À contacter » y entre.')}
      ${can.length ? `<h2 class="titre-section">Par canal <span>Canal principal du contact ; taux rapportés aux affaires contactées.</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Canal</th><th class="nb">Affaires</th><th class="nb">Contactées</th><th class="nb">Réponse</th><th class="nb">Rendez-vous</th><th class="nb">Gagnées</th></tr></thead><tbody>${can.map((c) => `<tr><td>${esc(c.nom)}</td><td class="nb">${c.total}</td><td class="nb">${c.contactes}</td><td class="nb">${pct(c.tauxReponse)} <small>(${c.reponses})</small></td><td class="nb">${pct(c.tauxRdv)} <small>(${c.rdv})</small></td><td class="nb">${pct(c.tauxGain)} <small>(${c.gagnes})</small></td></tr>`).join('')}</tbody></table></div>
      <p class="note">Sur de petits nombres, un taux varie beaucoup d'une affaire à l'autre : regarde aussi les effectifs entre parenthèses.</p>` : ''}
      <h2 class="titre-section">Activité des 8 dernières semaines</h2>
      <figure class="graphique" id="graphique-activite">
        <div class="graphique-tete"><h2>Messages envoyés et réponses reçues</h2><div class="legende">${SERIES_ACT.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphiqueActivite(act)}
        <div class="infobulle" hidden></div>
        <details class="tableau-details"><summary>Voir le tableau par semaine</summary><div class="defile"><table class="tableau"><thead><tr><th>Semaine du</th><th class="nb">Envoyés</th><th class="nb">Réponses</th></tr></thead><tbody>${act.map((s) => `<tr><td>${fmt(s.debut, { day: 'numeric', month: 'long' })}</td><td class="nb">${s.envois}</td><td class="nb">${s.reponses}</td></tr>`).join('')}</tbody></table></div></details>
      </figure>
      ${motifs.length ? `<h2 class="titre-section">Motifs de perte <span>${pluriel(motifs.reduce((s, m) => s + m.n, 0), 'affaire perdue', 'affaires perdues')} dans la période.</span></h2><div class="motifs">${motifs.map((m) => `<div><b>${m.n}</b><span>${esc(m.motif)}</span></div>`).join('')}</div>` : ''}
      <h2 class="titre-section">Chiffre d'affaires, 12 derniers mois</h2>
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

  // Infobulle d'un graphique en barres : survol ou toucher d'une colonne.
  function brancherInfobulle(fig, contenu) {
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const montrer = (zone) => {
      const i = Number(zone.dataset.i);
      fig.querySelectorAll('.colonne-g').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = contenu(i);
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

  function brancherGraphique() {
    $('#annee')?.addEventListener('change', (e) => { anneeChiffres = e.target.value; rendre(); });
    const mois = R.caParMois(E.documents, R.moisDe(auj()), 12);
    brancherInfobulle($('#graphique'), (i) => `<b>${versDate(`${mois[i].mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${eur(mois[i][k])}</div>`).join('')}`);
    const sem = R.activite(E.echanges, auj(), 8);
    brancherInfobulle($('#graphique-activite'), (i) => `<b>Semaine du ${fmt(sem[i].debut, { day: 'numeric', month: 'long' })}</b>${SERIES_ACT.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${sem[i][k]}</div>`).join('')}`);
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

  // Bloc « suivi » : une cadence de relance (messages calculés) ou une prochaine action datée à la main.
  const descriptionCadence = (id) => { const k = cadence(id); return k ? `${esc(k.description || '')} ${R.frise(k).map((x) => `J${x.jour ? `+${x.jour}` : '0'} ${esc(canalNom(x.canal).split(' ')[0].toLowerCase())}`).join(' · ')}` : ''; };
  function blocSuivi({ cadenceId = '', debut = auj(), p = null, rien = false, enCours = false } = {}) {
    const mode = rien ? 'aucune' : cadenceId || '';
    return `<fieldset class="groupe-champs"><legend>Suivi</legend>
      <label class="champ">Relances<select name="suivi" data-action="suivi-select">
        ${E.cadences.map((k) => `<option value="${k.id}" ${k.id === mode ? 'selected' : ''}>Cadence : ${esc(k.nom)}</option>`).join('')}
        <option value="" ${mode === '' ? 'selected' : ''}>Prochaine action datée à la main</option>
        <option value="aucune" ${mode === 'aucune' ? 'selected' : ''}>Rien de prévu pour l'instant</option>
      </select></label>
      <div class="prochaine-champs" data-suivi="cadence" ${cadenceId && !rien ? '' : 'hidden'}>
        <p class="aide" id="frise-suivi">${descriptionCadence(cadenceId)}</p>
        ${enCours ? '<p class="aide">Garder la cadence en cours la laisse où elle en est ; en choisir une autre la redémarre à la date ci-dessous.</p>' : ''}
        <label class="champ">Premier message le<input type="date" name="debut" value="${debut}"></label>
      </div>
      <div class="prochaine-champs" data-suivi="main" ${mode === '' ? '' : 'hidden'}>
        <label class="champ">Action<select name="ptype" data-action="type-action">${optionsActions(p?.type)}</select></label>
        <label class="champ">Date<input type="date" name="pdate" value="${p?.date || auj()}"></label>
        <label class="champ">Note<small>Facultative : ce qu'il faut dire ou préparer.</small><input name="pnote" maxlength="200" value="${esc(p?.note || '')}"></label>
        <p class="aide" id="conseil-action">${esc(action(p?.type)?.conseil || '')}</p>
      </div></fieldset>`;
  }
  const lireSuivi = (f) => {
    const s = f.get('suivi');
    if (s === 'aucune') return { cadence: null, prochaine: null };
    if (s) return { cadence: s, debut: f.get('debut') || auj(), prochaine: null };
    return { cadence: null, prochaine: { type: f.get('ptype'), date: f.get('pdate') || auj(), note: String(f.get('pnote') || '').trim() } };
  };
  // Applique le suivi choisi ; une cadence déjà en cours et choisie à nouveau continue où elle en est.
  function appliquerSuivi(c, s) {
    if (s.cadence) {
      if (!(c.cadence?.id === s.cadence && R.relanceCourante(c, E.cadences))) Object.assign(c, R.demarrerCadence(c, s.cadence, s.debut));
      c.prochaine = null;
    } else { c.cadence = null; c.prochaine = s.prochaine; }
  }
  // Affaire du pipeline ouverte avec un nouveau contact.
  const nouvelleAffaire = (c, titre = 'Premier contrat') => { const p = { id: uid(), contactId: c.id, titre, etape: 'cible', etapeMax: 0, montant: 0, creeLe: auj(), maj: auj(), decision: null, avancement: null, motif: '' }; E.projets.push(p); return p; };

  function modaleContact(id) {
    const c = id ? contact(id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(c?.nom || '')}" placeholder="Prénom et nom"></label>
      <div class="deux"><label class="champ">Entreprise ou organisation<small>Facultatif.</small><input name="entreprise" maxlength="80" value="${esc(c?.entreprise || '')}"></label>
      <label class="champ">Fonction<small>Remplit {fonction} dans les scripts.</small><input name="fonction" maxlength="80" value="${esc(c?.fonction || '')}"></label></div>
      <div class="deux"><label class="champ">E-mail<input type="email" name="email" maxlength="120" value="${esc(c?.email || '')}" autocomplete="off"></label>
      <label class="champ">Téléphone<input type="tel" name="tel" maxlength="30" value="${esc(c?.tel || '')}" autocomplete="off"></label></div>
      <div class="deux"><label class="champ">Origine<select name="origine"><option value="">—</option>${B.origines.map((o) => `<option ${c?.origine === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
      <label class="champ">Canal principal<small>Sert aux chiffres par canal.</small><select name="canal"><option value="">—</option>${B.canaux.map((x) => `<option value="${x.id}" ${c?.canal === x.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label></div>
      <label class="champ">Notes<small>Ce qui est utile à la relation commerciale, rien de plus (pas de santé, d'opinions ni de vie privée).</small><textarea name="notes" maxlength="1000">${esc(c?.notes || '')}</textarea></label>
      ${c ? '' : `${blocSuivi({ cadenceId: E.reglages.cadenceDefaut || '', p: { type: 'premier-contact', date: auj() } })}
      <label class="case"><input type="checkbox" name="affaire" checked> Ajouter au pipeline une affaire « À contacter »</label>`}
      ${c ? `<label class="case"><input type="checkbox" name="archive" ${c.archive ? 'checked' : ''}> Contact archivé (n'apparaît plus dans les relances)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = c
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le contact' : 'Nouveau contact', corps, pied, (f, act) => {
      if (act === 'supprimer') return supprimerContact(c.id) ? undefined : false;
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du contact.';
      const champs = { nom, entreprise: String(f.get('entreprise') || '').trim(), fonction: String(f.get('fonction') || '').trim(), email: String(f.get('email') || '').trim(), tel: String(f.get('tel') || '').trim(), origine: f.get('origine') || '', canal: f.get('canal') || '', notes: String(f.get('notes') || '').trim() };
      if (!c) {
        const op = R.doublonOppose(E.contacts, champs);
        if (op) return `Cette personne s'est opposée à la prospection le ${fmtLong(op.oppose)} : ne la recontacte pas.`;
      }
      memoriserAnnulation();
      if (c) {
        Object.assign(c, champs, { archive: !!f.get('archive') });
        if (c.archive) { c.prochaine = null; c.cadence = null; }
        sauver(); rendre(); toast('Contact enregistré.');
      } else {
        const n = { id: uid(), ...champs, creeLe: auj(), prochaine: null, cadence: null, oppose: null, archive: false };
        appliquerSuivi(n, lireSuivi(f));
        E.contacts.push(n);
        if (f.get('affaire')) nouvelleAffaire(n);
        contactOuvert = n.id;
        sauver();
        if (vue !== 'contacts') changerVue('contacts'); else rendre();
        const p = prochaine(n);
        toast(`« ${nom} » ajouté.${p ? ` ${p.relance ? 'Premier message' : 'Prochaine action'} ${quand(p.date)}.` : ''}`, { libelle: 'Annuler', faire: annuler });
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

  // Échange : nouveau (depuis « Fait », « A répondu » ou libre) ou modification d'un échange existant.
  // sens : « envoye » (message ou relance de ta part), « recu » (réponse ou demande du contact), vide (rendez-vous, appel).
  function modaleEchange(contactId, echangeId, depuisAction = false, recu = false) {
    if (!E.contacts.length) { modaleContact(); toast('Ajoute d\'abord un contact.'); return; }
    const e = echangeId ? E.echanges.find((x) => x.id === echangeId) : null;
    const c = contact(e?.contactId || contactId);
    const p = c?.prochaine;
    const enCadence = c && !recu && R.relanceCourante(c, E.cadences);
    const fait = depuisAction && p && !c.cadence ? action(p.type) : null;
    const typeDefaut = e?.type || (recu ? echangeDuCanal(c?.canal) : fait && /relance|proposition|temoignage/.test(fait.id) ? 'email' : 'appel');
    const sensDefaut = e ? (e.sens || '') : recu ? 'recu' : fait && /relance|premier|nouvelles|recontacter/.test(fait.id) ? 'envoye' : '';
    const principale = c ? affairePrincipale(c) : null;
    const suite = recu ? 'repondre' : fait ? R.suiteDe(B.actions, fait.id) : (principale && etape(principale.etape)?.action) || 'relance-silence';
    // Échange libre : la prochaine action déjà prévue est gardée telle quelle.
    const proposee = (!fait && !recu && p && !c.cadence) ? p : (R.proposerAction(B.actions, suite, auj()) || { type: 'relance-silence', date: ajout(auj(), 5), note: '' });
    const SENS = [['', 'Échange (rendez-vous, appel à deux)'], ['envoye', 'Message de ta part, sans réponse'], ['recu', 'Réponse ou demande du contact']];
    const corps = `
      ${e || c ? `<p class="surtitre" style="margin:0">${esc(nomComplet(c))}</p><input type="hidden" name="contact" value="${c.id}">` : `<label class="champ">Contact<select name="contact">${optionsContacts(contactId)}</select></label>`}
      <div class="deux"><label class="champ">Date<input type="date" name="date" value="${e?.date || auj()}" max="${auj()}" required></label>
      <label class="champ">Type<select name="type">${B.typesEchange.map((x) => `<option value="${x.id}" ${x.id === typeDefaut ? 'selected' : ''}>${x.nom}</option>`).join('')}</select></label></div>
      <label class="champ">Qui<small>Sert aux chiffres de réponse. Une réponse arrête la cadence de relance.</small><select name="sens">${SENS.map(([v, l]) => `<option value="${v}" ${v === sensDefaut ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="champ">Résumé<textarea name="resume" maxlength="1000" placeholder="Ce qui a été dit, décidé, promis.">${esc(e?.resume || (fait ? `${fait.nom}${p.note ? ` : ${p.note}` : ''}` : recu ? 'Réponse reçue' : ''))}</textarea></label>
      ${e ? '' : enCadence ? `<p class="aide">La cadence « ${esc(enCadence.cadence.nom)} » continue : ${esc(libelleAction(prochaine(c)))}, ${quand(prochaine(c).date)}. Une réponse du contact l'arrête.</p>` : blocProchaine(proposee)}
      ${e || enCadence ? '' : `<p class="aide" id="conseil-action">${esc(action(proposee.type)?.conseil || '')}</p>`}
      <p class="erreur" role="alert"></p>`;
    const pied = e
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : `<button class="btn primaire" value="ok">${fait ? 'Noter et planifier' : 'Enregistrer'}</button><button class="btn" value="annuler">Annuler</button>`;
    ouvrirModale(e ? 'Modifier l\'échange' : fait ? `Fait : ${esc(fait.nom)}` : recu ? `Réponse de ${esc(c.nom)}` : 'Noter un échange', corps, pied, (f, act) => {
      memoriserAnnulation();
      if (act === 'supprimer') {
        E.echanges = E.echanges.filter((x) => x.id !== e.id);
        sauver(); rendre(); toast('Échange supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const date = f.get('date');
      if (!date || date > auj()) return 'La date de l\'échange ne peut pas être dans le futur.';
      const sens = f.get('sens') || '';
      const champs = { contactId: f.get('contact'), date, type: f.get('type'), resume: String(f.get('resume') || '').trim(), ...(sens ? { sens } : {}) };
      if (e) { if (!sens) delete e.sens; Object.assign(e, champs); sauver(); rendre(); toast('Échange enregistré.'); return; }
      E.echanges.push({ id: uid(), ...champs });
      const cc = contact(champs.contactId);
      let msg = '';
      // Réponse du contact : la cadence s'arrête et l'affaire « À contacter » ou « Contacté » passe « En échange ».
      if (sens === 'recu') {
        if (cc.cadence) { cc.cadence = null; msg = ' Cadence arrêtée.'; }
        const pr = affairePrincipale(cc);
        if (pr && ['cible', 'contacte'].includes(pr.etape)) { Object.assign(pr, R.changerEtape(pr, 'echange', B.etapes, auj())); msg += ` Affaire « ${pr.titre} » : En échange.`; }
      }
      if (R.relanceCourante(cc, E.cadences)) { sauver(); rendre(); toast(`Échange noté. ${libelleAction(prochaine(cc))} ${quand(prochaine(cc).date)}.`, { libelle: 'Annuler', faire: annuler }); return; }
      cc.prochaine = lireProchaine(f);
      sauver(); rendre();
      toast(cc.prochaine ? `Noté.${msg} Prochaine action ${quand(cc.prochaine.date)} : ${action(cc.prochaine.type)?.nom}.` : `Échange noté.${msg}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Suivi d'un contact : démarrer, garder ou arrêter une cadence, ou dater la prochaine action à la main.
  function modalePlanifier(id) {
    const c = contact(id);
    const enCours = R.relanceCourante(c, E.cadences);
    const p = c.prochaine || R.proposerAction(B.actions, etape(affairePrincipale(c)?.etape)?.action || 'relance-silence', auj());
    ouvrirModale(`Suivi · ${esc(c.nom)}`, `${blocSuivi({ cadenceId: enCours ? c.cadence.id : '', debut: enCours ? c.cadence.debut : auj(), p, enCours: !!enCours })}<p class="erreur" role="alert"></p>`,
      `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
        memoriserAnnulation();
        appliquerSuivi(c, lireSuivi(f));
        const n = prochaine(c);
        if (c.archive && n) c.archive = false;
        sauver(); rendre();
        toast(n ? `${n.relance ? `${libelleAction(n)}` : 'Prévu'} ${quand(n.date)}.` : 'Aucune action prévue.', { libelle: 'Annuler', faire: annuler });
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
      <label class="champ">Étape<small>Changer d'étape propose la prochaine action, démarre ou arrête la cadence de relance du contact.</small><select name="etape" data-action="etape-select">${B.etapes.map((e) => `<option value="${e.id}" ${e.id === (p?.etape || 'cible') ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
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
      const cible = f.get('etape');
      const champs = { contactId: f.get('contact'), titre, montant: R.arrondi(montant), decision: f.get('decision') || null, maj: auj() };
      let x = p;
      if (x) Object.assign(x, champs); else { x = { id: uid(), creeLe: auj(), etape: 'cible', etapeMax: 0, avancement: null, motif: '', ...champs }; E.projets.push(x); }
      const changement = !p || p.etape !== cible;
      const msg = changement ? entrerEtape(x, cible, f.get('motif') || '') : '';
      if (cible === 'gagne') x.avancement = f.get('avancement') || x.avancement || 'a-venir';
      if (cible === 'perdu') x.motif = f.get('motif') || '';
      sauver(); rendre();
      toast(`${p ? 'Affaire enregistrée.' : 'Affaire créée.'}${msg}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Entrée d'une affaire dans une étape : étape la plus avancée gardée, puis effet sur le contact (regles.js,
  // effetCadence) : la cadence en cours continue, une cadence démarre (proposition : « Suivi de proposition »),
  // ou la cadence s'arrête et l'action type de l'étape est proposée.
  function entrerEtape(p, cible, motif = '') {
    Object.assign(p, R.changerEtape(p, cible, B.etapes, auj(), motif));
    const c = contact(p.contactId);
    if (!c || c.archive || c.oppose) return '';
    const effet = R.effetCadence(B.etapes, cible);
    if (effet === 'garder') return R.relanceCourante(c, E.cadences) ? '' : proposerSelonEtape(c, cible);
    if (effet.demarrer && cadence(effet.demarrer)) {
      Object.assign(c, R.demarrerCadence(c, effet.demarrer, auj()));
      const d = prochaine(c);
      return ` Cadence « ${cadence(effet.demarrer).nom} » démarrée${d ? `, relance ${quand(d.date)}` : ''}.`;
    }
    if (c.cadence) { c.cadence = null; c.prochaine = null; }
    return proposerSelonEtape(c, cible);
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
      // Un devis accepté fait passer l'affaire liée à « Gagné » ; un devis envoyé, à « Proposition envoyée ».
      let msg = '';
      if (!facture && champs.statut === 'accepte' && avant !== 'accepte' && champs.projetId) {
        const p = projet(champs.projetId);
        if (p && etape(p.etape)?.ouverte) msg = ` Affaire « ${p.titre} » passée à Gagné.${entrerEtape(p, 'gagne')}`;
      }
      if (!facture && champs.statut === 'envoye' && avant !== 'envoye' && champs.projetId) {
        const p = projet(champs.projetId);
        if (p && etape(p.etape)?.ouverte && R.rang(B.etapes, p.etape) < R.rang(B.etapes, 'proposition')) msg = ` Affaire passée à « Proposition envoyée ».${entrerEtape(p, 'proposition')}`;
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

  // ---------- Prospection : messages, cadences, scripts ----------
  // Message préparé : script de la relance (ou de l'étape), variables remplies, copie en un clic.
  function modaleMessage(id) {
    const c = contact(id);
    if (!c) return;
    const r = R.relanceCourante(c, E.cadences);
    const pr = affairePrincipale(c);
    const defaut = (r && script(r.script)?.id) || E.scripts.find((s) => s.etape === pr?.etape)?.id || E.scripts[0]?.id;
    if (!defaut) { toast('Aucun script : ajoute-en un dans Pipeline, Scripts et cadences.'); return; }
    const canalEnvoi = r?.canal || c.canal || 'email';
    const corps = `
      <p class="aide">${r ? `Relance ${r.index + 1} sur ${r.total} de la cadence « ${esc(r.cadence.nom)} », par <b>${esc(canalNom(canalEnvoi))}</b>.` : `Canal : <b>${esc(canalNom(canalEnvoi))}</b>.`} Relis et personnalise avant d'envoyer depuis ta messagerie : l'application n'envoie rien.</p>
      <label class="champ">Script<select id="choix-script">${B.etapes.map((e) => { const l = E.scripts.filter((s) => s.etape === e.id); return l.length ? `<optgroup label="${esc(e.nom)}">${l.map((s) => `<option value="${s.id}" ${s.id === defaut ? 'selected' : ''}>${esc(s.titre)} (${esc(canalNom(s.canal))})</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <div id="zone-message"></div>
      <input type="hidden" name="canal" value="${canalEnvoi}">
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Message pour ${esc(c.nom)}`, corps,
      `<button class="btn primaire" value="ok">Marquer comme envoyé</button><button class="btn" value="annuler">Fermer</button>`, (f) => {
        const s = script($('#choix-script').value);
        envoye(c.id, f.get('canal'), s?.titre);
      });
    const remplir = () => {
      const s = script($('#choix-script').value);
      const o = R.remplirScript(s.objet || '', valeurs(c));
      const tx = R.remplirScript(s.texte, valeurs(c));
      const manq = [...new Set([...o.manquantes, ...tx.manquantes])];
      $('#zone-message').innerHTML = `
        ${s.objet ? `<label class="champ">Objet<span class="rang-copie"><input id="msg-objet" value="${esc(o.texte)}"><button type="button" class="btn petit" data-action="copier" data-cible="msg-objet">Copier</button></span></label>` : ''}
        <label class="champ">Message<textarea id="msg-texte" rows="10">${esc(tx.texte)}</textarea></label>
        ${manq.length ? `<p class="avertissement">À compléter : ${manq.map((m) => `<b>[${esc(m)}]</b>`).join(', ')} est vide dans la fiche ou les réglages.</p>` : ''}
        ${/\[[^\]]+\]/.test(tx.texte.replace(/\[(prénom|nom|organisation|fonction|mon prénom|mon activité)\]/g, '')) ? '<p class="aide">Les passages entre crochets sont à remplacer par tes propres mots.</p>' : ''}
        <button type="button" class="btn jaune" data-action="copier" data-cible="msg-texte" style="width:100%;margin-top:12px">Copier le message</button>`;
    };
    remplir();
    $('#choix-script').addEventListener('change', remplir);
  }

  async function copierTexte(texte) {
    try { await navigator.clipboard.writeText(texte); return true; } catch {
      const zone = document.createElement('textarea');
      zone.value = texte; zone.setAttribute('readonly', ''); zone.style.position = 'fixed'; zone.style.opacity = '0';
      (modale().open ? modale() : document.body).appendChild(zone);
      zone.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      zone.remove();
      return ok;
    }
  }

  // Message de la cadence (ou message libre) envoyé : échange noté, cadence avancée, affaire « À contacter » → « Contacté ».
  function envoye(id, canalEnvoi, titre) {
    const c = contact(id);
    if (!c) return;
    memoriserAnnulation();
    const r = R.relanceCourante(c, E.cadences);
    const canalUtilise = canalEnvoi || r?.canal || c.canal || 'email';
    const resume = r ? `Relance ${r.index + 1} sur ${r.total} : ${titre || script(r.script)?.titre || 'message'}` : (titre || 'Message envoyé');
    E.echanges.push({ id: uid(), contactId: c.id, date: auj(), type: echangeDuCanal(canalUtilise), resume, sens: 'envoye' });
    // Sans cadence, le message envoyé vaut l'action du jour faite : l'action suivante est proposée.
    if (r) Object.assign(c, R.enregistrerEnvoi(c, E.cadences, auj()));
    else if (c.prochaine && c.prochaine.date <= auj()) c.prochaine = R.proposerAction(B.actions, R.suiteDe(B.actions, c.prochaine.type) || 'relance-silence', auj());
    const pr = affairePrincipale(c);
    if (pr && pr.etape === 'cible') Object.assign(pr, R.changerEtape(pr, 'contacte', B.etapes, auj()));
    sauver(); rendre();
    const n = prochaine(c);
    toast(`${c.nom} : ${r ? (n ? `relance suivante ${quand(n.date)}` : 'cadence terminée') : `message noté${n ? `, prochaine action ${quand(n.date)} : ${libelleAction(n)}` : ''}`}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleDate(titre, texte, defaut, bouton, faire) {
    ouvrirModale(titre, `<p>${texte}</p><label class="champ">Date<input type="date" name="date" value="${defaut}" min="${auj()}" required></label><p class="erreur" role="alert"></p>`,
      `<button class="btn primaire" value="ok">${bouton}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
        const d = f.get('date');
        if (!d) return 'Choisis une date.';
        faire(d);
      });
  }

  function reporterA(id, date) {
    const c = contact(id);
    memoriserAnnulation();
    Object.assign(c, R.reporter(c, E.cadences, date));
    sauver(); rendre();
    toast(`${c.nom} : reporté ${quand(date)}.`, { libelle: 'Annuler', faire: annuler });
  }

  // Cadence finie sans réponse (ou affaire perdue) : nouvelle cadence à une date, l'affaire revient dans le pipeline.
  function modaleRecontacter(id) {
    const c = contact(id);
    const pr = E.projets.filter((p) => p.contactId === c.id).sort((a, b) => (b.maj || b.creeLe || '').localeCompare(a.maj || a.creeLe || ''))[0];
    const choix = E.cadences.some((k) => k.id === 'douce') ? 'douce' : (E.reglages.cadenceDefaut || E.cadences[0]?.id);
    ouvrirModale(`Recontacter ${esc(c.nom)}`, `<p>Une nouvelle cadence démarre à la date choisie${pr && !etape(pr.etape)?.ouverte ? ` ; l'affaire « ${esc(pr.titre)} » revient dans le pipeline` : ''}.</p>
      <label class="champ">Cadence<select name="cadence">${E.cadences.map((k) => `<option value="${k.id}" ${k.id === choix ? 'selected' : ''}>${esc(k.nom)}</option>`).join('')}</select></label>
      <label class="champ">Premier message le<input type="date" name="date" value="${ajout(auj(), 60)}" min="${auj()}"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Programmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date') || auj();
      memoriserAnnulation();
      Object.assign(c, R.demarrerCadence(c, f.get('cadence'), date), { prochaine: null, archive: false });
      if (pr && !etape(pr.etape)?.ouverte && pr.etape === 'perdu') Object.assign(pr, R.changerEtape(pr, (pr.etapeMax ?? 0) >= 1 ? 'contacte' : 'cible', B.etapes, auj()));
      sauver(); rendre(); toast(`${c.nom} : premier message ${quand(date)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Classer perdue l'affaire en cours d'un contact (motif), la cadence s'arrête.
  function modaleClasserPerdu(id) {
    const c = contact(id);
    const pr = affairePrincipale(c);
    ouvrirModale(`Classer ${esc(c.nom)} en perdu`, `<label class="champ">Motif<select name="motif">${B.motifsPerte.map((m) => `<option ${m === 'Pas de réponse' ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <p class="aide">${pr && etape(pr.etape)?.ouverte ? `L'affaire « ${esc(pr.titre)} » passe « Perdu » et garde l'étape la plus avancée atteinte dans les chiffres.` : 'Aucune affaire ouverte : seule la cadence s\'arrête.'} Tu pourras recontacter la personne plus tard.</p>`,
    '<button class="btn primaire" value="ok">Classer perdu</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memoriserAnnulation();
      let msg = '';
      if (pr && etape(pr.etape)?.ouverte) msg = entrerEtape(pr, 'perdu', f.get('motif'));
      else { c.cadence = null; }
      sauver(); rendre(); toast(`${c.nom} : perdu.${msg}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Opposition : arrêt définitif, coordonnées, notes et échanges effacés ; nom, organisation et date gardés.
  function opposition(id) {
    const c = contact(id);
    if (!confirm(`${c.nom} s'oppose à la prospection ? Toute relance s'arrête ; coordonnées, notes et échanges sont effacés. Les devis et factures restent suivis.`)) return;
    memoriserAnnulation();
    Object.assign(c, R.opposer(c, auj()));
    E.echanges = E.echanges.filter((x) => x.contactId !== c.id);
    E.projets.filter((p) => p.contactId === c.id && etape(p.etape)?.ouverte).forEach((p) => Object.assign(p, R.changerEtape(p, 'perdu', B.etapes, auj(), 'Opposition à la prospection')));
    sauver(); rendre(); toast('Opposition enregistrée : plus aucune relance.', { libelle: 'Annuler', faire: annuler });
  }

  // Saisie groupée de prospects : une ligne par personne, cadence et affaire « À contacter » pour chacun.
  function modalePlusieurs() {
    const t = auj();
    ouvrirModale('Ajouter plusieurs contacts', `
      <label class="champ">Un contact par ligne<small>« Prénom Nom ; Organisation ; Fonction ». Les éléments manquants peuvent rester vides.</small><textarea name="lignes" rows="7" placeholder="Camille Durand ; Atelier Exemple ; Gérante&#10;Sam Martin ; Société Fictive ; Directeur commercial"></textarea></label>
      <div class="deux"><label class="champ">Canal principal<select name="canal">${B.canaux.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></label><label class="champ">Origine<select name="origine"><option value="">—</option>${B.origines.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label></div>
      <div class="deux"><label class="champ">Cadence<select name="cadence">${E.cadences.map((k) => `<option value="${k.id}" ${k.id === E.reglages.cadenceDefaut ? 'selected' : ''}>${esc(k.nom)}</option>`).join('')}</select></label><label class="champ">Premier message le<input type="date" name="debut" value="${t}"></label></div>
      <label class="case"><input type="checkbox" name="affaire" checked> Ajouter au pipeline une affaire « À contacter » pour chacun</label>
      <p class="aide">Pour ne pas tout envoyer le même jour, échelonne : ajoute-les par petits groupes avec des dates différentes. Les personnes opposées à la prospection sont ignorées.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const lignes = R.lireLignes(f.get('lignes'));
      if (!lignes.length) return 'Ajoute au moins une ligne.';
      memoriserAnnulation();
      const ignores = lignes.filter((l) => R.doublonOppose(E.contacts, l));
      const ok = lignes.filter((l) => !ignores.includes(l));
      for (const l of ok) {
        const n = R.demarrerCadence({ id: uid(), nom: l.nom || l.entreprise, entreprise: l.entreprise, fonction: l.fonction, email: '', tel: '', origine: f.get('origine') || '', canal: f.get('canal'), notes: '', creeLe: t, prochaine: null, archive: false, oppose: null }, f.get('cadence'), f.get('debut') || t);
        E.contacts.push(n);
        if (f.get('affaire')) nouvelleAffaire(n);
      }
      sauver(); rendre();
      toast(`${pluriel(ok.length, 'contact ajouté', 'contacts ajoutés')}${ignores.length ? ` · ${ignores.length} ignoré${ignores.length > 1 ? 's' : ''} (opposition)` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleScript(id) {
    const s = id ? script(id) : null;
    const corps = `
      <label class="champ">Titre<input name="titre" required maxlength="80" value="${esc(s?.titre || '')}"></label>
      <div class="deux"><label class="champ">Étape<select name="etape">${B.etapes.map((e) => `<option value="${e.id}" ${e.id === (s?.etape || 'cible') ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
      <label class="champ">Canal<select name="canal">${B.canaux.map((x) => `<option value="${x.id}" ${x.id === (s?.canal || 'email') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label></div>
      <label class="champ">Objet<small>Pour un e-mail ; laisse vide sinon.</small><input name="objet" maxlength="140" value="${esc(s?.objet || '')}"></label>
      <label class="champ">Texte<small>Variables : ${B.variables.map((v) => `{${v}}`).join(' ')}</small><textarea name="texte" rows="9" maxlength="3000" required>${esc(s?.texte || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const utilise = s && E.cadences.some((k) => k.relances.some((r) => r.script === s.id));
    const pied = s ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier le script' : 'Nouveau script', corps, pied, (f, act) => {
      if (act === 'supprimer') {
        if (utilise) return 'Ce script est utilisé par une cadence : choisis-en un autre dans la cadence avant de le supprimer.';
        if (!confirm(`Supprimer le script « ${s.titre} » ?`)) return false;
        memoriserAnnulation();
        E.scripts = E.scripts.filter((x) => x.id !== s.id);
        sauver(); rendre(); toast('Script supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = { titre: String(f.get('titre') || '').trim(), etape: f.get('etape'), canal: f.get('canal'), objet: String(f.get('objet') || '').trim(), texte: String(f.get('texte') || '').trim() };
      if (!v.titre || !v.texte) return 'Indique un titre et un texte.';
      memoriserAnnulation();
      if (s) Object.assign(s, v); else E.scripts.push({ id: uid(), ...v });
      sauver(); rendre(); toast(s ? 'Script enregistré.' : 'Script créé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCadence(id) {
    const k = id ? cadence(id) : null;
    const lignes = [...(k?.relances || [{ delai: 0, canal: 'email', script: E.scripts[0]?.id }]), {}, {}];
    const optScripts = (sel) => `<option value="">Sans script</option>${E.scripts.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.titre)}</option>`).join('')}`;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(k?.nom || '')}"></label>
      <label class="champ">Description<input name="description" maxlength="140" value="${esc(k?.description || '')}"></label>
      <p class="aide">Délai en jours depuis le message précédent (le premier : depuis la date de départ, 0 = le jour même). Laisse le délai vide pour retirer une ligne.</p>
      <div class="relances-edition">${lignes.map((r, i) => `<div class="relance-ligne"><span class="num">${i + 1}</span>
        <label class="champ"><span class="sr-only">Délai de la relance ${i + 1}</span><input type="number" name="delai_${i}" min="0" max="365" value="${r.delai ?? ''}" placeholder="jours" inputmode="numeric"></label>
        <label class="champ"><span class="sr-only">Canal</span><select name="canal_${i}">${B.canaux.map((x) => `<option value="${x.id}" ${x.id === (r.canal || 'email') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ"><span class="sr-only">Script</span><select name="script_${i}">${optScripts(r.script)}</select></label></div>`).join('')}</div>
      <label class="case"><input type="checkbox" name="defaut" ${E.reglages.cadenceDefaut === k?.id ? 'checked' : ''}> Cadence par défaut des nouveaux contacts</label>
      <p class="erreur" role="alert"></p>`;
    const n = k ? E.contacts.filter((x) => x.cadence?.id === k.id).length : 0;
    const pied = k ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(k ? 'Modifier la cadence' : 'Nouvelle cadence', corps, pied, (f, act) => {
      if (act === 'supprimer') {
        if (n) return `Utilisée par ${pluriel(n, 'contact')} : impossible de la supprimer.`;
        if (E.cadences.length < 2) return 'Garde au moins une cadence.';
        if (B.etapes.some((e) => e.cadence === k.id)) return `Cette cadence démarre à l'étape « ${B.etapes.find((e) => e.cadence === k.id).nom} » : modifie-la plutôt que de la supprimer.`;
        if (!confirm(`Supprimer la cadence « ${k.nom} » ?`)) return false;
        memoriserAnnulation();
        E.cadences = E.cadences.filter((x) => x.id !== k.id);
        if (E.reglages.cadenceDefaut === k.id) E.reglages.cadenceDefaut = E.cadences[0].id;
        sauver(); rendre(); toast('Cadence supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la cadence.';
      const relances = lignes.map((_, i) => ({ d: String(f.get(`delai_${i}`) ?? '').trim(), canal: f.get(`canal_${i}`), script: f.get(`script_${i}`) || null }))
        .filter((r) => r.d !== '').map((r) => ({ delai: Number(r.d), canal: r.canal, script: r.script }));
      if (!relances.length) return 'Ajoute au moins une relance.';
      if (relances.some((r) => !Number.isInteger(r.delai) || r.delai < 0 || r.delai > 365)) return 'Délais : nombres entiers entre 0 et 365.';
      memoriserAnnulation();
      const v = { nom, description: String(f.get('description') || '').trim(), relances };
      let cible = k;
      if (k) Object.assign(k, v); else { cible = { id: uid(), ...v }; E.cadences.push(cible); }
      if (f.get('defaut')) E.reglages.cadenceDefaut = cible.id;
      // Un contact au-delà de la nouvelle longueur passe en « cadence terminée ».
      sauver(); rendre(); toast(k ? 'Cadence enregistrée.' : 'Cadence créée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleAide() {
    const r = B.reperes;
    const consulte = fmtLong(r.consulteLe);
    const source = (x) => `<p class="source">Source : <a href="${x.url}" target="_blank" rel="noopener">${esc(x.source)}</a>, consultée le ${consulte}.</p>`;
    ouvrirModale('Aide et repères', `
      <div class="aide-bloc"><h3>Ce que fait ce CRM</h3><p>Il garde tes prospects et clients, l'historique de vos échanges et, pour chacun, une cadence de relance ou une prochaine action datée. Chaque matin, l'onglet Aujourd'hui liste les relances du jour, les cadences terminées sans réponse, les factures en retard et les devis sans réponse. Les ${B.etapes.length} étapes du pipeline, les ${E.cadences.length} cadences, les ${E.scripts.length} scripts et les ${B.actions.length} actions types proposent la suite après chaque échange. Il n'envoie aucun message : tu copies le message préparé et tu l'envoies toi-même.</p></div>
      <div class="aide-bloc"><h3>Ce n'est pas un logiciel de facturation</h3><p>Le CRM <b>suit</b> tes devis et factures (montants, dates, encaissements) ; il n'en émet aucun, ne vérifie ni les mentions obligatoires ni ta TVA, et ne remplace pas ta comptabilité. Aucun taux de TVA n'est intégré : tu saisis le tien.</p><p>${esc(r.facturationElectronique.texte)}</p>${source(r.facturationElectronique)}</div>
      <div class="aide-bloc"><h3>Délais de paiement</h3><p>${esc(r.delaiPaiement.texte)} Le délai par défaut du CRM (${delai()} jours) se change dans les réglages ou facture par facture.</p>${source(r.delaiPaiement)}</div>
      <div class="aide-bloc"><h3>Données de tes clients et prospects (RGPD)</h3>
        <p>Ce que tu notes ici concerne d'autres personnes : tu en es responsable. Les données sont enregistrées en ligne avec ta clé, sur l'hébergement du site QME.</p>
        <ul class="puces-texte">
          <li>Ne note que ce qui sert la relation commerciale ; jamais de santé, d'opinions, de vie privée.</li>
          <li>Informe tes prospects de l'usage de leurs coordonnées et respecte leur refus d'être recontactés : « Enregistrer son opposition », en bas de la fiche, arrête toute relance et ne garde que le nom, l'organisation et la date, pour ne pas les recontacter.</li>
          <li>Sur demande, communique ou supprime les données d'une personne (fiche contact : Modifier, puis Supprimer).</li>
          <li>Ne garde pas indéfiniment : le CRM signale « à revoir » les contacts qui ne t'ont pas donné de nouvelles depuis ${pluriel(E.reglages.conservationAns, 'an')}, sans affaire en cours (réglable). Un message que tu as envoyé sans réponse ne prolonge pas ce délai.</li>
        </ul>
        <p>${esc(r.prospection.texte)}</p>${source(r.prospection)}
        <p>${esc(r.opposition.texte)}</p>${source(r.opposition)}
        <p>${esc(r.conservation.texte)}</p>${source(r.conservation)}</div>
      <p class="aide">Outil d'aide : ces repères ne sont ni un conseil juridique, ni fiscal, ni comptable. Vérifie-les sur les sites officiels, ils peuvent changer.</p>`,
    '<button class="btn primaire" value="ok">Compris</button>');
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="deux"><label class="champ">Ton prénom<small>{mon prénom} dans les scripts.</small><input name="nom" maxlength="40" value="${esc(E.nom)}"></label>
      <label class="champ">Cadence par défaut<small>Proposée aux nouveaux contacts.</small><select name="cadenceDefaut">${E.cadences.map((k) => `<option value="${k.id}" ${k.id === r.cadenceDefaut ? 'selected' : ''}>${esc(k.nom)}</option>`).join('')}<option value="" ${!r.cadenceDefaut ? 'selected' : ''}>Aucune : action datée à la main</option></select></label></div>
      <label class="champ">Ton activité en une phrase<small>{mon activité} dans les scripts.</small><input name="activite" maxlength="160" value="${esc(r.monActivite || '')}"></label>
      <div class="deux"><label class="champ">Délai de paiement par défaut (jours)<input type="number" name="delai" min="0" max="120" value="${r.delaiPaiement}"></label>
      <label class="champ">Taux de TVA habituel (%)<input name="tva" inputmode="decimal" value="${r.tva ?? ''}"></label></div>
      <div class="deux"><label class="champ">Relancer un devis après (jours)<input type="number" name="relance" min="1" max="60" value="${r.relanceDevis}"></label>
      <label class="champ">Contacts « à revoir » après (ans)<small>Référentiel CNIL : 3 ans.</small><input type="number" name="conservation" min="1" max="10" value="${r.conservationAns}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Aide</h3><p class="aide">Facturation, délais de paiement, données de tes contacts (RGPD), avec les sources.</p><div class="rang"><button class="btn petit" type="button" data-action="aide">Aide et repères</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'} « Restaurer » accepte aussi une copie du Pipeline de prospection B2B : ses prospects deviennent des contacts.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du CRM, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
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
      Object.assign(r, { delaiPaiement: dl, tva, relanceDevis: rl, conservationAns: cv, monActivite: String(f.get('activite') || '').trim(), cadenceDefaut: f.get('cadenceDefaut') || '' });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        let d = JSON.parse(await fichier.text());
        // Copie du Pipeline de prospection B2B (fusionné dans ce CRM le 22/11/2026) : prospects repris en contacts.
        if (Array.isArray(d.prospects) && !Array.isArray(d.contacts)) d = R.depuisPipeline(d, B, { id: uid, aujourdhui: auj() });
        if (!Array.isArray(d.contacts) || !Array.isArray(d.documents)) throw new Error();
        if (!confirm(`Remplacer ton CRM actuel par cette copie (${pluriel(d.contacts.length, 'contact')}, ${pluriel(d.documents.length, 'document')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe;
        if (vu) E.tutorielVu = true;
        contactOuvert = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du CRM.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-prospection-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const nomCadence = (id) => cadence(id)?.nom;
    const defaut = nomCadence(r.cadenceDefaut);
    const etapeCadence = B.etapes.find((e) => e.cadence && e.cadence !== 'garder' && cadence(e.cadence));
    const arretent = B.etapes.filter((e) => !e.cadence).map((e) => e.nom).join(', ');
    const blocs = [
      ['rose', 'Une cadence ou une action par contact', `Chaque contact suit soit une <b>cadence de relance</b>, une suite de messages prévus chacun un nombre de jours après le précédent réellement envoyé${defaut ? ` (par défaut «&nbsp;${esc(defaut)}&nbsp;»)` : ''}, soit une <b>prochaine action</b> datée à la main&nbsp;: rendez-vous, devis à envoyer, point d'avancement… Le jour venu, elle apparaît dans <b>Aujourd'hui</b>.`],
      ['beurre', 'Relancer le jour venu', `<b>Préparer</b> remplit le script avec la fiche du contact&nbsp;: tu le copies et tu l'envoies toi-même, l'application n'envoie rien. <b>Envoyé</b> calcule la relance suivante&nbsp;; <b>A répondu</b> arrête la cadence. Pour une action datée, <b>Fait</b> note l'échange et propose l'action suivante avec sa date. <b>Demain</b> reporte d'un jour.`],
      ['ciel', 'Le pipeline pilote les relances', `Une affaire avance de «&nbsp;À contacter&nbsp;» à Gagné ou Perdu. Le premier message envoyé la passe «&nbsp;Contacté&nbsp;», une réponse «&nbsp;En échange&nbsp;». ${etapeCadence ? `«&nbsp;${esc(etapeCadence.nom)}&nbsp;» démarre la cadence «&nbsp;${esc(nomCadence(etapeCadence.cadence))}&nbsp;»&nbsp;; ` : ''}${esc(arretent)} arrêtent la cadence et proposent l'action type. Une cadence finie sans réponse remonte dans Aujourd'hui&nbsp;: recontacte plus tard ou classe en perdu.`],
      ['rose', 'Devis et factures&nbsp;: le suivi', `Reporte tes devis et factures (montant HT, ton taux de TVA)&nbsp;: le CRM les suit mais ne les émet pas. Un devis lié marqué envoyé passe l'affaire en proposition, accepté en Gagné. Une facture est due ${delai()} jours après sa date par défaut&nbsp;; au-delà, elle passe <b>En retard</b>. Un devis envoyé sans réponse depuis ${r.relanceDevis} jours remonte dans Aujourd'hui, sauf si une cadence le relance déjà.`],
      ['sable', 'Tes contacts, tes responsabilités', `Ne note que ce qui sert la relation commerciale. <b>Enregistrer son opposition</b>, en bas d'une fiche, arrête toute relance et ne garde que le nom, l'organisation et la date. Un contact qui ne t'a pas donné de nouvelles depuis plus de ${pluriel(r.conservationAns, 'an')}, sans affaire en cours, est signalé <b>à revoir</b>. Les repères (RGPD, délais de paiement) sont dans les réglages, <b>Aide et repères</b>.`],
    ];
    const corps = `
      <p>Le CRM te dit chaque jour qui relancer, prépare le message et suit ce qui reste à encaisser. Ton rôle&nbsp;: noter chaque contact avec sa cadence ou sa prochaine action, envoyer toi-même les messages, puis noter ce qui s'est passé.</p>
      <ol class="tuto">${blocs.map(([c, titre, texte]) => `<li style="--f:var(--${c});--t:var(--${c === 'sable' ? 'encre' : `${c}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Contacts</b> réunit les fiches (échanges, affaires, factures), <b>Pipeline</b> les affaires par étape avec les scripts et les cadences, <b>Chiffres</b> la conversion (étapes, canaux, activité) et le chiffre d'affaires facturé et encaissé. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.contacts.length;
    const pied = premier
      ? '<button class="btn primaire" value="contact">Ajouter mon premier contact</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'contact') setTimeout(() => modaleContact(), 0); });
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
    c.cadence = null;
    c.archive = false;
    sauver(); rendre();
    toast(`${action(type).nom} ajouté aux relances du jour pour ${c.nom}.`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; contactOuvert = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'sous-vue': changerVue(el.dataset.vue); break;
      case 'periode': periode = id; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'aide': modaleAide(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'contact-nouveau': modaleContact(); break;
      case 'contacts-plusieurs': modalePlusieurs(); break;
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
      case 'reporter': reporterA(id, ajout(auj(), 1)); break;
      case 'reporter-date': { const c = contact(id); if (modale().open) modale().close(); modaleDate('Reporter', `${esc(libelleAction(prochaine(c)))} avec ${esc(c.nom)}, décalée à la date choisie${c.cadence ? ', sans compter de message' : ''}.`, ajout(auj(), 1), 'Reporter', (d) => reporterA(id, d)); break; }
      case 'envoye': if (modale().open) modale().close(); envoye(id); break;
      case 'message': modaleMessage(id); break;
      case 'repondu': if (modale().open) modale().close(); modaleEchange(id, null, false, true); break;
      case 'recontacter': modaleRecontacter(id); break;
      case 'classer-perdu': modaleClasserPerdu(id); break;
      case 'opposition': opposition(id); break;
      case 'script-nouveau': modaleScript(); break;
      case 'script-modifier': modaleScript(id); break;
      case 'cadence-nouvelle': modaleCadence(); break;
      case 'cadence-modifier': modaleCadence(id); break;
      case 'scripts-origine': {
        if (!confirm('Remettre les scripts d\'origine ? Tes scripts modifiés ou ajoutés seront remplacés.')) break;
        memoriserAnnulation();
        E.scripts = structuredClone(B.scripts);
        // Les cadences qui visaient un script disparu restent sans script.
        E.cadences.forEach((k) => k.relances.forEach((r) => { if (r.script && !script(r.script)) r.script = null; }));
        sauver(); rendre(); toast('Scripts d\'origine remis.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'copier-script': {
        const s = script(id);
        const c = apercu ? contact(apercu) : null;
        const tx = c ? R.remplirScript(s.texte, valeurs(c)).texte : s.texte;
        toast(await copierTexte(tx) ? 'Script copié.' : 'Copie impossible : sélectionne le texte à la main.');
        break;
      }
      case 'copier': {
        const champ = document.getElementById(el.dataset.cible);
        if (champ) toast(await copierTexte(champ.value) ? (el.dataset.cible === 'msg-objet' ? 'Objet copié.' : 'Message copié : colle-le dans ta messagerie.') : 'Copie impossible : sélectionne le texte à la main.');
        break;
      }
      case 'affaire-nouvelle': modaleAffaire(null, id); break;
      case 'affaire-modifier': modaleAffaire(id); break;
      case 'etape-suivante': {
        const p = projet(id); memoriserAnnulation();
        const msg = entrerEtape(p, R.etapeSuivante(B.etapes, p.etape));
        sauver(); rendre(); toast(`« ${p.titre} » : ${etape(p.etape).nom}.${msg}`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'affaire-perdue': {
        const p = projet(id); memoriserAnnulation();
        const msg = entrerEtape(p, 'perdu');
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
    } else if (act === 'suivi-select') {
      const f = el.form;
      f.querySelector('[data-suivi="cadence"]').hidden = !el.value || el.value === 'aucune';
      f.querySelector('[data-suivi="main"]').hidden = el.value !== '';
      const fr = $('#frise-suivi'); if (fr) fr.innerHTML = descriptionCadence(el.value);
    } else if (act === 'apercu') {
      apercu = el.value; rendre();
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
