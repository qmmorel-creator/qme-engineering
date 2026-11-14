// Réservation de salles et bureaux QME : ressources, créneaux sans double réservation, libre maintenant, vues jour
// et semaine, taux d'occupation. Une clé partagée par l'équipe ; chacun saisit son nom. Rien n'est connecté.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.SDR;
  const API = '/api/templates';
  const PRODUIT = 'SDR';
  const CLE_CODE = 'qme-sdr-code';
  const CLE_CACHE = 'qme-sdr-cache';
  const CLE_DEMO = 'qme-sdr-demo';
  const CLE_NOM = 'qme-sdr-nom';
  const CLE_NOM_DEMO = 'qme-sdr-nom-demo';
  const CLE_ACCUEIL = 'qme-sdr-ecran-accueil';
  const CODE_DEMO = 'DEMO';
  const DEFAUTS = { reglages: B.reglages };

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
  const { ajout, versDate, minutes, heure } = R;
  const maintenant = () => new Date();
  const auj = () => R.iso(maintenant());
  const minuteNow = () => R.minuteDe(maintenant());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const quand = (d) => (d === auj() ? 'aujourd\'hui' : d === ajout(auj(), 1) ? 'demain' : `le ${dateLongue(d)}`);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const plage = (r) => `${r.debut}–${r.fin}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let ops = [];          // actions sur les réservations pas encore enregistrées en ligne (rejouées en cas de conflit)
  let autresModifs = false; // réglages ou ressources modifiés et pas encore enregistrés
  let vue = 'maintenant';
  let jourVu = auj();
  let semaineVue = R.lundi(auj());
  let ressourceSemaine = null;
  let filtreType = 'tous';
  const filtre = { liste: 'aVenir', q: '' };
  let periodeOcc = 4;
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const resa = (id) => E.reservations.find((r) => r.id === id);
  const ressource = (id) => E.ressources.find((x) => x.id === id);
  const actives = () => E.ressources.filter((x) => !x.archive);
  const visibles = () => actives().filter((x) => filtreType === 'tous' || x.type === filtreType);
  const nomRessource = (id) => ressource(id)?.nom || 'Ressource supprimée';
  const couleur = (x) => B.couleurs[(x?.couleur ?? 0) % B.couleurs.length];
  const monNom = () => stock.lire(session.demo ? CLE_NOM_DEMO : CLE_NOM) || '';
  const ecrireNom = (n) => stock.ecrire(session.demo ? CLE_NOM_DEMO : CLE_NOM, n.trim().slice(0, 60));

  function retenir() { annulation = { E: structuredClone(E), ops: structuredClone(ops), autresModifs }; }
  function annuler() {
    if (!annulation) return;
    E = annulation.E; ops = annulation.ops; autresModifs = annulation.autresModifs; annulation = null;
    // Ce qui a déjà été enregistré en ligne est rejoué par l'état complet : on force un envoi.
    autresModifs = true;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }
  const journaliser = (op) => { if (!session.demo) ops.push(structuredClone(op)); };

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye, ops, autresModifs }, !session.memoriser);
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

  // Un autre appareil a écrit entre-temps : on part de sa version et on rejoue nos réservations dessus.
  function fusionnerAvecServeur(donnees) {
    const { etat, refusees } = R.rejouer(normaliser(donnees), ops);
    const perdues = autresModifs;
    E = etat;
    session.base = donnees.majLe;
    return { refusees, perdues };
  }
  function signalerFusion({ refusees, perdues }) {
    if (refusees.length) {
      const l = refusees.map((x) => `${nomRessource(x.resa.ressource)} ${dateCourte(x.resa.date)} ${plage(x.resa)}${x.raison === 'conflit' ? ` (prise par ${x.avec.par || 'quelqu\'un'} entre-temps)` : ' (supprimée sur un autre appareil)'}`);
      toast(`Réservation refusée : ${l.join(' ; ')}.`, null, 12000);
    } else if (perdues) toast('Un autre appareil a modifié les réglages ou les ressources entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.', null, 9000);
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const envoyees = ops.length;
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        const f = fusionnerAvecServeur(corps.donnees);
        // On garde les actions acceptées : elles seront rejouées si un autre appareil écrit encore entre-temps.
        const refusees = new Set(f.refusees.map((x) => x.resa.id));
        ops = ops.filter((op) => op.type === 'suppr' || !refusees.has(op.resa.id)); autresModifs = false;
        cache(true);
        if (!modale().open) rendre();
        signalerFusion(f);
        aRenvoyer = true; // nos réservations acceptées restent à enregistrer
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        ops = ops.slice(envoyees); autresModifs = false;
        cache(ops.length > 0);
      }
      majSync(ops.length ? 'attente' : 'ok');
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
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes réservations sont gardées sur cet appareil et seront vérifiées et envoyées au retour du réseau.' : libelles[etat];
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
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après l\'achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    ops = []; autresModifs = false;
    if (c && c.code === session.code && c.nonEnvoye) {
      ops = c.ops || []; autresModifs = !!c.autresModifs;
      if (!donnees || c.base === donnees.majLe) {
        E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
        demarrer(); envoyer();
        return;
      }
      // Le serveur a changé pendant que cet appareil était hors ligne : on rejoue ses réservations dessus.
      const f = fusionnerAvecServeur(donnees);
      ops = []; autresModifs = false;
      demarrer(); signalerFusion(f); sauver();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    ops = []; autresModifs = false;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    if (!stock.lire(CLE_NOM_DEMO)) stock.ecrire(CLE_NOM_DEMO, 'Camille');
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; ops = [];
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // « Atelier Exemple » (fictif) : 3 salles, 1 cabine, 4 bureaux en flex, 2 équipements prêtables. Quatre
  // semaines d'historique et deux semaines à venir, générées avec les vraies règles (aucun conflit), une série
  // « chaque semaine », une salle occupée et une libre à l'heure d'ouverture de la démo, une ressource archivée.
  function donneesDemo() {
    const e = etatVide();
    e.organisation = 'Atelier Exemple (fictif)';
    Object.assign(e.reglages, { ouverture: '08:00', fermeture: '19:00', jours: [1, 2, 3, 4, 5, 6], pas: 30, avanceMax: 90, dureeMax: null });
    const res = (nom, type, capacite, lieu, equipements = [], extra = {}) => { const x = R.normaliserRessource({ id: uid(), nom, type, capacite, lieu, equipements, couleur: e.ressources.length % 8, ...extra }, e.ressources.length); e.ressources.push(x); return x; };
    const horizon = res('Salle Horizon', 'salle', 12, '1er étage', ['Écran', 'Visioconférence', 'Tableau blanc', 'Lumière du jour']);
    const atelier = res('Salle Atelier', 'salle', 8, 'Rez-de-chaussée', ['Vidéoprojecteur', 'Paperboard', 'Accès de plain-pied']);
    const bulle = res('Salle Bulle', 'salle', 4, '1er étage', ['Écran', 'Visioconférence']);
    const cabine = res('Cabine téléphone', 'bureau', 1, '1er étage', [], { note: 'Pour les appels et visios en solo.' });
    const bureaux = ['A1', 'A2', 'A3', 'A4'].map((n) => res(`Bureau flex ${n}`, 'bureau', 1, 'Plateau A'));
    const projo = res('Vidéoprojecteur portable', 'equipement', 1, 'Armoire de l\'accueil');
    const kit = res('Kit visio mobile', 'equipement', 1, 'Armoire de l\'accueil');
    res('Ancienne salle 3', 'salle', 6, '2e étage', [], { archive: true });

    const t = auj();
    const noms = ['Alex', 'Camille', 'Sam', 'Nour', 'Léa', 'Hugo', 'Inès', 'Malo', 'Jade', 'Tom'];
    const objets = ['Revue de projet', 'Atelier client (fictif)', 'Formation interne', 'Visio partenaires', 'Entretien', 'Comité de pilotage', 'Préparation de salon', 'Réunion d\'équipe'];
    let graine = 7;
    const hasard = (n) => { graine = (graine * 9301 + 49297) % 233280; return Math.floor((graine / 233280) * n); };
    const poser = (x, nouvelle = false) => {
      const r = R.normaliserReservation({ id: uid(), creeLe: ajout(x.date, -3 - hasard(5)), ...x }, t);
      if (R.valider(r, e, { auj: t, nouvelle }).ok) { e.reservations.push(r); return r; }
      return null;
    };
    // Série : point d'équipe chaque lundi (ou premier jour ouvert de la semaine) de 09:30 à 10:30.
    const serie = uid();
    for (let s = -4; s <= 2; s++) {
      const d = R.prochainJourOuvert(ajout(R.lundi(t), s * 7), e.reglages);
      poser({ ressource: horizon.id, date: d, debut: '09:30', fin: '10:30', objet: 'Point d\'équipe', par: 'Camille', personnes: 9, serie });
    }
    // Historique et semaines à venir, plus dense en milieu de semaine.
    for (let k = -27; k <= 13; k++) {
      const d = ajout(t, k);
      if (!R.jourOuvert(d, e.reglages).ouvert) continue;
      const w = R.jourSemaine(d);
      const charge = w === 6 ? 1 : k > 6 ? 2 : (w === 2 || w === 4 ? 5 : 4);
      for (let i = 0; i < charge; i++) {
        const salle = [horizon, atelier, bulle, bulle, atelier][hasard(5)];
        const deb = 8 * 60 + 30 * hasard(18);
        poser({ ressource: salle.id, date: d, debut: heure(deb), fin: heure(deb + 30 * (1 + hasard(5))), objet: objets[hasard(objets.length)], par: noms[hasard(noms.length)], personnes: Math.min(salle.capacite, 2 + hasard(6)) });
      }
      bureaux.forEach((b, i) => { if (k <= 6 && hasard(10) < (w === 6 ? 2 : [7, 6, 4, 3][i])) poser({ ressource: b.id, date: d, debut: hasard(3) ? '08:30' : '13:30', fin: hasard(4) ? '18:00' : '12:30', objet: 'Journée sur place', par: noms[hasard(noms.length)], personnes: 1 }); });
      if (hasard(3) === 0) { const deb = 9 * 60 + 30 * hasard(14); poser({ ressource: cabine.id, date: d, debut: heure(deb), fin: heure(deb + 30), objet: 'Appel', par: noms[hasard(noms.length)] }); }
      if (k <= 6 && hasard(4) === 0) poser({ ressource: [projo, kit][hasard(2)].id, date: d, debut: '14:00', fin: '17:00', objet: 'Prêt pour un rendez-vous extérieur', par: noms[hasard(noms.length)] });
    }
    // Autour de l'instant présent : Salle Atelier occupée, Salle Bulle libre puis réservée, cabine bientôt prise.
    const jourDemo = R.jourOuvert(t, e.reglages).ouvert ? t : R.prochainJourOuvert(t, e.reglages);
    const m = jourDemo === t ? Math.min(Math.max(minuteNow(), minutes(e.reglages.ouverture) + 60), minutes(e.reglages.fermeture) - 120) : 10 * 60 + 40;
    const base = m - (m % 30);
    const liberer = (id, a, b) => { e.reservations = e.reservations.filter((r) => !(r.ressource === id && r.date === jourDemo && r.debut < heure(b) && heure(a) < r.fin)); };
    liberer(atelier.id, base - 60, base + 90); liberer(bulle.id, base - 30, base + 150); liberer(cabine.id, base, base + 60);
    poser({ ressource: atelier.id, date: jourDemo, debut: heure(base - 30), fin: heure(base + 60), objet: 'Atelier client (fictif)', par: 'Nour', personnes: 6 });
    poser({ ressource: bulle.id, date: jourDemo, debut: heure(base + 90), fin: heure(base + 150), objet: 'Visio partenaires', par: 'Camille', personnes: 3, note: 'Prévoir le câble HDMI.' });
    poser({ ressource: cabine.id, date: jourDemo, debut: heure(base + 30), fin: heure(base + 60), objet: 'Appel', par: 'Camille' });
    poser({ ressource: horizon.id, date: ajout(jourDemo, 2) > ajout(t, 60) ? jourDemo : R.prochainJourOuvert(ajout(jourDemo, 2), e.reglages), debut: '14:00', fin: '16:30', objet: 'Comité de pilotage', par: 'Camille', personnes: 10 });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Réservation de salles · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="170" height="110" fill="#1D4E89"/>
          <rect x="20" y="170" width="80" height="110" fill="#F5B400"/>
          <rect x="110" y="170" width="80" height="110" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="300" cy="110" r="70" fill="#D9302A"/>
          <path d="M300 110 L300 40 A70 70 0 0 1 370 110 Z" fill="#F0EDE6"/>
          <rect x="240" y="210" width="240" height="22" fill="#141414"/>
          <rect x="240" y="250" width="160" height="22" fill="#141414"/>
          <circle cx="500" cy="80" r="40" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Réservation de salles et bureaux</p>
          <h1>La salle est libre ? Tu le sais.</h1>
          <p>Salles, bureaux en flex et matériel prêté : qui a réservé, jusqu'à quand, et aucune double réservation. Une clé pour toute l'équipe.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès</p>
          <h2>Ouvre le planning</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après l'achat, ou celle que ton équipe t'a transmise. Les réservations sont enregistrées en ligne et partagées par tous ceux qui ont la clé.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir le planning</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/salles/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans l'e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir le planning'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const ligneRessourceVide = (type = 'salle') => ({ nom: '', type, capacite: type === 'salle' ? 6 : 1 });
  const accueilVide = () => ({ etape: 1, organisation: '', ressources: [ligneRessourceVide('salle'), ligneRessourceVide('salle'), ligneRessourceVide('bureau')], ouverture: B.reglages.ouverture, fermeture: B.reglages.fermeture, jours: [...B.reglages.jours], pas: B.reglages.pas, nom: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ce que l'on réserve chez vous</h1>
        <p class="intro">Liste les salles, les bureaux en flex et le matériel que l'on se prête. Chacun réservera un créneau en saisissant son nom : une salle déjà prise est refusée. Tu pourras tout modifier dans les Réglages.</p>
        <label class="champ" style="max-width:420px;margin-top:20px">Nom du lieu ou de l'organisation <small>Facultatif, affiché en haut de l'écran « Maintenant ».</small><input id="organisation" value="${esc(a.organisation)}" maxlength="80"></label>
        <h2 class="titre-section">Tes ressources <span>Jusqu'à ${R.MAX_RESSOURCES}. Pas de véhicules ici.</span></h2>
        <ol class="ressources-accueil">${a.ressources.map((x, i) => `<li><span class="palier-num">${i + 1}</span>
          <label class="champ">Nom<input data-rs="${i}" data-k="nom" value="${esc(x.nom)}" maxlength="60" placeholder="${x.type === 'salle' ? 'Ex. : Salle du rez-de-chaussée' : x.type === 'bureau' ? 'Ex. : Bureau flex 1' : 'Ex. : Vidéoprojecteur'}"></label>
          <label class="champ">Type<select data-rs="${i}" data-k="type">${B.types.map((t) => `<option value="${t.id}" ${t.id === x.type ? 'selected' : ''}>${t.nom}</option>`).join('')}</select></label>
          <label class="champ">Capacité<input type="number" min="1" max="500" data-rs="${i}" data-k="capacite" value="${esc(x.capacite)}"></label></li>`).join('')}</ol>
        <div class="rang" style="margin-top:10px">${a.ressources.length < R.MAX_RESSOURCES ? '<button class="btn petit" data-action="accueil-ressource" data-type="salle">+ Salle</button><button class="btn petit" data-action="accueil-ressource" data-type="bureau">+ Bureau</button><button class="btn petit" data-action="accueil-ressource" data-type="equipement">+ Équipement</button>' : ''}</div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Horaires et créneaux</h1>
        <p class="intro">On réserve pendant les horaires d'ouverture, par pas de ${a.pas} minutes. Les jours fériés sont fermés (modifiable dans les Réglages).</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ouverture<input type="time" id="ouverture" value="${esc(a.ouverture)}" step="900"></label>
          <label class="champ">Fermeture<input type="time" id="fermeture" value="${esc(a.fermeture)}" step="900"></label>
          <label class="champ">Pas des créneaux<select id="pas">${R.PAS.map((p) => `<option value="${p}" ${p === Number(a.pas) ? 'selected' : ''}>${p} minutes</option>`).join('')}</select></label>
        </div>
        <fieldset class="champ jours-ouverts" style="margin-top:16px"><legend>Jours ouverts</legend><div class="cases">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<label class="case"><input type="checkbox" data-jour="${w}" ${a.jours.includes(w) ? 'checked' : ''}> ${R.JOURS[w]}</label>`).join('')}</div></fieldset>
        <label class="champ" style="max-width:420px;margin-top:20px">Ton nom <small>Pré-rempli quand tu réserves depuis cet appareil. Un prénom suffit.</small><input id="nom" value="${esc(a.nom)}" maxlength="60" autocomplete="given-name"></label>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer le planning</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#organisation')?.addEventListener('input', (e) => { accueil.organisation = e.target.value; });
    ['ouverture', 'fermeture', 'pas', 'nom'].forEach((k) => $(`#${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; }));
    document.querySelectorAll('[data-jour]').forEach((el) => el.addEventListener('change', () => { const w = Number(el.dataset.jour); accueil.jours = el.checked ? [...accueil.jours, w] : accueil.jours.filter((x) => x !== w); }));
    document.querySelectorAll('[data-rs]').forEach((el) => el.addEventListener('input', () => { accueil.ressources[Number(el.dataset.rs)][el.dataset.k] = el.value; }));
  }

  function erreurAccueil(m) { const p = $('#erreur-accueil'); if (p) p.textContent = m; }
  function accueilSuivant() {
    if (!accueil.ressources.some((x) => x.nom.trim())) return erreurAccueil('Donne un nom à au moins une ressource.');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }
  function terminerAccueil() {
    const a = accueil;
    if (!R.estHeure(a.ouverture) || !R.estHeure(a.fermeture) || a.fermeture <= a.ouverture) return erreurAccueil('Indique une heure d\'ouverture avant l\'heure de fermeture.');
    if (!a.jours.length) return erreurAccueil('Coche au moins un jour ouvert.');
    E = etatVide();
    E.organisation = a.organisation.trim();
    E.reglages = R.reglagesDe({ ...E.reglages, ouverture: a.ouverture, fermeture: a.fermeture, jours: a.jours, pas: Number(a.pas) }, E.reglages);
    E.ressources = a.ressources.filter((x) => x.nom.trim()).map((x, i) => R.normaliserRessource({ id: uid(), nom: x.nom.trim(), type: x.type, capacite: x.capacite, couleur: i % 8 }, i));
    if (a.nom.trim()) ecrireNom(a.nom);
    accueil = accueilVide();
    vue = 'maintenant';
    autresModifs = true;
    sauver();
    demarrer();
    toast('Le planning est prêt. Partage la clé avec les personnes qui réservent.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    maintenant: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    jour: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="8" height="4" fill="currentColor"/><rect x="13" y="10" width="8" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    liste: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    occupation: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['maintenant', 'Maintenant'], ['jour', 'Jour'], ['semaine', 'Semaine'], ['liste', 'Réservations'], ['occupation', 'Occupation']];
  const MENTION = '<p class="mention avertissement">Une clé partagée, pas de comptes : toute personne qui a la clé peut réserver, modifier ou supprimer une réservation. Chaque réservation garde le nom saisi et sa date de création. Garde le minimum dans les noms et les objets (un prénom suffit).</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/salles/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Salles<br>et bureaux</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, ressources et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (ops.length || autresModifs ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Salles et bureaux`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { maintenant: vueMaintenant, jour: vueJour, semaine: vueSemaine, liste: vueListe, occupation: vueOccupation }[vue]();
    brancherInfobulles();
    if (vue === 'jour') ajusterGrilleJour();
    if (vue === 'semaine') centrerSemaine();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const dj = $('#date-jour');
    if (dj) dj.addEventListener('change', (e) => { if (R.estDate(e.target.value)) { jourVu = e.target.value; rendre(); } });
    const rs = $('#ressource-semaine');
    if (rs) rs.addEventListener('change', (e) => { ressourceSemaine = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="8" width="56" height="40" fill="#1D4E89"/><rect x="0" y="56" width="26" height="40" fill="#F5B400"/><circle cx="74" cy="70" r="22" fill="#D9302A"/></svg>';
  const sansRessource = () => `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune ressource</h3><p>Ajoute d'abord une salle, un bureau ou un équipement : les réservations s'y rattachent.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-ressource">${ICONES.plus}Ajouter une ressource</button></div></div></div>`;
  const boutonNouvelle = (lib = 'Réserver') => `<button class="btn primaire" data-action="nouvelle">${ICONES.plus}${lib}</button>`;
  const filtresType = () => {
    const nb = (t) => actives().filter((x) => t === 'tous' || x.type === t).length;
    const l = [['tous', 'Tout'], ...B.types.map((t) => [t.id, t.pluriel])].filter(([id]) => id === 'tous' || nb(id));
    return l.length > 2 ? `<div class="filtres" role="group" aria-label="Type de ressource">${l.map(([id, lib]) => `<button class="filtre" data-action="type" data-type="${id}" aria-pressed="${filtreType === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>` : '';
  };
  const pastille = (x) => `<i class="pastille-res" style="--rc:${couleur(x)}" aria-hidden="true"></i>`;
  const detailRessource = (x) => [R.LIB_TYPE[x.type], x.type === 'salle' ? `${x.capacite} pers.` : '', x.lieu].filter(Boolean).join(' · ');

  function alerteConflits() {
    const c = R.conflits(E.reservations).filter((x) => x.a.date >= auj());
    if (!c.length) return '';
    return `<div class="alerte-conflit" role="alert"><b>${pluriel(c.length, 'chevauchement')} à régler</b><ul>${c.slice(0, 5).map((x) => `<li>${esc(nomRessource(x.a.ressource))}, ${dateCourte(x.a.date)} : <button class="btn lien" data-action="ouvrir" data-id="${x.a.id}">${plage(x.a)} ${esc(x.a.par)}</button> et <button class="btn lien" data-action="ouvrir" data-id="${x.b.id}">${plage(x.b)} ${esc(x.b.par)}</button></li>`).join('')}</ul><p>Ces réservations viennent d'une copie restaurée : déplace ou supprime l'une d'elles.</p></div>`;
  }

  // ---------- Maintenant ----------
  function carteRessource(x, t, m) {
    const e = R.etatRessource(x.id, E, t, m);
    let statut, corps, actions;
    if (e.statut === 'occupee') {
      statut = `<span class="etiquette rose">Occupée</span>`;
      corps = `<b class="res-etat">Libre à ${e.libreA}</b><button class="lien-ligne" data-action="ouvrir" data-id="${e.resa.id}"><span>${esc(e.resa.objet || 'Réservée')}${e.resa.par ? ` · ${esc(e.resa.par)}` : ''} · ${plage(e.resa)}</span></button>`;
      actions = `<button class="btn petit" data-action="voir-jour" data-date="${t}">Voir la journée</button>`;
    } else if (e.statut === 'libre') {
      statut = '<span class="etiquette vert">Libre</span>';
      const toute = e.jusqua === E.reglages.fermeture;
      corps = `<b class="res-etat">${toute ? 'Libre jusqu\'à la fermeture' : `Libre jusqu'à ${e.jusqua}`}</b><span class="res-suite">${e.prochaine ? `Ensuite : ${esc(e.prochaine.objet || 'réservée')}${e.prochaine.par ? `, ${esc(e.prochaine.par)}` : ''}` : `Fermeture à ${E.reglages.fermeture}`}</span>`;
      const c30 = R.creneauMaintenant(x.id, E, t, m, 30), c60 = R.creneauMaintenant(x.id, E, t, m, 60);
      actions = [c30 ? `<button class="btn petit primaire" data-action="rapide" data-res="${x.id}" data-duree="30">Prendre ${c30.debut}–${c30.fin}</button>` : '', c60 && c60.fin !== c30?.fin ? `<button class="btn petit" data-action="rapide" data-res="${x.id}" data-duree="60">Jusqu'à ${c60.fin}</button>` : ''].join('');
    } else {
      statut = '<span class="etiquette sable">Fermé</span>';
      corps = `<b class="res-etat">${e.raison === 'avant' ? `Ouvre à ${e.ouvreA}` : 'Fermé'}</b><span class="res-suite">${e.prochaine ? `Première réservation : ${plage(e.prochaine)}` : ''}</span>`;
      actions = '';
    }
    return `<article class="res-carte st-${e.statut}" style="--rc:${couleur(x)}">
      <div class="res-tete"><button class="lien-ligne" data-action="ressource" data-id="${x.id}"><b>${esc(x.nom)}</b><span>${esc(detailRessource(x))}</span></button>${statut}</div>
      <div class="res-corps">${corps}</div>
      ${x.equipements.length ? `<p class="res-eq">${x.equipements.map((q) => `<span>${esc(q)}</span>`).join('')}</p>` : ''}
      <div class="res-pied">${actions}<button class="btn petit lien" data-action="nouvelle-res" data-res="${x.id}">Autre créneau</button></div>
    </article>`;
  }

  function vueMaintenant() {
    const t = auj(), m = minuteNow();
    const nom = monNom();
    const titre = `<div class="vue-tete"><div><h1>Maintenant <span class="heure-vive">${heure(m)}</span></h1><p>${E.organisation ? `${esc(E.organisation)} · ` : ''}${dateLongue(t)} : ce qui est libre, ce qui est pris et jusqu'à quand.</p></div>
      <div class="actions">${actives().length ? boutonNouvelle() : ''}</div></div>`;
    if (!actives().length) return `${titre}${sansRessource()}${MENTION}`;
    const j = R.jourOuvert(t, E.reglages);
    const etats = actives().map((x) => R.etatRessource(x.id, E, t, m));
    const libres = etats.filter((e) => e.statut === 'libre').length;
    const occ = R.occupation(E, t, ajout(t, 1));
    const duJour = E.reservations.filter((r) => r.date === t);
    const mes = nom ? R.aVenir(E.reservations, t, m).filter((r) => R.memeNom(r.par, nom)) : [];
    const prochaineOuv = !j.ouvert || heure(m) >= E.reglages.fermeture ? R.prochainJourOuvert(ajout(t, j.ouvert ? 1 : 0), E.reglages) : null;
    const ferme = !j.ouvert ? `<div class="bandeau-ferme"><b>${j.raison === 'ferie' ? `Fermé aujourd'hui : ${esc(j.nom)}` : `Fermé le ${R.JOURS[R.jourSemaine(t)]}`}</b>${prochaineOuv ? `<span>Réouverture ${quand(prochaineOuv)} à ${E.reglages.ouverture}.</span><button class="btn petit" data-action="voir-jour" data-date="${prochaineOuv}">Voir ce jour-là</button>` : ''}</div>`
      : heure(m) >= E.reglages.fermeture ? `<div class="bandeau-ferme"><b>Fermé depuis ${E.reglages.fermeture}</b>${prochaineOuv ? `<span>Réouverture ${quand(prochaineOuv)} à ${E.reglages.ouverture}.</span><button class="btn petit" data-action="voir-jour" data-date="${prochaineOuv}">Voir ce jour-là</button>` : ''}</div>` : '';
    const tuiles = [
      ['Libres maintenant', `${libres} / ${actives().length}`, j.ouvert ? `${pluriel(etats.filter((e) => e.statut === 'occupee').length, 'occupée')}` : 'lieu fermé', 'var(--vert)', 'rond'],
      ['Réservations du jour', String(duJour.length), duJour.length ? `de ${duJour.map((r) => r.debut).sort()[0]} à ${duJour.map((r) => r.fin).sort().pop()}` : 'aucune', 'var(--bleu)', ''],
      ['Occupation du jour', R.pct(occ.taux), `${R.texteDuree(occ.reserve)} réservées`, 'var(--jaune)', 'rond'],
      ['Tes réservations', String(mes.length), nom ? (mes[0] ? `prochaine ${quand(mes[0].date)} à ${mes[0].debut}` : 'aucune à venir') : 'indique ton nom', 'var(--rouge)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `${titre}
      ${ferme}
      <div class="tuiles">${tuiles}</div>
      ${alerteConflits()}
      <div class="outils-liste" style="margin-top:24px">${filtresType()}<span class="mention">Mis à jour à ${heure(m)}${session.demo ? '' : ' · actualisé chaque minute'}</span></div>
      <div class="grille-res">${visibles().map((x) => carteRessource(x, t, m)).join('')}</div>
      <h2 class="titre-section">Tes prochaines réservations <span>${nom ? `au nom de ${esc(nom)}` : 'sur cet appareil'}</span></h2>
      ${!nom ? `<div class="vide-etat petit"><div><h3>Qui réserve depuis cet appareil ?</h3><p>Indique ton nom (un prénom suffit) : il est pré-rempli à chaque réservation et retrouve les tiennes. Il reste sur cet appareil.</p><div class="actions"><button class="btn petit" data-action="mon-nom">Indiquer mon nom</button></div></div></div>`
        : mes.length ? `<ul class="journal">${mes.slice(0, 6).map((r) => ligneResa(r)).join('')}</ul>` : `<p class="aide">Aucune réservation à venir au nom de ${esc(nom)}. <button class="btn lien" data-action="mon-nom">Changer de nom</button></p>`}
      ${MENTION}`;
  }

  function ligneResa(r, { date = true } = {}) {
    const x = ressource(r.ressource);
    const passe = r.date < auj() || (r.date === auj() && r.fin <= heure(minuteNow()));
    return `<li class="${passe ? 'passee' : ''}"><span class="date-pastille" style="--rc:${couleur(x)}"><b>${date ? versDate(r.date).getDate() : r.debut.slice(0, 2)}</b>${date ? fmt(r.date, { month: 'short' }).replace('.', '') : r.debut.slice(3)}</span>
      <button class="lien-ligne" data-action="ouvrir" data-id="${r.id}"><b>${esc(r.objet || 'Réservation')} · ${esc(x?.nom || 'Ressource supprimée')}</b><span>${date ? `${dateCourte(r.date)}, ` : ''}${plage(r)} · ${R.texteDuree(R.duree(r))}${r.par ? ` · ${esc(r.par)}` : ''}${x?.type === 'salle' ? ` · ${pluriel(r.personnes, 'pers.', 'pers.')}` : ''}</span></button>
      <span class="ligne-tags">${r.serie ? '<span class="etiquette ciel">Chaque semaine</span>' : ''}</span></li>`;
  }

  // ---------- Jour : ressources × heures ----------
  function navJour() {
    const t = auj();
    return `<div class="nav-mois"><button class="btn petit" data-action="jour-nav" data-n="-1" aria-label="Jour précédent">‹</button><h2>${dateLongue(jourVu)}</h2><button class="btn petit" data-action="jour-nav" data-n="1" aria-label="Jour suivant">›</button>${jourVu !== t ? '<button class="btn petit" data-action="jour-nav" data-n="0">Aujourd\'hui</button>' : ''}<label class="champ champ-date"><span class="sr-only">Aller au</span><input type="date" id="date-jour" value="${jourVu}"></label></div>`;
  }
  function vueJour() {
    const g = E.reglages;
    const titre = `<div class="vue-tete"><div><h1>Jour</h1><p>Une ligne par ressource, de ${g.ouverture} à ${g.fermeture}. Touche un créneau libre pour réserver ; une réservation pour la modifier.</p></div>
      <div class="actions">${actives().length ? boutonNouvelle() : ''}</div></div>`;
    if (!actives().length) return `${titre}${sansRessource()}`;
    const j = R.jourOuvert(jourVu, g);
    const o = minutes(g.ouverture), f = minutes(g.fermeture);
    const nb = (f - o) / g.pas;
    const heures = [];
    for (let h = Math.ceil(o / 60) * 60; h < f; h += 60) heures.push(h);
    const t = auj();
    const ligneNow = jourVu === t && minuteNow() >= o && minuteNow() < f ? `<span class="trait-now" style="left:calc(var(--nom) + ${(minuteNow() - o) / g.pas} * var(--w))" aria-hidden="true"></span>` : '';
    const tete = `<div class="jr-ligne jr-tete"><div class="jr-nom"></div><div class="jr-piste">${heures.map((h) => `<span class="jr-heure" style="left:calc(${(h - o) / g.pas} * var(--w))">${heure(h).replace(':00', ' h')}</span>`).join('')}</div></div>`;
    const lignes = visibles().map((x) => {
      const rs = R.duJour(E.reservations, x.id, jourVu);
      const cases = j.ouvert ? Array.from({ length: nb }, (_, i) => { const d = heure(o + i * g.pas); const pris = rs.some((r) => r.debut <= d && d < r.fin); const passe = jourVu < t || (jourVu === t && o + (i + 1) * g.pas <= minuteNow()); return pris || passe ? '' : `<button class="jr-case ${(o + i * g.pas) % 60 === 0 ? 'h' : ''}" style="left:calc(${i} * var(--w))" data-action="nouvelle-creneau" data-res="${x.id}" data-date="${jourVu}" data-debut="${d}" aria-label="Réserver ${esc(x.nom)} à ${d}" tabindex="-1"></button>`; }).join('') : '';
      const barres = rs.map((r) => {
        const a = (minutes(r.debut) - o) / g.pas, b = (minutes(r.fin) - o) / g.pas;
        const passe = jourVu < t || (jourVu === t && r.fin <= heure(minuteNow()));
        return `<button class="jr-barre ${passe ? 'passe' : ''} ${R.conflitsAvec(r, E.reservations).length ? 'conflit' : ''}" style="left:calc(${Math.max(0, a)} * var(--w) + 1px);width:calc(${Math.min(nb, b) - Math.max(0, a)} * var(--w) - 3px)" data-action="ouvrir" data-id="${r.id}" title="${esc(`${plage(r)} · ${r.objet || 'Réservation'}${r.par ? ` · ${r.par}` : ''}`)}"><b>${esc(r.objet || 'Réservé')}</b><span>${r.debut}${r.par ? ` · ${esc(r.par)}` : ''}</span></button>`;
      }).join('');
      const occ = rs.reduce((s, r) => s + Math.max(0, Math.min(f, minutes(r.fin)) - Math.max(o, minutes(r.debut))), 0);
      return `<div class="jr-ligne" style="--rc:${couleur(x)}"><div class="jr-nom"><button class="lien-ligne" data-action="semaine-de" data-id="${x.id}" title="Voir la semaine de ${esc(x.nom)}"><b>${esc(x.nom)}</b><span>${j.ouvert ? `${R.pct((occ / (f - o)) * 100)} réservé` : R.LIB_TYPE[x.type]}</span></button></div><div class="jr-piste ${j.ouvert ? '' : 'fermee'}">${cases}${barres}</div></div>`;
    }).join('');
    const liste = E.reservations.filter((r) => r.date === jourVu && visibles().some((x) => x.id === r.ressource)).sort((a, b) => a.debut.localeCompare(b.debut) || nomRessource(a.ressource).localeCompare(nomRessource(b.ressource)));
    return `${titre}${navJour()}
      ${!j.ouvert ? `<div class="bandeau-ferme"><b>${j.raison === 'ferie' ? `Jour férié : ${esc(j.nom)}` : `Fermé le ${R.JOURS[R.jourSemaine(jourVu)]}`}</b><span>Aucune réservation possible ce jour-là (voir les Réglages).</span></div>` : ''}
      <div class="outils-liste">${filtresType()}</div>
      <div class="jr-cadre defile" id="jr-defile"><div class="jr" style="--n:${nb}">${tete}${lignes}${ligneNow}</div></div>
      <p class="legende-cal">Touche une case vide pour réserver · <span class="pastille-l passe"></span>Passé · créneaux de ${g.pas} minutes</p>
      <h2 class="titre-section">Réservations du ${fmt(jourVu, { day: 'numeric', month: 'long' })} <span>${pluriel(liste.length, 'réservation')}</span></h2>
      ${liste.length ? `<ul class="journal">${liste.map((r) => ligneResa(r, { date: false })).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Rien de réservé</h3><p>${j.ouvert ? 'Toutes les ressources sont libres ce jour-là.' : 'Le lieu est fermé.'}</p></div></div>`}`;
  }
  // Largeur d'un pas : remplit le cadre sur ordinateur, 26 px au moins (défilement horizontal sur téléphone).
  function ajusterGrilleJour() {
    const cadre = $('#jr-defile');
    const jr = cadre?.querySelector('.jr');
    if (!jr) return;
    const nom = parseFloat(getComputedStyle(jr).getPropertyValue('--nom')) || 180;
    const n = Number(jr.style.getPropertyValue('--n')) || 22;
    const min = E.reglages.pas === 15 ? 18 : E.reglages.pas === 60 ? 52 : 28;
    jr.style.setProperty('--w', `${Math.max(min, Math.floor((cadre.clientWidth - nom - 2) / n))}px`);
    if (jourVu === auj() && cadre.scrollWidth > cadre.clientWidth) {
      const o = minutes(E.reglages.ouverture);
      const w = parseFloat(jr.style.getPropertyValue('--w'));
      cadre.scrollLeft = Math.max(0, ((minuteNow() - o) / E.reglages.pas) * w - cadre.clientWidth / 3);
    }
  }

  // ---------- Semaine : une ressource, 7 jours × heures ----------
  function vueSemaine() {
    const g = E.reglages;
    const titre = `<div class="vue-tete"><div><h1>Semaine</h1><p>Une ressource, sept jours. Touche un créneau libre pour réserver.</p></div>
      <div class="actions">${actives().length ? boutonNouvelle() : ''}</div></div>`;
    if (!actives().length) return `${titre}${sansRessource()}`;
    if (!ressource(ressourceSemaine) || ressource(ressourceSemaine).archive) ressourceSemaine = actives()[0].id;
    const x = ressource(ressourceSemaine);
    const t = auj(), mNow = minuteNow();
    const o = minutes(g.ouverture), f = minutes(g.fermeture);
    const nb = (f - o) / g.pas;
    const jours = Array.from({ length: 7 }, (_, i) => ajout(semaineVue, i));
    const ouverts = jours.filter((d) => (g.jours || []).includes(R.jourSemaine(d)));
    const choix = `<label class="champ choix-ressource">Ressource<select id="ressource-semaine">${B.types.map((ty) => { const l = actives().filter((r) => r.type === ty.id); return l.length ? `<optgroup label="${ty.pluriel}">${l.map((r) => `<option value="${r.id}" ${r.id === x.id ? 'selected' : ''}>${esc(r.nom)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>`;
    const nav = `<div class="nav-mois"><button class="btn petit" data-action="semaine-nav" data-n="-1" aria-label="Semaine précédente">‹</button><h2>Semaine du ${fmt(semaineVue, { day: 'numeric', month: 'long' })}</h2><button class="btn petit" data-action="semaine-nav" data-n="1" aria-label="Semaine suivante">›</button>${semaineVue !== R.lundi(t) ? '<button class="btn petit" data-action="semaine-nav" data-n="0">Cette semaine</button>' : ''}</div>`;
    const heures = [];
    for (let h = Math.ceil(o / 60) * 60; h < f; h += 60) heures.push(h);
    const axe = `<div class="sm-axe">${heures.map((h) => `<span style="top:calc(${(h - o) / g.pas} * var(--h))">${heure(h).replace(':00', ' h')}</span>`).join('')}</div>`;
    const cols = ouverts.map((d) => {
      const j = R.jourOuvert(d, g);
      const rs = R.duJour(E.reservations, x.id, d);
      const cases = j.ouvert ? Array.from({ length: nb }, (_, i) => { const deb = heure(o + i * g.pas); const pris = rs.some((r) => r.debut <= deb && deb < r.fin); const passe = d < t || (d === t && o + (i + 1) * g.pas <= mNow); return pris || passe ? '' : `<button class="sm-case ${(o + i * g.pas) % 60 === 0 ? 'h' : ''}" style="top:calc(${i} * var(--h))" data-action="nouvelle-creneau" data-res="${x.id}" data-date="${d}" data-debut="${deb}" aria-label="Réserver le ${dateLongue(d)} à ${deb}" tabindex="-1"></button>`; }).join('') : '';
      const blocs = rs.map((r) => { const a = (minutes(r.debut) - o) / g.pas, b = (minutes(r.fin) - o) / g.pas; const passe = d < t || (d === t && r.fin <= heure(mNow)); return `<button class="sm-bloc ${passe ? 'passe' : ''}" style="top:calc(${Math.max(0, a)} * var(--h) + 1px);height:calc(${Math.min(nb, b) - Math.max(0, a)} * var(--h) - 3px)" data-action="ouvrir" data-id="${r.id}"><b>${r.debut}–${r.fin}</b><span>${esc(r.objet || 'Réservé')}</span>${r.par ? `<span>${esc(r.par)}</span>` : ''}</button>`; }).join('');
      const now = d === t && mNow >= o && mNow < f ? `<span class="trait-now-h" style="top:calc(${(mNow - o) / g.pas} * var(--h))" aria-hidden="true"></span>` : '';
      return `<div class="sm-col ${j.ouvert ? '' : 'fermee'} ${d === t ? 'auj' : ''}"><div class="sm-jour"><b>${fmt(d, { weekday: 'short' }).replace('.', '')}</b> ${versDate(d).getDate()}${j.raison === 'ferie' ? `<small>${esc(j.nom)}</small>` : ''}</div><div class="sm-piste">${cases}${blocs}${now}</div></div>`;
    }).join('');
    const occ = R.occupation(E, semaineVue, ajout(semaineVue, 7), { ressources: [x.id] });
    return `${titre}
      <div class="rang-outils">${choix}<p class="info-res">${pastille(x)}<span><b>${esc(x.nom)}</b> · ${esc(detailRessource(x))}${x.equipements.length ? ` · ${esc(x.equipements.join(', '))}` : ''}</span><button class="btn petit lien" data-action="ressource" data-id="${x.id}">Fiche</button></p></div>
      ${nav}
      <div class="sm-cadre defile" id="sm-defile"><div class="sm" style="--n:${nb};--c:${ouverts.length};--rc:${couleur(x)}"><div class="sm-col sm-col-axe"><div class="sm-jour"></div>${axe}</div>${cols}</div></div>
      <p class="legende-cal">${esc(x.nom)} : ${R.pct(occ.taux)} réservé cette semaine (${R.texteDuree(occ.reserve)} sur ${R.texteDuree(occ.ouvert)} d'ouverture) · ${pluriel(occ.nb, 'réservation')}</p>`;
  }
  function centrerSemaine() {
    const cadre = $('#sm-defile');
    const c = cadre?.querySelector('.sm-col.auj');
    if (cadre && c && cadre.scrollWidth > cadre.clientWidth) cadre.scrollLeft = Math.max(0, c.offsetLeft - 56);
  }

  // ---------- Réservations ----------
  const FILTRES = [['aVenir', 'À venir'], ['miennes', 'Les miennes'], ['aujourdhui', 'Aujourd\'hui'], ['series', 'Chaque semaine'], ['passees', 'Passées'], ['toutes', 'Toutes']];
  function garder(r, f, t, m, nom) {
    const fini = r.date < t || (r.date === t && r.fin <= heure(m));
    if (f === 'toutes') return true;
    if (f === 'passees') return fini;
    if (f === 'aujourdhui') return r.date === t;
    if (fini) return false;
    if (f === 'miennes') return R.memeNom(r.par, nom);
    if (f === 'series') return !!r.serie;
    return true;
  }
  function vueListe() {
    const t = auj(), m = minuteNow(), nom = monNom();
    const q = filtre.q.trim().toLocaleLowerCase('fr');
    const l = E.reservations.filter((r) => garder(r, filtre.liste, t, m, nom) && (!q || `${r.objet} ${r.par} ${nomRessource(r.ressource)} ${r.note}`.toLocaleLowerCase('fr').includes(q)))
      .sort((a, b) => (['passees', 'toutes'].includes(filtre.liste) ? -1 : 1) * R.triChrono(a, b));
    const nb = (id) => E.reservations.filter((r) => garder(r, id, t, m, nom)).length;
    const parJour = [];
    for (const r of l.slice(0, 300)) { const g = parJour.at(-1); if (g && g.date === r.date) g.l.push(r); else parJour.push({ date: r.date, l: [r] }); }
    return `
      <div class="vue-tete"><div><h1>Réservations</h1><p>Toutes les réservations de l'équipe. Filtre les tiennes${nom ? ` (${esc(nom)})` : ''}, cherche un nom, une salle ou un objet.</p></div>
        <div class="actions">${actives().length ? boutonNouvelle() : ''}</div></div>
      ${!actives().length ? sansRessource() : `
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-f="${id}" aria-pressed="${filtre.liste === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Nom, ressource, objet" value="${esc(filtre.q)}"></label>
      </div>
      ${filtre.liste === 'miennes' && !nom ? `<p class="aide">Indique ton nom pour retrouver tes réservations. <button class="btn lien" data-action="mon-nom">Indiquer mon nom</button></p>` : ''}
      ${l.length ? `<p class="resume-liste">${pluriel(l.length, 'réservation')} · ${R.texteDuree(l.reduce((s, r) => s + R.duree(r), 0))}${l.length > 300 ? ' · 300 premières affichées' : ''}</p>${parJour.map((g) => `<h3 class="titre-jour">${dateLongue(g.date)}</h3><ul class="journal">${g.l.map((r) => ligneResa(r, { date: false })).join('')}</ul>`).join('')}`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.reservations.length ? 'Aucune réservation ne correspond' : 'Aucune réservation'}</h3><p>${E.reservations.length ? 'Change le filtre ou la recherche.' : 'Réserve un premier créneau : ressource, date, heures et ton nom.'}</p><div class="actions">${boutonNouvelle('Réserver')}</div></div></div>`}
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>`}
      <div class="rgpd"><h2>Noms des personnes</h2><p>Chaque réservation garde le nom saisi : un prénom ou des initiales suffisent. Ni e-mail ni téléphone ici. Dans les Réglages, efface les noms et les objets des réservations passées depuis plusieurs mois : les créneaux restent pour les taux d'occupation.</p></div>`;
  }

  // ---------- Occupation ----------
  function vueOccupation() {
    const t = auj();
    const fin = ajout(R.lundi(t), 7);
    const debut = ajout(fin, -7 * periodeOcc);
    const titre = `<div class="vue-tete"><div><h1>Occupation</h1><p>Part des heures d'ouverture réservées, du ${fmt(debut, { day: 'numeric', month: 'long' })} au ${fmt(ajout(fin, -1), { day: 'numeric', month: 'long' })}. Jours fermés et fériés exclus.</p></div>
      <div class="actions"><div class="filtres" role="group" aria-label="Période">${[[1, 'Cette semaine'], [4, '4 semaines'], [12, '12 semaines']].map(([n, lib]) => `<button class="filtre" data-action="periode" data-n="${n}" aria-pressed="${periodeOcc === n}">${lib}</button>`).join('')}</div></div></div>`;
    if (!actives().length) return `${titre}${sansRessource()}`;
    const o = R.occupation(E, debut, fin);
    const top = [...o.parRessource].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
    const tuiles = [
      ['Occupation', R.pct(o.taux), `${R.texteDuree(o.reserve)} sur ${R.texteDuree(o.ouvert)} ouvertes`, 'var(--bleu)', ''],
      ['Réservations', String(o.nb), `sur ${pluriel(o.joursOuverts, 'jour ouvert', 'jours ouverts')}`, 'var(--jaune)', 'rond'],
      ['La plus demandée', top[0] && top[0].reserve ? esc(nomRessource(top[0].ressource)) : '–', top[0] && top[0].reserve ? `${R.pct(top[0].taux)} réservée` : 'aucune réservation', 'var(--rouge)', ''],
      ['La moins utilisée', top.length > 1 ? esc(nomRessource(top.at(-1).ressource)) : '–', top.length > 1 ? `${R.pct(top.at(-1).taux)} réservée` : '', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b class="${v.length > 10 ? 'long' : ''}">${v}</b><span>${d}</span></div>`).join('');
    const max = Math.max(1, ...o.parRessource.map((x) => x.taux || 0));
    const barres = B.types.map((ty) => {
      const l = o.parRessource.filter((x) => ressource(x.ressource)?.type === ty.id);
      if (!l.length) return '';
      return `<p class="bc-groupe">${ty.pluriel}</p>${l.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(nomRessource(x.ressource))}</b>${R.pct(x.taux, 1)} des heures d'ouverture<br>${R.texteDuree(x.reserve)} réservées · ${pluriel(x.nb, 'réservation')}`)}"><span class="bc-nom">${pastille(ressource(x.ressource))}${esc(nomRessource(x.ressource))}</span><span class="bc-piste"><span class="bc-barre" style="width:${x.taux ? Math.max(1, (x.taux / max) * 100) : 0}%"></span></span><span class="bc-val">${R.pct(x.taux)}<small>${R.texteDuree(x.reserve)}</small></span></div>`).join('')}`;
    }).join('');
    const jours = [1, 2, 3, 4, 5, 6, 0].filter((w) => E.reglages.jours.includes(w));
    const maxJ = Math.max(1, ...jours.map((w) => o.parJour[w].taux || 0));
    const colsJ = jours.map((w) => { const c = o.parJour[w]; return `<div class="col-proj ${c.taux === maxJ && c.taux ? 'max' : ''}" tabindex="0" data-info="${esc(`<b>${R.JOURS[w]}</b>${c.ouvert ? `${R.pct(c.taux, 1)} réservé<br>${R.texteDuree(c.reserve)} sur ${R.texteDuree(c.ouvert)}` : 'aucun jour ouvert sur la période'}`)}"><span class="cp-val">${c.ouvert ? R.pct(c.taux) : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${c.taux ? Math.max(2, (c.taux / maxJ) * 100) : 0}%"></span></span><span class="cp-mois">${R.JOURS[w].slice(0, 3)}</span></div>`; }).join('');
    const niveau = (taux) => (taux === null ? -1 : Math.min(7, Math.ceil(taux / (100 / 7))));
    const carte = `<div class="carte-h defile"><table class="tableau carte-heures"><caption class="sr-only">Taux d'occupation par jour et par heure</caption><thead><tr><th scope="col">Heure</th>${jours.map((w) => `<th scope="col">${R.JOURS[w].slice(0, 3)}</th>`).join('')}</tr></thead><tbody>${o.heures.map((h, i) => `<tr><th scope="row">${h} h</th>${jours.map((w) => { const c = o.carte[w][i]; const n = niveau(c.taux); return `<td class="${n < 0 ? 'vide' : ''}" style="${n >= 0 ? `background:${B.rampe[n]};color:${n >= 4 ? '#fff' : 'var(--encre)'}` : ''}" title="${R.JOURS[w]} ${h} h : ${R.pct(c.taux)}">${n < 0 ? '' : R.pct(c.taux)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="legende-cal legende-rampe">0 %${B.rampe.map((c) => `<i style="background:${c}"></i>`).join('')}100 % · toutes ressources confondues</p>`;
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Par ressource <span>Part des heures d'ouverture réservées</span></h2>
      <figure class="graphique"><div class="barres-cats">${barres}</div><div class="infobulle" hidden></div></figure>
      <div class="colonnes-occ">
        <section><h2 class="titre-section">Par jour de la semaine</h2><figure class="graphique"><div class="projection" style="grid-template-columns:repeat(${jours.length},minmax(0,1fr))">${colsJ}</div><div class="infobulle" hidden></div></figure></section>
        <section><h2 class="titre-section">Heures les plus demandées</h2>${carte}</section>
      </div>
      <details class="tableau-details"><summary>Voir le tableau par ressource</summary><div class="defile"><table class="tableau"><thead><tr><th>Ressource</th><th class="nb">Réservations</th><th class="nb">Heures réservées</th><th class="nb">Heures ouvertes</th><th class="nb">Occupation</th></tr></thead><tbody>${o.parRessource.map((x) => `<tr><td>${esc(nomRessource(x.ressource))}</td><td class="nb">${x.nb}</td><td class="nb">${R.texteDuree(x.reserve)}</td><td class="nb">${R.texteDuree(x.ouvert)}</td><td class="nb">${R.pct(x.taux, 1)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${o.nb}</td><td class="nb">${R.texteDuree(o.reserve)}</td><td class="nb">${R.texteDuree(o.ouvert)}</td><td class="nb">${R.pct(o.taux, 1)}</td></tr></tfoot></table></div></details>
      <div class="rgpd"><h2>Lire ces taux</h2><p>Un taux bas sur une grande salle peut cacher des réunions à deux : compare avec le nombre de personnes saisi. Une ressource réservée mais pas utilisée compte comme occupée : invite chacun à libérer ses créneaux (« Libérer maintenant » sur une réservation en cours).</p></div>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 6)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };

  // Options d'heures au pas choisi, pendant les horaires d'ouverture.
  const optionsHeures = (de, a, sel) => { const g = E.reglages; let s = ''; for (let m = de; m <= a; m += g.pas) s += `<option value="${heure(m)}" ${heure(m) === sel ? 'selected' : ''}>${heure(m)}</option>`; return s; };

  // Nouvelle réservation (id absent) ou réservation existante.
  function modaleReservation(id, { res = '', date = '', debut = '', fin = '' } = {}) {
    const t = auj(), g = E.reglages;
    const r = id ? resa(id) : null;
    if (id && !r) return;
    if (!actives().length) { modaleRessource(null); return; }
    const o = minutes(g.ouverture), f = minutes(g.fermeture);
    let d0 = date || jourVu;
    if (!r && (d0 < t || !R.jourOuvert(d0, g).ouvert)) d0 = R.prochainJourOuvert(t, g) || t;
    const mNow = minuteNow();
    const debDefaut = d0 === t ? Math.min(f - g.pas, Math.max(o, Math.ceil(mNow / g.pas) * g.pas)) : Math.max(o, 9 * 60);
    const v = r || { ressource: res || visibles()[0]?.id || actives()[0].id, date: d0, debut: debut || heure(debDefaut), fin: fin || heure(Math.min(f, minutes(debut || heure(debDefaut)) + 60)), objet: '', par: monNom(), personnes: 1, note: '', serie: null };
    const enCours = r && r.date === t && r.debut <= heure(mNow) && heure(mNow) < r.fin;
    const suivantes = r?.serie ? R.occurrencesSuivantes(E.reservations, r).length : 0;
    const corps = `
      ${r ? `<p class="aide">${r.par ? `Réservé par <b>${esc(r.par)}</b>` : 'Réservation sans nom'}${r.creeLe ? `, le ${fmt(r.creeLe)}` : ''}. Toute personne qui a la clé peut la modifier : préviens la personne si ce n'est pas la tienne.</p>` : ''}
      <label class="champ">Ressource<select name="ressource" id="r-ressource">${B.types.map((ty) => { const l = E.ressources.filter((x) => x.type === ty.id && (!x.archive || x.id === v.ressource)); return l.length ? `<optgroup label="${ty.pluriel}">${l.map((x) => `<option value="${x.id}" ${x.id === v.ressource ? 'selected' : ''}>${esc(x.nom)}${x.type === 'salle' ? ` (${x.capacite} pers.)` : ''}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" required value="${v.date}"></label>
        <label class="champ">Début<select name="debut">${optionsHeures(o, f - g.pas, v.debut)}</select></label>
        <label class="champ">Fin<select name="fin">${optionsHeures(o + g.pas, f, v.fin)}</select></label>
      </div>
      <label class="champ">Objet <small>Facultatif : « Point d'équipe », « Rendez-vous client »…</small><input name="objet" maxlength="80" value="${esc(v.objet)}" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Réservé par <small>Ton nom, retenu sur cet appareil.</small><input name="par" maxlength="60" required value="${esc(v.par)}" autocomplete="given-name"></label>
        <label class="champ" id="r-personnes-champ">Personnes<input type="number" name="personnes" min="1" max="500" value="${v.personnes}"></label>
      </div>
      ${r ? '' : `<fieldset class="champ cadre-champs"><legend>Répéter</legend>
        <label class="case"><input type="checkbox" name="repeter" id="r-repeter"> Chaque semaine, le même jour, jusqu'au</label>
        <label class="champ"><span class="sr-only">Dernière date</span><input type="date" name="jusqua" id="r-jusqua" value="${ajout(v.date, 7 * 7)}" disabled></label></fieldset>`}
      ${r?.serie && suivantes > 1 ? `<fieldset class="champ"><legend>Réservation répétée chaque semaine <small>${pluriel(suivantes, 'date', 'dates')} à partir de celle-ci.</small></legend><div class="choix-statut deux"><label><input type="radio" name="portee" value="une" checked><span>Cette date</span></label><label><input type="radio" name="portee" value="suivantes"><span>Celle-ci et les suivantes</span></label></div></fieldset>` : ''}
      <label class="champ">Note <small>Facultative. Pas d'information personnelle.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="recap" id="r-recap" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    const pied = r
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${enCours ? '<button class="btn" value="liberer">Libérer maintenant</button>' : ''}<button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Réserver</button><button class="btn" value="annuler">Annuler</button>';
    const lire = (fd) => ({
      ressource: fd.get('ressource'), date: fd.get('date'), debut: fd.get('debut'), fin: fd.get('fin'),
      objet: String(fd.get('objet') || '').trim(), par: String(fd.get('par') || '').trim(), personnes: Math.round(Number(fd.get('personnes')) || 1),
      note: String(fd.get('note') || '').trim(),
    });
    const planDe = (x, fd) => {
      const modele = R.normaliserReservation({ ...x, id: uid(), serie: uid(), creeLe: t }, t);
      return R.planSerie(modele, fd.get('jusqua'), E, { auj: t });
    };
    ouvrirModale(r ? 'Réservation' : 'Réserver', corps, pied, (fd, action) => {
      const portee = fd.get('portee') === 'suivantes' ? 'suivantes' : 'une';
      if (action === 'supprimer') {
        const cibles = portee === 'suivantes' ? R.occurrencesSuivantes(E.reservations, r) : [r];
        if (!confirm(cibles.length > 1 ? `Supprimer ${pluriel(cibles.length, 'réservation')} (${esc(nomRessource(r.ressource))}, chaque semaine à partir du ${fmt(r.date)}) ?` : `Supprimer la réservation de ${nomRessource(r.ressource)} (${dateCourte(r.date)}, ${plage(r)}) ?`)) { garderOuverte(); return; }
        retenir();
        const ids = new Set(cibles.map((x) => x.id));
        E.reservations = E.reservations.filter((x) => !ids.has(x.id));
        cibles.forEach((x) => journaliser({ type: 'suppr', id: x.id }));
        sauver(); rendre(); toast(cibles.length > 1 ? `${pluriel(cibles.length, 'réservation supprimée', 'réservations supprimées')}.` : 'Réservation supprimée : le créneau est libre.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (action === 'liberer') {
        const nf = R.finLiberee(r, minuteNow(), g.pas);
        retenir();
        if (!nf) { E.reservations = E.reservations.filter((x) => x.id !== r.id); journaliser({ type: 'suppr', id: r.id }); } else { r.fin = nf; journaliser({ type: 'modif', resa: r }); }
        sauver(); rendre(); toast(`${nomRessource(r.ressource)} libérée${nf ? ` à ${nf}` : ''}.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const x = lire(fd);
      if (!x.par) return 'Indique ton nom (un prénom suffit) : les autres sauront qui a réservé.';
      if (!r && fd.get('repeter')) {
        if (!R.estDate(fd.get('jusqua')) || fd.get('jusqua') < x.date) return 'Indique la dernière date de la répétition, après la première.';
        const p = planDe(x, fd);
        if (!p.retenues.length) return `Aucune date possible : ${p.refusees[0]?.erreur || ''}`;
        retenir();
        p.retenues.forEach((n) => { E.reservations.push(n); journaliser({ type: 'ajout', resa: n }); });
        ecrireNom(x.par);
        sauver(); rendre();
        toast(`${pluriel(p.retenues.length, 'réservation créée', 'réservations créées')}, chaque ${R.JOURS[R.jourSemaine(x.date)]}${p.refusees.length ? ` ; ${pluriel(p.refusees.length, 'date refusée', 'dates refusées')} (${p.refusees.map((y) => dateCourte(y.date)).join(', ')})` : ''}.`, { libelle: 'Annuler', faire: annuler }, 9000);
        return;
      }
      if (r && portee === 'suivantes') {
        // Mêmes heures, objet, nom, personnes et ressource pour cette date et les suivantes ; chaque date est revalidée.
        const cibles = R.occurrencesSuivantes(E.reservations, r);
        const essai = structuredClone(E);
        const ok = [], refus = [];
        for (const c of cibles) {
          const n = { ...c, ...x, date: c.id === r.id ? x.date : c.date };
          const autres = essai.reservations.filter((y) => y.id !== c.id);
          const vv = R.valider(n, { ...essai, reservations: autres }, { auj: t, nouvelle: false });
          if (vv.ok) { ok.push(n); essai.reservations = [...autres, n]; } else refus.push({ c, e: vv.erreur });
        }
        if (!ok.length) return refus[0]?.e || 'Aucune date modifiable.';
        retenir();
        ok.forEach((n) => { Object.assign(resa(n.id), n); journaliser({ type: 'modif', resa: n }); });
        ecrireNom(x.par);
        sauver(); rendre();
        toast(`${pluriel(ok.length, 'réservation modifiée', 'réservations modifiées')}${refus.length ? ` ; ${pluriel(refus.length, 'date inchangée', 'dates inchangées')} (conflit : ${refus.map((y) => dateCourte(y.c.date)).join(', ')})` : ''}.`, { libelle: 'Annuler', faire: annuler }, 9000);
        return;
      }
      const candidat = R.normaliserReservation({ ...(r || { creeLe: t }), ...x, id: r?.id || uid() }, t);
      const v2 = R.valider(candidat, E, { auj: t, nouvelle: !r || candidat.date !== r.date });
      if (!v2.ok) return v2.erreur;
      if (!r && (candidat.date < t || (candidat.date === t && candidat.fin <= heure(minuteNow())))) return 'Ce créneau est déjà passé.';
      retenir();
      if (r) { Object.assign(r, candidat); journaliser({ type: 'modif', resa: r }); } else { E.reservations.push(candidat); journaliser({ type: 'ajout', resa: candidat }); }
      ecrireNom(x.par);
      sauver(); rendre();
      toast(r ? 'Réservation enregistrée.' : `${nomRessource(candidat.ressource)} réservée ${quand(candidat.date)}, ${plage(candidat)}.`, { libelle: 'Annuler', faire: annuler });
    });
    // Champs liés : fin après le début, personnes selon le type, répétition, récapitulatif.
    const dlg = modale();
    const f2 = dlg.querySelector('form');
    const majPersonnes = () => { const x = ressource(f2.ressource.value); dlg.querySelector('#r-personnes-champ').hidden = x?.type !== 'salle'; };
    f2.debut.addEventListener('change', () => { if (f2.fin.value <= f2.debut.value) { const n = Math.min(f, minutes(f2.debut.value) + 60); f2.fin.value = heure(n - ((n - o) % g.pas)); } });
    f2.ressource.addEventListener('change', majPersonnes);
    majPersonnes();
    const rep = dlg.querySelector('#r-repeter');
    if (rep) rep.addEventListener('change', () => { dlg.querySelector('#r-jusqua').disabled = !rep.checked; });
    const recap = () => {
      const fd = new FormData(f2);
      const x = lire(fd);
      const el = dlg.querySelector('#r-recap');
      if (!R.estDate(x.date) || !x.debut || !x.fin) { el.textContent = ''; return; }
      if (!r && fd.get('repeter') && R.estDate(fd.get('jusqua'))) {
        const p = planDe({ ...x, par: x.par || '—' }, fd);
        el.innerHTML = `<b>${pluriel(p.retenues.length, 'date réservable', 'dates réservables')}</b>, chaque ${R.JOURS[R.jourSemaine(x.date)]} jusqu'au ${fmt(fd.get('jusqua'))}${p.retenues.length === R.MAX_OCCURRENCES ? ' (52 au plus)' : ''}.${p.refusees.length ? `<br><span class="texte-alerte">Refusées : ${p.refusees.map((y) => `${dateCourte(y.date)} (${esc(y.erreur.replace(/\.$/, ''))})`).join(' ; ')}</span>` : ''}`;
        return;
      }
      const c = R.normaliserReservation({ ...x, id: r?.id || 'apercu', par: x.par || '—' }, t);
      const vv = R.valider(c, E, { auj: t, nouvelle: !r || c.date !== r.date });
      el.innerHTML = vv.ok ? `${esc(nomRessource(c.ressource))} · ${dateLongue(c.date)} · ${plage(c)} (${R.texteDuree(R.duree(c))}) · <b>libre</b>` : `<span class="texte-alerte">${esc(vv.erreur)}</span>`;
    };
    f2.addEventListener('input', recap); f2.addEventListener('change', recap); recap();
  }

  function reserverRapide(resId, dureeVoulue) {
    const t = auj();
    const c = R.creneauMaintenant(resId, E, t, minuteNow(), dureeVoulue);
    if (!c) { toast('Ce créneau vient d\'être pris ou le lieu ferme : choisis un autre horaire.'); return; }
    if (!monNom()) { modaleReservation(null, { res: resId, date: t, debut: c.debut, fin: c.fin }); return; }
    const n = R.normaliserReservation({ id: uid(), ressource: resId, date: t, ...c, par: monNom(), personnes: 1, creeLe: t }, t);
    const v = R.valider(n, E, { auj: t });
    if (!v.ok) { toast(v.erreur); return; }
    retenir();
    E.reservations.push(n); journaliser({ type: 'ajout', resa: n });
    sauver(); rendre();
    toast(`${nomRessource(resId)} réservée de ${c.debut} à ${c.fin} au nom de ${monNom()}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleNom() {
    ouvrirModale('Ton nom', `<p>Ton nom est pré-rempli à chaque réservation et retrouve les tiennes. Il reste sur cet appareil : chaque personne indique le sien sur son téléphone ou son ordinateur.</p>
      <label class="champ">Nom ou prénom<input name="nom" maxlength="60" value="${esc(monNom())}" autocomplete="given-name"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const n = String(fd.get('nom') || '').trim();
      if (!n) return 'Indique un nom (un prénom suffit).';
      ecrireNom(n); rendre(); toast(`Bonjour ${n} : tes réservations sont filtrées à ce nom.`);
    });
  }

  function modaleRessource(id) {
    const x = id ? ressource(id) : null;
    if (!x && E.ressources.length >= R.MAX_RESSOURCES) { toast(`${R.MAX_RESSOURCES} ressources au plus : archive celles qui ne servent plus.`); return; }
    const v = x || { nom: '', type: filtreType !== 'tous' ? filtreType : 'salle', capacite: 6, lieu: '', equipements: [], couleur: E.ressources.length % 8, note: '', archive: false };
    const n = x ? E.reservations.filter((r) => r.ressource === x.id).length : 0;
    const eqs = [...new Set([...B.equipements, ...E.equipementsPerso, ...v.equipements])];
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom<input name="nom" maxlength="60" required value="${esc(v.nom)}" placeholder="Ex. : Salle du rez-de-chaussée"></label>
        <label class="champ">Type<select name="type" id="rs-type">${B.types.map((t) => `<option value="${t.id}" ${t.id === v.type ? 'selected' : ''}>${t.nom}</option>`).join('')}</select></label>
      </div>
      <p class="mention" id="rs-aide">${esc(B.types.find((t) => t.id === v.type).aide)}</p>
      <div class="rang-champs">
        <label class="champ" id="rs-cap">Capacité (personnes)<input type="number" name="capacite" min="1" max="500" value="${v.capacite}"></label>
        <label class="champ">Lieu <small>Étage, zone, armoire…</small><input name="lieu" maxlength="60" value="${esc(v.lieu)}"></label>
      </div>
      <fieldset class="champ cadre-champs" id="rs-eq"><legend>Équipements de la salle</legend><div class="cases">${eqs.map((q) => `<label class="case"><input type="checkbox" name="eq" value="${esc(q)}" ${v.equipements.includes(q) ? 'checked' : ''}> ${esc(q)}</label>`).join('')}</div>
        <label class="champ" style="margin-top:8px">Autre équipement <small>Ajouté à la liste de toutes les salles.</small><input name="autreEq" maxlength="40"></label></fieldset>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${i === v.couleur ? 'checked' : ''} aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Note <small>Facultative : code d'accès à éviter ici.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${x ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Archivée (ne se réserve plus, l'historique reste)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(x ? 'Ressource' : 'Nouvelle ressource', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (n) return `${pluriel(n, 'réservation')} sur cette ressource : archive-la plutôt (case ci-dessus), l'historique reste.`;
        if (!confirm(`Supprimer « ${x.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.ressources = E.ressources.filter((y) => y.id !== x.id);
        autresModifs = true; sauver(); rendre(); toast(`« ${x.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la ressource.';
      if (E.ressources.some((y) => y.id !== x?.id && y.nom.toLowerCase() === nom.toLowerCase())) return 'Une ressource porte déjà ce nom.';
      const type = fd.get('type');
      const cap = type === 'salle' ? Math.round(Number(fd.get('capacite'))) : 1;
      if (!(cap >= 1 && cap <= 500)) return 'La capacité va de 1 à 500 personnes.';
      if (x && type === 'salle' && E.reservations.some((r) => r.ressource === x.id && r.date >= auj() && r.personnes > cap)) return 'Des réservations à venir comptent plus de personnes que cette capacité : modifie-les d\'abord.';
      const autre = String(fd.get('autreEq') || '').trim().slice(0, 40);
      const equipements = type === 'salle' ? [...fd.getAll('eq'), ...(autre ? [autre] : [])] : [];
      retenir();
      if (autre && !B.equipements.includes(autre) && !E.equipementsPerso.includes(autre)) E.equipementsPerso.push(autre);
      const d = R.normaliserRessource({ id: x?.id || uid(), nom, type, capacite: cap, lieu: String(fd.get('lieu') || '').trim(), equipements, couleur: Number(fd.get('couleur')), note: String(fd.get('note') || '').trim(), archive: !!fd.get('archive') });
      if (x) Object.assign(x, d); else E.ressources.push(d);
      autresModifs = true; sauver(); rendre(); toast(`« ${nom} » enregistrée.`, { libelle: 'Annuler', faire: annuler });
    });
    const dlg = modale();
    const maj = () => { const ty = dlg.querySelector('#rs-type').value; dlg.querySelector('#rs-cap').hidden = ty !== 'salle'; dlg.querySelector('#rs-eq').hidden = ty !== 'salle'; dlg.querySelector('#rs-aide').textContent = B.types.find((t) => t.id === ty).aide; };
    dlg.querySelector('#rs-type').addEventListener('change', maj); maj();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <label class="champ">Nom du lieu ou de l'organisation<input name="organisation" maxlength="80" value="${esc(E.organisation)}"></label>
      <div class="groupe"><h3>Ressources <span class="etiquette sable">${E.ressources.length} / ${R.MAX_RESSOURCES}</span></h3>
        ${E.ressources.length ? `<ul class="mini-liste">${E.ressources.map((x) => `<li><span>${pastille(x)}<b>${esc(x.nom)}</b> · ${esc(detailRessource(x))}${x.archive ? ' · archivée' : ''}</span><button type="button" class="btn petit" data-action="ressource" data-id="${x.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Aucune ressource.</p>'}
        <div class="rang">${E.ressources.length < R.MAX_RESSOURCES ? `<button type="button" class="btn petit" data-action="nouvelle-ressource">${ICONES.plus}Ajouter une ressource</button>` : ''}</div></div>
      <div class="groupe"><h3>Horaires et créneaux</h3>
        <div class="rang-champs">
          <label class="champ">Ouverture<input type="time" name="ouverture" value="${g.ouverture}" step="900"></label>
          <label class="champ">Fermeture<input type="time" name="fermeture" value="${g.fermeture}" step="900"></label>
          <label class="champ">Pas<select name="pas">${R.PAS.map((p) => `<option value="${p}" ${p === g.pas ? 'selected' : ''}>${p} min</option>`).join('')}</select></label>
        </div>
        <fieldset class="champ"><legend>Jours ouverts</legend><div class="cases">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<label class="case"><input type="checkbox" name="jours" value="${w}" ${g.jours.includes(w) ? 'checked' : ''}> ${R.JOURS[w]}</label>`).join('')}</div></fieldset>
        <div class="rang-champs">
          <label class="champ">Durée maximale (heures)<small>Vide : sans limite.</small><input name="dureeMax" inputmode="decimal" value="${g.dureeMax ? String(g.dureeMax / 60).replace('.', ',') : ''}" placeholder="Sans limite"></label>
          <label class="champ">Réserver au plus (jours à l'avance)<small>Vide : sans limite.</small><input type="number" name="avanceMax" min="1" max="730" value="${g.avanceMax ?? ''}" placeholder="Sans limite"></label>
        </div>
        <p class="mention">Les réservations existantes ne sont pas modifiées ; celles qui sortent des nouveaux horaires restent visibles.</p></div>
      <div class="groupe"><h3>Jours fériés <span class="etiquette jaune">Liste datée</span></h3>
        <label class="case"><input type="checkbox" name="feries" ${g.feries ? 'checked' : ''}> Fermé les jours fériés</label>
        <label class="case"><input type="checkbox" name="alsaceMoselle" ${g.alsaceMoselle ? 'checked' : ''}> Alsace-Moselle (Vendredi saint et 26 décembre en plus)</label>
        <details class="champs-aide"><summary>Liste et sources</summary><ul><li>${esc(B.sourceFeries)}</li><li>Cette année : ${Object.entries(R.feries(Number(auj().slice(0, 4)), { alsaceMoselle: g.alsaceMoselle })).sort().map(([d, n]) => `${esc(n)} (${fmt(d, { day: 'numeric', month: 'short' })})`).join(', ')}.</li>${B.sources.map(([lb, u]) => `<li>${esc(lb)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details></div>
      <div class="groupe"><h3>Sur cet appareil</h3><p class="aide">Ton nom : <b>${esc(monNom() || 'non indiqué')}</b>. Il pré-remplit tes réservations et n'est pas partagé.</p>
        <div class="rang"><button type="button" class="btn petit" data-action="mon-nom">${monNom() ? 'Changer de nom' : 'Indiquer mon nom'}</button></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Noms des personnes</h3><p class="aide">Efface le nom, l'objet et la note des réservations passées depuis plus de N mois : les créneaux restent pour les taux d'occupation.</p>
        <div class="rang"><label class="champ" style="flex:0 1 220px">Passées depuis plus de (mois)<input type="number" id="anciens" min="1" max="120" value="6"></label><button type="button" class="btn petit" data-action="anonymiser" style="align-self:flex-end">Effacer ces noms</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les réservations en tableur (CSV), pour un bilan ou une archive.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Les données sont enregistrées en ligne avec la clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Partager avec l'équipe</h3><p class="aide">Transmets la clé aux personnes qui réservent (de vive voix ou par ta messagerie habituelle) : chacune la saisit une fois sur <b>qm-engineering.fr/templates/salles/</b>. Pas de compte, pas de droits différents : tout le monde peut réserver, modifier et supprimer.</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les réservations et les noms saisis sont enregistrés en ligne, liés à la clé, et ne sont ni lus ni partagés par QME. L'organisation qui utilise l'outil est responsable des noms saisis : garde le minimum et efface ce qui ne sert plus.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucun agenda externe, aucune messagerie, aucun badge ni capteur n'est connecté : chacun réserve ici. Réservations dans une même journée, de l'ouverture à la fermeture.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ouv = fd.get('ouverture'), fer = fd.get('fermeture');
      if (!R.estHeure(ouv) || !R.estHeure(fer) || fer <= ouv) return 'L\'ouverture doit précéder la fermeture.';
      const jours = fd.getAll('jours').map(Number);
      if (!jours.length) return 'Coche au moins un jour ouvert.';
      const dm = String(fd.get('dureeMax') || '').trim();
      const dmN = dm ? Number(dm.replace(',', '.')) : null;
      if (dm && !(dmN > 0 && dmN <= 24)) return 'Durée maximale : un nombre d\'heures entre 0,25 et 24.';
      const am = String(fd.get('avanceMax') || '').trim();
      const pas = Number(fd.get('pas'));
      if ((minutes(ouv) % pas) || (minutes(fer) % pas)) return `Avec un pas de ${pas} minutes, l'ouverture et la fermeture doivent tomber sur ce pas (ex. 08:00, 08:${pas === 15 ? '15' : '30'}).`;
      retenir();
      E.organisation = String(fd.get('organisation') || '').trim();
      E.reglages = R.reglagesDe({ ouverture: ouv, fermeture: fer, jours, pas, dureeMax: dmN ? Math.round(dmN * 60) : null, avanceMax: am ? Number(am) : null, feries: !!fd.get('feries'), alsaceMoselle: !!fd.get('alsaceMoselle') }, E.reglages);
      autresModifs = true; sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.reservations) || !Array.isArray(d.ressources)) throw new Error();
        if (!confirm(`Remplacer toutes les données (pour toute l'équipe) par cette copie (${pluriel(d.ressources.length, 'ressource')}, ${pluriel(d.reservations.length, 'réservation')}) ?`)) return;
        retenir();
        E = normaliser(d); delete E.majLe;
        ops = []; autresModifs = true;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
    });
  }

  function anonymiser() {
    const mois = Math.round(Number($('#anciens')?.value));
    if (!(mois >= 1 && mois <= 120)) { toast('Indique un nombre de mois entre 1 et 120.'); return; }
    const d = maintenant(); d.setMonth(d.getMonth() - mois);
    const avant = R.iso(d);
    const { etat, n } = R.anonymiser(E, avant);
    if (!n) { toast('Aucune réservation à effacer avant cette date.'); return; }
    if (!confirm(`Effacer le nom, l'objet et la note de ${pluriel(n, 'réservation')} antérieure${n > 1 ? 's' : ''} au ${fmt(avant)} ?`)) return;
    retenir();
    E = etat; autresModifs = true;
    sauver(); rendre(); modale().close();
    toast(`${pluriel(n, 'réservation effacée', 'réservations effacées')} (créneaux conservés).`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `salles-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E), 'text/csv;charset=utf-8', `reservations-salles-${auj()}.csv`);

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
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Les données restent les mêmes : l'icône ouvre cette page avec la clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
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
  function toast(texte, action, duree) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, duree || (action ? 7000 : 4000));
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-ressource': if (accueil.ressources.length < R.MAX_RESSOURCES) { accueil.ressources.push(ligneRessourceVide(el.dataset.type)); ecranAccueil(); } break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleReservation(null, vue === 'semaine' ? { res: ressourceSemaine } : {}); break;
      case 'nouvelle-res': modaleReservation(null, { res: el.dataset.res, date: auj() }); break;
      case 'nouvelle-creneau': { const deb = el.dataset.debut; const f = Math.min(minutes(E.reglages.fermeture), minutes(deb) + 60); const prochaine = R.duJour(E.reservations, el.dataset.res, el.dataset.date).find((r) => r.debut > deb); modaleReservation(null, { res: el.dataset.res, date: el.dataset.date, debut: deb, fin: prochaine && prochaine.debut < heure(f) ? prochaine.debut : heure(f) }); break; }
      case 'rapide': reserverRapide(el.dataset.res, Number(el.dataset.duree)); break;
      case 'ouvrir': modaleReservation(id); break;
      case 'mon-nom': modaleNom(); break;
      case 'ressource': modaleRessource(id); break;
      case 'nouvelle-ressource': modaleRessource(null); break;
      case 'anonymiser': anonymiser(); break;
      case 'voir-jour': jourVu = el.dataset.date; changerVue('jour'); break;
      case 'semaine-de': ressourceSemaine = id; semaineVue = R.lundi(jourVu); changerVue('semaine'); break;
      case 'jour-nav': jourVu = el.dataset.n === '0' ? auj() : ajout(jourVu, Number(el.dataset.n)); rendre(); break;
      case 'semaine-nav': semaineVue = el.dataset.n === '0' ? R.lundi(auj()) : ajout(semaineVue, 7 * Number(el.dataset.n)); rendre(); break;
      case 'type': filtreType = el.dataset.type; rendre(); break;
      case 'filtre': filtre.liste = el.dataset.f; rendre(); break;
      case 'periode': periodeOcc = Number(el.dataset.n); rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('resize', () => { if (vue === 'jour' && $('#jr-defile')) ajusterGrilleJour(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // l'heure a changé
  });
  // Chaque minute : relecture des réservations de l'équipe et mise à jour de « libre maintenant ».
  setInterval(() => {
    if (!E || document.visibilityState !== 'visible' || modale().open || !$('#vue')) return;
    rafraichir();
    if (vue === 'maintenant' || vue === 'jour') { const y = window.scrollY; rendre(); window.scrollTo({ top: y }); }
  }, 60000);
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton; ops = c.ops || []; autresModifs = !!c.autresModifs;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__salles = { etat: () => E, regles: R, ops: () => ops };
  init();
})();
