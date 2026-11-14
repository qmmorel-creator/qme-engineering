// Suivi du temps passé et rentabilité par mission QME : chronomètre ou saisie rapide, temps facturable ou non,
// missions au forfait ou en régie avec budget et avancement, taux horaire effectif comparé au TJM cible, au
// devis et au coût de revient, alertes de dépassement, semaine type, rapport client imprimable, export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucun lien avec un agenda, une banque ou un
// logiciel de facturation : chaque temps se saisit ici.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.TMP;
  const API = '/api/templates';
  const PRODUIT = 'TMP';
  const CLE_CODE = 'qme-tmp-code';
  const CLE_CACHE = 'qme-tmp-cache';
  const CLE_DEMO = 'qme-tmp-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-tmp-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { duree, euros, pct, fini } = R;
  const aujIso = () => R.iso(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const categorie = (id) => B.categories.find((c) => c.id === id) || { id, nom: id || 'Autre', facturable: true };
  const couleurMission = (m) => B.couleurs[(m?.couleur ?? 0) % B.couleurs.length];
  const tauxH = (v) => (fini(v) ? `${R.nombre(v, 0)} €/h` : '–');
  const heuresTxt = (min) => (fini(min) ? `${R.nombre(min / 60, min % 60 ? 1 : 0)} h` : '–');
  const libCible = (e) => { const m = R.mission(E, e.mission); return m ? m.nom : categorie(e.categorie).nom; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'jour';
  let jourVu = null;          // date affichée dans Aujourd'hui
  let lundiVu = null;         // semaine affichée
  let missionVue = null;      // fiche mission ouverte
  let filtreMissions = 'en-cours';
  let periodeNom = 'mois';
  const rapportOpt = { cible: '', du: null, au: null, nonFact: false, montants: false };   // du/au null : mois courant ; '' : sans borne
  let saisieRapide = { cible: '', tache: '', facturable: true };
  let annulation = null;

  const normaliser = (d) => R.normaliser(d);
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
        toast('Un autre appareil a modifié tes temps entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
        if (!modale().open && !saisieEnCours()) rendre();
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
  // Code interne (TMP-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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

  const dejaCommence = (x) => x && (x.missions.length || x.entrees.length || x.tjm || x.chrono);
  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (dejaCommence(E)) { cache(false); demarrer(); } else { E = null; ecranAccueil(); }
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
    arreterTic();
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Freelance fictif « Studio Exemple » (TJM cible 560 €, 7 h par jour, coût de revient 45 €/h), six semaines
  // de saisies jusqu'à aujourd'hui, clients fictifs. États forcés : forfait dépassé (avec une reprise offerte),
  // régie à surveiller, forfait qui dérive et passe sous le coût de revient, formation terminée sous la cible,
  // audit rentable, maintenance en régie sous la cible, temps interne non facturable, chronomètre en cours.
  function donneesDemo() {
    const e = R.etatVide();
    Object.assign(e, { activite: 'Studio Exemple', tjm: 560, heuresJour: 7, coutHeure: 45, seuilVigilance: 80, objectifFacturable: 70, arrondi: 5 });
    const auj = aujIso();
    const J = (n) => R.ajoutJours(auj, n);
    const modele = (id) => B.modeles.find((m) => m.id === id).taches.map(([nom, categorie]) => ({ id: R.nouvelId(), nom, categorie }));
    const mk = (o) => R.normaliserMission({ id: R.nouvelId(), taches: modele(o.modele), ...o });
    const site = mk({ nom: 'Refonte du site vitrine', client: 'Boulangerie Exemple', modele: 'site', mode: 'forfait', montant: 4200, budget: 8, uniteBudget: 'jour', avancement: 85, couleur: 0, debut: J(-36) });
    const regie = mk({ nom: 'Accompagnement produit', client: 'Société Fictive', modele: 'regie', mode: 'regie', taux: 600, uniteTaux: 'jour', budget: 12, uniteBudget: 'jour', couleur: 1, debut: J(-30) });
    const audit = mk({ nom: 'Audit d\'accessibilité', client: 'Association Démo', modele: 'conseil', mode: 'forfait', montant: 1800, budget: 3, uniteBudget: 'jour', avancement: 50, couleur: 2, debut: J(-12) });
    const form = mk({ nom: 'Formation équipe marketing', client: 'Cabinet Imaginaire', modele: 'formation', mode: 'forfait', montant: 1500, budget: 2, uniteBudget: 'jour', avancement: 100, statut: 'terminee', couleur: 3, debut: J(-41), fin: J(-27) });
    const maint = mk({ nom: 'Maintenance mensuelle', client: 'Boulangerie Exemple', modele: 'libre', mode: 'regie', taux: 65, uniteTaux: 'heure', budget: 10, uniteBudget: 'heure', couleur: 4, debut: J(-41) });
    const logo = mk({ nom: 'Identité visuelle', client: 'Atelier Exemple', modele: 'design', mode: 'forfait', montant: 900, budget: 12, uniteBudget: 'heure', avancement: 20, couleur: 5, debut: J(-4) });
    e.missions = [site, regie, audit, logo, maint, form];
    // Plans : [mission, premier jour, dernier jour, minutes à répartir, notes]
    const plans = [
      [form, -41, -28, 19 * 60, ['Supports de la session', 'Session 1', 'Session 2', 'Questionnaire de satisfaction']],
      [site, -36, -7, 56 * 60, ['Atelier de cadrage', 'Arborescence', 'Gabarits', 'Pages produits', 'Recette avec la cliente', 'Retours sur la page contact']],
      [regie, -30, -1, 60 * 60, ['Priorisation du backlog', 'Point hebdomadaire', 'Ateliers utilisateurs', 'Compte rendu']],
      [audit, -10, -1, 9 * 60, ['Entretiens', 'Parcours testés', 'Grille d\'audit'], 3],
      [logo, -4, -1, 6 * 60, ['Recherches', 'Trois pistes', 'Échange avec la cliente'], 2],
      [maint, -41, -2, 4 * 60, ['Mises à jour', 'Sauvegarde', 'Correction formulaire']],
    ];
    let graine = 20261114;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const quart = (v) => Math.max(15, Math.round(v / 15) * 15);
    const ouvre = (d) => R.rangJour(d) < 5;
    const ouvreAvant = (n) => { while (!ouvre(J(n))) n--; return n; };
    const entrees = [];
    const ajouter = (date, m, t, minutes, facturable, note, cat) => entrees.push({ id: R.nouvelId(), date, mission: m?.id || null, tache: t?.id || null, categorie: cat || t?.categorie || 'realisation', minutes, facturable, note });
    const parJour = new Map();
    for (const [m, de, a, total, notes, nbT] of plans) {
      const jours = [];
      for (let d = de; d <= a; d++) if (ouvre(J(d))) jours.push(d);
      if (m === maint) jours.splice(0, jours.length, ...jours.filter((_, i) => i % 7 === 0));
      if (m === form) jours.splice(0, jours.length, ...jours.filter((_, i) => i % 2 === 0));
      let reste = total;
      jours.forEach((d, i) => {
        const part = i === jours.length - 1 ? reste : quart((reste / (jours.length - i)) * (0.75 + alea() * 0.5));
        if (part <= 0) return;
        reste -= part;
        const nt = nbT || m.taches.length;
        const t = m.taches[Math.min(nt - 1, Math.floor((i / jours.length) * nt))];
        ajouter(J(d), m, t, part, true, notes[Math.min(notes.length - 1, Math.floor((i / jours.length) * notes.length))]);
        parJour.set(d, (parJour.get(d) || 0) + part);
      });
    }
    // Temps offert : reprise sur le site, réunion de lancement non facturée en régie.
    ajouter(J(ouvreAvant(-6)), site, site.taches[4], 150, false, 'Corrections hors devis', 'reprise');
    ajouter(J(ouvreAvant(-3)), site, site.taches[4], 90, false, 'Ajustements demandés après recette', 'reprise');
    ajouter(J(ouvreAvant(-29)), regie, regie.taches[1], 180, false, 'Lancement offert', 'reunion');
    // Temps interne non facturable, pour compléter les journées de la semaine type.
    const internes = ['prospection', 'admin', 'avant-vente', 'facturation', 'compta', 'veille', 'communication', 'prospection', 'formation', 'admin'];
    const notesInternes = { prospection: 'Relances et rendez-vous découverte', admin: 'Courriels et classement', 'avant-vente': 'Devis site e-commerce', facturation: 'Factures du mois', compta: 'Justificatifs pour le comptable', veille: 'Veille outils', communication: 'Article de blog', formation: 'Formation accessibilité' };
    for (let d = -41, k = 0; d <= -1; d++) {
      if (!ouvre(J(d))) continue;
      const fait = parJour.get(d) || 0;
      const manque = 7.5 * 60 - fait;
      const cat = internes[k++ % internes.length];
      ajouter(J(d), null, null, quart(Math.max(60, Math.min(180, manque))), false, notesInternes[cat], cat);
    }
    // Aujourd'hui : deux saisies et le chronomètre en cours.
    ajouter(auj, null, null, 45, false, 'Courriels', 'admin');
    ajouter(auj, audit, audit.taches[2], 90, true, 'Rédaction des constats', 'livrables');
    e.entrees = entrees;
    e.chrono = { debut: Date.now() - 47 * 60000, mission: regie.id, tache: regie.taches[0].id, categorie: regie.taches[0].categorie, facturable: true, note: 'Ateliers utilisateurs' };
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi du temps et rentabilité · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="150" cy="160" r="120" fill="#1D4E89"/>
          <path d="M150 160 L150 40 A120 120 0 0 1 270 160 Z" fill="#F5B400"/>
          <rect x="140" y="70" width="20" height="100" fill="#F0EDE6"/>
          <rect x="120" y="10" width="60" height="18" fill="#141414"/>
          <rect x="320" y="200" width="60" height="80" fill="#D9302A"/>
          <rect x="396" y="140" width="60" height="140" fill="#F5B400"/>
          <rect x="472" y="90" width="60" height="190" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi du temps et rentabilité</p>
          <h1>Ce que tu gagnes vraiment de l'heure.</h1>
          <p>Le temps passé sur chaque mission, au chronomètre ou en une ligne, comparé à ton TJM, à ton devis et à ton coût de revient. Les dépassements se voient avant la fin.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi du temps</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes temps sont enregistrés en ligne et te suivent sur tous tes appareils, chronomètre compris.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi du temps</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/suivi-temps/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi du temps'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, activite: '', tjm: '', heuresJour: '7', coutHeure: '', semaine: 'cinq', mission: { nom: '', client: '', modele: 'conseil', mode: 'forfait', montant: '', budget: '' } });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes repères, en une minute.</h1>
        <p class="intro">Ton TJM cible et ton coût de revient servent de repères : chaque mission sera comparée à eux. Ils viennent de ton calcul de tarif (par exemple le Calculateur de TJM ou le Coût de revient QME) ; tout reste modifiable dans les réglages.</p>
        <div class="rang-champs" style="max-width:820px;margin-top:20px">
          <label class="champ">Ton activité <small>Facultatif, en tête des rapports.</small><input id="a-activite" value="${esc(a.activite)}" autocomplete="organization" maxlength="80" placeholder="Ex. : Studio Exemple"></label>
          <label class="champ">TJM cible (€ HT) <small>Le tarif journalier que tu vises.</small><input id="a-tjm" value="${esc(a.tjm)}" inputmode="decimal" placeholder="Ex. : 550"></label>
          <label class="champ">Heures par jour <small>Pour passer des jours aux heures.</small><input id="a-hj" value="${esc(a.heuresJour)}" inputmode="decimal"></label>
          <label class="champ">Coût de revient (€/h) <small>Facultatif : ton prix plancher.</small><input id="a-cout" value="${esc(a.coutHeure)}" inputmode="decimal" placeholder="Ex. : 45"></label>
        </div>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0"><legend>Ta semaine type <small>Les heures que tu prévois de travailler : chaque journée s'y compare.</small></legend>
          <div class="choix-activite">${B.semaines.map((s) => `<label><input type="radio" name="semaine" value="${s.id}" ${s.id === a.semaine ? 'checked' : ''}><span><b>${esc(s.nom)}</b><small>${R.nombre(s.heures.reduce((x, y) => x + y, 0), 0)} h par semaine</small></span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Ma première mission</button></div>`;
    } else {
      const m = a.mission;
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta première mission</h1>
        <p class="intro">Un forfait (montant du devis) ou une régie (taux par jour ou par heure), et le budget en temps. Le modèle ajoute des tâches types, modifiables ensuite. Tu peux aussi passer cette étape.</p>
        <div class="rang-champs" style="max-width:820px;margin-top:20px">
          <label class="champ">Nom de la mission<input id="m-nom" value="${esc(m.nom)}" maxlength="120" placeholder="Ex. : Refonte du site"></label>
          <label class="champ">Client<input id="m-client" value="${esc(m.client)}" maxlength="80" placeholder="Ex. : Société Exemple"></label>
          <label class="champ">Modèle<select id="m-modele">${B.modeles.map((x) => `<option value="${x.id}" ${x.id === m.modele ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        </div>
        <div class="rang-champs" style="max-width:820px;margin-top:16px">
          <fieldset class="champ" style="border:0;padding:0;margin:0"><legend>Facturation</legend><div class="choix-statut deux">${Object.entries(R.MODES).map(([k, l]) => `<label><input type="radio" name="m-mode" value="${k}" ${m.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
          <label class="champ">${m.mode === 'regie' ? 'Taux par jour (€ HT)' : 'Montant du devis (€ HT)'}<input id="m-montant" value="${esc(m.montant)}" inputmode="decimal"></label>
          <label class="champ">Budget (jours)<input id="m-budget" value="${esc(m.budget)}" inputmode="decimal" placeholder="Ex. : 5"></label>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-fin" data-sans="1">Passer</button><button class="btn primaire" data-action="accueil-fin">Commencer</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lie = (sel, f) => $(sel)?.addEventListener('input', (e) => f(e.target.value));
    lie('#a-activite', (v) => { a.activite = v; }); lie('#a-tjm', (v) => { a.tjm = v; }); lie('#a-hj', (v) => { a.heuresJour = v; }); lie('#a-cout', (v) => { a.coutHeure = v; });
    lie('#m-nom', (v) => { a.mission.nom = v; }); lie('#m-client', (v) => { a.mission.client = v; }); lie('#m-montant', (v) => { a.mission.montant = v; }); lie('#m-budget', (v) => { a.mission.budget = v; });
    $('#m-modele')?.addEventListener('change', (e) => { a.mission.modele = e.target.value; a.mission.mode = B.modeles.find((x) => x.id === e.target.value).mode; ecranAccueil(); });
    document.querySelectorAll('[name=semaine]').forEach((el) => el.addEventListener('change', () => { a.semaine = el.value; }));
    document.querySelectorAll('[name=m-mode]').forEach((el) => el.addEventListener('change', () => { a.mission.mode = el.value; ecranAccueil(); }));
  }

  function verifierAccueil() {
    const a = accueil;
    if (a.tjm.trim() && !(R.lireNombre(a.tjm) > 0)) return 'Le TJM cible n\'est pas un nombre.';
    const hj = R.lireNombre(a.heuresJour);
    if (!(hj >= 1 && hj <= 24)) return 'Les heures par jour vont de 1 à 24.';
    if (a.coutHeure.trim() && !(R.lireNombre(a.coutHeure) > 0)) return 'Le coût de revient n\'est pas un nombre.';
    return '';
  }

  function terminerAccueil(sansMission) {
    const a = accueil;
    E = R.normaliser({ activite: a.activite.trim(), tjm: a.tjm, heuresJour: a.heuresJour, coutHeure: a.coutHeure, semaineType: B.semaines.find((s) => s.id === a.semaine).heures });
    if (!sansMission && a.mission.nom.trim()) {
      const mo = B.modeles.find((x) => x.id === a.mission.modele);
      E.missions.push(R.normaliserMission({ nom: a.mission.nom.trim(), client: a.mission.client.trim(), mode: a.mission.mode, montant: a.mission.mode === 'forfait' ? a.mission.montant : null, taux: a.mission.mode === 'regie' ? a.mission.montant : null, uniteTaux: 'jour', budget: a.mission.budget, uniteBudget: 'jour', couleur: 0, debut: aujIso(), taches: mo.taches.map(([nom, categorie]) => ({ nom, categorie })) }));
    } else if (!sansMission && !a.mission.nom.trim()) { toast('Donne un nom à la mission, ou passe cette étape.'); return; }
    accueil = accueilVide();
    vue = 'jour';
    sauver();
    demarrer();
    toast(E.missions.length ? 'C\'est parti : lance le chronomètre ou saisis ton premier temps.' : 'C\'est parti : crée ta première mission dans l\'onglet Missions.');
  }

  // ---------- Icônes ----------
  const ICONES = {
    jour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13V8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="9" y="2" width="6" height="2.4" fill="currentColor"/></svg>',
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="4" fill="currentColor"/><rect x="6" y="12" width="3" height="3" fill="currentColor"/><rect x="11" y="12" width="3" height="3" fill="currentColor"/><rect x="16" y="12" width="3" height="3" fill="currentColor"/></svg>',
    missions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="15" height="4" fill="currentColor"/></svg>',
    rentabilite: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="5" height="8" fill="currentColor"/><rect x="10" y="8" width="5" height="13" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="5" height="18" fill="currentColor"/></svg>',
    rapport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4v16l13-8Z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    imprimer: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="3" width="12" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="9" width="18" height="8" fill="currentColor"/><rect x="7" y="14" width="10" height="7" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ICONE_STATUT = {
    ok: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.2 7 10.6l4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vigilance: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1 15.5 15H.5Z" fill="currentColor"/><rect x="7.1" y="5.5" width="1.8" height="5" fill="#fff"/><rect x="7.1" y="11.6" width="1.8" height="1.8" fill="#fff"/></svg>',
    alerte: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect width="16" height="16" rx="3" fill="currentColor"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    neutre: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4.5" y="7" width="7" height="2" fill="currentColor"/></svg>',
  };
  const NIVEAU_BUDGET = { ok: 'ok', vigilance: 'vigilance', depasse: 'alerte', 'sans-budget': 'neutre' };
  const NIVEAU_TAUX = { 'au-dessus': 'ok', 'sous-cible': 'vigilance', 'sous-plancher': 'alerte', 'sans-cible': 'neutre', 'sans-temps': 'neutre' };
  const statut = (niveau, lib) => `<span class="statut st-${niveau}">${ICONE_STATUT[niveau]}<span>${esc(lib)}</span></span>`;
  const statutBudget = (s) => statut(NIVEAU_BUDGET[s], R.LIB_BUDGET[s]);
  const statutTaux = (s) => statut(NIVEAU_TAUX[s], R.LIB_TAUX[s]);
  const pastille = (couleur, forme = 'rond') => `<svg class="pastille-m" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">${forme === 'carre' ? `<rect width="12" height="12" rx="2" fill="${couleur}"/>` : `<circle cx="6" cy="6" r="6" fill="${couleur}"/>`}</svg>`;
  const pastilleEntree = (e) => { const m = R.mission(E, e.mission); return m ? pastille(couleurMission(m)) : pastille('#B5AC9C', 'carre'); };
  const MESSAGES_ALERTE = {
    depasse: (b) => `Budget dépassé : ${duree(b.consomme)} passées pour ${duree(b.budget)} prévues (${pct(b.conso)}).`,
    vigilance: (b) => `${pct(b.conso)} du budget consommé, ${duree(Math.max(0, b.restant))} restantes.`,
    derive: (b) => `Le temps consommé (${pct(b.conso)}) devance l'avancement (${pct(b.avancement)}).`,
    prevu: (b) => `À ce rythme, ${duree(b.estimation)} au total : ${duree(b.depassementPrevu)} au-delà du budget${b.m.mode === 'forfait' && fini(b.tauxFin) ? `, soit ${tauxH(b.tauxFin)} en fin de mission` : ''}.`,
  };

  const ONGLETS = [['jour', 'Aujourd\'hui', 'Jour'], ['semaine', 'Semaine', 'Semaine'], ['missions', 'Missions', 'Missions'], ['rentabilite', 'Rentabilité', 'Rentab.'], ['rapport', 'Rapport', 'Rapport']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil de gestion du temps, pas un logiciel de facturation ni un conseil : les montants sont hors taxes et ceux que tu saisis, la valeur d\'un forfait est répartie au prorata du temps passé. Ton TJM cible et ton coût de revient sont tes propres repères ; aucun tarif de marché n\'est intégré.</p>';

  // ---------- Application ----------
  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    jourVu = jourVu || aujIso();
    lundiVu = lundiVu || R.lundi(aujIso());
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/suivi-temps/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi<br>du temps</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom, court]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span><span class="court">${court}</span></button>`).join('')}</nav>
        <button class="chrono-barre" data-action="vue" data-vue="jour" hidden><i aria-hidden="true"></i><b></b></button>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    demarrerTic();
    proposerEcranAccueil();
  }

  const saisieEnCours = () => document.activeElement?.matches?.('input:not([type=checkbox]),textarea,select');

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS.map(([id, nom]) => [id, nom]));
    document.title = `${titres[vue]} · Suivi du temps`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { jour: vueJour, semaine: vueSemaine, missions: vueMissions, rentabilite: vueRentabilite, rapport: vueRapport }[vue]();
    brancherVue();
    majChrono();
  }

  function changerVue(v, { haut = true } = {}) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    if (haut) window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Chronomètre ----------
  let tic = null;
  function demarrerTic() { arreterTic(); tic = setInterval(majChrono, 15000); }
  function arreterTic() { clearInterval(tic); tic = null; }
  function majChrono() {
    const c = E?.chrono;
    const barre = $('.chrono-barre');
    const min = c ? R.minutesChrono(c, Date.now()) : 0;
    if (barre) { barre.hidden = !c || vue === 'jour'; if (c) barre.querySelector('b').textContent = duree(min); barre.setAttribute('aria-label', c ? `Chronomètre en cours : ${duree(min)}` : ''); }
    const el = $('[data-chrono-temps]');
    if (el && c) { const h = Math.floor(min / 60), m = min % 60; el.textContent = `${h}:${String(m).padStart(2, '0')}`; }
    const long = $('[data-chrono-long]');
    if (long) long.hidden = !(c && min >= (B.defauts.chronoLong * 60));
  }

  // Liste des cibles d'une saisie : missions en cours, puis catégories internes (non facturables).
  function optionsCible(sel, { toutes = false } = {}) {
    const missions = E.missions.filter((m) => toutes || m.statut === 'en-cours' || `m:${m.id}` === sel);
    const internes = B.categories.filter((c) => !c.facturable && c.id !== 'reprise');
    return `${missions.length ? `<optgroup label="Missions">${missions.map((m) => `<option value="m:${m.id}" ${sel === `m:${m.id}` ? 'selected' : ''}>${esc(m.nom)}${m.client ? ` · ${esc(m.client)}` : ''}</option>`).join('')}</optgroup>` : ''}
      <optgroup label="Temps interne (non facturable)">${internes.map((c) => `<option value="c:${c.id}" ${sel === `c:${c.id}` ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</optgroup>`;
  }
  function optionsTache(cible, sel) {
    const m = cible?.startsWith('m:') ? R.mission(E, cible.slice(2)) : null;
    if (!m) return '<option value="">—</option>';
    return `<option value="">Sans tâche</option>${m.taches.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}`;
  }
  // Valeur par défaut de « facturable » selon la cible et la tâche choisies.
  function facturableParDefaut(cible, idTache) {
    if (!cible?.startsWith('m:')) return false;
    const t = R.tache(R.mission(E, cible.slice(2)), idTache);
    return t ? categorie(t.categorie).facturable : true;
  }
  const cibleParDefaut = () => { const m = E.missions.find((x) => x.statut === 'en-cours'); return m ? `m:${m.id}` : 'c:admin'; };
  function lireCible(cible, idTache) {
    if (cible?.startsWith('m:')) {
      const m = R.mission(E, cible.slice(2));
      const t = R.tache(m, idTache);
      return { mission: m?.id || null, tache: t?.id || null, categorie: t?.categorie || 'realisation' };
    }
    return { mission: null, tache: null, categorie: cible?.slice(2) || 'admin' };
  }

  // ---------- Vue : Aujourd'hui ----------
  function blocChrono() {
    const c = E.chrono;
    if (c) {
      const m = R.mission(E, c.mission);
      const t = R.tache(m, c.tache);
      return `<section class="chrono en-cours" aria-label="Chronomètre">
        <div class="chrono-tete"><span class="surtitre">Chronomètre en cours</span><span class="chrono-depuis">depuis ${new Date(c.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <p class="chrono-temps" data-chrono-temps aria-live="off">0:00</p>
        <p class="chrono-quoi">${m ? pastille(couleurMission(m)) : pastille('#B5AC9C', 'carre')} <b>${esc(m ? m.nom : categorie(c.categorie).nom)}</b>${t ? ` · ${esc(t.nom)}` : ''}${c.note ? ` · ${esc(c.note)}` : ''} ${c.facturable ? '<span class="etiquette ciel">Facturable</span>' : '<span class="etiquette sable">Non facturable</span>'}</p>
        <p class="aide" data-chrono-long hidden>Plus de ${B.defauts.chronoLong} heures : chronomètre oublié ? Arrête-le puis corrige la durée de la saisie.</p>
        <div class="rang"><button class="btn primaire" data-action="chrono-stop">${ICONES.stop} Arrêter et enregistrer</button><button class="btn lien" data-action="chrono-annuler">Annuler sans enregistrer</button></div>
        ${E.arrondi ? `<p class="mention">Durée arrondie aux ${E.arrondi} minutes les plus proches à l'arrêt.</p>` : ''}
      </section>`;
    }
    const cible = saisieRapide.cible || cibleParDefaut();
    return `<section class="chrono" aria-label="Chronomètre">
      <div class="chrono-tete"><span class="surtitre">Chronomètre</span></div>
      <form id="form-chrono" class="ligne-saisie-temps" novalidate>
        <label class="champ">Sur quoi<select name="cible" data-cible>${optionsCible(cible)}</select></label>
        <label class="champ">Tâche<select name="tache" data-tache>${optionsTache(cible, saisieRapide.tache)}</select></label>
        <label class="champ large">Note<input name="note" maxlength="300" placeholder="Facultatif : maquettes de l'accueil…"></label>
        <label class="case"><input type="checkbox" name="facturable" data-facturable ${facturableParDefaut(cible, saisieRapide.tache) ? 'checked' : ''}> Facturable</label>
        <button class="btn primaire" type="submit">${ICONES.lecture} Démarrer</button>
      </form>
    </section>`;
  }

  function ligneEntree(e, { date = false, dansMission = false } = {}) {
    const m = R.mission(E, e.mission);
    const t = R.tache(m, e.tache);
    const titre = dansMission ? (t?.nom || categorie(e.categorie).nom) : libCible(e);
    const detail = dansMission ? [R.libDate(e.date, { annee: false, jour: true }), e.note] : [date ? R.libDate(e.date, { annee: false, jour: true }) : '', m?.client, t?.nom, e.note];
    return `<li class="entree"><button class="entree-corps" data-action="modifier-entree" data-id="${e.id}">
        ${pastilleEntree(e)}<span class="entree-texte"><b>${esc(titre)}</b><span>${detail.filter(Boolean).map(esc).join(' · ') || esc(categorie(e.categorie).nom)}</span></span>
      </button><span class="entree-droite"><b class="nb">${duree(e.minutes)}</b>${e.facturable ? '' : '<span class="etiquette sable">Non fact.</span>'}</span></li>`;
  }

  function vueJour() {
    const auj = aujIso();
    const liste = E.entrees.filter((e) => e.date === jourVu).sort((a, b) => a.id.localeCompare(b.id));
    const total = R.somme(liste), fact = R.somme(liste.filter((e) => e.facturable));
    const prevu = Math.round((E.semaineType[R.rangJour(jourVu)] || 0) * 60);
    const alertes = R.alertesMissions(E);
    const cible = saisieRapide.cible || cibleParDefaut();
    const sem = R.feuilleSemaine(E, R.lundi(jourVu));
    const nav = `<div class="choix-mois" role="group" aria-label="Jour affiché">
        <button type="button" class="btn-icone" data-action="jour" data-d="-1" aria-label="Jour précédent">‹</button>
        <label class="date-choisie"><span aria-hidden="true">${esc(R.JOURS_COURTS[R.rangJour(jourVu)])} ${esc(R.libDate(jourVu, { annee: false }))}</span><input type="date" id="choix-jour" value="${jourVu}" max="${auj}" aria-label="Choisir la date"></label>
        <button type="button" class="btn-icone" data-action="jour" data-d="1" aria-label="Jour suivant" ${jourVu >= auj ? 'disabled' : ''}>›</button>
      </div>`;
    return `
      <div class="vue-tete"><div><h1>${jourVu === auj ? 'Aujourd\'hui' : esc(R.libDate(jourVu, { jour: true }))}</h1><p>${jourVu === auj ? esc(R.libDate(jourVu, { jour: true })) + ' · ' : ''}${duree(total)} saisies${prevu ? ` sur ${duree(prevu)} prévues` : ''}, dont ${duree(fact)} facturables.</p></div>
        <div class="actions">${nav}${jourVu !== auj ? '<button class="btn petit" data-action="jour-auj">Aujourd\'hui</button>' : ''}</div></div>
      ${jourVu === auj ? blocChrono() : ''}
      <section class="saisie-rapide" aria-label="Saisir un temps">
        <h2 class="titre-section" style="margin-top:${jourVu === auj ? 28 : 0}px">Saisir un temps <span>« 1h30 », « 45 min », « 2 » ou « 1,5 ». Entrée pour enregistrer.</span></h2>
        <form id="form-rapide" class="ligne-saisie-temps" novalidate>
          <label class="champ">Sur quoi<select name="cible" data-cible>${optionsCible(cible)}</select></label>
          <label class="champ">Tâche<select name="tache" data-tache>${optionsTache(cible, saisieRapide.tache)}</select></label>
          <label class="champ etroit">Durée<input name="duree" inputmode="decimal" autocomplete="off" placeholder="1h30" required></label>
          <label class="champ large">Note<input name="note" maxlength="300" placeholder="Facultatif : ce que tu as fait"></label>
          <label class="case"><input type="checkbox" name="facturable" data-facturable ${facturableParDefaut(cible, saisieRapide.tache) ? 'checked' : ''}> Facturable</label>
          <button class="btn primaire" type="submit">${ICONES.plus} Ajouter</button>
        </form>
      </section>
      <div class="colonnes-jour">
        <section>
          <h2 class="titre-section">Saisies du jour <span>${pluriel(liste.length, 'saisie')}</span></h2>
          ${liste.length ? `<ul class="entrees">${liste.map((e) => ligneEntree(e)).join('')}</ul>
            <div class="jauge-jour" aria-label="Journée : ${duree(total)} sur ${duree(prevu)} prévues">${jauge(total, prevu, fact)}</div>` : `<div class="vide-etat petit"><div><h3>Rien de saisi ce jour-là</h3><p>Lance le chronomètre ou saisis une durée ci-dessus. Le temps interne (devis, administratif, prospection) compte aussi.</p></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Cette semaine <span>${duree(sem.total)} / ${duree(sem.prevu)}</span></h2>
          <div class="mini-semaine">${sem.jours.map((d, i) => `<button class="ms-jour ${d === jourVu ? 'actif' : ''}" data-action="aller-jour" data-date="${d}" ${d > auj ? 'disabled' : ''} aria-label="${esc(R.libDate(d, { jour: true }))} : ${duree(sem.totaux[i])}"><span class="ms-barre"><i style="height:${Math.min(100, sem.prevus[i] ? sem.totaux[i] / sem.prevus[i] * 100 : sem.totaux[i] ? 100 : 0)}%"></i></span><small>${R.JOURS_COURTS[i]}</small><b>${sem.totaux[i] ? heuresTxt(sem.totaux[i]) : '–'}</b></button>`).join('')}</div>
          <h2 class="titre-section">Missions à surveiller <span>${alertes.length || 'aucune'}</span></h2>
          ${alertes.length ? `<ul class="alertes-missions">${alertes.slice(0, 4).map((b) => `<li class="alerte-m niv-${b.alertes[0].niveau}"><button class="lien-ligne" data-action="fiche" data-id="${b.m.id}"><b>${pastille(couleurMission(b.m))} ${esc(b.m.nom)}</b><span>${esc(MESSAGES_ALERTE[b.alertes[0].code](b))}</span></button>${statutBudget(b.statutBudget)}</li>`).join('')}</ul>` : '<p class="mention">Toutes les missions en cours sont dans leur budget.</p>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Jauge : réalisé (facturable foncé, non facturable clair) face à un prévu (repère).
  function jauge(total, prevu, fact) {
    const max = Math.max(total, prevu, 1);
    return `<div class="jauge"><span class="j-fact" style="width:${fact / max * 100}%"></span><span class="j-nonfact" style="width:${(total - fact) / max * 100}%"></span>${prevu ? `<i class="j-repere" style="left:${prevu / max * 100}%"></i>` : ''}</div>
      <div class="legende-jauge"><span><i class="lg-fact"></i>Facturable ${duree(fact)}</span><span><i class="lg-nonfact"></i>Non facturable ${duree(total - fact)}</span>${prevu ? `<span><i class="lg-repere"></i>Prévu ${duree(prevu)}</span>` : ''}</div>`;
  }

  // ---------- Vue : Semaine ----------
  function vueSemaine() {
    const auj = aujIso();
    const f = R.feuilleSemaine(E, lundiVu);
    const nomLigne = (l) => { const m = R.mission(E, l.mission); return m ? `${pastille(couleurMission(m))} <span>${esc(m.nom)}<small>${esc(m.client)}</small></span>` : `${pastille('#B5AC9C', 'carre')} <span>${esc(categorie(l.categorie).nom)}<small>Interne</small></span>`; };
    const objectif = E.objectifFacturable / 100;
    const nonFact = R.synthesePeriode(E, { du: f.jours[0], au: f.jours[6] }).nonFactParCategorie;
    return `
      <div class="vue-tete"><div><h1>Semaine</h1><p>Du ${esc(R.libDate(f.jours[0], { annee: false }))} au ${esc(R.libDate(f.jours[6]))}.</p></div>
        <div class="actions"><div class="choix-mois" role="group" aria-label="Semaine affichée">
          <button type="button" class="btn-icone" data-action="semaine" data-d="-7" aria-label="Semaine précédente">‹</button><span class="exo-lib">${R.lundi(auj) === lundiVu ? 'Cette semaine' : `Sem. du ${esc(R.libDate(lundiVu, { annee: false }))}`}</span>
          <button type="button" class="btn-icone" data-action="semaine" data-d="7" aria-label="Semaine suivante" ${lundiVu >= R.lundi(auj) ? 'disabled' : ''}>›</button></div></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Temps saisi</p><b>${duree(f.total)}</b><span>${f.prevu ? `Semaine type : ${duree(f.prevu)} (${f.total >= f.prevu ? '+' : ''}${duree(f.total - f.prevu)})` : 'Pas de semaine type réglée'}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Part facturable</p><b>${pct(f.partFacturable)}</b><span>Objectif ${pct(objectif)} · ${duree(f.facturable)} facturables</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Non facturable</p><b>${duree(f.total - f.facturable)}</b><span>${nonFact[0] ? `Surtout : ${esc(categorie(nonFact[0].categorie).nom.toLowerCase())}` : 'Rien cette semaine'}</span></div>
      </div>
      <h2 class="titre-section">Feuille de temps <span>Touche un jour pour voir ou compléter ses saisies.</span></h2>
      ${f.lignes.length ? `<div class="defile"><table class="tableau feuille">
        <caption class="sr-only">Temps par mission et par jour</caption>
        <thead><tr><th>Mission ou temps interne</th>${f.jours.map((d, i) => `<th class="nb"><button class="lien-jour" data-action="aller-jour" data-date="${d}" ${d > auj ? 'disabled' : ''}>${R.JOURS_COURTS[i]} ${Number(d.slice(8))}</button></th>`).join('')}<th class="nb">Total</th></tr></thead>
        <tbody>${f.lignes.map((l) => `<tr><th scope="row"><div class="nom-ligne">${nomLigne(l)}</div></th>${l.jours.map((m) => `<td class="nb ${m ? '' : 'vide'}">${m ? heuresTxt(m) : '·'}</td>`).join('')}<td class="nb"><b>${heuresTxt(l.total)}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Réalisé</td>${f.totaux.map((m) => `<td class="nb">${m ? heuresTxt(m) : '–'}</td>`).join('')}<td class="nb">${heuresTxt(f.total)}</td></tr>
          <tr class="prevu"><td>Semaine type</td>${f.prevus.map((m) => `<td class="nb">${m ? heuresTxt(m) : '–'}</td>`).join('')}<td class="nb">${heuresTxt(f.prevu)}</td></tr></tfoot>
      </table></div>` : `<div class="vide-etat petit"><div><h3>Aucune saisie cette semaine</h3><p>Les temps saisis dans « Aujourd'hui » apparaissent ici, mission par mission.</p><div class="actions"><button class="btn" data-action="aller-jour" data-date="${f.jours[0] > auj ? auj : (f.jours[6] < auj ? f.jours[0] : auj)}">Saisir un temps</button></div></div></div>`}
      ${nonFact.length ? `<h2 class="titre-section">Temps non facturable de la semaine <span>Il doit être payé par tes missions.</span></h2>${barresCategories(nonFact)}` : ''}
      ${AVERTISSEMENT}`;
  }

  function barresCategories(liste) {
    const max = Math.max(...liste.map((x) => x.minutes), 1);
    const total = R.somme(liste);
    return `<div class="graphique"><div class="barres-cats" role="list">${liste.map((x) => `<div class="barre-cat" role="listitem"><span class="bc-nom">${esc(categorie(x.categorie).nom)}</span><span class="bc-piste"><span class="bc-barre nf" style="width:${x.minutes / max * 100}%"></span></span><span class="bc-val">${duree(x.minutes)} <small>${pct(x.minutes / total)}</small></span></div>`).join('')}</div></div>`;
  }

  // ---------- Vue : Missions ----------
  function jaugeMission(b) {
    if (!b.budget) return `<div class="jauge-m sans"><span class="nb">${duree(b.consomme)} passées · sans budget</span></div>`;
    const max = Math.max(b.consomme, b.budget, b.estimation || 0);
    const cls = b.statutBudget === 'depasse' ? 'depasse' : b.statutBudget === 'vigilance' ? 'vigilance' : '';
    return `<div class="jauge-m ${cls}" title="Consommé ${pct(b.conso)} du budget${b.avancement !== null ? `, avancement ${pct(b.avancement)}` : ''}">
      <div class="jm-piste"><span class="jm-budget" style="width:${b.budget / max * 100}%"></span>${b.estimation && b.estimation > b.consomme ? `<span class="jm-estim" style="width:${b.estimation / max * 100}%"></span>` : ''}<span class="jm-conso" style="width:${b.consomme / max * 100}%"></span>${b.avancement !== null ? `<i class="jm-av" style="left:${b.avancement * b.budget / max * 100}%"></i>` : ''}</div>
      <span class="nb">${duree(b.consomme)} / ${duree(b.budget)} · ${pct(b.conso)}${b.avancement !== null ? ` · avancement ${pct(b.avancement)}` : ''}</span></div>`;
  }

  function vueMissions() {
    if (missionVue && R.mission(E, missionVue)) return vueFicheMission(R.mission(E, missionVue));
    const tous = E.missions.map((m) => R.bilanMission(E, m));
    const filtres = [['en-cours', 'En cours'], ['terminee', 'Terminées'], ['archivee', 'Archivées'], ['', 'Toutes']];
    const liste = tous.filter((b) => !filtreMissions || b.m.statut === filtreMissions);
    const ordre = { depasse: 0, vigilance: 1, ok: 2, 'sans-budget': 3 };
    liste.sort((a, b) => ordre[a.statutBudget] - ordre[b.statutBudget] || b.derniere.localeCompare(a.derniere));
    return `
      <div class="vue-tete"><div><h1>Missions</h1><p>Budget consommé, avancement, estimation à terminaison et taux horaire effectif de chaque mission.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-mission">${ICONES.plus} Nouvelle mission</button></div></div>
      <div class="filtres" role="group" aria-label="Filtrer les missions">${filtres.map(([id, nom]) => `<button class="filtre" data-action="filtre-missions" data-f="${id}" aria-pressed="${filtreMissions === id}">${nom} <small>${tous.filter((b) => !id || b.m.statut === id).length}</small></button>`).join('')}</div>
      ${liste.length ? `<ul class="lignes-missions">${liste.map((b) => `<li class="ligne-mission st-${b.statutBudget}" style="--c:${couleurMission(b.m)}">
          <button class="lm-corps" data-action="fiche" data-id="${b.m.id}">
            <span class="lm-tete"><b>${esc(b.m.nom)}</b><span>${esc(b.m.client || 'Sans client')} · ${R.MODES[b.m.mode]}${b.m.mode === 'forfait' && b.m.montant ? ` ${euros(b.m.montant)}` : b.m.taux ? ` ${euros(b.m.taux)}/${b.m.uniteTaux === 'heure' ? 'h' : 'j'}` : ''}</span></span>
            ${jaugeMission(b)}
            ${b.alertes.length ? `<span class="lm-alerte">${esc(MESSAGES_ALERTE[b.alertes[b.alertes.length > 1 && b.alertes[0].code === 'vigilance' ? 1 : 0].code](b))}</span>` : ''}
          </button>
          <span class="lm-droite"><span class="lm-taux"><b>${tauxH(b.taux)}</b><small>${b.taux === null ? 'taux effectif' : b.m.mode === 'forfait' && b.estimation && Math.abs(b.tauxFin - b.taux) >= 1 ? `à ce jour · ${tauxH(b.tauxFin)} projeté en fin` : `soit ${euros(b.tjmEquivalent)} par jour`}</small></span>${statutBudget(b.statutBudget)}${statutTaux(b.statutTaux)}</span>
        </li>`).join('')}</ul>` : `<div class="vide-etat"><svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="52" r="40" fill="#1D4E89"/><path d="M48 52V12a40 40 0 0 1 40 40Z" fill="#F5B400"/></svg><div><h3>${E.missions.length ? 'Aucune mission dans ce filtre' : 'Pas encore de mission'}</h3><p>Une mission, c'est un client, un forfait ou une régie, et un budget en jours ou en heures. Le temps saisi dessus se compare au budget et à ton TJM.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-mission">Créer une mission</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function vueFicheMission(m) {
    const b = R.bilanMission(E, m);
    const taches = R.tempsParTache(E, m);
    const dernieres = E.entrees.filter((e) => e.mission === m.id).sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id)).slice(0, 12);
    const cible = R.tauxCible(E), plancher = R.plancher(E);
    const comp = (v, ref) => (fini(v) && fini(ref) ? `${v >= ref ? '+' : '−'}${tauxH(Math.abs(v - ref)).replace(' €/h', '')} €/h` : '');
    return `
      <nav class="fil-fiche"><button class="btn lien" data-action="fermer-fiche">‹ Toutes les missions</button></nav>
      <div class="vue-tete"><div><h1>${pastille(couleurMission(m))} ${esc(m.nom)}</h1><p>${esc(m.client || 'Sans client')} · ${R.MODES[m.mode]} · ${R.STATUTS_MISSION[m.statut]}${m.debut ? ` · depuis le ${esc(R.libDate(m.debut))}` : ''}</p></div>
        <div class="actions"><button class="btn" data-action="avancement" data-id="${m.id}">Avancement</button><button class="btn" data-action="modifier-mission" data-id="${m.id}">Modifier</button><button class="btn" data-action="rapport-mission" data-id="${m.id}">${ICONES.imprimer} Rapport client</button></div></div>
      ${b.alertes.length ? `<div class="alertes-fiche">${b.alertes.map((a) => `<p class="alerte-m niv-${a.niveau}">${ICONE_STATUT[a.niveau === 'depasse' ? 'alerte' : 'vigilance']}<span>${esc(MESSAGES_ALERTE[a.code](b))}</span></p>`).join('')}</div>` : ''}
      <div class="tuiles">
        <div class="tuile" style="--c:${couleurMission(m)}"><p class="surtitre">Temps passé</p><b>${duree(b.minutes)}</b><span>${R.nombre(b.minutes / 60 / R.heuresJour(E), 1)} j · dont ${duree(b.nonFacturable)} non facturables</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Budget</p><b>${b.budget ? pct(b.conso) : '–'}</b><span>${b.budget ? `${duree(b.consomme)} sur ${duree(b.budget)} · ${b.restant >= 0 ? `reste ${duree(b.restant)}` : `${duree(-b.restant)} de trop`}` : 'Aucun budget saisi'}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Estimation à terminaison</p><b>${b.estimation ? duree(b.estimation) : '–'}</b><span>${b.estimation ? (b.depassementPrevu > 0 ? `${duree(b.depassementPrevu)} au-delà du budget` : b.depassementPrevu !== null ? 'Dans le budget' : `Avancement ${pct(b.avancement)}`) : 'Saisis l\'avancement pour l\'estimer'}</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Taux horaire effectif</p><b>${tauxH(b.taux)}</b><span>${b.taux !== null ? `${euros(b.tjmEquivalent)} par jour · ${statutTaux(b.statutTaux)}` : 'Pas encore de temps ou de montant'}</span></div>
      </div>
      <h2 class="titre-section">Comparaisons <span>Valeur ÷ temps réel passé, non facturable compris.</span></h2>
      <div class="defile"><table class="tableau comparaisons"><caption class="sr-only">Taux de la mission face aux repères</caption>
        <thead><tr><th>Repère</th><th class="nb">Taux horaire</th><th class="nb">Par jour</th><th class="nb">Écart du taux effectif</th></tr></thead>
        <tbody>
          <tr><th scope="row">Taux effectif à ce jour</th><td class="nb"><b>${tauxH(b.taux)}</b></td><td class="nb">${euros(b.tjmEquivalent)}</td><td></td></tr>
          ${m.mode === 'forfait' && b.estimation && b.tauxFin !== b.taux ? `<tr><th scope="row">Taux projeté en fin de mission</th><td class="nb">${tauxH(b.tauxFin)}</td><td class="nb">${euros(b.tauxFin * R.heuresJour(E))}</td><td class="nb"><small>si l'avancement est juste</small></td></tr>` : ''}
          ${b.devis !== null ? `<tr><th scope="row">Taux prévu au devis</th><td class="nb">${tauxH(b.devis)}</td><td class="nb">${euros(b.devis * R.heuresJour(E))}</td><td class="nb">${comp(b.taux, b.devis)}</td></tr>` : ''}
          ${m.mode === 'regie' && R.tauxMission(m, R.heuresJour(E)) !== null ? `<tr><th scope="row">Taux facturé en régie</th><td class="nb">${tauxH(R.tauxMission(m, R.heuresJour(E)))}</td><td class="nb">${euros(R.tauxMission(m, R.heuresJour(E)) * R.heuresJour(E))}</td><td class="nb">${comp(b.taux, R.tauxMission(m, R.heuresJour(E)))}</td></tr>` : ''}
          <tr><th scope="row">Ton TJM cible</th><td class="nb">${tauxH(cible)}</td><td class="nb">${euros(E.tjm)}</td><td class="nb">${comp(b.taux, cible) || '<button class="btn lien" data-action="reglages">À saisir</button>'}</td></tr>
          <tr><th scope="row">Ton coût de revient</th><td class="nb">${tauxH(plancher)}</td><td class="nb">${plancher ? euros(plancher * R.heuresJour(E)) : '–'}</td><td class="nb">${comp(b.taux, plancher) || '<button class="btn lien" data-action="reglages">À saisir</button>'}</td></tr>
        </tbody></table></div>
      <p class="mention" style="margin-top:8px">Valeur de la mission : ${m.mode === 'forfait' ? `montant du forfait, ${euros(b.valeur)}` : `${duree(b.facturable)} facturables × ${tauxH(R.tauxMission(m, R.heuresJour(E)))}, soit ${euros(b.valeur)}`}.</p>
      <div class="colonnes-fiche">
        <section><h2 class="titre-section">Temps par tâche <span>${pluriel(m.taches.length, 'tâche')}</span></h2>
          ${b.minutes ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Tâche</th><th class="nb">Temps</th><th class="nb">Facturable</th><th class="nb">Budget</th></tr></thead>
            <tbody>${taches.map((x) => `<tr><td>${esc(x.t.nom)}</td><td class="nb">${duree(x.minutes)}</td><td class="nb">${duree(x.facturable)}</td><td class="nb">${x.budget ? `${duree(x.budget)} <small>${pct(x.conso)}</small>` : '–'}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>Total</td><td class="nb">${duree(b.minutes)}</td><td class="nb">${duree(b.facturable)}</td><td class="nb">${b.budget ? duree(b.budget) : '–'}</td></tr></tfoot></table></div>` : '<p class="mention">Aucun temps saisi sur cette mission.</p>'}
        </section>
        <section><h2 class="titre-section">Dernières saisies <span>${pluriel(b.nbEntrees, 'saisie')}</span></h2>
          ${dernieres.length ? `<ul class="entrees">${dernieres.map((e) => ligneEntree(e, { dansMission: true })).join('')}</ul>` : '<p class="mention">Lance le chronomètre sur cette mission depuis « Aujourd\'hui ».</p>'}
          <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="saisir-sur" data-id="${m.id}">${ICONES.plus} Saisir un temps</button></div>
        </section>
      </div>
      ${m.note ? `<h2 class="titre-section">Notes</h2><p class="note-mission">${esc(m.note)}</p>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Vue : Rentabilité ----------
  const PERIODES = [['mois', 'Ce mois'], ['mois-precedent', 'Mois précédent'], ['trimestre', '3 derniers mois'], ['annee', 'Cette année'], ['tout', 'Tout']];
  function vueRentabilite() {
    const p = R.periode(periodeNom, aujIso());
    const pEff = { du: p.du, au: p.au && p.au > aujIso() ? aujIso() : p.au };
    const s = R.synthesePeriode(E, pEff);
    const cible = R.tauxCible(E), plancher = R.plancher(E);
    const ids = new Set(E.entrees.filter((e) => e.mission && (!pEff.du || e.date >= pEff.du) && (!pEff.au || e.date <= pEff.au)).map((e) => e.mission));
    const bilans = E.missions.filter((m) => ids.has(m.id)).map((m) => R.bilanMission(E, m)).filter((b) => b.taux !== null).map((b) => ({ ...b, tauxGraphe: b.m.mode === 'forfait' && fini(b.tauxFin) ? b.tauxFin : b.taux })).sort((a, b) => b.tauxGraphe - a.tauxGraphe);
    const semaines = R.dernieresSemaines(E, aujIso(), 6);
    return `
      <div class="vue-tete"><div><h1>Rentabilité</h1><p>Ce que rapporte réellement une heure de ton temps, temps non facturable compris.</p></div></div>
      <div class="filtres" role="group" aria-label="Période">${PERIODES.map(([id, nom]) => `<button class="filtre" data-action="periode" data-p="${id}" aria-pressed="${periodeNom === id}">${nom}</button>`).join('')}</div>
      <div class="tuiles" style="margin-top:16px">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Temps total</p><b>${duree(s.minutes)}</b><span>${s.prevu ? `Semaine type : ${duree(s.prevu)}` : `${pluriel(s.nbEntrees, 'saisie')}`}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Part facturable</p><b>${pct(s.partFacturable)}</b><span>Objectif ${pct(s.objectif)} · ${duree(s.nonFacturable)} non facturables</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Valeur produite</p><b>${euros(s.valeur)}</b><span>Régie facturable et part des forfaits, HT</span></div>
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Taux horaire réel</p><b>${tauxH(s.taux)}</b><span>${s.taux !== null ? `${euros(s.tjmEquivalent)} par jour · cible ${tauxH(cible)}` : 'Aucun temps sur la période'}</span></div>
      </div>
      ${s.minutes ? `<p class="lecture-taux">${statutTaux(s.statutTaux)} <span>${s.taux !== null && cible ? (s.taux >= cible ? `Sur la période, chaque heure travaillée a rapporté ${tauxH(s.taux)}, au niveau de ton TJM cible (${tauxH(cible)}).` : `Sur la période, chaque heure travaillée a rapporté ${tauxH(s.taux)}, ${tauxH(cible - s.taux)} de moins que ton TJM cible (${tauxH(cible)}). En cause : ${s.partFacturable !== null && s.partFacturable < s.objectif ? 'trop de temps non facturable' : 'des missions sous-payées ou dépassées'}.`) : 'Saisis ton TJM cible dans les réglages pour situer ce taux.'}</span></p>` : ''}
      <h2 class="titre-section">Taux effectif par mission <span>Missions travaillées sur la période, sur toute la mission ; forfait en cours : taux projeté en fin de mission.</span></h2>
      ${bilans.length ? graphiqueTaux(bilans, cible, plancher) : '<p class="mention">Aucune mission avec du temps et un montant sur cette période.</p>'}
      <h2 class="titre-section">Temps non facturable <span>${duree(s.nonFacturable)} sur la période</span></h2>
      ${s.nonFactParCategorie.length ? barresCategories(s.nonFactParCategorie) : '<p class="mention">Aucun temps non facturable sur la période.</p>'}
      <h2 class="titre-section">Six dernières semaines <span>Temps saisi face à la semaine type</span></h2>
      ${graphiqueSemaines(semaines)}
      ${AVERTISSEMENT}`;
  }

  function graphiqueTaux(bilans, cible, plancher) {
    const max = Math.max(...bilans.map((b) => b.tauxGraphe), cible || 0, plancher || 0) * 1.1;
    const repere = (v, cls, lib) => (fini(v) ? `<i class="rep ${cls}" style="left:${v / max * 100}%" title="${esc(lib)}"></i>` : '');
    return `<div class="graphique graph-taux">
      <div class="legende">${cible ? '<span><i class="lg-cible"></i>TJM cible</span>' : ''}${plancher ? '<span><i class="lg-plancher"></i>Coût de revient</span>' : ''}</div>
      <div class="barres-cats" role="list">${bilans.map((b) => `<div class="barre-cat" role="listitem" title="${esc(b.m.nom)} : ${tauxH(b.tauxGraphe)}, ${duree(b.minutes)} passées"><button class="bc-nom lien-ligne" data-action="fiche" data-id="${b.m.id}"><b>${esc(b.m.nom)}</b></button><span class="bc-piste"><span class="bc-barre" style="width:${b.tauxGraphe / max * 100}%;background:${couleurMission(b.m)}"></span>${repere(cible, 'cible', 'TJM cible')}${repere(plancher, 'plancher', 'Coût de revient')}</span><span class="bc-val">${tauxH(b.tauxGraphe)} ${statutTaux(b.statutTaux)}</span></div>`).join('')}</div>
      <details class="tableau-details"><summary>Voir en tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Mission</th><th class="nb">Temps</th><th class="nb">Valeur</th><th class="nb">Taux à ce jour</th><th class="nb">Taux du graphique</th><th class="nb">Par jour</th></tr></thead><tbody>${bilans.map((b) => `<tr><td>${esc(b.m.nom)}</td><td class="nb">${duree(b.minutes)}</td><td class="nb">${euros(b.valeur)}</td><td class="nb">${tauxH(b.taux)}</td><td class="nb">${tauxH(b.tauxGraphe)}</td><td class="nb">${euros(b.tauxGraphe * R.heuresJour(E))}</td></tr>`).join('')}</tbody></table></div></details>
    </div>`;
  }

  function graphiqueSemaines(semaines) {
    const max = Math.max(...semaines.map((s) => Math.max(s.minutes, s.prevu)), 60);
    return `<div class="graphique">
      <div class="legende"><span><i class="lg-fact"></i>Facturable</span><span><i class="lg-nonfact"></i>Non facturable</span><span><i class="lg-repere"></i>Semaine type</span></div>
      <div class="semaines" role="list">${semaines.map((s, i) => `<div class="col-sem ${i === semaines.length - 1 ? 'actif' : ''}" role="listitem" title="Semaine du ${esc(R.libDate(s.lundi, { annee: false }))} : ${duree(s.minutes)} dont ${duree(s.facturable)} facturables (prévu ${duree(s.prevu)})">
          <span class="cs-val">${heuresTxt(s.minutes)}</span>
          <span class="cs-zone"><span class="cs-pile"><span class="cs-nonfact" style="height:${(s.minutes - s.facturable) / max * 100}%"></span><span class="cs-fact" style="height:${s.facturable / max * 100}%"></span></span>${s.prevu ? `<i class="cs-prevu" style="bottom:${s.prevu / max * 100}%"></i>` : ''}</span>
          <span class="cs-lib">${Number(s.lundi.slice(8))}/${s.lundi.slice(5, 7)}</span></div>`).join('')}</div>
      <details class="tableau-details"><summary>Voir en tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Semaine du</th><th class="nb">Total</th><th class="nb">Facturable</th><th class="nb">Part</th><th class="nb">Prévu</th></tr></thead><tbody>${semaines.map((s) => `<tr><td>${esc(R.libDate(s.lundi))}</td><td class="nb">${duree(s.minutes)}</td><td class="nb">${duree(s.facturable)}</td><td class="nb">${s.minutes ? pct(s.facturable / s.minutes) : '–'}</td><td class="nb">${duree(s.prevu)}</td></tr>`).join('')}</tbody></table></div></details>
    </div>`;
  }

  // ---------- Vue : Rapport client ----------
  function clients() { return [...new Set(E.missions.map((m) => m.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')); }
  function vueRapport() {
    const auj = aujIso();
    if (rapportOpt.du === null) { rapportOpt.du = R.debutMois(auj); rapportOpt.au = R.finMois(auj); }
    if (!rapportOpt.cible) rapportOpt.cible = clients()[0] ? `c:${clients()[0]}` : (E.missions[0] ? `m:${E.missions[0].id}` : '');
    const o = rapportOpt;
    const choix = `<optgroup label="Par client">${clients().map((c) => `<option value="c:${esc(c)}" ${o.cible === `c:${c}` ? 'selected' : ''}>${esc(c)}</option>`).join('')}</optgroup><optgroup label="Par mission">${E.missions.map((m) => `<option value="m:${m.id}" ${o.cible === `m:${m.id}` ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</optgroup>`;
    const r = o.cible ? R.rapport(E, { client: o.cible.startsWith('c:') ? o.cible.slice(2) : '', mission: o.cible.startsWith('m:') ? o.cible.slice(2) : '', du: o.du, au: o.au, facturableSeul: !o.nonFact }) : null;
    const titre = o.cible.startsWith('m:') ? (R.mission(E, o.cible.slice(2))?.client || '') : o.cible.slice(2);
    const hj = R.heuresJour(E);
    return `
      <div class="vue-tete outils-rapport"><div><h1>Rapport client</h1><p>Le détail du temps passé pour un client ou une mission, prêt à imprimer ou à joindre à ta facture.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer" ${r?.minutes ? '' : 'disabled'}>${ICONES.imprimer} Imprimer</button><button class="btn" data-action="csv-rapport" ${r?.minutes ? '' : 'disabled'}>CSV du rapport</button><button class="btn" data-action="csv-saisies" title="Toutes les saisies de la période, toutes missions confondues">Saisies de la période (CSV)</button></div></div>
      ${E.missions.length ? `<form class="reglages-rapport" id="form-rapport" novalidate>
        <label class="champ">Client ou mission<select name="cible">${choix}</select></label>
        <label class="champ">Du<input type="date" name="du" value="${o.du}"></label>
        <label class="champ">Au<input type="date" name="au" value="${o.au}"></label>
        <div class="cases"><label class="case"><input type="checkbox" name="nonFact" ${o.nonFact ? 'checked' : ''}> Temps non facturable inclus</label><label class="case"><input type="checkbox" name="montants" ${o.montants ? 'checked' : ''}> Afficher les montants</label></div>
      </form>` : ''}
      ${!r ? '<div class="vide-etat petit"><div><h3>Pas encore de mission</h3><p>Crée une mission et saisis du temps dessus : le rapport client se construit tout seul.</p></div></div>' : `
      <article class="feuille-rapport">
        <header class="fr-tete"><div><p class="surtitre">Rapport de temps passé</p><h2>${esc(titre || 'Mission')}</h2><p>${o.du || o.au ? `Du ${esc(R.libDate(o.du || r.blocs[0]?.entrees[0]?.date || auj))} au ${esc(R.libDate(o.au || auj))}` : 'Toute la période'}${o.nonFact ? '' : ' · temps facturable'}</p></div>
          <div class="fr-emetteur"><b>${esc(E.activite || 'Mon activité')}</b><span>Édité le ${esc(R.libDate(auj))}</span></div></header>
        <div class="fr-totaux"><div><span>Temps total</span><b>${duree(r.minutes)}</b></div><div><span>Soit</span><b>${R.nombre(r.jours, 2)} j</b><small>à ${R.nombre(hj, hj % 1 ? 1 : 0)} h par jour</small></div><div><span>Missions</span><b>${r.blocs.length}</b></div></div>
        ${r.blocs.length ? r.blocs.map((bl) => `<section class="fr-bloc">
          <h3>${esc(bl.m.nom)} <span>${R.MODES[bl.m.mode]}${bl.budget ? ` · budget ${duree(bl.budget)}, consommé ${pct(bl.conso)} à ce jour` : ''}</span></h3>
          ${bl.entrees.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Tâche</th><th>Détail</th><th class="nb">Durée</th></tr></thead>
            <tbody>${bl.entrees.map((e) => `<tr><td class="date-r">${esc(R.libDate(e.date, { annee: false }))}</td><td>${esc(R.tache(bl.m, e.tache)?.nom || categorie(e.categorie).nom)}${e.facturable ? '' : ' <small>(non facturé)</small>'}</td><td>${esc(e.note)}</td><td class="nb">${duree(e.minutes)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="3">Total ${esc(bl.m.nom)}</td><td class="nb">${duree(bl.minutes)}</td></tr></tfoot></table></div>
            <p class="fr-taches">${bl.parTache.map((x) => `${esc(x.nom)} : <b>${duree(x.minutes)}</b>`).join(' · ')}</p>
            ${o.montants ? `<p class="fr-montant">${bl.m.mode === 'regie' ? `Montant au temps facturable : <b>${euros(bl.valeur, 2)} HT</b> (${tauxH(R.tauxMission(bl.m, hj))})` : `Forfait : <b>${euros(bl.m.montant, 2)} HT</b>`}</p>` : ''}` : '<p class="mention">Aucun temps sur la période.</p>'}
        </section>`).join('') : '<p class="mention">Aucun temps sur cette période pour ce client.</p>'}
        <p class="mention fr-pied">Temps saisis par ${esc(E.activite || 'le prestataire')}${o.montants ? ' ; montants hors taxes' : ''}. Document de suivi, pas une facture.</p>
      </article>`}
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
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  // Création (id absent, date et mission facultatives) ou modification d'une saisie.
  function modaleEntree(id, { date = jourVu, mission = '' } = {}) {
    const x = id ? E.entrees.find((e) => e.id === id) : null;
    if (id && !x) return;
    const cible = x ? (x.mission ? `m:${x.mission}` : `c:${x.categorie}`) : (mission ? `m:${mission}` : cibleParDefaut());
    const corps = `
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${x?.date || date}" max="${aujIso()}" required></label>
        <label class="champ">Durée <small>« 1h30 », « 45 min »</small><input name="duree" inputmode="decimal" value="${x ? esc(duree(x.minutes).replace(/ /g, ' ')) : ''}" required></label>
      </div>
      <label class="champ">Sur quoi<select name="cible" data-cible>${optionsCible(cible, { toutes: true })}</select></label>
      <label class="champ">Tâche<select name="tache" data-tache>${optionsTache(cible, x?.tache)}</select></label>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(x?.note)}"></label>
      <label class="case"><input type="checkbox" name="facturable" data-facturable ${(x ? x.facturable : facturableParDefaut(cible, '')) ? 'checked' : ''}> Facturable</label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x ? `<button class="btn danger gauche" type="button" data-action="suppr-entree" data-id="${x.id}">Supprimer</button>` : ''}`;
    ouvrirModale(x ? 'Modifier la saisie' : 'Saisir un temps', corps, pied, (fd) => {
      const minutes = R.lireDuree(fd.get('duree'));
      if (!minutes) return 'Durée illisible : écris par exemple 1h30, 45 min ou 2.';
      const d = String(fd.get('date') || '');
      if (!R.estDate(d)) return 'Choisis une date.';
      retenir();
      const n = R.normaliserEntree({ id: x?.id || R.nouvelId(), date: d, ...lireCible(fd.get('cible'), fd.get('tache')), minutes, facturable: fd.get('facturable') === 'on', note: String(fd.get('note') || '').trim() });
      if (x) E.entrees[E.entrees.indexOf(x)] = n; else E.entrees.push(n);
      sauver(); rendre();
      toast(x ? 'Saisie modifiée.' : `${duree(minutes)} ajoutées.`, { libelle: 'Annuler', faire: annuler });
    });
    brancherCible(modale());
  }

  // Liens entre « Sur quoi », « Tâche » et « Facturable » dans un formulaire.
  function brancherCible(racine) {
    const sel = racine.querySelector('[data-cible]');
    if (!sel) return;
    const tache = racine.querySelector('[data-tache]');
    const fact = racine.querySelector('[data-facturable]');
    sel.addEventListener('change', () => { tache.innerHTML = optionsTache(sel.value, ''); if (fact) fact.checked = facturableParDefaut(sel.value, ''); if (racine !== modale()) { saisieRapide.cible = sel.value; saisieRapide.tache = ''; } });
    tache.addEventListener('change', () => { if (fact) fact.checked = facturableParDefaut(sel.value, tache.value); if (racine !== modale()) saisieRapide.tache = tache.value; });
  }

  // Création ou modification d'une mission.
  function modaleMission(id) {
    const x = id ? R.mission(E, id) : null;
    if (id && !x) return;
    const m = x || { nom: '', client: '', mode: 'forfait', montant: null, taux: null, uniteTaux: 'jour', budget: null, uniteBudget: 'jour', avancement: null, statut: 'en-cours', taches: [], note: '', couleur: E.missions.length % B.couleurs.length };
    const nb = (v) => (fini(v) ? String(v).replace('.', ',') : '');
    const tachesTxt = m.taches.map((t) => `${t.nom}${t.budgetH ? ` ; ${nb(t.budgetH)}h` : ''}`).join('\n');
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="120" required value="${esc(m.nom)}" placeholder="Ex. : Refonte du site"></label>
      <label class="champ">Client<input name="client" maxlength="80" value="${esc(m.client)}" list="liste-clients" placeholder="Ex. : Société Exemple"><datalist id="liste-clients">${clients().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      ${x ? '' : `<label class="champ">Modèle de tâches<select name="modele">${B.modeles.map((mo) => `<option value="${mo.id}">${esc(mo.nom)} (${mo.taches.length} tâches)</option>`).join('')}</select></label>`}
      <fieldset class="champ"><legend>Facturation</legend><div class="choix-statut deux">${Object.entries(R.MODES).map(([k, l]) => `<label><input type="radio" name="mode" value="${k}" ${m.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs" data-forfait ${m.mode === 'regie' ? 'hidden' : ''}><label class="champ">Montant du forfait (€ HT)<input name="montant" inputmode="decimal" value="${nb(m.montant)}"></label></div>
      <div class="rang-champs" data-regie ${m.mode === 'regie' ? '' : 'hidden'}><label class="champ">Taux (€ HT)<input name="taux" inputmode="decimal" value="${nb(m.taux)}"></label><label class="champ">Par<select name="uniteTaux"><option value="jour" ${m.uniteTaux === 'jour' ? 'selected' : ''}>jour</option><option value="heure" ${m.uniteTaux === 'heure' ? 'selected' : ''}>heure</option></select></label></div>
      <div class="rang-champs"><label class="champ">Budget en temps <small>Prévu au devis ou au bon de commande</small><input name="budget" inputmode="decimal" value="${nb(m.budget)}"></label><label class="champ">En<select name="uniteBudget"><option value="jour" ${m.uniteBudget === 'jour' ? 'selected' : ''}>jours</option><option value="heure" ${m.uniteBudget === 'heure' ? 'selected' : ''}>heures</option></select></label></div>
      <div class="rang-champs"><label class="champ">Avancement (%) <small>Facultatif</small><input name="avancement" inputmode="decimal" value="${nb(m.avancement)}"></label><label class="champ">Statut<select name="statut">${Object.entries(R.STATUTS_MISSION).map(([k, l]) => `<option value="${k}" ${m.statut === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${m.couleur % B.couleurs.length === i ? 'checked' : ''} aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      ${x ? `<label class="champ">Tâches <small>Une par ligne. Budget facultatif après un point-virgule : « Maquettes ; 6h ».</small><textarea name="taches" rows="5">${esc(tachesTxt)}</textarea></label>` : ''}
      <label class="champ">Notes<textarea name="note" rows="2" maxlength="1000">${esc(m.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x ? `<button class="btn danger gauche" type="button" data-action="suppr-mission" data-id="${x.id}">Supprimer</button>` : ''}`;
    ouvrirModale(x ? 'Modifier la mission' : 'Nouvelle mission', corps, pied, (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la mission.';
      const mode = fd.get('mode');
      const lu = (n) => { const s = String(fd.get(n) ?? '').trim(); return s === '' ? null : R.lireNombre(s); };
      for (const [n, lib] of [['montant', 'Le montant'], ['taux', 'Le taux'], ['budget', 'Le budget'], ['avancement', 'L\'avancement']]) if (String(fd.get(n) ?? '').trim() !== '' && (lu(n) === null || lu(n) < 0)) return `${lib} n'est pas un nombre.`;
      if (lu('avancement') !== null && lu('avancement') > 100) return 'L\'avancement va de 0 à 100 %.';
      let taches = m.taches;
      if (x) {
        taches = String(fd.get('taches') || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
          const [nomT, b] = l.split(';').map((s) => s.trim());
          const ancienne = m.taches.find((t) => t.nom === nomT);
          return { id: ancienne?.id || R.nouvelId(), nom: nomT, categorie: ancienne?.categorie || 'realisation', budgetH: b ? (R.lireDuree(b) || 0) / 60 || null : null };
        });
      } else {
        taches = B.modeles.find((mo) => mo.id === fd.get('modele')).taches.map(([nomT, categorie]) => ({ nom: nomT, categorie }));
      }
      retenir();
      const n = R.normaliserMission({ ...m, id: x?.id || R.nouvelId(), nom, client: String(fd.get('client') || '').trim(), mode, montant: lu('montant'), taux: lu('taux'), uniteTaux: fd.get('uniteTaux'), budget: lu('budget'), uniteBudget: fd.get('uniteBudget'), avancement: lu('avancement'), statut: fd.get('statut'), couleur: Number(fd.get('couleur')) || 0, note: String(fd.get('note') || ''), debut: m.debut || aujIso(), taches });
      if (x) E.missions[E.missions.indexOf(x)] = n; else E.missions.push(n);
      // Une tâche retirée : ses saisies passent en « Sans tâche ».
      if (x) for (const e of E.entrees) if (e.mission === n.id && e.tache && !R.tache(n, e.tache)) e.tache = null;
      sauver();
      if (!x) { missionVue = n.id; vue = 'missions'; history.replaceState(null, '', '#missions'); }
      rendre();
      toast(x ? 'Mission enregistrée.' : `Mission créée : ${n.nom}.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelectorAll('[name=mode]').forEach((el) => el.addEventListener('change', () => {
      const regie = modale().querySelector('[name=mode]:checked').value === 'regie';
      modale().querySelector('[data-forfait]').hidden = regie;
      modale().querySelector('[data-regie]').hidden = !regie;
    }));
    modale().querySelector('[name=modele]')?.addEventListener('change', (e) => {
      const mo = B.modeles.find((x2) => x2.id === e.target.value);
      modale().querySelector(`[name=mode][value=${mo.mode}]`).checked = true;
      modale().querySelector('[name=mode]:checked').dispatchEvent(new Event('change'));
      modale().querySelector('[name=uniteBudget]').value = mo.unite;
    });
  }

  function modaleAvancement(id) {
    const m = R.mission(E, id);
    if (!m) return;
    const b = R.bilanMission(E, m);
    const corps = `
      <p>${esc(m.nom)} : ${duree(b.consomme)} consommées${b.budget ? ` sur ${duree(b.budget)} (${pct(b.conso)})` : ''}.</p>
      <label class="champ">Avancement réel (%) <small>La part du travail réellement faite, pas du temps passé.</small><input name="avancement" type="range" min="0" max="100" step="5" value="${fini(m.avancement) ? m.avancement : 0}" data-curseur><output class="valeur-curseur">${fini(m.avancement) ? m.avancement : 0} %</output></label>
      <label class="case"><input type="checkbox" name="terminee" ${m.statut === 'terminee' ? 'checked' : ''}> Mission terminée</label>
      <p class="aide">Avec l'avancement, l'outil estime le temps total à terminaison : temps consommé ÷ avancement.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Avancement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      m.avancement = Number(fd.get('avancement'));
      m.statut = fd.get('terminee') === 'on' ? 'terminee' : (m.statut === 'terminee' ? 'en-cours' : m.statut);
      if (m.statut === 'terminee') m.avancement = 100;
      sauver(); rendre();
      toast(`Avancement : ${m.avancement} %.`, { libelle: 'Annuler', faire: annuler });
    });
    const c = modale().querySelector('[data-curseur]');
    c.addEventListener('input', () => { modale().querySelector('.valeur-curseur').textContent = `${c.value} %`; });
  }

  function supprimerMission(id) {
    const m = R.mission(E, id);
    if (!m) return;
    const n = E.entrees.filter((e) => e.mission === id).length;
    if (!confirm(`Supprimer la mission « ${m.nom} »${n ? ` et ses ${pluriel(n, 'saisie')}` : ''} ? Pour la garder sans l'afficher, passe-la plutôt en « Archivée ».`)) return;
    retenir();
    E.missions = E.missions.filter((x) => x.id !== id);
    E.entrees = E.entrees.filter((e) => e.mission !== id);
    if (E.chrono?.mission === id) E.chrono = null;
    missionVue = null;
    if (modale().open) modale().close();
    sauver(); rendre();
    toast(`Mission supprimée : ${m.nom}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const nb = (v) => (fini(v) ? String(v).replace('.', ',') : '');
    const corps = `
      <label class="champ">Ton activité <small>En tête des rapports clients.</small><input name="activite" maxlength="80" value="${esc(E.activite)}"></label>
      <div class="groupe"><h3>Tes repères</h3><p class="aide">Ton TJM cible vient de ton calcul de tarif (par exemple le Calculateur de TJM QME), ton coût de revient horaire du Coût de revient QME. Hors taxes.</p>
        <div class="rang-champs"><label class="champ">TJM cible (€ HT)<input name="tjm" inputmode="decimal" value="${nb(E.tjm)}"></label><label class="champ">Heures par jour<input name="heuresJour" inputmode="decimal" value="${nb(E.heuresJour)}"></label><label class="champ">Coût de revient (€/h)<input name="coutHeure" inputmode="decimal" value="${nb(E.coutHeure)}"></label></div></div>
      <div class="groupe"><h3>Alertes et objectifs</h3>
        <div class="rang-champs"><label class="champ">Vigilance budget (%) <small>À partir de quelle part consommée.</small><input name="seuilVigilance" inputmode="decimal" value="${nb(E.seuilVigilance)}"></label><label class="champ">Dérive (points) <small>Temps consommé en avance sur l'avancement.</small><input name="derive" inputmode="decimal" value="${nb(E.derive)}"></label><label class="champ">Objectif facturable (%)<input name="objectifFacturable" inputmode="decimal" value="${nb(E.objectifFacturable)}"></label></div>
        <label class="champ">Arrondi du chronomètre<select name="arrondi">${[[0, 'Aucun (à la minute)'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes']].map(([v, l]) => `<option value="${v}" ${E.arrondi === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="groupe"><h3>Semaine type <small>heures prévues par jour</small></h3>
        <div class="semaine-type">${R.JOURS_COURTS.map((j, i) => `<label class="champ">${j}<input name="st${i}" inputmode="decimal" value="${nb(E.semaineType[i])}"></label>`).join('')}</div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte toutes tes saisies en tableur (CSV, point-virgule), ou un rapport client depuis l'onglet Rapport.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-tout">Toutes les saisies (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes temps sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour lancer et arrêter le chronomètre d'un geste, comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. ${B.categories.length} catégories de tâches et ${B.modeles.length} modèles de missions rédigés pour QME ; aucun taux, barème ni tarif de marché intégré. Aucun lien avec un agenda, une banque ou un logiciel de facturation. Outil de gestion, pas un logiciel de facturation ni un conseil.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lu = (n) => { const s = String(fd.get(n) ?? '').trim(); return s === '' ? null : R.lireNombre(s); };
      for (const n of ['tjm', 'coutHeure']) if (String(fd.get(n) ?? '').trim() !== '' && !(lu(n) > 0)) return 'TJM et coût de revient : des montants positifs.';
      if (!(lu('heuresJour') >= 1 && lu('heuresJour') <= 24)) return 'Les heures par jour vont de 1 à 24.';
      for (const n of ['seuilVigilance', 'derive', 'objectifFacturable']) if (lu(n) === null || lu(n) < 0 || lu(n) > 100) return 'Les pourcentages vont de 0 à 100.';
      const st = Array.from({ length: 7 }, (_, i) => lu(`st${i}`) ?? 0);
      if (st.some((h) => h < 0 || h > 24)) return 'La semaine type : de 0 à 24 h par jour.';
      retenir();
      E = R.normaliser({ ...E, activite: String(fd.get('activite') || '').trim(), tjm: lu('tjm'), heuresJour: lu('heuresJour'), coutHeure: lu('coutHeure'), seuilVigilance: lu('seuilVigilance'), derive: lu('derive'), objectifFacturable: lu('objectifFacturable'), arrondi: Number(fd.get('arrondi')), semaineType: st });
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.missions) || !Array.isArray(d.entrees)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.missions.length, 'mission')}, ${pluriel(d.entrees.length, 'saisie')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi du temps.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-temps-${aujIso()}.json`);
  const nomFichier = (s) => String(s || 'rapport').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

  // ---------- Chronomètre : démarrer, arrêter ----------
  function demarrerChrono(form) {
    const fd = new FormData(form);
    retenir();
    E.chrono = { debut: Date.now(), ...lireCible(fd.get('cible'), fd.get('tache')), facturable: fd.get('facturable') === 'on', note: String(fd.get('note') || '').trim().slice(0, 300) };
    sauver(); rendre();
    toast('Chronomètre lancé. Il continue même si tu fermes la page, sur tous tes appareils.');
  }
  function arreterChrono() {
    if (!E.chrono) return;
    retenir();
    const n = R.entreeDepuisChrono(E, Date.now(), aujIso());
    E.chrono = null;
    if (n) E.entrees.push(n);
    jourVu = aujIso();
    sauver(); rendre();
    toast(n ? `${duree(n.minutes)} enregistrées sur ${libCible(n)}.` : 'Moins d\'une minute : rien n\'est enregistré.', { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Écouteurs propres à chaque vue ----------
  function brancherVue() {
    document.querySelectorAll('#form-rapide, #form-chrono').forEach((f) => brancherCible(f));
    $('#form-rapide')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const minutes = R.lireDuree(fd.get('duree'));
      const champ = e.target.querySelector('[name=duree]');
      if (!minutes) { champ.classList.add('invalide'); champ.focus(); toast('Durée illisible : écris par exemple 1h30, 45 min ou 2.'); return; }
      retenir();
      const n = R.normaliserEntree({ id: R.nouvelId(), date: jourVu, ...lireCible(fd.get('cible'), fd.get('tache')), minutes, facturable: fd.get('facturable') === 'on', note: String(fd.get('note') || '').trim() });
      E.entrees.push(n);
      sauver(); rendre();
      $('#form-rapide [name=duree]')?.focus();
      toast(`${duree(minutes)} ajoutées sur ${libCible(n)}.`, { libelle: 'Annuler', faire: annuler });
    });
    $('#form-rapide [name=duree]')?.addEventListener('input', (e) => e.target.classList.remove('invalide'));
    $('#form-chrono')?.addEventListener('submit', (e) => { e.preventDefault(); demarrerChrono(e.target); });
    $('#choix-jour')?.addEventListener('change', (e) => { if (R.estDate(e.target.value)) { jourVu = e.target.value > aujIso() ? aujIso() : e.target.value; rendre(); } });
    const fr = $('#form-rapport');
    if (fr) fr.addEventListener('change', () => {
      const fd = new FormData(fr);
      Object.assign(rapportOpt, { cible: fd.get('cible'), du: fd.get('du') || '', au: fd.get('au') || '', nonFact: fd.get('nonFact') === 'on', montants: fd.get('montants') === 'on' });
      rendre();
    });
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); jourVu = aujIso(); missionVue = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': { const err = verifierAccueil(); if (err) { toast(err); break; } accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break; }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(el.dataset.sans === '1'); break;
      case 'vue': if (modale().open) modale().close(); if (el.dataset.vue === 'missions') missionVue = null; if (el.dataset.vue === 'jour' && vue !== 'jour') jourVu = aujIso(); changerVue(el.dataset.vue); break;
      case 'jour': { const n = R.ajoutJours(jourVu, Number(el.dataset.d)); if (n <= aujIso()) { jourVu = n; rendre(); } break; }
      case 'jour-auj': jourVu = aujIso(); rendre(); break;
      case 'aller-jour': jourVu = el.dataset.date; lundiVu = R.lundi(jourVu); changerVue('jour'); break;
      case 'semaine': { const n = R.ajoutJours(lundiVu, Number(el.dataset.d)); if (n <= R.lundi(aujIso())) { lundiVu = n; rendre(); } break; }
      case 'chrono-stop': arreterChrono(); break;
      case 'chrono-annuler': if (confirm('Annuler le chronomètre sans enregistrer le temps écoulé ?')) { retenir(); E.chrono = null; sauver(); rendre(); toast('Chronomètre annulé.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'modifier-entree': modaleEntree(id); break;
      case 'suppr-entree': { const x = E.entrees.find((y) => y.id === id); if (!x) break; retenir(); E.entrees = E.entrees.filter((y) => y.id !== id); modale().close(); sauver(); rendre(); toast(`Saisie supprimée (${duree(x.minutes)}).`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'saisir-sur': modaleEntree(null, { date: aujIso(), mission: id }); break;
      case 'filtre-missions': filtreMissions = el.dataset.f; rendre(); break;
      case 'fiche': if (modale().open) modale().close(); missionVue = id; changerVue('missions'); break;
      case 'fermer-fiche': missionVue = null; rendre(); window.scrollTo({ top: 0 }); break;
      case 'nouvelle-mission': modaleMission(null); break;
      case 'modifier-mission': modaleMission(id); break;
      case 'suppr-mission': supprimerMission(id); break;
      case 'avancement': modaleAvancement(id); break;
      case 'rapport-mission': rapportOpt.cible = `m:${id}`; rapportOpt.du = ''; rapportOpt.au = ''; changerVue('rapport'); break;
      case 'periode': periodeNom = el.dataset.p; rendre(); break;
      case 'imprimer': window.print(); break;
      case 'csv-rapport': {
        const o = rapportOpt;
        const r = R.rapport(E, { client: o.cible.startsWith('c:') ? o.cible.slice(2) : '', mission: o.cible.startsWith('m:') ? o.cible.slice(2) : '', du: o.du, au: o.au, facturableSeul: !o.nonFact });
        telecharger(R.versCsvRapport(E, r), 'text/csv;charset=utf-8', `rapport-${nomFichier(o.cible.startsWith('m:') ? R.mission(E, o.cible.slice(2))?.nom : o.cible.slice(2))}-${aujIso()}.csv`);
        break;
      }
      case 'csv-saisies': telecharger(R.versCsvEntrees(E, { du: rapportOpt.du || null, au: rapportOpt.au || null }, B.categories), 'text/csv;charset=utf-8', `saisies-temps-${rapportOpt.du || 'debut'}-${rapportOpt.au || aujIso()}.csv`); break;
      case 'csv-tout': telecharger(R.versCsvEntrees(E, {}, B.categories), 'text/csv;charset=utf-8', `saisies-temps-${aujIso()}.csv`); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    majChrono();
    rafraichir();
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
  window.__suiviTemps = { etat: () => E, regles: R };
  init();
})();
