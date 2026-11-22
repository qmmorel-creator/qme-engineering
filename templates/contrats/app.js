// Contrats fournisseurs et échéances QME : contrats par fournisseur et catégorie, montant et périodicité,
// échéance avec reconduction tacite, préavis et date limite de résiliation calculée, alertes (J-60, J-30,
// dépassée), décision (renouveler, renégocier, résilier) avec modèle de lettre, coût annuel par catégorie,
// historique, export CSV. Données synchronisées par clé de licence ou code d'accès.
// Outil d'aide : ne remplace pas la lecture du contrat ni un conseil juridique.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CTR;
  const API = '/api/templates';
  const PRODUIT = 'CTR';
  const CLE_CODE = 'qme-ctr-code';
  const CLE_CACHE = 'qme-ctr-cache';
  const CLE_DEMO = 'qme-ctr-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ctr-ecran-accueil';

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
  const { ajout, ajoutMois, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const euros = (n, dec = false) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 })} €`;
  const eurosAuto = (n) => euros(n, Math.round(n) !== n);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const lienExterne = (url, texte) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texte)}</a>` : esc(texte));
  const dans = (j) => (j === null ? '' : j === 0 ? 'aujourd\'hui' : j > 0 ? `dans ${pluriel(j, 'jour')}` : `depuis ${pluriel(-j, 'jour')}`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { statut: 'tous', q: '', groupe: 'categorie', categorie: '', histo: '' };
  let annulation = null;

  const contrat = (id) => E.contrats.find((c) => c.id === id);
  const mention = () => E.reglages.mention || 'HT';

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
        toast('Un autre appareil a modifié tes contrats entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (CTR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.initialise) { cache(false); demarrer(); } else ecranAccueil();
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
  // Entreprise fictive de services, 15 contrats de fournisseurs fictifs (« Exemple »), dates relatives à
  // aujourd'hui. États forcés : préavis dépassé (nettoyage), J-30 (assurance des locaux, copieur à résilier
  // avec lettre prête), J-60 (climatisation à renégocier, électricité sans reconduction), reconductions
  // tacites déjà intervenues (fibre), renégociations (portes, fibre), résiliation envoyée (télésurveillance),
  // contrat terminé (fontaines), paiement unique, date de fin à saisir (messagerie), décision « Renouveler ».
  function donneesDemo() {
    const e = etatVide();
    e.initialise = true;
    e.structure = 'Société Exemple';
    e.lettre = { adresse: '12 rue de l\'Exemple, 00000 Ville-Exemple', ville: 'Ville-Exemple', signataire: 'Camille Exemple', fonction: 'Office manager' };
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n, dj = 0) => ajout(ajoutMois(t, n), dj);
    const marge = e.reglages.margeEnvoi;
    // Échéance telle que la date d'envoi conseillée tombe dans n jours (préavis en mois).
    const finPour = (n, preavisMois) => ajoutMois(j(n + marge), preavisMois);
    const specs = [
      { nom: 'Multirisque des locaux', fournisseur: 'Assurances Exemple', categorie: 'assurances', reference: 'MRP-204518', montant: 3840, periodicite: 'annuel', debut: m(-38), fin: finPour(19, 2), contact: 'Conseiller entreprise', lien: 'https://example.com/contrats/multirisque.pdf' },
      { nom: 'Responsabilité civile professionnelle', fournisseur: 'Assurances Exemple', categorie: 'assurances', reference: 'RCP-88412', montant: 1260, periodicite: 'annuel', debut: m(-27), fin: m(9, 3), decision: 'renouveler' },
      { nom: 'Maintenance de la climatisation', fournisseur: 'Clim Service Exemple', categorie: 'maintenance', reference: 'CS-2291', montant: 320, periodicite: 'trimestriel', debut: m(-33), fin: finPour(44, 3), decision: 'renegocier', note: 'Deux visites par an seulement l\'an dernier pour quatre prévues : demander un avoir ou une baisse.' },
      { nom: 'Nettoyage des locaux', fournisseur: 'Propreté Exemple', categorie: 'nettoyage', reference: 'NET-1107', montant: 1150, periodicite: 'mensuel', debut: m(-45), fin: finPour(-9, 3), contact: 'Responsable de secteur' },
      { nom: 'Fibre et téléphonie', fournisseur: 'Télécom Exemple', categorie: 'telecoms', reference: 'FTTO-77310', montant: 229, periodicite: 'mensuel', debut: m(-44), fin: m(-20, 6), dureeReconductionMois: 12 },
      { nom: 'Location du copieur multifonction', fournisseur: 'Copieurs Exemple', categorie: 'leasing', reference: 'LOC-55021', montant: 240, periodicite: 'trimestriel', debut: m(-60), fin: finPour(23, 6), preavis: { mois: 6 }, decision: 'resilier', note: 'Préavis de 6 mois (conditions particulières, article 9). Remplacer par une imprimante achetée.' },
      { nom: 'Logiciel de paie', fournisseur: 'Logiciel Exemple', categorie: 'logiciels', reference: 'ABO-3302', montant: 89, periodicite: 'mensuel', debut: m(-19), fin: m(5, -2), decision: 'renouveler' },
      { nom: 'Électricité des locaux', fournisseur: 'Énergie Exemple', categorie: 'energie', reference: 'PDL 000 000 000', montant: 410, periodicite: 'mensuel', debut: m(-22), fin: j(48), reconduction: 'aucune', note: 'Offre à prix fixe : comparer trois offres avant la fin.' },
      { nom: 'Télésurveillance', fournisseur: 'Sécurité Exemple', categorie: 'securite', reference: 'TS-9081', montant: 69, periodicite: 'mensuel', debut: m(-37), fin: m(4, 4) },
      { nom: 'Fontaines à eau', fournisseur: 'Services Exemple', categorie: 'services', reference: 'FE-118', montant: 45, periodicite: 'mensuel', debut: m(-30), fin: j(-60) },
      { nom: 'Maintenance des portes automatiques', fournisseur: 'Portes Exemple', categorie: 'maintenance', reference: 'PA-6640', montant: 980, periodicite: 'annuel', debut: m(-26), fin: m(10, 12) },
      { nom: 'Messagerie et bureautique (18 comptes)', fournisseur: 'Logiciel Exemple', categorie: 'logiciels', reference: '', montant: 216, periodicite: 'mensuel', debut: m(-8), fin: null, note: 'Date d\'échéance à retrouver dans l\'espace client.' },
      { nom: 'Machine à affranchir', fournisseur: 'Services Exemple', categorie: 'leasing', reference: 'MAF-2207', montant: 95, periodicite: 'trimestriel', debut: m(-10), fin: m(14, 8) },
      { nom: 'Vérification des extincteurs', fournisseur: 'Prévention Exemple', categorie: 'maintenance', reference: 'EXT-410', montant: 420, periodicite: 'annuel', debut: m(-18), fin: m(6, 9) },
      { nom: 'Installation du contrôle d\'accès', fournisseur: 'Sécurité Exemple', categorie: 'securite', reference: 'DEV-2026-14', montant: 2400, periodicite: 'unique', debut: j(-120), fin: m(8), reconduction: 'aucune', note: 'Paiement unique ; la garantie court jusqu\'à la fin indiquée.' },
    ];
    for (const s of specs) {
      const c = R.normaliserContrat({ id: uid(), reconduction: 'tacite', ...s });
      e.contrats.push(c);
      R.journal(e, { contrat: c.id, date: c.debut || j(-30), type: 'creation', texte: 'Contrat saisi dans l\'outil.' }, uid);
    }
    const par = (nom) => e.contrats.find((c) => c.nom === nom);
    for (const c of e.contrats) {
      if (c.decision !== 'a-decider') { const d = c.decision; c.decision = 'a-decider'; R.decider(e, c.id, d, j(-6), d === 'renegocier' ? 'demander un devis concurrent avant la date limite' : '', uid); }
    }
    // Renégociations déjà obtenues (économies sur 12 mois).
    R.renegocier(e, par('Fibre et téléphonie').id, { date: m(-8), montant: 189, note: 'Offre concurrente présentée : 189 € par mois au lieu de 229 €.' }, m(-8), uid);
    par('Fibre et téléphonie').decision = 'a-decider';
    R.renegocier(e, par('Maintenance des portes automatiques').id, { date: j(-50), montant: 780, note: 'Visite annuelle groupée avec la porte de quai : 780 € au lieu de 980 €.' }, j(-50), uid);
    // Résiliations : une envoyée (fin le mois prochain), une terminée.
    R.resilier(e, par('Télésurveillance').id, { envoyeeLe: j(-40), mode: B.modesEnvoi[0], reference: 'RAR 1A 000 000 0001 2' }, j(-40), uid);
    R.resilier(e, par('Fontaines à eau').id, { envoyeeLe: j(-150), effetLe: j(-60), mode: B.modesEnvoi[2] }, j(-150), uid);
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Contrats fournisseurs et échéances · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="150" height="200" rx="14" fill="#2E5A88"/>
          <rect x="44" y="80" width="100" height="12" rx="6" fill="#F0EDE6"/>
          <rect x="44" y="110" width="70" height="12" rx="6" fill="#F0EDE6"/>
          <rect x="190" y="150" width="90" height="90" fill="#E8B93A"/>
          <rect x="190" y="40" width="90" height="90" fill="none" stroke="#24221F" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="430" cy="150" r="130" fill="#F3EDE3"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#E58C74"/>
          <circle cx="430" cy="150" r="46" fill="#24221F"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Contrats fournisseurs et échéances</p>
          <h1>Plus de reconduction subie.</h1>
          <p>Tes contrats par fournisseur et catégorie, la date limite de résiliation calculée, les alertes à J-60 et J-30, la lettre de résiliation prête à adapter et le coût annuel de chaque poste.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes contrats</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes contrats sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes contrats</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/contrats/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes contrats'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const nouvelAccueil = () => ({ etape: 1, structure: '', ville: '', categories: null, preavis: {} });
  let accueil = nouvelAccueil();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On ne subit plus les reconductions.</h1>
        <p class="intro">Pour chaque contrat, tu notes le fournisseur, le montant, la date de fin de la période en cours et le préavis : l'outil fait avancer les reconductions tacites, calcule la date limite de résiliation, te prévient à J-60 et J-30 et prépare la lettre.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton entreprise ou ta structure <small>Facultatif, reprise sur les lettres.</small><input id="structure" value="${esc(a.structure)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Ville <small>Facultative, pour « Fait à … le … ».</small><input id="ville" value="${esc(a.ville)}" maxlength="60"></label>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const coches = new Set(a.categories ?? B.categories.map((c) => c.id));
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes catégories de contrats</h1>
        <p class="intro">Garde celles qui te concernent. Le préavis indiqué est une valeur par défaut, pas une règle : chaque contrat peut avoir le sien, et c'est celui du contrat qui compte. Tu pourras tout changer dans les réglages.</p>
        <div class="choix-cats" style="margin-top:16px">${B.categories.map((c) => `<div class="cat-choix"><label class="case"><input type="checkbox" name="cats" value="${c.id}" ${coches.has(c.id) || c.id === 'autre' ? 'checked' : ''} ${c.id === 'autre' ? 'disabled' : ''}><span><b>${esc(c.nom)}</b><small>${esc(c.exemples)}</small></span></label>
          <label class="champ preavis-cat">Préavis par défaut <span class="rang-preavis"><input name="pv-${c.id}" inputmode="numeric" value="${a.preavis[c.id] ?? (c.preavisMois ?? '')}" placeholder="–" aria-label="Préavis par défaut en mois pour ${esc(c.nom)}"> mois</span></label></div>`).join('')}</div>
        <p class="aide" style="max-width:720px;margin-top:16px">Ces préavis sont des repères d'organisation, modifiables. ${esc(B.categories[0].nom)} : le Code des assurances (art. L113-12) prévoit deux mois avant l'échéance annuelle, mais permet d'y déroger pour les risques professionnels ; lis ta police (source dans le guide).</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['structure', 'ville']) $(`#${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    document.querySelectorAll('[name=cats]').forEach((el) => el.addEventListener('change', () => { accueil.categories = [...document.querySelectorAll('[name=cats]:checked')].map((x) => x.value); }));
    document.querySelectorAll('[name^="pv-"]').forEach((el) => el.addEventListener('input', () => { accueil.preavis[el.name.slice(3)] = el.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    const garde = new Set([...(a.categories ?? B.categories.map((c) => c.id)), 'autre']);
    for (const [id, v] of Object.entries(a.preavis)) {
      const s = String(v).trim();
      if (s && !(Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 36)) { toast(`Préavis illisible pour « ${B.categories.find((c) => c.id === id)?.nom} » : un nombre de mois entre 0 et 36.`); return; }
    }
    const vu = !!E?.tutorielVu;
    E = etatVide();
    E.tutorielVu = vu;
    E.initialise = true;
    E.structure = a.structure.trim();
    E.lettre.ville = a.ville.trim();
    E.categories = E.categories.filter((c) => garde.has(c.id)).map((c) => (a.preavis[c.id] !== undefined ? { ...c, preavisMois: String(a.preavis[c.id]).trim() === '' ? null : Number(a.preavis[c.id]) } : c));
    accueil = nouvelAccueil();
    vue = 'contrats';
    sauver();
    demarrer();
    toast('C\'est prêt : ajoute ton premier contrat.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    contrats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    couts: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="5" height="8" fill="currentColor"/><rect x="10" y="8" width="5" height="13" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    historique: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><path d="M14 3 22 17H6Z" fill="none" stroke="currentColor" stroke-width="2" transform="translate(-1 0) scale(.9)"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#B84A34"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#E8B93A" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#B84A34" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#2E5A88" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  // tutorielVu (guide « Comment ça marche » déjà vu) : propre à l'application, réinjecté après la normalisation.
  function etatVide() { return { ...R.etatVide(), tutorielVu: false }; }
  function normaliser(d) { return { ...R.normaliser(d), tutorielVu: !!d?.tutorielVu }; }
  const ONGLETS = [['tableau', 'Bord'], ['contrats', 'Contrats'], ['calendrier', 'Calendrier'], ['couts', 'Coûts'], ['historique', 'Historique']];
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : il ne remplace ni la lecture de tes contrats ni un conseil juridique. Les dates limites dépendent de ce que tu saisis (échéance, préavis, reconduction) ; vérifie-les dans les conditions générales et particulières de chaque contrat, qui priment.</p>';
  const COULEUR_STATUT = { depassee: 'rouge', j30: 'jaune', j60: 'ciel', inconnue: 'rose', ok: 'vert', resilie: 'sable', termine: 'sable' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;
  const COULEUR_DECISION = { renouveler: 'vert', renegocier: 'ciel', resilier: 'rose' };
  const etiquetteDecision = (d) => (d === 'a-decider' ? '' : `<span class="etiquette ${COULEUR_DECISION[d]}">${R.libDecision(d)}</span>`);
  const couleurCat = (cat) => B.couleurs[(cat?.couleur ?? 0) % B.couleurs.length];
  const pastilleCat = (cat) => `<i class="pastille-cat" style="--c:${couleurCat(cat)}" aria-hidden="true"></i>`;
  const libMontant = (s) => (s.periodicite.parAn === 0 ? `${eurosAuto(s.c.montant)} une fois` : `${eurosAuto(s.c.montant)} ${s.periodicite.court}`);

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Contrats<br>fournisseurs</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et calculs" title="Guide et calculs">${ICONES.guide}</button>
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
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { ...Object.fromEntries(ONGLETS), tableau: 'Tableau de bord', guide: 'Guide et calculs' };
    document.title = `${titres[vue]} · Contrats fournisseurs`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, contrats: vueContrats, calendrier: vueCalendrier, couts: vueCouts, historique: vueHistorique, guide: vueGuide }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#filtre-cat')?.addEventListener('change', (e) => { filtre.categorie = e.target.value; rendre(); });
    $('#filtre-histo')?.addEventListener('change', (e) => { filtre.histo = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="20" width="44" height="76" rx="6" fill="#2E5A88"/><rect x="52" y="56" width="40" height="40" fill="#E8B93A"/><circle cx="72" cy="26" r="20" fill="#E58C74"/></svg>';

  // Texte court de la situation d'un contrat (ce qu'il faut faire, et quand).
  function quoiFaire(s) {
    if (s.statut === 'resilie') return `Résilié : fin le ${dateCourte(s.c.resiliation?.effetLe || s.fin)}`;
    if (s.statut === 'termine') return `Terminé le ${dateCourte(s.c.resiliation?.effetLe || s.fin)}`;
    if (s.statut === 'inconnue') return 'Date de fin de la période en cours à saisir';
    if (!s.tacite) return `Fin du contrat ${dans(s.joursFin)} (${dateCourte(s.fin)}), sans reconduction : renouveler ou remplacer`;
    if (s.sansPreavis) return `Échéance ${dans(s.joursFin)} · préavis à saisir`;
    if (s.statut === 'depassee') return `Préavis dépassé : reconduit le ${dateCourte(s.fin)}${s.suivante ? ` · prochaine date limite le ${dateCourte(s.suivante.limite)}` : ''}`;
    return `Résilier avant le ${dateCourte(s.limite)} (envoi conseillé ${dans(s.jours)})`;
  }

  function boutonsDecision(s) {
    if (!s.actif) return '';
    if (s.decision === 'resilier') return `<button class="btn petit" data-action="lettre" data-id="${s.c.id}">Lettre</button>`;
    return `<button class="btn petit" data-action="decider" data-id="${s.c.id}">${s.statut === 'inconnue' ? 'Compléter' : 'Décider'}</button>`;
  }

  // ---------- Tableau de bord ----------
  function ligneAlerte(s) {
    const cle = s.statut === 'inconnue' ? null : (s.tacite && s.statut !== 'depassee' ? (s.envoi || s.fin) : s.fin);
    const pastille = cle ? `<span class="date-pastille ${s.statut}"><b>${versDate(cle).getDate()}</b>${fmt(cle, { month: 'short' })}</span>` : '<span class="date-pastille inconnue"><b>?</b>date</span>';
    return `<li>${pastille}<button class="lien-ligne" data-action="ouvrir" data-id="${s.c.id}"><b>${esc(s.c.nom)}</b><span>${esc(quoiFaire(s))} · ${esc(s.c.fournisseur || s.categorie.nom)}</span><span class="ligne-etiquettes">${etiquetteStatut(s.statut)}${etiquetteDecision(s.decision)}</span></button>
      ${s.statut === 'inconnue' ? `<button class="btn petit" data-action="modifier" data-id="${s.c.id}">Compléter</button>` : boutonsDecision(s)}</li>`;
  }

  function barresCategories(liste, total) {
    liste = liste.filter((x) => x.cout > 0);
    const max = Math.max(1, ...liste.map((x) => x.cout));
    return `<div class="barres-cats" role="list">${liste.map((x) => `<div class="barre-cat" role="listitem"><span class="bc-nom">${pastilleCat(x.categorie)}${esc(x.categorie.nom)}</span><span class="bc-piste" aria-hidden="true"><span class="bc-barre" style="width:${Math.max(1, (x.cout / max) * 100)}%;background:${couleurCat(x.categorie)}"></span></span><span class="bc-val">${euros(x.cout)}<small>${pluriel(x.nb, 'contrat')}${total ? ` · ${Math.round((x.cout / total) * 100)} %` : ''}</small></span></div>`).join('')}</div>`;
  }

  function vueTableau() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.structure ? `${esc(E.structure)} · ` : ''}Les dates limites de résiliation qui arrivent, et ce que coûtent tes contrats.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-contrat">${ICONES.plus}Ajouter un contrat</button></div></div>`;
    if (!E.contrats.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun contrat pour l'instant</h3><p>Commence par ceux qui coûtent le plus ou qui se reconduisent seuls : assurances, maintenance, nettoyage, télécoms, location de matériel.</p><div class="actions"><button class="btn primaire" data-action="nouveau-contrat">${ICONES.plus}Ajouter un contrat</button></div></div></div>${AVERTISSEMENT}`;
    }
    const s = R.synthese(E, t);
    const al = R.alertes(E, t);
    const r = E.reglages;
    const tuiles = [
      ['Préavis dépassés', String(s.depassee), s.depassee ? 'reconduits si rien n\'est fait' : 'aucun contrat reconduit malgré toi', 'var(--rouge)', 'rond'],
      ['À traiter', String(s.j30), `date limite d'envoi dans ${r.alerteCourte} jours ou moins`, 'var(--jaune)', ''],
      ['À anticiper', String(s.j60), `entre ${r.alerteCourte + 1} et ${r.alerteLongue} jours`, 'var(--bleu)', ''],
      ['Coût annuel', euros(s.coutAnnuel), `${pluriel(s.nb, 'contrat')} en cours · ${mention()}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const pc = R.parCategorie(E, t);
    const eco = [];
    if (s.economiesPrevues) eco.push(`Résiliations décidées : <b>${euros(s.economiesPrevues)}</b> par an en moins (${pluriel(s.aResilier.length, 'contrat')}).`);
    if (s.economiesObtenues) eco.push(`Renégociations et résiliations des 12 derniers mois : <b>${euros(s.economiesObtenues)}</b> par an économisés.`);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${eco.length ? `<p class="resume-ventes">${eco.join(' ')}</p>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Alertes <span>Préavis dépassés, J-${r.alerteCourte}, J-${r.alerteLongue}, dates manquantes</span></h2>
          ${al.length ? `<ul class="prochains alertes-ctr">${al.slice(0, 8).map(ligneAlerte).join('')}</ul>${al.length > 8 ? `<p class="mention">${pluriel(al.length - 8, 'autre alerte')} : voir <button class="btn lien" data-action="filtre-vue" data-statut="alerte">les contrats à traiter</button>.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune alerte</h3><p>Aucune date limite de résiliation dans les prochaines semaines, ou la décision est déjà prise.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Coût annuel par catégorie <span>Contrats en cours, ${mention()}</span></h2>
          <div class="graphique">${pc.length ? barresCategories(pc, s.coutAnnuel) : '<p class="mention">Aucun contrat en cours.</p>'}</div>
          ${s.uniques ? `<p class="mention" style="margin-top:8px">Paiements uniques en cours (hors coût annuel) : ${euros(s.uniques)}.</p>` : ''}
          <p class="mention" style="margin-top:8px"><button class="btn lien" data-action="vue" data-vue="couts">Détail par catégorie et par fournisseur</button></p>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Contrats ----------
  const FILTRES = [['tous', 'En cours'], ['alerte', 'À traiter'], ['depassee', 'Préavis dépassé'], ['j30', `J-30`], ['j60', 'J-60'], ['inconnue', 'À compléter'], ['ok', 'Rien à faire'], ['fini', 'Résiliés et terminés']];
  function garder(s, f) {
    if (f === 'fini') return !s.actif;
    if (!s.actif) return false;
    if (f === 'tous') return true;
    if (f === 'alerte') return ['depassee', 'j30', 'j60', 'inconnue'].includes(s.statut) && (s.statut === 'inconnue' || s.decision !== 'renouveler');
    return s.statut === f;
  }

  function ligneContrat(s) {
    const c = s.c;
    const tags = [etiquetteStatut(s.statut)];
    const d = etiquetteDecision(s.decision);
    if (d && s.actif) tags.push(d);
    if (s.actif && s.tacite) tags.push('<span class="etiquette sable">Tacite reconduction</span>');
    if (s.actif && !s.tacite) tags.push('<span class="etiquette sable">Sans reconduction</span>');
    if (s.actif && s.preavis && s.preavis.origine === 'categorie') tags.push('<span class="etiquette sable">Préavis par défaut</span>');
    const classe = s.statut === 'depassee' ? 'alerte-depasse' : s.statut === 'j30' || s.statut === 'inconnue' ? 'alerte-proche' : !s.actif ? 'st-resilie' : '';
    const detail = [c.fournisseur, c.reference && `n° ${c.reference}`].filter(Boolean).map(esc).join(' · ');
    const dateCle = !s.actif ? (s.c.resiliation?.effetLe || s.fin) : s.statut === 'inconnue' ? null : s.tacite && s.limite && s.statut !== 'depassee' ? s.limite : s.fin;
    return `<li class="ligne-fac ${classe}">
      <button class="ligne-info" data-action="ouvrir" data-id="${c.id}">
        <b>${esc(c.nom)}</b>
        <span class="ligne-detail">${detail || esc(s.categorie.nom)} · ${esc(libMontant(s))}</span>
        <span class="ligne-detail">${esc(quoiFaire(s))}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${dateCle ? dateCourte(dateCle) : 'Date ?'}</b><small>${!s.actif ? 'fin du contrat' : s.statut === 'inconnue' ? 'échéance à saisir' : s.statut === 'depassee' ? 'reconduction' : s.tacite && s.limite ? 'date limite de réception' : 'fin du contrat'} · ${s.periodicite.parAn ? `${euros(s.coutAnnuel)} / an` : 'paiement unique'}</small></span>
        ${s.statut === 'inconnue' ? `<button class="btn petit" data-action="modifier" data-id="${c.id}">Compléter</button>` : boutonsDecision(s)}
      </div>
    </li>`;
  }

  function vueContrats() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Contrats</h1><p>Chaque contrat, sa date limite de résiliation et ce qu'il coûte par an.</p></div>
      <div class="actions"><button class="btn" data-action="csv-contrats">Exporter (CSV)</button><button class="btn primaire" data-action="nouveau-contrat">${ICONES.plus}Ajouter un contrat</button></div></div>`;
    if (!E.contrats.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun contrat</h3><p>Un contrat par engagement : « Multirisque des locaux », « Maintenance de la climatisation », « Location du copieur »… Avec sa date de fin et son préavis, la date limite de résiliation se calcule.</p><div class="actions"><button class="btn primaire" data-action="nouveau-contrat">${ICONES.plus}Ajouter un contrat</button></div></div></div>${AVERTISSEMENT}`;
    if (filtre.categorie && !E.categories.some((c) => c.id === filtre.categorie)) filtre.categorie = '';
    const toutes = R.situations(E, t).filter((s) => !filtre.categorie || s.categorie.id === filtre.categorie);
    const q = filtre.q.trim().toLowerCase();
    const cherche = (s) => !q || [s.c.nom, s.c.fournisseur, s.c.reference, s.categorie.nom, s.c.contact, s.c.note].join(' ').toLowerCase().includes(q);
    const compte = (f) => toutes.filter((s) => garder(s, f) && cherche(s)).length;
    const liste = toutes.filter((s) => garder(s, filtre.statut) && cherche(s));
    let groupes;
    if (filtre.groupe === 'fournisseur') {
      const noms = [...new Set(liste.map((s) => s.c.fournisseur || 'Fournisseur non renseigné'))].sort((a, b) => a.localeCompare(b));
      groupes = noms.map((n) => ({ titre: esc(n), lignes: liste.filter((s) => (s.c.fournisseur || 'Fournisseur non renseigné') === n) }));
    } else {
      groupes = E.categories.map((cat) => ({ titre: `${pastilleCat(cat)}${esc(cat.nom)}`, lignes: liste.filter((s) => s.categorie.id === cat.id) })).filter((g) => g.lignes.length);
    }
    const somme = (l) => l.filter((s) => s.actif).reduce((x, s) => x + s.coutAnnuel, 0);
    return `${titre}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Statut">${FILTRES.map(([f, l]) => `<button class="filtre" data-action="filtre" data-statut="${f}" aria-pressed="${filtre.statut === f}">${l} <small>${compte(f)}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          <label class="champ"><span class="sr-only">Catégorie</span><select id="filtre-cat"><option value="">Toutes les catégories</option>${E.categories.map((c) => `<option value="${c.id}" ${c.id === filtre.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher…" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      <div class="bascule-groupe" role="group" aria-label="Regrouper par"><span>Regrouper par</span><button class="filtre" data-action="groupe" data-groupe="categorie" aria-pressed="${filtre.groupe === 'categorie'}">Catégorie</button><button class="filtre" data-action="groupe" data-groupe="fournisseur" aria-pressed="${filtre.groupe === 'fournisseur'}">Fournisseur</button></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${g.titre} <span>${pluriel(g.lignes.length, 'contrat')}${somme(g.lignes) ? ` · ${euros(somme(g.lignes))} par an` : ''}</span></h2><ul class="lignes-fac">${g.lignes.map(ligneContrat).join('')}</ul></section>`).join('') : '<div class="vide-etat petit"><div><h3>Rien ne correspond</h3><p>Change de filtre ou efface la recherche.</p></div></div>'}
      ${AVERTISSEMENT}`;
  }

  // ---------- Calendrier ----------
  const LIB_GENRE = { envoi: 'Envoyer la résiliation avant', reconduction: 'Échéance (reconduction tacite)', fin: 'Fin du contrat', 'fin-resilie': 'Fin effective (résilié)' };
  function vueCalendrier() {
    const t = auj();
    const c = R.calendrier(E, t, 12);
    const depassees = R.situations(E, t).filter((s) => s.statut === 'depassee');
    const ligne = (l) => `<li class="cal-${l.genre}"><span class="cal-date">${fmt(l.date, { weekday: 'short', day: 'numeric' })}</span><button class="lien-ligne" data-action="ouvrir" data-id="${l.situation.c.id}"><b>${esc(l.situation.c.nom)}</b><span>${LIB_GENRE[l.genre]}${l.genre === 'envoi' ? ` · réception au plus tard le ${dateCourte(R.ajout(l.date, E.reglages.margeEnvoi))}` : ''} · ${esc(l.situation.c.fournisseur || l.situation.categorie.nom)}</span></button></li>`;
    return `<div class="vue-tete"><div><h1>Calendrier</h1><p>Les dates d'envoi des résiliations et les échéances des douze prochains mois, reconductions comprises.</p></div>
        <div class="actions"><button class="btn" data-action="csv-contrats">Exporter (CSV)</button></div></div>
      <p class="legende-cal"><i class="lc-envoi"></i>Envoi de la résiliation <i class="lc-reconduction"></i>Échéance avec reconduction <i class="lc-fin"></i>Fin du contrat</p>
      ${depassees.length ? `<section class="cal-bloc retard"><h2 class="titre-section">Préavis dépassés <span>Reconduits à l'échéance, sauf accord du fournisseur</span></h2><ul class="cal-liste">${depassees.map((s) => `<li><span class="cal-date">${dateCourte(s.fin)}</span><button class="lien-ligne" data-action="ouvrir" data-id="${s.c.id}"><b>${esc(s.c.nom)}</b><span>Date limite passée le ${dateCourte(s.limite)}${s.suivante ? ` · prochaine le ${dateCourte(s.suivante.limite)}` : ''}</span></button></li>`).join('')}</ul></section>` : ''}
      <div class="cal-mois">${c.mois.map((m) => `<section class="cal-bloc"><h2 class="cal-titre">${fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' })} <span>${m.lignes.length ? pluriel(m.lignes.length, 'date') : 'rien de prévu'}</span></h2>${m.lignes.length ? `<ul class="cal-liste">${m.lignes.map(ligne).join('')}</ul>` : ''}</section>`).join('')}</div>
      ${c.sansDate.length ? `<section class="cal-bloc" style="margin-top:14px"><h2 class="titre-section">Sans date <span>Échéance à saisir</span></h2><ul class="cal-liste">${c.sansDate.map((s) => `<li><span class="cal-date">?</span><button class="lien-ligne" data-action="modifier" data-id="${s.c.id}"><b>${esc(s.c.nom)}</b><span>${esc(s.c.fournisseur || s.categorie.nom)} · date de fin de la période en cours à saisir</span></button></li>`).join('')}</ul></section>` : ''}`;
  }

  // ---------- Coûts ----------
  function vueCouts() {
    const t = auj();
    const s = R.synthese(E, t);
    const pc = R.parCategorie(E, t);
    const pf = R.parFournisseur(E, t);
    const titre = `<div class="vue-tete"><div><h1>Coûts</h1><p>Ce que coûtent tes contrats en cours sur un an (${mention()}), par catégorie et par fournisseur.</p></div>
      <div class="actions"><button class="btn" data-action="csv-contrats">Exporter (CSV)</button></div></div>`;
    if (!pc.length) return `${titre}<div class="vide-etat petit"><div><h3>Aucun contrat en cours</h3><p>Ajoute tes contrats avec leur montant et leur périodicité.</p></div></div>`;
    return `${titre}
      <div class="tuiles tuiles-3">
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Coût annuel</p><b>${euros(s.coutAnnuel)}</b><span>${pluriel(s.nb, 'contrat')} en cours · ${euros(Math.round(s.coutAnnuel / 12))} par mois</span></div>
        <div class="tuile" style="--c:var(--rose-fort)"><p class="surtitre">À résilier</p><b>${euros(s.economiesPrevues)}</b><span>par an, ${pluriel(s.aResilier.length, 'contrat')} avec la décision « Résilier »</span></div>
        <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">Économisé</p><b>${euros(s.economiesObtenues)}</b><span>par an, renégociations et résiliations des 12 derniers mois</span></div>
      </div>
      <h2 class="titre-section">Par catégorie <span>Part du coût annuel</span></h2>
      <div class="graphique">${barresCategories(pc, s.coutAnnuel)}</div>
      <div class="defile" style="margin-top:12px"><table class="tableau"><caption class="sr-only">Coût annuel par catégorie</caption><thead><tr><th>Catégorie</th><th class="nb">Contrats</th><th class="nb">Coût annuel</th><th class="nb">Par mois</th><th class="nb">Part</th></tr></thead>
        <tbody>${pc.map((x) => `<tr><td>${pastilleCat(x.categorie)}${esc(x.categorie.nom)}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.cout)}</td><td class="nb">${euros(Math.round(x.cout / 12))}</td><td class="nb">${s.coutAnnuel ? Math.round((x.cout / s.coutAnnuel) * 100) : 0} %</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${s.nb}</td><td class="nb">${euros(s.coutAnnuel)}</td><td class="nb">${euros(Math.round(s.coutAnnuel / 12))}</td><td class="nb">100 %</td></tr></tfoot></table></div>
      <h2 class="titre-section">Par fournisseur <span>Du plus coûteux au moins coûteux</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Fournisseur</th><th>Catégories</th><th class="nb">Contrats</th><th class="nb">Coût annuel</th></tr></thead>
        <tbody>${pf.map((x) => `<tr><td><b>${esc(x.fournisseur)}</b></td><td>${x.categories.map(esc).join(', ')}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.cout)}</td></tr>`).join('')}</tbody></table></div>
      ${s.uniques ? `<p class="mention" style="margin-top:10px">Paiements uniques des contrats en cours, hors coût annuel : ${euros(s.uniques)}.</p>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Historique ----------
  function vueHistorique() {
    const t = auj();
    if (filtre.histo && !contrat(filtre.histo)) filtre.histo = '';
    const liste = R.historique(E, t, filtre.histo);
    return `<div class="vue-tete"><div><h1>Historique</h1><p>Décisions, renégociations, résiliations et reconductions tacites, contrat par contrat.</p></div>
        <div class="actions"><button class="btn" data-action="csv-historique">Exporter (CSV)</button></div></div>
      <div class="outils-liste"><label class="champ" style="max-width:420px;width:100%">Contrat<select id="filtre-histo"><option value="">Tous les contrats</option>${[...E.contrats].sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => `<option value="${c.id}" ${c.id === filtre.histo ? 'selected' : ''}>${esc(c.nom)}${c.fournisseur ? ` · ${esc(c.fournisseur)}` : ''}</option>`).join('')}</select></label></div>
      ${liste.length ? `<ul class="journal journal-ctr">${liste.map((h) => {
        const c = contrat(h.contrat);
        const delta = Number.isFinite(h.coutAvant) && Number.isFinite(h.coutApres) && h.coutAvant !== h.coutApres ? `<span class="mvt-q ${h.coutApres < h.coutAvant ? 'pos' : 'neg'}">${h.coutApres < h.coutAvant ? '−' : '+'}${euros(Math.abs(h.coutAvant - h.coutApres))} / an</span>` : '<span></span>';
        return `<li class="evt-${h.type}"><span class="cal-date">${dateCourte(h.date)}</span><button class="lien-ligne" data-action="ouvrir" data-id="${h.contrat}"><b>${esc(R.LIB_EVT[h.type])} · ${esc(c?.nom || 'Contrat supprimé')}</b><span>${esc(h.texte)}</span></button>${delta}</li>`;
      }).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien pour l\'instant</h3><p>Chaque décision, renégociation ou résiliation s\'inscrit ici, avec les reconductions tacites déduites des dates.</p></div></div>'}`;
  }

  // ---------- Guide ----------
  function vueGuide() {
    const r = E.reglages;
    const src = R.sourceCategorie('assurances');
    return `
      <div class="vue-tete"><div><h1>Guide et calculs</h1><p>Comment l'outil calcule les dates limites, et ce qu'il ne fait pas.</p></div></div>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Échéance en cours</b> : la date de fin que tu saisis (fin de la période en cours, dans les conditions particulières ou le dernier avenant). Avec une <b>reconduction tacite</b>, si cette date est passée, l'outil la fait avancer de la durée de reconduction (12 mois par défaut) jusqu'à la prochaine échéance à venir, et note chaque reconduction dans l'historique.</li>
        <li><b>Date limite de réception</b> = échéance − préavis (en mois, bornée à la fin du mois : 31 mai − 3 mois = 28 ou 29 février ; ou en jours). C'est la date à laquelle le fournisseur doit avoir reçu ta résiliation, sauf si ton contrat parle d'envoi : adapte alors ta marge.</li>
        <li><b>Envoi conseillé</b> = date limite − ${pluriel(r.margeEnvoi, 'jour')} de marge (réglable) pour l'acheminement du courrier.</li>
        <li><b>Alertes</b> sur la date d'envoi conseillée : <b>À anticiper</b> à J-${r.alerteLongue}, <b>À traiter</b> à J-${r.alerteCourte}, <b>Préavis dépassé</b> une fois la date passée (le contrat sera reconduit ; la prochaine date limite est affichée). Sans reconduction tacite, l'alerte porte sur la fin du contrat. La décision « Renouveler » éteint l'alerte jusqu'à l'échéance suivante.</li>
        <li><b>Préavis</b> : celui saisi dans le contrat, sinon celui de sa catégorie (valeur par défaut, affichée « préavis par défaut »). Les préavis des catégories sont des repères d'organisation, pas des règles : remplace-les par ceux de tes contrats.</li>
        <li><b>Coût annuel</b> = montant × nombre de paiements par an (mois 12, trimestre 4, semestre 2, an 1). Les paiements uniques sont montrés à part.</li>
        <li><b>Économies</b> : écart de coût annuel enregistré à chaque renégociation et résiliation des 12 derniers mois.</li>
      </ul>
      <h2 class="titre-section">Repère légal sourcé <span>Lu le ${esc(src.consulte)}</span></h2>
      <div class="legal">
        <p><b>Assurances.</b> ${esc(src.texte)} Source : <a href="${esc(src.url)}" target="_blank" rel="noopener">Légifrance, Code des assurances, article L113-12</a>, ${esc(src.version)}, consulté le ${esc(src.consulte)}. C'est pourquoi la catégorie « Assurances » propose 2 mois par défaut ; la police de chaque contrat prime.</p>
        <p>L'outil n'intègre <b>aucune autre règle légale</b> de résiliation : il calcule à partir de ce que dit ton contrat (durée, reconduction, préavis). Si tu penses qu'un texte particulier s'applique à l'un de tes contrats, vérifie-le sur une source officielle ou auprès d'un professionnel du droit, puis saisis le préavis qui en résulte.</p>
      </div>
      <h2 class="titre-section">La lettre de résiliation</h2>
      <ul class="limites">
        <li>C'est un <b>modèle à adapter</b> : vérifie la forme exigée par le contrat (lettre recommandée, e-mail, espace client), l'adresse du service résiliation et la date d'effet.</li>
        <li>Elle reprend ta structure, ta ville et ton signataire (Réglages), le fournisseur, le numéro et l'objet du contrat, l'échéance visée et le préavis. Tu peux la modifier avant de la copier ou de l'imprimer ; rien n'est envoyé par l'outil.</li>
        <li>Une fois envoyée, note-la (« Résiliation envoyée ») : date, mode, numéro de recommandé. Envoyée après la date limite, la fin effective passe à l'échéance suivante (modifiable si le fournisseur accepte une autre date).</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Pas de stockage de fichiers</b> : garde tes contrats dans ton espace documentaire et colle leur lien dans la fiche.</li>
        <li><b>Pas d'envoi d'e-mails ni de rappels hors de l'outil</b> : les alertes s'affichent à l'ouverture ; exporte le CSV pour les partager.</li>
        <li><b>Indexations et révisions de prix</b> non calculées : saisis le nouveau montant (Renégocier) pour garder la trace de l'écart.</li>
      </ul>
      ${AVERTISSEMENT}`;
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
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;

  function texteCategorie(id) {
    const cat = R.categorie(E, id);
    const src = R.sourceCategorie(cat.id);
    const pv = cat.preavisMois === null ? 'pas de préavis par défaut : saisis celui du contrat' : `préavis par défaut ${cat.preavisMois} mois`;
    return `<b>${esc(cat.nom)}</b> : ${pv}, ${cat.reconduction === 'tacite' ? `reconduction tacite de ${cat.dureeMois} mois` : 'sans reconduction'} (valeurs par défaut, modifiables dans les réglages).${src ? ` Assurances : ${esc(src.texte)} <a href="${esc(src.url)}" target="_blank" rel="noopener">Légifrance, art. L113-12</a>, consulté le ${esc(src.consulte)}.` : ''}`;
  }

  // Nouveau contrat (id absent) ou contrat existant.
  function modaleContrat(id) {
    const a = id ? contrat(id) : null;
    if (id && !a) return;
    const cat0 = R.categorie(E, filtre.categorie || 'maintenance');
    const v = a || { nom: '', fournisseur: '', categorie: cat0.id, reference: '', montant: '', periodicite: 'mensuel', debut: null, fin: null, reconduction: cat0.reconduction, dureeReconductionMois: null, preavis: null, contact: '', lien: '', note: '' };
    const pv = v.preavis;
    const pvNombre = pv ? (pv.mois ? pv.mois : pv.jours) : '';
    const pvUnite = pv && !pv.mois ? 'jours' : 'mois';
    const corps = `
      <label class="champ">Objet du contrat<input name="nom" required maxlength="100" value="${esc(v.nom)}" placeholder="Ex. : Maintenance de la climatisation"></label>
      <div class="rang-champs">
        <label class="champ">Fournisseur<input name="fournisseur" list="l-fournisseurs" maxlength="80" value="${esc(v.fournisseur)}"></label>
        <label class="champ">Catégorie<select name="categorie" id="c-cat">${E.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      <p class="source-type" id="c-source"></p>
      <div class="rang-champs">
        <label class="champ">Montant (${mention()})<input name="montant" inputmode="decimal" maxlength="14" value="${v.montant === '' ? '' : String(v.montant).replace('.', ',')}" placeholder="0"></label>
        <label class="champ">Périodicité<select name="periodicite">${B.periodicites.map((p) => `<option value="${p.id}" ${p.id === v.periodicite ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">N° de contrat <small>Facultatif.</small><input name="reference" maxlength="60" value="${esc(v.reference)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Début <small>Facultatif.</small><input type="date" name="debut" value="${v.debut || ''}"></label>
        <label class="champ">Fin de la période en cours <small>Échéance du contrat ou de sa dernière reconduction.</small><input type="date" name="fin" value="${v.fin || ''}"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Reconduction et préavis <small>Lis-les dans les conditions générales ou particulières.</small></legend>
        <div class="choix-statut deux"><label><input type="radio" name="reconduction" value="tacite" ${v.reconduction === 'tacite' ? 'checked' : ''}><span>Tacite reconduction</span></label><label><input type="radio" name="reconduction" value="aucune" ${v.reconduction === 'aucune' ? 'checked' : ''}><span>S'arrête à la fin</span></label></div>
        <div class="rang-champs" style="margin-top:10px">
          <label class="champ" id="c-duree">Reconduit pour (mois)<input name="duree" inputmode="numeric" value="${v.dureeReconductionMois || ''}" placeholder="${R.categorie(E, v.categorie).dureeMois}"></label>
          <label class="champ">Préavis<input name="pvNombre" inputmode="numeric" value="${pvNombre}" placeholder="défaut"></label>
          <label class="champ">Unité<select name="pvUnite">${['mois', 'jours'].map((u) => `<option ${u === pvUnite ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <p class="mention">Préavis vide : celui de la catégorie s'applique. 0 : aucun préavis.</p>
      </fieldset>
      <div class="rang-champs">
        <label class="champ">Interlocuteur <small>Fonction ou service, facultatif.</small><input name="contact" maxlength="100" value="${esc(v.contact)}"></label>
        <label class="champ">Lien vers le contrat <small>Facultatif : Drive, serveur, GED…</small><input name="lien" type="url" inputmode="url" maxlength="500" value="${esc(v.lien)}" placeholder="https://"></label>
      </div>
      <label class="champ">Note <small>Facultative : clause particulière, pénalité de sortie, matériel à rendre…</small><textarea name="note" rows="2" maxlength="500">${esc(v.note)}</textarea></label>
      <p class="aide" id="c-apres"></p>
      ${listeDonnees('l-fournisseurs', E.contrats.map((c) => c.fournisseur))}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter le contrat</button><button class="btn" value="annuler">Annuler</button>';
    const lire = (fd) => {
      const montant = R.lireMontant(fd.get('montant'));
      const preavis = R.lirePreavis(fd.get('pvNombre'), fd.get('pvUnite'));
      const dureeTxt = String(fd.get('duree') || '').trim();
      const duree = dureeTxt ? Number(dureeTxt) : null;
      return { montant, preavis, duree, dureeTxt };
    };
    ouvrirModale(a ? `Modifier ${esc(a.nom)}` : 'Nouveau contrat', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${a.nom} » et son historique ? Pour un contrat arrêté, note plutôt la résiliation : il reste dans l'historique.`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerContrat(E, a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un objet au contrat (ex. : Maintenance de la climatisation).';
      const { montant, preavis, duree, dureeTxt } = lire(fd);
      if (Number.isNaN(montant)) return 'Montant illisible : un nombre, par exemple 120 ou 120,50.';
      if (Number.isNaN(preavis)) return 'Préavis illisible : un nombre entier (36 mois ou 730 jours au plus).';
      if (dureeTxt && !(Number.isInteger(duree) && duree >= 1 && duree <= 120)) return 'Durée de reconduction : un nombre de mois entre 1 et 120.';
      const debut = fd.get('debut'), fin = fd.get('fin');
      if (debut && fin && fin < debut) return 'La fin ne peut pas précéder le début.';
      const lien = R.lireLien(fd.get('lien'));
      if (lien === null) return 'Lien illisible : colle une adresse qui commence par https://';
      retenir();
      const donnees = R.normaliserContrat({ ...(a || {}), id: a?.id || uid(), nom, fournisseur: fd.get('fournisseur'), categorie: fd.get('categorie'), reference: fd.get('reference'), montant: montant ?? 0, periodicite: fd.get('periodicite'), debut, fin, reconduction: fd.get('reconduction'), dureeReconductionMois: duree, preavis, contact: fd.get('contact'), lien, note: fd.get('note') });
      if (a) {
        const avant = R.coutAnnuel(a);
        Object.assign(a, donnees);
        const apres = R.coutAnnuel(a);
        if (avant !== apres) R.journal(E, { contrat: a.id, date: auj(), type: 'note', texte: `Montant modifié : ${euros(avant)} → ${euros(apres)} par an.` }, uid);
      } else {
        E.contrats.push(donnees);
        R.journal(E, { contrat: donnees.id, date: auj(), type: 'creation', texte: 'Contrat saisi dans l\'outil.' }, uid);
      }
      sauver(); rendre();
      const s = R.situation(donnees, E, auj());
      toast(`« ${nom} » ${a ? 'enregistré' : 'ajouté'}${s.limite && s.tacite ? ` : résilier avant le ${dateCourte(s.limite)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const fd = new FormData(d.querySelector('form'));
      d.querySelector('#c-source').innerHTML = texteCategorie(fd.get('categorie'));
      d.querySelector('#c-duree').hidden = fd.get('reconduction') !== 'tacite';
      d.querySelector('[name=duree]').placeholder = R.categorie(E, fd.get('categorie')).dureeMois;
      const { montant, preavis, duree } = lire(fd);
      const essai = R.normaliserContrat({ id: 'essai', categorie: fd.get('categorie'), montant: Number.isNaN(montant) ? 0 : montant ?? 0, periodicite: fd.get('periodicite'), fin: fd.get('fin'), reconduction: fd.get('reconduction'), dureeReconductionMois: duree, preavis: Number.isNaN(preavis) ? null : preavis });
      const s = R.situation(essai, E, auj());
      const cout = s.periodicite.parAn ? `Coût annuel : <b>${euros(s.coutAnnuel)}</b>. ` : '';
      d.querySelector('#c-apres').innerHTML = !s.fin ? `${cout}Saisis la fin de la période en cours pour calculer la date limite.`
        : !s.tacite ? `${cout}Fin du contrat le <b>${dateLongue(s.fin)}</b>, sans reconduction.`
        : s.limite ? `${cout}Échéance en cours : <b>${dateLongue(s.fin)}</b>${s.reconductions.length ? ` (après ${pluriel(s.reconductions.length, 'reconduction')})` : ''}. Résiliation à recevoir au plus tard le <b>${dateLongue(s.limite)}</b> (préavis ${R.libellePreavis(s.preavis)}${s.preavis.origine === 'categorie' ? ' par défaut' : ''}), envoi conseillé avant le ${dateLongue(s.envoi)}.`
        : `${cout}Échéance en cours : <b>${dateLongue(s.fin)}</b>. Saisis le préavis pour calculer la date limite.`;
    };
    d.querySelectorAll('input,select').forEach((x) => x.addEventListener('input', maj));
    d.querySelectorAll('select,[type=radio]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  // Fiche d'un contrat : situation, dates, décision, lettre, historique.
  function modaleDetail(id) {
    const t = auj();
    const c = contrat(id);
    if (!c) return;
    const s = R.situation(c, E, t);
    const h = R.historique(E, t, c.id);
    const actions = s.actif ? `<div class="rang">
        <button type="button" class="btn petit primaire" data-action="decider" data-id="${c.id}">Décider</button>
        <button type="button" class="btn petit" data-action="lettre" data-id="${c.id}">Lettre de résiliation</button>
        <button type="button" class="btn petit" data-action="renegocier" data-id="${c.id}">Renégocié</button>
        ${s.tacite || c.decision === 'resilier' ? `<button type="button" class="btn petit" data-action="resiliation" data-id="${c.id}">Résiliation envoyée</button>` : ''}
      </div>` : (c.statut === 'resilie' ? `<div class="rang"><button type="button" class="btn petit" data-action="annuler-resiliation" data-id="${c.id}">Annuler la résiliation</button></div>` : '');
    const corps = `
      <div class="resume-facture">
        <div><span>${s.tacite ? 'Date limite de réception' : 'Fin du contrat'}</span><b>${s.tacite ? (s.limite ? dateCourte(s.limite) : '–') : (s.fin ? dateCourte(s.fin) : '–')}</b><small>${etiquetteStatut(s.statut)} ${s.tacite && s.envoi && s.actif ? `envoi conseillé avant le ${dateCourte(s.envoi)}` : ''}</small></div>
        <div><span>Échéance en cours</span><b>${s.fin ? dateCourte(s.fin) : '–'}</b><small>${s.tacite ? `Tacite reconduction, ${R.dureeReconduction(c, E)} mois` : 'Sans reconduction'}${s.reconductions.length ? ` · ${pluriel(s.reconductions.length, 'reconduction')}` : ''}</small></div>
        <div><span>Préavis</span><b>${R.libellePreavis(s.preavis)}</b><small>${s.preavis ? (s.preavis.origine === 'contrat' ? 'Saisi pour ce contrat' : `Défaut de la catégorie ${esc(s.categorie.nom)}`) : 'À saisir'}</small></div>
        <div><span>Coût</span><b>${s.periodicite.parAn ? `${euros(s.coutAnnuel)} / an` : euros(c.montant)}</b><small>${esc(libMontant(s))} ${mention()}</small></div>
      </div>
      <p class="mention">${[esc(c.fournisseur), c.reference && `n° ${esc(c.reference)}`, `${pastilleCat(s.categorie)}${esc(s.categorie.nom)}`, c.debut && `depuis le ${dateCourte(c.debut)}`, c.contact && esc(c.contact), c.lien && lienExterne(c.lien, 'voir le contrat')].filter(Boolean).join(' · ')}</p>
      <p class="aide">${esc(quoiFaire(s))}.${s.decision !== 'a-decider' && s.actif ? ` Décision pour cette échéance : <b>${R.libDecision(s.decision)}</b>.` : ''}${c.statut === 'resilie' && c.resiliation ? ` Envoyée le ${dateCourte(c.resiliation.envoyeeLe)}${c.resiliation.mode ? ` (${esc(c.resiliation.mode)})` : ''}${c.resiliation.reference ? `, réf. ${esc(c.resiliation.reference)}` : ''}.` : ''}</p>
      ${c.note ? `<p class="aide">${esc(c.note)}</p>` : ''}
      ${actions}
      <section class="bloc-detail"><h3>Historique <span>${pluriel(h.length, 'événement')}</span></h3>
        ${h.length ? `<ul class="mini-liste">${h.map((x) => `<li><span><b>${dateCourte(x.date)} · ${esc(R.LIB_EVT[x.type])}</b><br><small>${esc(x.texte)}</small></span>${x.derive ? '<span></span>' : `<button type="button" class="btn-suppr" data-action="suppr-evt" data-id="${x.id}" data-retour="${c.id}" aria-label="Supprimer cet événement">×</button>`}</li>`).join('')}</ul>` : '<p class="mention">Aucun événement.</p>'}
        <div class="rang"><button type="button" class="btn petit" data-action="note" data-id="${c.id}">${ICONES.plus}Ajouter une note</button></div>
      </section>`;
    ouvrirModale(esc(c.nom), corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier" data-id="${c.id}">Modifier le contrat</button>`);
  }

  // Décision pour l'échéance en cours.
  function modaleDecider(id) {
    const c = contrat(id);
    if (!c) return;
    const s = R.situation(c, E, auj());
    if (s.statut === 'inconnue') { modaleContrat(id); return; }
    const corps = `
      <p class="aide"><b>${esc(c.nom)}</b>${c.fournisseur ? ` · ${esc(c.fournisseur)}` : ''}<br>${esc(quoiFaire(s))}.</p>
      <fieldset class="champ"><legend>Ta décision pour l'échéance du ${dateCourte(s.fin)}</legend>
        <div class="choix-decision">${B.decisions.map((d) => `<label><input type="radio" name="decision" value="${d.id}" ${d.id === s.decision ? 'checked' : ''}><span><b>${esc(d.nom)}</b><small>${esc(d.detail)}</small></span></label>`).join('')}</div></fieldset>
      <label class="champ">Note <small>Facultative : raison, devis à demander, interlocuteur…</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Décider', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const decision = fd.get('decision');
      retenir();
      const r = R.decider(E, id, decision, auj(), fd.get('note'), uid);
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      if (decision === 'resilier') { setTimeout(() => modaleLettre(id), 0); garderOuverte(); return; }
      toast(`Décision enregistrée : ${R.libDecision(decision)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Lettre de résiliation : modèle à adapter, à copier ou imprimer.
  function modaleLettre(id) {
    const c = contrat(id);
    if (!c) return;
    const s = R.situation(c, E, auj());
    const avert = s.statut === 'depassee' ? `<p class="aide alerte-taux">La date limite du ${dateCourte(s.limite)} est passée : la lettre vise l'échéance suivante (${dateCourte(s.suivante?.fin)}), sauf accord du fournisseur.</p>`
      : s.tacite && s.limite ? `<p class="aide">À faire recevoir au plus tard le <b>${dateLongue(s.limite)}</b> (envoi conseillé avant le ${dateLongue(s.envoi)}).</p>` : '';
    const corps = `
      ${avert}
      <label class="champ">Lettre <small>Modèle à adapter : vérifie la forme exigée par le contrat, l'adresse et la date d'effet.</small><textarea name="lettre" id="lettre-texte" rows="16" spellcheck="true">${esc(R.lettre(E, c, auj()))}</textarea></label>
      <div class="rang"><button type="button" class="btn petit" data-action="copier-lettre">Copier le texte</button><button type="button" class="btn petit" data-action="imprimer-lettre">Imprimer ou PDF</button></div>
      <p class="mention">Ta structure, ton adresse, ta ville et ton signataire se règlent dans les Réglages. Rien n'est envoyé par l'outil.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Lettre de résiliation', corps, `<button class="btn primaire" type="button" data-action="resiliation" data-id="${c.id}">Je l'ai envoyée</button><button class="btn" value="annuler">Fermer</button>`);
  }

  function imprimerLettre() {
    const texte = $('#lettre-texte')?.value || '';
    let zone = $('#impression');
    if (!zone) { zone = document.createElement('div'); zone.id = 'impression'; document.body.append(zone); }
    zone.textContent = texte;
    document.body.classList.add('imprime-lettre');
    const fin = () => { document.body.classList.remove('imprime-lettre'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  async function copierLettre() {
    const el = $('#lettre-texte');
    if (!el) return;
    try { await navigator.clipboard.writeText(el.value); toast('Lettre copiée : colle-la dans ton traitement de texte.'); } catch { el.select(); toast('Sélectionne le texte et copie-le (Ctrl + C).'); }
  }

  // Résiliation envoyée.
  function modaleResiliation(id) {
    const c = contrat(id);
    if (!c) return;
    const s = R.situation(c, E, auj());
    const corps = `
      <p class="aide"><b>${esc(c.nom)}</b>${c.fournisseur ? ` · ${esc(c.fournisseur)}` : ''}<br>${s.tacite && s.limite ? `Date limite de réception : ${dateLongue(s.limite)}.` : `Fin du contrat : ${dateLongue(s.fin)}.`}</p>
      <div class="rang-champs">
        <label class="champ">Envoyée le<input type="date" name="envoyeeLe" id="r-date" required max="${auj()}" value="${auj()}"></label>
        <label class="champ">Fin effective <small>Proposée d'après les dates ; corrige-la si le fournisseur confirme une autre date.</small><input type="date" name="effetLe" id="r-effet"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Mode d'envoi<select name="mode">${B.modesEnvoi.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
        <label class="champ">Référence <small>N° de recommandé, de dossier…</small><input name="reference" maxlength="80"></label>
      </div>
      <p class="aide" id="r-info"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Résiliation envoyée', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      const r = R.resilier(E, id, { envoyeeLe: fd.get('envoyeeLe'), effetLe: fd.get('effetLe'), mode: fd.get('mode'), reference: fd.get('reference') }, auj(), uid);
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      toast(`Résiliation notée : fin le ${dateCourte(r.effetLe)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const env = d.querySelector('#r-date').value;
      if (!R.estDate(env)) return;
      const x = R.situation(c, E, env);
      const tard = x.tacite && x.limite && env > x.limite;
      const effet = tard ? R.ajoutMois(x.fin, R.dureeReconduction(c, E)) : x.fin;
      const ch = d.querySelector('#r-effet');
      if (!ch.dataset.touche) ch.value = effet || '';
      d.querySelector('#r-info').innerHTML = tard ? `Envoi après la date limite du ${dateCourte(x.limite)} : sauf accord du fournisseur, le contrat est reconduit et prend fin le <b>${dateLongue(effet)}</b>.` : effet ? `Envoi dans les délais : le contrat prend fin le <b>${dateLongue(effet)}</b>.` : 'Saisis la fin effective.';
    };
    d.querySelector('#r-effet').addEventListener('input', (ev) => { ev.target.dataset.touche = '1'; });
    d.querySelector('#r-date').addEventListener('change', maj);
    maj();
  }

  // Renégociation : nouveau montant, nouvelle fin facultative.
  function modaleRenegocier(id) {
    const c = contrat(id);
    if (!c) return;
    const corps = `
      <p class="aide"><b>${esc(c.nom)}</b>${c.fournisseur ? ` · ${esc(c.fournisseur)}` : ''}<br>Aujourd'hui : ${esc(libMontant(R.situation(c, E, auj())))} (${euros(R.coutAnnuel(c))} par an).</p>
      <div class="rang-champs">
        <label class="champ">Date de l'accord<input type="date" name="date" required max="${auj()}" value="${auj()}"></label>
        <label class="champ">Nouveau montant (${mention()})<input name="montant" inputmode="decimal" value="${String(c.montant).replace('.', ',')}"></label>
        <label class="champ">Périodicité<select name="periodicite">${B.periodicites.map((p) => `<option value="${p.id}" ${p.id === c.periodicite ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Nouvelle fin de période <small>Facultative : si l'accord repart pour une nouvelle durée.</small><input type="date" name="fin"></label>
      <label class="champ">Ce qui a été obtenu <small>Facultatif.</small><input name="note" maxlength="300"></label>
      <p class="aide" id="n-info"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Renégocié', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      const r = R.renegocier(E, id, { date: fd.get('date'), montant: fd.get('montant'), periodicite: fd.get('periodicite'), fin: fd.get('fin'), note: fd.get('note') }, auj(), uid);
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      toast('Renégociation enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const m = R.lireMontant(d.querySelector('[name=montant]').value);
      if (m === null || Number.isNaN(m)) { d.querySelector('#n-info').textContent = ''; return; }
      const apres = R.coutAnnuel({ montant: m, periodicite: d.querySelector('[name=periodicite]').value });
      const ec = R.coutAnnuel(c) - apres;
      d.querySelector('#n-info').innerHTML = ec > 0 ? `Économie : <b>${euros(ec)}</b> par an.` : ec < 0 ? `Hausse : <b>${euros(-ec)}</b> par an.` : 'Coût annuel inchangé.';
    };
    d.querySelectorAll('[name=montant],[name=periodicite]').forEach((x) => x.addEventListener('input', maj));
    maj();
  }

  function modaleNote(id) {
    const c = contrat(id);
    if (!c) return;
    ouvrirModale('Ajouter une note', `<p class="mention">${esc(c.nom)}</p><div class="rang-champs"><label class="champ" style="flex:0 1 180px">Date<input type="date" name="date" value="${auj()}" max="${auj()}"></label><label class="champ">Note<input name="texte" maxlength="400" required placeholder="Ex. : appel du commercial, devis concurrent reçu"></label></div><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
        const texte = String(fd.get('texte') || '').trim();
        if (!texte) return 'Écris la note.';
        if (!R.estDate(fd.get('date')) || fd.get('date') > auj()) return 'Date illisible ou dans le futur.';
        retenir();
        R.journal(E, { contrat: id, date: fd.get('date'), type: 'note', texte }, uid);
        sauver(); rendre();
        setTimeout(() => modaleDetail(id), 0); garderOuverte();
      });
  }

  function supprimerEvenement(id, retour) {
    if (!confirm('Supprimer cet événement de l\'historique ?')) return;
    retenir();
    E.historique = E.historique.filter((h) => h.id !== id);
    sauver(); rendre();
    if (retour) modaleDetail(retour);
    toast('Événement supprimé.', { libelle: 'Annuler', faire: annuler });
  }

  // Catégories : nom, préavis par défaut, reconduction, durée.
  function modaleCategories() {
    const utilise = (id) => E.contrats.filter((c) => c.categorie === id).length;
    const corps = `
      <p class="mention">Valeurs par défaut appliquées aux contrats dont le préavis ou la durée de reconduction n'est pas saisi. Ce sont des repères d'organisation : le contrat prime.</p>
      <ul class="liste-cats">${E.categories.map((c, i) => `<li data-id="${c.id}">
        <div class="rang-champs">
          <label class="champ">Nom<input name="nom-${i}" maxlength="60" value="${esc(c.nom)}"></label>
          <label class="champ" style="flex:0 1 110px">Préavis (mois)<input name="pv-${i}" inputmode="numeric" value="${c.preavisMois ?? ''}" placeholder="–"></label>
          <label class="champ" style="flex:0 1 150px">Reconduction<select name="rc-${i}"><option value="tacite" ${c.reconduction === 'tacite' ? 'selected' : ''}>Tacite</option><option value="aucune" ${c.reconduction === 'aucune' ? 'selected' : ''}>Aucune</option></select></label>
          <label class="champ" style="flex:0 1 110px">Durée (mois)<input name="du-${i}" inputmode="numeric" value="${c.dureeMois}"></label>
        </div>
        <span class="mention">${pastilleCat(c)}${pluriel(utilise(c.id), 'contrat')}${c.id === 'autre' ? ' · catégorie de repli' : ''}</span>
        ${c.id !== 'autre' && !utilise(c.id) ? `<button type="button" class="btn-suppr" data-action="suppr-cat" data-id="${c.id}" aria-label="Retirer ${esc(c.nom)}">×</button>` : ''}
      </li>`).join('')}</ul>
      <div class="rang"><button type="button" class="btn petit" data-action="ajout-cat">${ICONES.plus}Ajouter une catégorie</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Catégories et préavis par défaut', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const cats = [];
      for (let i = 0; i < E.categories.length; i++) {
        const c = E.categories[i];
        const nom = String(fd.get(`nom-${i}`) || '').trim();
        if (!nom) return 'Chaque catégorie a besoin d\'un nom.';
        const pvTxt = String(fd.get(`pv-${i}`) || '').trim();
        const pv = pvTxt === '' ? null : Number(pvTxt);
        if (pv !== null && !(Number.isInteger(pv) && pv >= 0 && pv <= 36)) return `Préavis de « ${nom} » : un nombre de mois entre 0 et 36, ou vide.`;
        const du = Number(fd.get(`du-${i}`));
        if (!(Number.isInteger(du) && du >= 1 && du <= 120)) return `Durée de « ${nom} » : entre 1 et 120 mois.`;
        cats.push({ ...c, nom, preavisMois: pv, reconduction: fd.get(`rc-${i}`), dureeMois: du });
      }
      retenir();
      E.categories = cats.map(R.normaliserCategorie);
      sauver(); rendre();
      toast('Catégories enregistrées.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function ajouterCategorie() {
    const nom = prompt('Nom de la nouvelle catégorie (ex. : Véhicules, Restauration) :');
    if (!nom || !nom.trim()) return;
    retenir();
    const id = `cat-${uid()}`;
    const i = E.categories.findIndex((c) => c.id === 'autre');
    const nouvelle = R.normaliserCategorie({ id, nom: nom.trim(), preavisMois: null, reconduction: 'tacite', dureeMois: 12, couleur: E.categories.length % B.couleurs.length });
    if (i >= 0) E.categories.splice(i, 0, nouvelle); else E.categories.push(nouvelle);
    sauver(); rendre(); modaleCategories();
  }
  function supprimerCategorie(id) {
    if (E.contrats.some((c) => c.categorie === id) || id === 'autre') return;
    retenir();
    E.categories = E.categories.filter((c) => c.id !== id);
    sauver(); rendre(); modaleCategories();
    toast('Catégorie retirée.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const L = E.lettre;
    const corps = `
      <label class="champ">Ton entreprise ou ta structure<input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <fieldset class="champ cadre-champs"><legend>Alertes <small>Comptées avant la date d'envoi conseillée.</small></legend>
        <div class="rang-champs">
          <label class="champ">À anticiper (jours)<input type="number" name="alerteLongue" min="1" max="365" value="${r.alerteLongue}"></label>
          <label class="champ">À traiter (jours)<input type="number" name="alerteCourte" min="0" max="365" value="${r.alerteCourte}"></label>
          <label class="champ">Marge d'envoi (jours) <small>Acheminement du courrier.</small><input type="number" name="margeEnvoi" min="0" max="60" value="${r.margeEnvoi}"></label>
        </div></fieldset>
      <fieldset class="champ"><legend>Montants saisis</legend><div class="choix-statut deux">${['HT', 'TTC'].map((x) => `<label><input type="radio" name="mention" value="${x}" ${r.mention === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></fieldset>
      <fieldset class="champ cadre-champs"><legend>Lettre de résiliation <small>Repris en tête et en signature.</small></legend>
        <label class="champ">Adresse<input name="adresse" maxlength="200" value="${esc(L.adresse)}"></label>
        <div class="rang-champs">
          <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(L.ville)}"></label>
          <label class="champ">Signataire<input name="signataire" maxlength="80" value="${esc(L.signataire)}"></label>
          <label class="champ">Fonction<input name="fonction" maxlength="80" value="${esc(L.fonction)}"></label>
        </div></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Catégories</h3><p class="aide">${pluriel(E.categories.length, 'catégorie')} : noms, préavis par défaut, reconduction.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="categories">Modifier les catégories</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tableur (CSV, point-virgule) : tous les contrats avec leurs dates limites, ou l'historique.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-contrats">Contrats (CSV)</button><button class="btn petit" type="button" data-action="csv-historique">Historique (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes contrats sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi des contrats, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, par exemple quand un commercial t'appelle pour renouveler.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucune règle légale de résiliation intégrée, sauf le repère sourcé sur les assurances (Code des assurances, art. L113-12, lu sur Légifrance le ${esc(R.sourceCategorie('assurances').consulte)}). Préavis par défaut : repères d'organisation, modifiables. Outil d'aide : il ne remplace ni la lecture de tes contrats ni un conseil juridique.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Number(fd.get(nom)); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
      const alerteLongue = ent('alerteLongue', 1, 365), alerteCourte = ent('alerteCourte', 0, 365), margeEnvoi = ent('margeEnvoi', 0, 60);
      if (alerteLongue === null || alerteCourte === null) return 'Alertes : un nombre de jours entre 0 et 365.';
      if (alerteCourte > alerteLongue) return '« À traiter » doit être plus court que « À anticiper ».';
      if (margeEnvoi === null) return 'Marge d\'envoi : entre 0 et 60 jours.';
      retenir();
      E.structure = String(fd.get('structure') || '').trim().slice(0, 80);
      Object.assign(E.reglages, { alerteLongue, alerteCourte, margeEnvoi, mention: fd.get('mention') === 'TTC' ? 'TTC' : 'HT' });
      E.lettre = { adresse: String(fd.get('adresse') || '').trim(), ville: String(fd.get('ville') || '').trim(), signataire: String(fd.get('signataire') || '').trim(), fonction: String(fd.get('fonction') || '').trim() };
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.contrats)) throw new Error();
        if (!confirm(`Remplacer tes contrats actuels par cette copie (${pluriel(d.contrats.length, 'contrat')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); E.initialise = true; delete E.majLe;
        E.tutorielVu = vu;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de tes contrats.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `contrats-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const blocs = [
      ['rose', 'Saisis chaque contrat', `Le fournisseur, le montant et sa périodicité, la date de fin de la période en cours et le préavis. Sans préavis saisi, c'est celui de la catégorie qui compte&nbsp;: un repère par défaut, pas une règle. Avec une reconduction tacite, une échéance passée avance seule jusqu'à la prochaine, et chaque reconduction est notée dans l'historique.`],
      ['beurre', 'L\'outil calcule la date limite', `Date limite de réception de ta résiliation = échéance moins préavis. L'envoi conseillé tombe ${pluriel(r.margeEnvoi, 'jour')} plus tôt, pour l'acheminement du courrier. Ces dates ne valent que ce que valent tes saisies&nbsp;: vérifie-les dans le contrat, qui prime.`],
      ['ciel', 'Suis les alertes', `Sur la date d'envoi conseillée&nbsp;: <b>À anticiper</b> à J-${r.alerteLongue}, <b>À traiter</b> à J-${r.alerteCourte}, puis <b>Préavis dépassé</b>&nbsp;: le contrat sera reconduit et la prochaine date limite s'affiche. Le <b>Bord</b> les réunit, avec le coût annuel de tes contrats.`],
      ['sable', 'Décide à temps', `Pour chaque alerte, choisis&nbsp;: <b>Renouveler</b> éteint l'alerte jusqu'à l'échéance suivante, <b>Renégocier</b> te laisse ensuite noter le nouveau montant et l'économie, <b>Résilier</b> prépare une lettre à adapter. Rien n'est envoyé par l'outil&nbsp;: note ensuite la date et le mode d'envoi.`],
    ];
    const corps = `
      <p>L'outil fait avancer les reconductions, calcule la date limite pour résilier et te prévient à temps. Ton rôle&nbsp;: saisir tes contrats tels qu'ils sont écrits, puis décider quand une alerte arrive.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Calendrier</b> liste les dates limites, <b>Coûts</b> le coût annuel par catégorie, <b>Historique</b> les décisions et économies. Le bouton <b>Guide et calculs</b> détaille chaque calcul. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes contrats sont enregistrés en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.contrats.length;
    const pied = premier
      ? '<button class="btn primaire" value="contrat">Ajouter mon premier contrat</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'contrat') setTimeout(() => modaleContrat(null), 0); });
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
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'filtre-vue': filtre.statut = el.dataset.statut; changerVue('contrats'); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'categories': modaleCategories(); break;
      case 'ajout-cat': ajouterCategorie(); break;
      case 'suppr-cat': supprimerCategorie(id); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-contrats': telecharger(R.versCsvContrats(E, auj()), 'text/csv;charset=utf-8', `contrats-${auj()}.csv`); break;
      case 'csv-historique': telecharger(R.versCsvHistorique(E, auj()), 'text/csv;charset=utf-8', `historique-contrats-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-contrat': modaleContrat(null); break;
      case 'ouvrir': modaleDetail(id); break;
      case 'modifier': modaleContrat(id); break;
      case 'decider': modaleDecider(id); break;
      case 'lettre': modaleLettre(id); break;
      case 'copier-lettre': copierLettre(); break;
      case 'imprimer-lettre': imprimerLettre(); break;
      case 'resiliation': modaleResiliation(id); break;
      case 'renegocier': modaleRenegocier(id); break;
      case 'note': modaleNote(id); break;
      case 'suppr-evt': supprimerEvenement(id, el.dataset.retour); break;
      case 'annuler-resiliation': {
        const c = contrat(id);
        if (!c || !confirm(`Annuler la résiliation de « ${c.nom} » ? Le contrat redevient actif.`)) break;
        retenir(); R.annulerResiliation(E, id, auj(), uid); sauver(); rendre(); modaleDetail(id);
        toast('Résiliation annulée.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'groupe': filtre.groupe = el.dataset.groupe; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__contrats = { etat: () => E, regles: R };
  init();
})();
