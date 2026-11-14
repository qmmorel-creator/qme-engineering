// Onboarding et offboarding salarié QME : checklists d'arrivée et de départ par profil, responsables par fonction,
// échéances de J-15 à J+90 (arrivée) et de J-30 à J+30 (départ), matériel remis et restitué.
// Données synchronisées par clé de licence ou code d'accès. Aucune intégration à un logiciel RH, aucun lien externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ARD;
  const API = '/api/templates';
  const PRODUIT = 'ARD';
  const CLE_CODE = 'qme-ard-code';
  const CLE_CACHE = 'qme-ard-cache';
  const CLE_DEMO = 'qme-ard-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ard-ecran-accueil';

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
  const { ajout, versDate, ecart, libJ } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const resp = (id) => B.responsables.find((r) => r.id === id) || B.responsables[0];
  const nomResp = (id) => resp(id).nom;
  const nomEtat = (id) => (B.etatsMateriel.find((e) => e.id === id) || { nom: '' }).nom;
  const LIB_SENS = { arrivee: 'Arrivée', depart: 'Départ' };
  const LIB_DATE = { arrivee: 'Arrivée le', depart: 'Dernier jour le' };
  const pillResp = (id) => `<span class="resp resp-${esc(id)}">${esc(nomResp(id))}</span>`;
  const quand = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let fiche = null; // personne ouverte dans l'onglet Personnes
  const filtre = { personnes: 'encours', q: '', resp: 'tous', modele: 'commun', sensModele: 'arrivee' };
  let annulation = null;

  const etatVide = () => R.etatVide(B.profils);
  const normaliser = (d) => R.normaliser(d, auj(), B.profils);
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const modele = (id) => E.modeles.find((m) => m.id === id);

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (ARD-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; fiche = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // PME fictive, 8 parcours à des dates relatives à aujourd'hui : arrivées avant J, à J+12, à J+40, à venir,
  // terminée ; départs dans 3 jours, passé avec matériel non rendu, terminé à effacer. Les tâches passées sont
  // cochées avec les vraies règles, sauf les retards voulus.
  function donneesDemo() {
    const e = etatVide();
    e.entreprise = 'Atelier Lumen (fictif)';
    const t = auj();
    // retards : nombre de tâches passées laissées à faire (les plus récentes) ; so : titres « sans objet ».
    const ajouter = (p, { retards = 0, so = [], encours = [], materiel = [] } = {}) => {
      const x = R.normaliserPersonne({ id: uid(), ...p, taches: R.genererTaches(e.modeles, p.profils, p.sens) }, t);
      const passees = x.taches.filter((k) => R.echeance(x, k) < t);
      const laissees = new Set(passees.slice(Math.max(0, passees.length - retards)).map((k) => k.id));
      for (const k of x.taches) {
        if (so.some((s) => k.titre.includes(s))) { k.statut = 'so'; k.faitLe = R.echeance(x, k) < t ? R.echeance(x, k) : t; continue; }
        if (R.echeance(x, k) < t && !laissees.has(k.id)) { k.statut = 'fait'; k.faitLe = R.echeance(x, k); }
        if (encours.some((s) => k.titre.includes(s))) { k.statut = 'fait'; k.faitLe = t; }
      }
      x.materiel = materiel.map((m) => R.normaliserMateriel({ id: uid(), ...m }));
      e.personnes.push(x);
      return x;
    };
    ajouter({ sens: 'arrivee', prenom: 'Camille R.', poste: 'Chargée de clientèle', contrat: 'CDI', service: 'Service client', manager: 'Responsable du service client', date: ajout(t, 4), profils: ['bureau'] },
      { retards: 2, materiel: [{ nom: 'Ordinateur portable', etat: 'neuf' }, { nom: 'Badge d\'accès', etat: 'neuf' }, { nom: 'Casque audio', etat: 'neuf' }] });
    ajouter({ sens: 'arrivee', prenom: 'Yanis B.', poste: 'Technicien de maintenance', contrat: 'CDI', service: 'Exploitation', manager: 'Chef d\'équipe maintenance', date: ajout(t, -12), profils: ['terrain'], note: 'Binôme prévu avec le technicien le plus ancien de l\'équipe.' },
      { retards: 2, materiel: [{ nom: 'Équipements de protection individuelle', remisLe: ajout(t, -12), etat: 'neuf' }, { nom: 'Téléphone professionnel', remisLe: ajout(t, -12), etat: 'bon' }, { nom: 'Véhicule de service', remisLe: ajout(t, -11), etat: 'bon', note: 'Utilitaire partagé avec l\'équipe.' }, { nom: 'Badge d\'accès', remisLe: ajout(t, -12), etat: 'neuf' }, { nom: 'Outillage', etat: 'bon' }] });
    ajouter({ sens: 'arrivee', prenom: 'Inès M.', poste: 'Assistante RH en alternance', contrat: 'Apprentissage', service: 'Ressources humaines', manager: 'Responsable RH', date: ajout(t, -40), profils: ['bureau', 'alternant'] },
      { retards: 1, so: ['Présenter les règles de sécurité informatique'], materiel: [{ nom: 'Ordinateur portable', remisLe: ajout(t, -40), etat: 'bon' }, { nom: 'Badge d\'accès', remisLe: ajout(t, -40), etat: 'neuf' }] });
    ajouter({ sens: 'arrivee', prenom: 'Thomas L.', poste: 'Responsable commercial', contrat: 'CDI', service: 'Commercial', manager: 'Direction générale', date: ajout(t, 24), profils: ['bureau', 'manager'] },
      { materiel: [{ nom: 'Ordinateur portable', etat: 'neuf' }, { nom: 'Téléphone professionnel', etat: 'neuf' }] });
    ajouter({ sens: 'arrivee', prenom: 'Nadia K.', poste: 'Comptable fournisseurs', contrat: 'CDD', service: 'Finance', manager: 'Responsable administratif et financier', date: ajout(t, -96), profils: ['bureau'] },
      { so: ['Noter la fin de la période d\'essai'], materiel: [{ nom: 'Ordinateur portable', remisLe: ajout(t, -96), etat: 'bon' }, { nom: 'Écran', remisLe: ajout(t, -96), etat: 'bon' }] });
    ajouter({ sens: 'depart', prenom: 'Sophie D.', poste: 'Comptable', contrat: 'CDI', service: 'Finance', manager: 'Responsable administratif et financier', date: ajout(t, 3), profils: ['bureau'] },
      { retards: 1, materiel: [{ nom: 'Ordinateur portable', remisLe: ajout(t, -1450), etat: 'usage' }, { nom: 'Écran', remisLe: ajout(t, -1450), etat: 'bon' }, { nom: 'Badge d\'accès', remisLe: ajout(t, -1450), etat: 'bon' }, { nom: 'Clés', remisLe: ajout(t, -900), etat: 'bon', restitueLe: ajout(t, -1), etatRetour: 'bon' }] });
    ajouter({ sens: 'depart', prenom: 'Marc V.', poste: 'Technicien itinérant', contrat: 'CDD', service: 'Exploitation', manager: 'Chef d\'équipe maintenance', date: ajout(t, -10), profils: ['terrain'] },
      { retards: 1, materiel: [{ nom: 'Téléphone professionnel', remisLe: ajout(t, -370), etat: 'bon' }, { nom: 'Carte carburant', remisLe: ajout(t, -370), etat: 'bon' }, { nom: 'Badge d\'accès', remisLe: ajout(t, -370), etat: 'bon', restitueLe: ajout(t, -10), etatRetour: 'bon' }, { nom: 'Véhicule de service', remisLe: ajout(t, -370), etat: 'bon', restitueLe: ajout(t, -10), etatRetour: 'usage', note: 'Rayure sur la portière arrière.' }] });
    ajouter({ sens: 'depart', prenom: 'Lucas P.', poste: 'Stagiaire marketing', contrat: 'Stage', service: 'Marketing', manager: 'Responsable marketing', date: ajout(t, -72), profils: ['bureau', 'alternant'] },
      { so: ['Tenir prêts le certificat', 'épargne salariale', 'congés restants'], materiel: [{ nom: 'Ordinateur portable', remisLe: ajout(t, -255), etat: 'bon', restitueLe: ajout(t, -72), etatRetour: 'bon' }, { nom: 'Badge d\'accès', remisLe: ajout(t, -255), etat: 'neuf', restitueLe: ajout(t, -72), etatRetour: 'bon' }] });
    // Lucas : parcours entièrement clos (dernière tâche cochée), pour la suggestion d'effacement.
    const lucas = e.personnes[e.personnes.length - 1];
    lucas.taches.forEach((k) => { if (k.statut === 'afaire') { k.statut = 'fait'; k.faitLe = R.echeance(lucas, k); } });
    // Une tâche ajoutée à la main, hors modèle, sur Camille.
    const camille = e.personnes[0];
    camille.taches = R.trierTaches([...camille.taches, R.normaliserTache({ titre: 'Réserver le déjeuner d\'accueil avec l\'équipe', resp: 'manager', j: -1 })]);
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Onboarding et offboarding · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <path d="M160 140 L160 20 A120 120 0 0 1 280 140 Z" fill="#D9302A"/>
          <circle cx="80" cy="220" r="60" fill="#F5B400"/>
          <rect x="160" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L300 150 A130 130 0 0 1 430 20 Z" fill="#141414"/>
          <rect x="430" y="150" width="60" height="60" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Onboarding et offboarding</p>
          <h1>Personne n'oublie rien.</h1>
          <p>Chaque arrivée et chaque départ suit sa checklist : qui fait quoi, et pour quand, de J-15 à J+90. Le matériel remis est noté, et ce qui n'est pas rendu se voit.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes parcours sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de suivi ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', profils: new Set(B.profils.map((p) => p.id)) };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const nbTaches = B.profils.reduce((s, p) => s + p.arrivee.length + p.depart.length, 0);
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Les arrivées et les départs, sans oubli.</h1>
        <p class="intro">Tu pars de checklists prêtes (${nbTaches} tâches en ${B.profils.length} profils), avec pour chaque tâche un responsable et une échéance relative. Tu les adaptes ensuite à ton entreprise.</p>
        <label class="champ" style="max-width:360px">Nom de l'entreprise ou du service <small>Facultatif, affiché sur les récapitulatifs imprimés.</small>
          <input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="60">
        </label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Choisis tes profils</h1>
        <p class="intro">« Commun à tous » s'applique à chaque parcours. Les autres s'ajoutent selon le poste. Tu pourras modifier chaque tâche, en ajouter ou en retirer dans l'onglet Modèles.</p>
        <div class="choix-types">${B.profils.map((p) => `<label class="groupe-types profil-choix"><span class="case"><input type="checkbox" data-action="choisir-profil" value="${p.id}" ${a.profils.has(p.id) ? 'checked' : ''} ${p.fixe ? 'disabled' : ''}> <b>${esc(p.nom)}</b></span><span class="profil-desc">${esc(p.desc)}</span><span class="profil-nb">${pluriel(p.arrivee.length, 'tâche')} d'arrivée · ${pluriel(p.depart.length, 'tâche')} de départ</span></label>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.modeles = E.modeles.filter((m) => m.fixe || accueil.profils.has(m.id));
    accueil = { etape: 1, entreprise: '', profils: new Set(B.profils.map((p) => p.id)) };
    vue = 'personnes'; fiche = null;
    sauver();
    demarrer();
    toast('Ton suivi est prêt. Ajoute ta première arrivée ou ton premier départ.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    personnes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    materiel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    modeles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const COURTS = { tableau: 'Tableau', semaine: 'Semaine' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['personnes', 'Personnes'], ['semaine', 'Cette semaine'], ['materiel', 'Matériel'], ['modeles', 'Modèles']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : il ne remplace pas un conseil juridique ou RH. Les repères réglementaires sont datés et à vérifier ; ta convention collective et les textes font foi. Données minimales : prénom et initiale, poste, dates, aucune donnée sensible.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/onboarding/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Onboarding<br>offboarding</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    if (fiche && !personne(fiche)) fiche = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${vue === 'personnes' && fiche ? personne(fiche).prenom : titres[vue]} · Onboarding et offboarding`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, personnes: () => (fiche ? vueFiche(personne(fiche)) : vuePersonnes()), semaine: vueSemaine, materiel: vueMateriel, modeles: vueModeles }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id = null) {
    vue = v; fiche = id;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  const ETIQ = { retard: ['rouge', 'En retard'], semaine: ['jaune', 'Cette semaine'], avenir: ['', 'À venir'], fait: ['ciel', 'Fait'], so: ['sable', 'Sans objet'] };
  function etiquetteStatut(t, p, aujourdhui) {
    const s = R.statutTache(t, p, aujourdhui);
    const [cl, lib] = ETIQ[s];
    if (s === 'fait') return `<span class="etiquette ciel">Fait${t.faitLe ? ` le ${dateCourte(t.faitLe)}` : ''}</span>`;
    if (s === 'retard') return `<span class="etiquette rouge">En retard · ${pluriel(ecart(R.echeance(p, t), aujourdhui), 'jour')}</span>`;
    return `<span class="etiquette ${cl}">${lib}</span>`;
  }
  function barre(pct, retard) {
    return `<span class="progres ${retard ? 'avec-retard' : ''}" role="img" aria-label="${pct} % fait"><span style="width:${pct}%"></span></span>`;
  }
  // Où en est le parcours : J+12, J-4, « terminé ».
  function position(p, t) {
    if (R.termine(p, t)) return 'Terminé';
    const n = ecart(p.date, t);
    return n === 0 ? 'Jour J' : n > 0 ? `J+${n}` : `J−${-n}`;
  }

  function cartePersonne(p, t) {
    const pr = R.progression(p, t);
    const fini = R.termine(p, t);
    const alertes = p.materiel.filter((m) => R.etatMateriel(m, p, t) === 'non-rendu').length;
    return `<li class="carte-personne sens-${p.sens} ${fini ? 'fini' : ''}">
      <button class="cp-corps" data-action="fiche" data-id="${p.id}">
        <span class="cp-tete"><span class="etiquette ${p.sens === 'arrivee' ? 'ciel' : 'rose'}">${LIB_SENS[p.sens]}</span><span class="cp-pos">${position(p, t)}</span></span>
        <b>${esc(p.prenom)}</b>
        <span class="cp-detail">${esc([p.poste, p.service].filter(Boolean).join(' · ') || 'Poste à préciser')}</span>
        <span class="cp-date">${LIB_DATE[p.sens]} ${dateLongue(p.date)}</span>
        <span class="cp-progres">${barre(pr.pct, pr.retard)}<span class="nb">${pr.pct} %</span></span>
        <span class="cp-etiquettes">${pr.retard ? `<span class="etiquette rouge">${pluriel(pr.retard, 'tâche')} en retard</span>` : ''}${pr.semaine ? `<span class="etiquette jaune">${pr.semaine} cette semaine</span>` : ''}${alertes ? `<span class="etiquette rouge">${pluriel(alertes, 'objet')} non rendu${alertes > 1 ? 's' : ''}</span>` : ''}${fini ? '<span class="etiquette ciel">Terminé</span>' : ''}</span>
      </button>
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const ind = R.indicateurs(E.personnes, t);
    const sem = R.semaine(t);
    const enCours = R.trierPersonnes(E.personnes, t).filter((p) => !R.termine(p, t));
    const retards = R.parResponsable(E.personnes, t).flatMap((g) => g.items.map((i) => ({ ...i, resp: g.resp }))).filter((i) => i.statut === 'retard').sort((x, y) => x.echeance.localeCompare(y.echeance));
    const alertes = R.alertesMateriel(E.personnes, t);
    const effacer = R.aEffacer(E.personnes, t, E.reglages.effacementJours);
    if (!E.personnes.length) {
      return `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>Aucun parcours pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute une arrivée ou un départ</h3><p>Prénom et initiale, poste, date d'arrivée ou dernier jour, profil : la checklist se crée avec ses responsables et ses échéances.</p><div class="actions"><button class="btn primaire" data-action="nouvelle" data-sens="arrivee">${ICONES.plus}Une arrivée</button><button class="btn" data-action="nouvelle" data-sens="depart">${ICONES.plus}Un départ</button></div></div></div>`;
    }
    const tuiles = [
      ['En cours', ind.enCours, `${pluriel(ind.arrivees, 'arrivée')} · ${pluriel(ind.departs, 'départ')}`, 'var(--bleu)', '', 'personnes'],
      ['En retard', ind.retard, ind.retard ? 'tâches dont l\'échéance est passée' : 'aucune tâche en retard', 'var(--rouge)', 'rond', 'semaine'],
      ['Cette semaine', ind.semaine, `tâches à faire d'ici dimanche ${dateCourte(sem.a)}`, 'var(--jaune)', '', 'semaine'],
      ['Non rendu', ind.nonRendu, ind.nonRendu ? 'objets à récupérer après un départ' : 'tout le matériel est rendu', 'var(--encre)', 'rond', 'materiel'],
    ].map(([lib, v, d, c, f, cible]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></button>`).join('');
    return `
      <div class="vue-tete"><div><h1>${E.entreprise ? esc(E.entreprise) : 'Tableau de bord'}</h1><p>Les parcours en cours, ce qui est en retard, ce qui tombe cette semaine et le matériel à récupérer.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle" data-sens="arrivee">${ICONES.plus}Arrivée</button><button class="btn" data-action="nouvelle" data-sens="depart">${ICONES.plus}Départ</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${effacer.length ? `<div class="alerte-rgpd"><div><b>${pluriel(effacer.length, 'parcours terminé', 'parcours terminés')} depuis plus de ${pluriel(E.reglages.effacementJours, 'jour')}</b><span>${effacer.map((p) => esc(p.prenom)).join(', ')} : efface ${effacer.length > 1 ? 'ces fiches' : 'cette fiche'} pour ne garder que le nécessaire (les archives RH obligatoires se tiennent ailleurs).</span></div><button class="btn petit" data-action="effacer-termines">Effacer</button></div>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">En retard <span>${retards.length ? 'Les plus anciens d\'abord' : ''}</span></h2>
          ${retards.length ? `<ul class="liste-taches">${retards.slice(0, 8).map((i) => ligneTransverse(i, t)).join('')}</ul>${retards.length > 8 ? `<button class="btn lien" data-action="vue" data-vue="semaine">Voir les ${retards.length} tâches en retard</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien en retard</h3><p>Les tâches dont l\'échéance est passée apparaissent ici, avec leur responsable.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Matériel à surveiller</h2>
          ${alertes.length ? `<ul class="liste-taches">${alertes.map((a) => `<li class="ligne-transverse alerte-${a.etat}"><button class="lien-ligne" data-action="fiche" data-id="${a.personneId}"><b>${esc(a.nom)}</b><span>${esc(a.prenom)} · ${a.etat === 'non-rendu' ? `parti${a.jours > 0 ? ` ${quand(-a.jours)}` : ''}` : a.etat === 'a-restituer' ? `dernier jour ${quand(-a.jours)}` : 'arrivée passée'}</span></button><span class="etiquette ${a.etat === 'non-rendu' ? 'rouge' : 'jaune'}">${R.LIB_MAT[a.etat].replace(' (en retard)', '')}</span></li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien à signaler</h3><p>Le matériel non rendu après un départ, ou à récupérer dans les 7 jours, apparaît ici.</p></div></div>'}
        </section>
      </div>
      <h2 class="titre-section">Parcours en cours <span>${pluriel(enCours.length, 'parcours', 'parcours')}</span></h2>
      ${enCours.length ? `<ul class="cartes-personnes">${enCours.map((p) => cartePersonne(p, t)).join('')}</ul>` : '<p class="aide">Aucun parcours en cours : tous sont terminés.</p>'}
      ${AVERTISSEMENT}`;
  }

  // Ligne de tâche transverse (tableau de bord, cette semaine) : case « fait », personne, échéance.
  function ligneTransverse(i, t) {
    const n = ecart(t, i.echeance);
    return `<li class="ligne-transverse st-${i.statut}">
      <button class="case-fait" data-action="cocher" data-id="${i.personneId}" data-tache="${i.tacheId}" aria-label="Marquer fait : ${esc(i.titre)}">${ICONES.coche}</button>
      <button class="lien-ligne" data-action="fiche" data-id="${i.personneId}"><b>${esc(i.titre)}</b><span>${esc(i.prenom)} · ${LIB_SENS[i.sens].toLowerCase()} · ${libJ(i.j)} · ${fmt(i.echeance)}</span></button>
      <span class="lt-droite">${i.resp ? pillResp(i.resp) : ''}<span class="etiquette ${i.statut === 'retard' ? 'rouge' : n === 0 ? 'jaune' : ''}">${i.statut === 'retard' ? `${pluriel(-n, 'jour')} de retard` : quand(n)}</span></span>
    </li>`;
  }

  // ---------- Personnes ----------
  function vuePersonnes() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const garde = (p) => {
      const fini = R.termine(p, t);
      const ok = filtre.personnes === 'tous' || (filtre.personnes === 'encours' && !fini) || (filtre.personnes === 'termines' && fini) || (!fini && filtre.personnes === p.sens);
      return ok && (!q || `${p.prenom} ${p.poste} ${p.service} ${p.manager} ${p.contrat}`.toLowerCase().includes(q));
    };
    const nb = (f) => E.personnes.filter((p) => { const fini = R.termine(p, t); return f === 'tous' || (f === 'encours' && !fini) || (f === 'termines' && fini) || (!fini && f === p.sens); }).length;
    const liste = R.trierPersonnes(E.personnes.filter(garde), t);
    const filtres = [['encours', 'En cours'], ['arrivee', 'Arrivées'], ['depart', 'Départs'], ['termines', 'Terminés'], ['tous', 'Tous']];
    return `
      <div class="vue-tete"><div><h1>Personnes</h1><p>Une fiche par arrivée ou par départ. Clique sur une fiche pour cocher ses tâches, noter le matériel et imprimer son récapitulatif.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle" data-sens="arrivee">${ICONES.plus}Arrivée</button><button class="btn" data-action="nouvelle" data-sens="depart">${ICONES.plus}Départ</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les parcours">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-filtre="${id}" aria-pressed="${filtre.personnes === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un prénom, un poste" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<ul class="cartes-personnes">${liste.map((p) => cartePersonne(p, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.personnes.length ? 'Aucun parcours ne correspond' : 'Aucun parcours'}</h3><p>${E.personnes.length ? 'Change le filtre ou la recherche.' : 'Ajoute une arrivée ou un départ : la checklist se crée depuis tes modèles.'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle" data-sens="arrivee">${ICONES.plus}Une arrivée</button><button class="btn" data-action="nouvelle" data-sens="depart">${ICONES.plus}Un départ</button></div></div></div>`}
      <p class="mention" style="margin-top:20px">Données minimales : prénom et initiale du nom, poste, contrat, service, dates. Ne saisis aucune donnée de santé, de salaire, d'adresse ou de numéro d'identification.</p>`;
  }

  function vueFiche(p) {
    const t = auj();
    const pr = R.progression(p, t);
    const fini = R.termine(p, t);
    const phases = R.PHASES[p.sens].map((ph) => ({ ph, taches: p.taches.filter((k) => R.phase(k.j, p.sens).id === ph.id) })).filter((g) => g.taches.length);
    const lien = p.lieeA && personne(p.lieeA);
    const depart = !lien && p.sens === 'arrivee' && E.personnes.find((x) => x.lieeA === p.id);
    const profils = p.profils.map((id) => modele(id)?.nom).filter(Boolean);
    return `
      <button class="btn lien retour" data-action="vue" data-vue="personnes">${ICONES.gauche}Toutes les personnes</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${LIB_SENS[p.sens]} · ${position(p, t)}</p>
          <h1>${esc(p.prenom)}</h1>
          <p>${esc([p.poste, p.contrat, p.service].filter(Boolean).join(' · ') || 'Poste à préciser')}${p.manager ? `<br>Manager : ${esc(p.manager)}` : ''}<br>${LIB_DATE[p.sens]} <b>${dateLongue(p.date)}</b>${profils.length ? ` · Profils : commun, ${esc(profils.join(', ').toLowerCase())}` : ' · Profil commun'}</p>
          ${p.note ? `<p class="note-fiche">${esc(p.note)}</p>` : ''}
          ${lien ? `<p><button class="btn lien" data-action="fiche" data-id="${lien.id}">Voir l'arrivée de ${esc(lien.prenom)}</button></p>` : ''}${depart ? `<p><button class="btn lien" data-action="fiche" data-id="${depart.id}">Voir le départ prévu le ${dateLongue(depart.date)}</button></p>` : ''}
        </div>
        <div class="actions">
          <button class="btn" data-action="modifier-personne" data-id="${p.id}">Modifier</button>
          <button class="btn" data-action="imprimer-fiche" data-id="${p.id}">Imprimer</button>
          ${p.sens === 'arrivee' && !depart ? `<button class="btn" data-action="preparer-depart" data-id="${p.id}">Préparer le départ</button>` : ''}
        </div></div>
      <div class="bilan-fiche">
        <div class="bf-progres"><b>${pr.pct} %</b>${barre(pr.pct, pr.retard)}<span>${pr.fait} faites sur ${pr.total - pr.so} applicables${pr.so ? ` · ${pr.so} sans objet` : ''}</span></div>
        <div class="bf-compteurs">${pr.retard ? `<span class="etiquette rouge">${pluriel(pr.retard, 'tâche')} en retard</span>` : ''}${pr.semaine ? `<span class="etiquette jaune">${pr.semaine} cette semaine</span>` : ''}${fini ? '<span class="etiquette ciel">Parcours terminé</span>' : ''}${!pr.retard && !pr.semaine && !fini ? '<span class="etiquette">Rien d\'urgent</span>' : ''}</div>
      </div>
      <div class="titre-section titre-avec-action"><h2>Checklist</h2><button class="btn petit" data-action="nouvelle-tache" data-id="${p.id}">${ICONES.plus}Ajouter une tâche</button></div>
      ${phases.length ? phases.map(({ ph, taches }) => `<section class="phase"><h3 class="titre-phase">${ph.nom}<span>${libJ(taches[0].j)}${taches[0].j !== taches[taches.length - 1].j ? ` à ${libJ(taches[taches.length - 1].j)}` : ''}</span></h3><ul class="liste-taches">${taches.map((k) => ligneTache(k, p, t)).join('')}</ul></section>`).join('') : '<p class="aide">Aucune tâche : ajoutes-en une, ou modifie les profils de la fiche.</p>'}
      <div class="titre-section titre-avec-action"><h2>Matériel <span>${p.sens === 'arrivee' ? 'Remis à l\'arrivée' : 'À restituer au départ'}</span></h2><button class="btn petit" data-action="nouveau-materiel" data-id="${p.id}">${ICONES.plus}Ajouter</button></div>
      ${p.materiel.length ? `<ul class="liste-materiel">${p.materiel.map((m) => ligneMateriel(m, p, t)).join('')}</ul>` : `<p class="aide">${p.sens === 'arrivee' ? 'Note ici ce qui est remis (ordinateur, badge, clés, équipements…) : au départ, la liste servira à la restitution.' : 'Liste ici ce qui doit être rendu : ce qui ne l\'est pas au dernier jour passe en alerte.'}</p>`}
      <div class="pied-fiche"><button class="btn danger" data-action="effacer-personne" data-id="${p.id}">Effacer cette fiche</button><p class="mention">Une fois le parcours terminé, efface la fiche : les archives RH obligatoires se tiennent dans tes outils de paie et le dossier du personnel.</p></div>`;
  }

  function ligneTache(k, p, t) {
    const s = R.statutTache(k, p, t);
    const e = R.echeance(p, k);
    return `<li class="ligne-tache st-${s}">
      <button class="case-fait ${k.statut === 'fait' ? 'coche' : ''}" data-action="cocher" data-id="${p.id}" data-tache="${k.id}" aria-pressed="${k.statut === 'fait'}" aria-label="${k.statut === 'fait' ? 'Remettre à faire' : 'Marquer fait'} : ${esc(k.titre)}">${ICONES.coche}</button>
      <div class="lt-corps">
        <button class="lien-ligne" data-action="tache" data-id="${p.id}" data-tache="${k.id}"><b>${esc(k.titre)}</b><span>${libJ(k.j)} · ${fmt(e)}${k.note ? ` · ${esc(k.note)}` : ''}</span></button>
        <span class="lt-etiquettes">${pillResp(k.resp)}${etiquetteStatut(k, p, t)}${k.r && B.reperes[k.r] ? `<button class="etiquette repere" data-action="repere" data-r="${k.r}">Repère</button>` : ''}</span>
      </div>
      <button class="btn petit so ${k.statut === 'so' ? 'actif' : ''}" data-action="sans-objet" data-id="${p.id}" data-tache="${k.id}" aria-pressed="${k.statut === 'so'}" title="Sans objet pour ce parcours">S. O.</button>
    </li>`;
  }

  function ligneMateriel(m, p, t) {
    const e = R.etatMateriel(m, p, t);
    const cl = { remis: 'ciel', restitue: 'ciel', 'a-remettre': '', 'a-remettre-retard': 'jaune', 'a-restituer': 'jaune', 'non-rendu': 'rouge' }[e];
    const detail = [m.remisLe ? `remis le ${dateCourte(m.remisLe)} (${nomEtat(m.etat).toLowerCase()})` : 'pas encore remis', m.restitueLe ? `rendu le ${dateCourte(m.restitueLe)}${m.etatRetour ? ` (${nomEtat(m.etatRetour).toLowerCase()})` : ''}` : '', m.note].filter(Boolean).join(' · ');
    const action = p.sens === 'arrivee'
      ? (m.remisLe ? '' : `<button class="btn petit primaire" data-action="remettre" data-id="${p.id}" data-mat="${m.id}">Remis</button>`)
      : (m.restitueLe ? '' : `<button class="btn petit primaire" data-action="restituer" data-id="${p.id}" data-mat="${m.id}">Rendu</button>`);
    return `<li class="ligne-mat mat-${e}">
      <button class="lien-ligne" data-action="materiel" data-id="${p.id}" data-mat="${m.id}"><b>${esc(m.nom)}</b><span>${esc(detail)}</span></button>
      <span class="etiquette ${cl}">${R.LIB_MAT[e]}</span>${action}
    </li>`;
  }

  // ---------- Cette semaine ----------
  function vueSemaine() {
    const t = auj();
    const sem = R.semaine(t);
    const groupes = R.parResponsable(E.personnes, t).filter((g) => filtre.resp === 'tous' || g.resp === filtre.resp);
    const tous = R.parResponsable(E.personnes, t);
    const nb = (r) => tous.filter((g) => r === 'tous' || g.resp === r).reduce((s, g) => s + g.items.length, 0);
    return `
      <div class="vue-tete"><div><h1>Cette semaine</h1><p>Du lundi ${dateCourte(sem.de)} au dimanche ${dateCourte(sem.a)} : ce que chaque responsable doit faire, avec les retards en tête. Coche une tâche dès qu'elle est faite.</p></div></div>
      <div class="filtres" role="group" aria-label="Filtrer par responsable">${[['tous', 'Tous'], ...B.responsables.map((r) => [r.id, r.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-resp" data-resp="${id}" aria-pressed="${filtre.resp === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
      ${groupes.length ? groupes.map((g) => {
        const r = g.items.filter((i) => i.statut === 'retard').length;
        return `<section class="groupe-resp"><h2 class="titre-cat">${pillResp(g.resp)}<span>${esc(resp(g.resp).long)} · ${pluriel(g.items.length, 'tâche')}${r ? `, dont ${r} en retard` : ''}</span></h2><ul class="liste-taches">${g.items.map((i) => ligneTransverse({ ...i, resp: null }, t)).join('')}</ul></section>`;
      }).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à faire cette semaine${filtre.resp !== 'tous' ? ` pour ${esc(resp(filtre.resp).long.toLowerCase())}` : ''}</h3><p>Aucune tâche en retard ni d'échéance d'ici dimanche. Les prochaines échéances sont dans chaque fiche.</p></div></div>`}`;
  }

  // ---------- Matériel ----------
  function vueMateriel() {
    const t = auj();
    const lignes = E.personnes.flatMap((p) => p.materiel.map((m) => ({ p, m, e: R.etatMateriel(m, p, t) })));
    const groupes = [
      ['non-rendu', 'Non rendu', 'Le dernier jour est passé : à récupérer ou à déclarer perdu.'],
      ['a-restituer', 'À restituer', 'Départs à venir.'],
      ['a-remettre-retard', 'À remettre (arrivée passée)', 'Prévu pour une arrivée déjà faite.'],
      ['a-remettre', 'À remettre', 'Arrivées à venir.'],
      ['remis', 'Remis', 'En possession des personnes arrivées.'],
      ['restitue', 'Restitué', 'Rendu au départ.'],
    ];
    const compte = (id) => lignes.filter((l) => l.e === id).length;
    if (!lignes.length) return `<div class="vue-tete"><div><h1>Matériel</h1><p>Rien de noté pour l'instant.</p></div></div><div class="vide-etat">${FORME_VIDE}<div><h3>Aucun matériel</h3><p>Ouvre une fiche et ajoute ce qui est remis à l'arrivée (ordinateur, badge, clés, équipements…) ou ce qui doit être rendu au départ.</p></div></div>`;
    return `
      <div class="vue-tete"><div><h1>Matériel</h1><p>Tout ce qui a été remis ou doit être rendu, toutes personnes confondues. « Rendu » coche la restitution avec sa date et l'état au retour.</p></div>
        <div class="actions"><button class="btn" data-action="csv-materiel">Exporter en CSV</button></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Non rendu</p><b>${compte('non-rendu')}</b><span>après un départ</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">À restituer</p><b>${compte('a-restituer')}</b><span>départs à venir</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Remis</p><b>${compte('remis')}</b><span>en circulation</span></div>
      </div>
      ${groupes.map(([id, nom, desc]) => {
        const l = lignes.filter((x) => x.e === id).sort((x, y) => x.p.date.localeCompare(y.p.date) || x.m.nom.localeCompare(y.m.nom, 'fr'));
        if (!l.length) return '';
        const corps = `<ul class="liste-materiel">${l.map(({ p, m }) => ligneMateriel(m, p, t).replace('<span>', `<span>${esc(p.prenom)} · ${LIB_SENS[p.sens].toLowerCase()} le ${dateCourte(p.date)} · `)).join('')}</ul>`;
        return id === 'remis' || id === 'restitue'
          ? `<details class="plus-tard groupe-mat"><summary>${nom} <small>${l.length}</small></summary>${corps}</details>`
          : `<section class="groupe-mat"><h2 class="titre-cat">${nom}<span>${pluriel(l.length, 'objet')} · ${desc}</span></h2>${corps}</section>`;
      }).join('')}`;
  }

  // ---------- Modèles ----------
  function vueModeles() {
    const m = modele(filtre.modele) || E.modeles[0];
    filtre.modele = m.id;
    const s = filtre.sensModele;
    const taches = m[s];
    const bornes = B.bornes[s];
    return `
      <div class="vue-tete"><div><h1>Modèles</h1><p>Les checklists de départ de chaque nouveau parcours. Ajoute, modifie ou retire des tâches : les parcours déjà créés ne changent pas.</p></div>
        <div class="actions"><button class="btn" data-action="nouveau-profil">${ICONES.plus}Nouveau profil</button></div></div>
      <div class="filtres" role="group" aria-label="Profils">${E.modeles.map((x) => `<button class="filtre" data-action="choisir-modele" data-modele="${x.id}" aria-pressed="${x.id === m.id}">${esc(x.nom)} <small>${x.arrivee.length + x.depart.length}</small></button>`).join('')}</div>
      <section class="carte-modele">
        <div class="cm-tete">
          <div><h2>${esc(m.nom)}</h2><p>${esc(m.desc || (m.fixe ? 'S\'applique à chaque parcours.' : 'S\'ajoute au profil commun selon le poste.'))}</p></div>
          <div class="actions"><button class="btn petit" data-action="modifier-profil" data-modele="${m.id}">Renommer</button>${m.fixe ? '' : `<button class="btn petit danger" data-action="supprimer-profil" data-modele="${m.id}">Supprimer</button>`}</div>
        </div>
        <div class="choix-statut choix-sens" role="group" aria-label="Arrivée ou départ">${[['arrivee', `Arrivée (${m.arrivee.length})`], ['depart', `Départ (${m.depart.length})`]].map(([id, lib]) => `<button type="button" data-action="sens-modele" data-sens="${id}" aria-pressed="${s === id}"><span>${lib}</span></button>`).join('')}</div>
        ${taches.length ? `<ul class="liste-taches modele-taches">${taches.map((k) => `<li class="ligne-modele"><span class="lm-j">${libJ(k.j)}</span><button class="lien-ligne" data-action="tache-modele" data-modele="${m.id}" data-tache="${k.id}"><b>${esc(k.titre)}</b><span>${esc(resp(k.resp).long)}${k.r ? ' · repère réglementaire' : ''}</span></button>${pillResp(k.resp)}<button class="btn-icone petit" data-action="retirer-tache-modele" data-modele="${m.id}" data-tache="${k.id}" aria-label="Retirer : ${esc(k.titre)}">×</button></li>`).join('')}</ul>` : '<p class="aide">Aucune tâche dans ce profil pour ce sens.</p>'}
        <div class="rang"><button class="btn primaire petit" data-action="nouvelle-tache-modele" data-modele="${m.id}">${ICONES.plus}Ajouter une tâche</button><span class="mention">Échéances conseillées : de ${libJ(bornes[0])} à ${libJ(bornes[1])}.</span></div>
      </section>
      <h2 class="titre-section">Repères réglementaires <span>Droit du travail français, à vérifier</span></h2>
      <ol class="conseils">${Object.values(B.reperes).map((r) => `<li><b>${esc(r.titre)}</b><span>${esc(r.texte)}</span><small class="source">${esc(r.source)}</small></li>`).join('')}</ol>
      <p class="mention" style="margin-top:12px">${esc(B.sourceReperes)}</p>
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="reinit-modeles">Rétablir les modèles d'origine</button></div>`;
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
  const optionsResp = (v) => B.responsables.map((r) => `<option value="${r.id}" ${r.id === v ? 'selected' : ''}>${esc(r.long)}</option>`).join('');

  // Nouvelle personne (sens donné) ou personne existante.
  function modalePersonne(id, sens = 'arrivee') {
    const t = auj();
    const p = id ? personne(id) : null;
    if (id && !p) return;
    const v = p || { sens, prenom: '', poste: '', contrat: 'CDI', service: '', manager: '', date: ajout(t, sens === 'arrivee' ? 15 : 30), profils: ['bureau'], note: '' };
    const autres = E.modeles.filter((m) => !m.fixe);
    const corps = `
      <fieldset class="champ"><legend>Parcours</legend><div class="choix-statut choix-2">${[['arrivee', 'Arrivée'], ['depart', 'Départ']].map(([s, l]) => `<label><input type="radio" name="sens" value="${s}" ${v.sens === s ? 'checked' : ''} ${p ? 'disabled' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Prénom et initiale du nom<small>Données minimales : « Camille D. ». Un nom complet est raccourci automatiquement.</small><input name="prenom" required maxlength="60" value="${esc(v.prenom)}" placeholder="Ex. : Camille D." autocomplete="off"></label>
      <p class="aide" id="apercu-nom" hidden></p>
      <div class="rang-champs">
        <label class="champ">Poste<input name="poste" maxlength="80" value="${esc(v.poste)}" placeholder="Ex. : Chargée de clientèle"></label>
        <label class="champ">Type de contrat<select name="contrat">${B.contrats.map((c) => `<option ${c === v.contrat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Service<input name="service" maxlength="60" value="${esc(v.service)}" placeholder="Ex. : Service client"></label>
        <label class="champ">Manager (fonction)<input name="manager" maxlength="60" value="${esc(v.manager)}" placeholder="Ex. : Responsable du service"></label>
      </div>
      <label class="champ"><span id="lib-date">${v.sens === 'arrivee' ? 'Date d\'arrivée' : 'Dernier jour'}</span><small>Le jour J : toutes les échéances se calculent depuis cette date.</small><input type="date" name="date" value="${v.date}" required></label>
      <fieldset class="champ cadre-champs"><legend>Profils <small>${p ? 'Un profil ajouté apporte ses tâches ; un profil retiré laisse les tâches déjà créées.' : '« Commun à tous » est toujours inclus.'}</small></legend>
        <div class="profils-cases">${autres.map((m) => `<label class="case"><input type="checkbox" name="profils" value="${m.id}" ${v.profils.includes(m.id) ? 'checked' : ''}> <span>${esc(m.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Note<small>Facultative. Aucune donnée sensible (santé, salaire, motif de départ, adresse).</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>'
      : '<button class="btn primaire" value="ok">Créer la checklist</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier la fiche' : (v.sens === 'arrivee' ? 'Nouvelle arrivée' : 'Nouveau départ'), corps, pied, (f) => {
      const prenom = R.nomMinimal(f.get('prenom'));
      if (!prenom) return 'Indique au moins un prénom.';
      if (!f.get('date')) return 'Indique la date.';
      const s = p ? p.sens : f.get('sens');
      const profils = f.getAll('profils').map(String);
      const champs = { prenom, poste: String(f.get('poste') || '').trim(), contrat: String(f.get('contrat') || ''), service: String(f.get('service') || '').trim(), manager: String(f.get('manager') || '').trim(), date: f.get('date'), note: String(f.get('note') || '').trim() };
      retenir();
      if (p) {
        const ajoutes = profils.filter((x) => !p.profils.includes(x));
        Object.assign(p, champs, { profils });
        if (ajoutes.length) {
          const titres = new Set(p.taches.map((k) => k.titre.trim().toLowerCase()));
          const nouvelles = R.genererTaches(E.modeles.filter((m) => ajoutes.includes(m.id)), ajoutes, s).filter((k) => !titres.has(k.titre.trim().toLowerCase()));
          p.taches = R.trierTaches([...p.taches, ...nouvelles]);
          toast(`Fiche enregistrée : ${pluriel(nouvelles.length, 'tâche ajoutée', 'tâches ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
        } else toast(`Fiche de ${prenom} enregistrée.`, { libelle: 'Annuler', faire: annuler });
        sauver(); rendre();
        return;
      }
      const np = R.normaliserPersonne({ id: uid(), sens: s, ...champs, profils, taches: R.genererTaches(E.modeles, profils, s) }, t);
      E.personnes.push(np);
      sauver();
      changerVue('personnes', np.id);
      toast(`${s === 'arrivee' ? 'Arrivée' : 'Départ'} de ${prenom} : ${pluriel(np.taches.length, 'tâche')} créées.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majDate = () => { const s = p ? p.sens : d.querySelector('[name=sens]:checked').value; d.querySelector('#lib-date').textContent = s === 'arrivee' ? 'Date d\'arrivée' : 'Dernier jour'; };
    d.querySelectorAll('[name=sens]').forEach((r) => r.addEventListener('change', majDate));
    const champ = d.querySelector('[name=prenom]');
    champ.addEventListener('input', () => {
      const n = R.nomMinimal(champ.value);
      const a = d.querySelector('#apercu-nom');
      a.hidden = !n || n === champ.value.trim();
      a.textContent = `Sera enregistré : « ${n} ».`;
    });
  }

  function modaleTache(pid, tid) {
    const p = personne(pid);
    const k = tid ? p?.taches.find((x) => x.id === tid) : null;
    if (!p || (tid && !k)) return;
    const v = k || { titre: '', resp: 'rh', j: 0, note: '', statut: 'afaire', faitLe: null };
    const corps = `
      <label class="champ">Tâche<input name="titre" required maxlength="160" value="${esc(v.titre)}" placeholder="Ex. : Présenter les locaux"></label>
      <div class="rang-champs">
        <label class="champ">Responsable<select name="resp">${optionsResp(v.resp)}</select></label>
        <label class="champ">Échéance<small>J−15, J, J+30… (J = ${p.sens === 'arrivee' ? 'arrivée' : 'dernier jour'})</small><input name="j" required value="${libJ(v.j).replace('−', '-')}" inputmode="text" autocomplete="off"></label>
      </div>
      <p class="aide" id="apercu-ech">Échéance : ${dateLongue(R.echeance(p, v))}</p>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${[['afaire', 'À faire'], ['fait', 'Fait'], ['so', 'Sans objet']].map(([s, l]) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-fait" ${v.statut === 'fait' ? '' : 'hidden'}>Fait le<input type="date" name="faitLe" value="${v.faitLe || auj()}"></label>
      <label class="champ">Note<small>Facultative, sans donnée sensible.</small><input name="note" maxlength="200" value="${esc(v.note || '')}"></label>
      ${k?.r && B.reperes[k.r] ? `<p class="aide"><b>${esc(B.reperes[k.r].titre)}</b> : ${esc(B.reperes[k.r].texte)} <small>${esc(B.reperes[k.r].source)}</small></p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = k
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(k ? 'Tâche' : `Nouvelle tâche · ${esc(p.prenom)}`, corps, pied, (f, action) => {
      if (action === 'supprimer') {
        retenir();
        p.taches = p.taches.filter((x) => x.id !== k.id);
        sauver(); rendre(); toast('Tâche retirée de ce parcours.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique la tâche.';
      const j = R.lireJ(f.get('j'));
      if (j === null || Math.abs(j) > 365) return 'Échéance illisible : écris par exemple J-7, J ou J+30.';
      const statut = f.get('statut') || 'afaire';
      retenir();
      const donnees = R.normaliserTache({ id: k?.id || uid(), titre, resp: f.get('resp'), j, r: k?.r || '', statut, faitLe: statut === 'fait' ? (f.get('faitLe') || auj()) : statut === 'so' ? auj() : null, note: f.get('note') });
      if (k) Object.assign(k, donnees); else p.taches.push(donnees);
      p.taches = R.trierTaches(p.taches);
      sauver(); rendre();
      toast(k ? 'Tâche enregistrée.' : `Tâche ajoutée pour le ${dateLongue(R.echeance(p, donnees))}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', () => { d.querySelector('#champ-fait').hidden = d.querySelector('[name=statut]:checked').value !== 'fait'; }));
    d.querySelector('[name=j]').addEventListener('input', (e) => { const j = R.lireJ(e.target.value); d.querySelector('#apercu-ech').textContent = j === null ? 'Échéance : à préciser (J-7, J, J+30…)' : `Échéance : ${dateLongue(R.echeance(p, { j }))}`; });
  }

  function modaleTacheModele(mid, tid) {
    const m = modele(mid);
    const s = filtre.sensModele;
    const k = tid ? m?.[s].find((x) => x.id === tid) : null;
    if (!m || (tid && !k)) return;
    const v = k || { titre: '', resp: 'rh', j: 0 };
    ouvrirModale(k ? 'Tâche du modèle' : `Nouvelle tâche · ${esc(m.nom)}`, `
      <p class="aide">${s === 'arrivee' ? 'Checklist d\'arrivée' : 'Checklist de départ'} du profil « ${esc(m.nom)} ». La modification vaut pour les prochains parcours.</p>
      <label class="champ">Tâche<input name="titre" required maxlength="160" value="${esc(v.titre)}"></label>
      <div class="rang-champs">
        <label class="champ">Responsable<select name="resp">${optionsResp(v.resp)}</select></label>
        <label class="champ">Échéance<small>De ${libJ(B.bornes[s][0])} à ${libJ(B.bornes[s][1])} conseillé</small><input name="j" required value="${libJ(v.j).replace('−', '-')}" autocomplete="off"></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${k ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${k ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { retirerTacheModele(mid, tid); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique la tâche.';
      const j = R.lireJ(f.get('j'));
      if (j === null || Math.abs(j) > 365) return 'Échéance illisible : écris par exemple J-7, J ou J+30.';
      retenir();
      const t2 = R.normaliserTache({ id: k?.id || uid(), titre, resp: f.get('resp'), j, r: k?.r || '' }, { avecStatut: false });
      if (k) Object.assign(k, t2); else m[s].push(t2);
      m[s] = R.trierTaches(m[s]);
      sauver(); rendre(); toast(k ? 'Modèle enregistré.' : 'Tâche ajoutée au modèle.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function retirerTacheModele(mid, tid) {
    const m = modele(mid);
    if (!m) return;
    const s = filtre.sensModele;
    const k = m[s].find((x) => x.id === tid);
    if (!k) return;
    retenir();
    m[s] = m[s].filter((x) => x.id !== tid);
    sauver(); rendre(); toast(`« ${k.titre.slice(0, 50)}${k.titre.length > 50 ? '…' : ''} » retirée du modèle.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleProfil(mid) {
    const m = mid ? modele(mid) : null;
    ouvrirModale(m ? 'Renommer le profil' : 'Nouveau profil', `
      <label class="champ">Nom du profil<input name="nom" required maxlength="60" value="${esc(m?.nom || '')}" placeholder="Ex. : Poste en atelier"></label>
      <label class="champ">Description<small>Facultative.</small><input name="desc" maxlength="160" value="${esc(m?.desc || '')}"></label>
      ${m ? '' : `<label class="champ">Partir de<select name="copie"><option value="">Un profil vide</option>${E.modeles.filter((x) => !x.fixe).map((x) => `<option value="${x.id}">Une copie de « ${esc(x.nom)} »</option>`).join('')}</select></label>`}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${m ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      retenir();
      if (m) { m.nom = nom; m.desc = String(f.get('desc') || '').trim(); } else {
        const src = modele(f.get('copie'));
        const nv = R.normaliserModele({ id: uid(), nom, desc: String(f.get('desc') || '').trim(), arrivee: src ? src.arrivee.map((k) => ({ ...k, id: uid() })) : [], depart: src ? src.depart.map((k) => ({ ...k, id: uid() })) : [] });
        E.modeles.push(nv); filtre.modele = nv.id;
      }
      sauver(); rendre(); toast(m ? 'Profil renommé.' : `Profil « ${nom} » créé.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMateriel(pid, mid) {
    const p = personne(pid);
    const m = mid ? p?.materiel.find((x) => x.id === mid) : null;
    if (!p || (mid && !m)) return;
    const v = m || { nom: '', remisLe: null, etat: 'bon', restitueLe: null, etatRetour: null, note: '' };
    const etats = (n, val, vide) => `<select name="${n}">${vide ? '<option value="">—</option>' : ''}${B.etatsMateriel.map((e) => `<option value="${e.id}" ${e.id === val ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select>`;
    const corps = `
      <label class="champ">Matériel<input name="nom" required maxlength="80" list="materiels" value="${esc(v.nom)}" placeholder="Ex. : Ordinateur portable"></label>
      <datalist id="materiels">${B.materielCourant.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="rang-champs">
        <label class="champ">Remis le<small>Vide : pas encore remis.</small><input type="date" name="remisLe" value="${v.remisLe || ''}"></label>
        <label class="champ">État à la remise${etats('etat', v.etat)}</label>
      </div>
      ${p.sens === 'depart' ? `<div class="rang-champs">
        <label class="champ">Rendu le<small>Vide : pas encore rendu.</small><input type="date" name="restitueLe" value="${v.restitueLe || ''}"></label>
        <label class="champ">État au retour${etats('etatRetour', v.etatRetour, true)}</label>
      </div>` : ''}
      <label class="champ">Note<small>Facultative : numéro d'inventaire, accessoire manquant…</small><input name="note" maxlength="120" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Matériel' : `Matériel · ${esc(p.prenom)}`, corps,
      `<button class="btn primaire" value="ok">${m ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${m ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`, (f, action) => {
        if (action === 'supprimer') {
          retenir(); p.materiel = p.materiel.filter((x) => x.id !== m.id);
          sauver(); rendre(); toast(`« ${m.nom} » retiré de la liste.`, { libelle: 'Annuler', faire: annuler }); return;
        }
        const nom = String(f.get('nom') || '').trim();
        if (!nom) return 'Indique le matériel.';
        const restitueLe = p.sens === 'depart' ? (f.get('restitueLe') || null) : (m?.restitueLe || null);
        const donnees = R.normaliserMateriel({ id: m?.id || uid(), nom, remisLe: f.get('remisLe') || null, etat: f.get('etat'), restitueLe, etatRetour: p.sens === 'depart' ? (f.get('etatRetour') || (restitueLe ? 'bon' : null)) : m?.etatRetour, note: f.get('note') });
        retenir();
        if (m) Object.assign(m, donnees); else p.materiel.push(donnees);
        sauver(); rendre(); toast(m ? `« ${nom} » enregistré.` : `« ${nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
      });
  }

  // Restitution (départ) ou remise (arrivée) en un geste : date du jour modifiable, état.
  function modaleMouvement(pid, mid, type) {
    const p = personne(pid);
    const m = p?.materiel.find((x) => x.id === mid);
    if (!m) return;
    const rendu = type === 'restituer';
    ouvrirModale(rendu ? `${esc(m.nom)} rendu` : `${esc(m.nom)} remis`, `
      <div class="rang-champs">
        <label class="champ">${rendu ? 'Rendu le' : 'Remis le'}<input type="date" name="date" value="${auj()}" required></label>
        <label class="champ">État<select name="etat">${B.etatsMateriel.map((e) => `<option value="${e.id}" ${e.id === (rendu ? (m.etat === 'neuf' ? 'bon' : m.etat) : m.etat) ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
      </div><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Confirmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!f.get('date')) return 'Choisis la date.';
      retenir();
      if (rendu) { m.restitueLe = f.get('date'); m.etatRetour = f.get('etat'); } else { m.remisLe = f.get('date'); m.etat = f.get('etat'); }
      sauver(); rendre(); toast(`« ${m.nom} » ${rendu ? 'rendu' : 'remis'} le ${dateCourte(f.get('date'))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePreparerDepart(pid) {
    const p = personne(pid);
    if (!p) return;
    ouvrirModale(`Préparer le départ · ${esc(p.prenom)}`, `
      <p>Crée la fiche de départ avec les mêmes informations et les mêmes profils. Le matériel remis (${pluriel(p.materiel.filter((m) => m.remisLe && m.etat !== 'perdu').length, 'objet')}) passe dans la liste « à restituer ».</p>
      <label class="champ">Dernier jour<input type="date" name="date" value="${ajout(auj(), 30)}" required></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Créer le départ</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!f.get('date')) return 'Choisis le dernier jour.';
      retenir();
      const d = R.normaliserPersonne(R.departDepuis(p, f.get('date'), E.modeles), auj());
      E.personnes.push(d);
      sauver(); changerVue('personnes', d.id);
      toast(`Départ de ${p.prenom} : ${pluriel(d.taches.length, 'tâche')}, ${pluriel(d.materiel.length, 'objet')} à restituer.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleRepere(r) {
    const x = B.reperes[r];
    if (!x) return;
    ouvrirModale(esc(x.titre), `<p>${esc(x.texte)}</p><p class="mention">${esc(x.source)}</p><p class="mention">Repère général, à vérifier : ta convention collective, ton contrat et les textes font foi.</p>`, '<button class="btn primaire" value="ok">Fermer</button>');
  }

  function cocher(pid, tid, statut) {
    const p = personne(pid);
    const k = p?.taches.find((x) => x.id === tid);
    if (!k) return;
    retenir();
    const avant = k.statut;
    k.statut = k.statut === statut ? 'afaire' : statut;
    k.faitLe = k.statut === 'afaire' ? null : auj();
    sauver(); rendre();
    const pr = R.progression(p, auj());
    const msg = k.statut === 'fait' ? `Fait : ${k.titre.slice(0, 60)}${k.titre.length > 60 ? '…' : ''} (${p.prenom}, ${pr.pct} %).` : k.statut === 'so' ? 'Tâche sans objet pour ce parcours.' : `Tâche remise à faire${avant === 'so' ? ' (elle compte de nouveau)' : ''}.`;
    toast(R.termine(p, auj()) ? `Parcours de ${p.prenom} terminé.` : msg, { libelle: 'Annuler', faire: annuler });
  }

  function effacerPersonne(pid) {
    const p = personne(pid);
    if (!p) return;
    if (!confirm(`Effacer la fiche de ${p.prenom} (${LIB_SENS[p.sens].toLowerCase()} du ${dateLongue(p.date)}) ? Ses tâches et son matériel sont effacés de ce suivi.`)) return;
    retenir();
    E.personnes = E.personnes.filter((x) => x.id !== pid);
    E.personnes.forEach((x) => { if (x.lieeA === pid) x.lieeA = null; });
    sauver(); changerVue('personnes');
    toast(`Fiche de ${p.prenom} effacée.`, { libelle: 'Annuler', faire: annuler });
  }

  function effacerTermines() {
    const l = R.aEffacer(E.personnes, auj(), E.reglages.effacementJours);
    if (!l.length) return;
    if (!confirm(`Effacer ${pluriel(l.length, 'fiche terminée', 'fiches terminées')} (${l.map((p) => p.prenom).join(', ')}) ?`)) return;
    retenir();
    const ids = new Set(l.map((p) => p.id));
    E.personnes = E.personnes.filter((p) => !ids.has(p.id));
    E.personnes.forEach((x) => { if (ids.has(x.lieeA)) x.lieeA = null; });
    sauver(); rendre();
    toast(`${pluriel(l.length, 'fiche effacée', 'fiches effacées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Récapitulatif imprimable ----------
  function imprimerFiche(pid) {
    const p = personne(pid);
    if (!p) return;
    const t = auj();
    const pr = R.progression(p, t);
    const phases = R.PHASES[p.sens].map((ph) => ({ ph, taches: p.taches.filter((k) => R.phase(k.j, p.sens).id === ph.id) })).filter((g) => g.taches.length);
    const statut = (k) => ({ fait: `Fait${k.faitLe ? ` le ${dateCourte(k.faitLe)}` : ''}`, so: 'Sans objet', retard: 'En retard', semaine: 'Cette semaine', avenir: 'À faire' })[R.statutTache(k, p, t)];
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    el.innerHTML = `
      <header><p>${esc(E.entreprise || 'Onboarding et offboarding')} · récapitulatif au ${dateLongue(t)}</p><h1>${LIB_SENS[p.sens]} · ${esc(p.prenom)}</h1>
      <p>${esc([p.poste, p.contrat, p.service].filter(Boolean).join(' · '))}${p.manager ? ` · Manager : ${esc(p.manager)}` : ''}</p>
      <p>${LIB_DATE[p.sens]} ${dateLongue(p.date)} · ${pr.pct} % fait (${pr.fait} sur ${pr.total - pr.so} applicables)${pr.retard ? ` · ${pluriel(pr.retard, 'tâche')} en retard` : ''}</p></header>
      ${phases.map(({ ph, taches }) => `<h2>${ph.nom}</h2><table><thead><tr><th>J</th><th>Échéance</th><th>Tâche</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>${taches.map((k) => `<tr class="${R.statutTache(k, p, t)}"><td>${libJ(k.j)}</td><td>${dateCourte(R.echeance(p, k))}</td><td>${esc(k.titre)}${k.note ? `<br><small>${esc(k.note)}</small>` : ''}</td><td>${esc(nomResp(k.resp))}</td><td>${statut(k)}</td></tr>`).join('')}</tbody></table>`).join('')}
      ${p.materiel.length ? `<h2>Matériel</h2><table><thead><tr><th>Matériel</th><th>Remis le</th><th>État</th>${p.sens === 'depart' ? '<th>Rendu le</th><th>État au retour</th>' : ''}</tr></thead><tbody>${p.materiel.map((m) => `<tr><td>${esc(m.nom)}${m.note ? `<br><small>${esc(m.note)}</small>` : ''}</td><td>${m.remisLe ? dateCourte(m.remisLe) : '—'}</td><td>${esc(nomEtat(m.etat))}</td>${p.sens === 'depart' ? `<td>${m.restitueLe ? dateCourte(m.restitueLe) : 'Non rendu'}</td><td>${m.etatRetour ? esc(nomEtat(m.etatRetour)) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table>` : ''}
      <p class="signatures"><span>Visa RH</span><span>Visa manager</span><span>Visa ${p.sens === 'arrivee' ? 'de la personne accueillie' : 'de la personne qui part'}</span></p>
      <p class="mention">Données minimales. Document interne : ne pas le laisser circuler hors des personnes concernées.</p>`;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const nbTaches = E.modeles.reduce((s, m) => s + m.arrivee.length + m.depart.length, 0);
    const corps = `
      <label class="champ">Entreprise ou service<small>Facultatif, affiché sur le tableau de bord et les récapitulatifs.</small><input name="entreprise" maxlength="60" value="${esc(E.entreprise)}"></label>
      <label class="champ">Proposer d'effacer un parcours terminé après<small>Nombre de jours après sa dernière échéance (0 à 365). Données minimales, durée minimale.</small><input type="number" name="effacementJours" min="0" max="365" step="1" value="${E.reglages.effacementJours}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique ni lien vers un logiciel RH : exporte en tableur ou imprime le récapitulatif d'une personne depuis sa fiche (impression ou PDF).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Tâches en CSV</button><button class="btn petit" type="button" data-action="csv-materiel">Matériel en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tu es responsable des données que tu saisis sur tes salariés. Cet outil est conçu pour le minimum : prénom et initiale, poste, contrat, service, dates, matériel. N'y mets ni santé, ni salaire, ni adresse, ni motif de départ. Efface chaque fiche une fois le parcours terminé ; informe les personnes concernées selon tes règles internes. ${esc(B.reperes.rgpd.source)}</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Modèles : ${E.modeles.length} profils, ${nbTaches} tâches (base intégrée version ${B.version}, rédigée pour QME). ${esc(B.sourceReperes)} Aucune intégration à un logiciel RH, aucun envoi d'e-mail : tu gardes la main.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = Math.round(Number(f.get('effacementJours')));
      if (!(n >= 0 && n <= 365)) return 'Le délai doit être entre 0 et 365 jours.';
      E.entreprise = String(f.get('entreprise') || '').trim();
      E.reglages.effacementJours = n;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.personnes)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.personnes.length, 'parcours', 'parcours')}) ?`)) return;
        E = normaliser(d); delete E.majLe; fiche = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `onboarding-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E.personnes, nomResp, auj()), 'text/csv;charset=utf-8', `onboarding-taches-${auj()}.csv`);
  const exporterCsvMateriel = () => telecharger(R.versCsvMateriel(E.personnes, nomEtat, auj()), 'text/csv;charset=utf-8', `onboarding-materiel-${auj()}.csv`);

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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); fiche = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'choisir-profil': if (el.checked) accueil.profils.add(el.value); else accueil.profils.delete(el.value); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'fiche': changerVue('personnes', id); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'csv-materiel': exporterCsvMateriel(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modalePersonne(null, el.dataset.sens); break;
      case 'modifier-personne': modalePersonne(id); break;
      case 'preparer-depart': modalePreparerDepart(id); break;
      case 'imprimer-fiche': imprimerFiche(id); break;
      case 'effacer-personne': effacerPersonne(id); break;
      case 'effacer-termines': effacerTermines(); break;
      case 'cocher': cocher(id, el.dataset.tache, 'fait'); break;
      case 'sans-objet': cocher(id, el.dataset.tache, 'so'); break;
      case 'tache': modaleTache(id, el.dataset.tache); break;
      case 'nouvelle-tache': modaleTache(id, null); break;
      case 'repere': modaleRepere(el.dataset.r); break;
      case 'nouveau-materiel': modaleMateriel(id, null); break;
      case 'materiel': modaleMateriel(id, el.dataset.mat); break;
      case 'remettre': modaleMouvement(id, el.dataset.mat, 'remettre'); break;
      case 'restituer': modaleMouvement(id, el.dataset.mat, 'restituer'); break;
      case 'filtre': filtre.personnes = el.dataset.filtre; rendre(); break;
      case 'filtre-resp': filtre.resp = el.dataset.resp; rendre(); break;
      case 'choisir-modele': filtre.modele = el.dataset.modele; rendre(); break;
      case 'sens-modele': filtre.sensModele = el.dataset.sens; rendre(); break;
      case 'tache-modele': modaleTacheModele(el.dataset.modele, el.dataset.tache); break;
      case 'nouvelle-tache-modele': modaleTacheModele(el.dataset.modele, null); break;
      case 'retirer-tache-modele': retirerTacheModele(el.dataset.modele, el.dataset.tache); break;
      case 'nouveau-profil': modaleProfil(null); break;
      case 'modifier-profil': modaleProfil(el.dataset.modele); break;
      case 'supprimer-profil': { const m = modele(el.dataset.modele); if (m && !m.fixe && confirm(`Supprimer le profil « ${m.nom} » ? Les parcours déjà créés gardent leurs tâches.`)) { retenir(); E.modeles = E.modeles.filter((x) => x.id !== m.id); filtre.modele = 'commun'; sauver(); rendre(); toast(`Profil « ${m.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'reinit-modeles': if (confirm('Remplacer tes modèles par ceux d\'origine ? Les parcours déjà créés ne changent pas.')) { retenir(); E.modeles = R.modelesDepuisBase(B.profils); filtre.modele = 'commun'; sauver(); rendre(); toast('Modèles d\'origine rétablis.', { libelle: 'Annuler', faire: annuler }); } break;
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
  window.__onboarding = { etat: () => E, regles: R };
  init();
})();
