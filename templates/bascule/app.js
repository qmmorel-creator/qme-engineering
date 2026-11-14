// Pilotage d'une journée de bascule QME : déroulé horaire, responsables, points go/no-go, points
// d'arrêt, plan de retour arrière, retard recalculé en direct, journal d'incidents, point de situation.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.BSC;
  const API = '/api/templates';
  const PRODUIT = 'BSC';
  const CLE_CODE = 'qme-bsc-code';
  const CLE_CACHE = 'qme-bsc-cache';
  const CLE_DEMO = 'qme-bsc-demo';
  const CLE_COURANTE = 'qme-bsc-courante';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-bsc-ecran-accueil';

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
  const { heure, dureeTexte, ecartTexte, versMin, depuisMin, estDH } = R;
  const now = () => R.maintenant();
  const nowDH = () => depuisMin(now());
  const auj = () => R.iso(new Date());
  const dateCourte = (s) => R.versDate(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const dateLongue = (s) => R.dateFrLongue(s);
  const hDH = (dh) => (estDH(dh) ? dh.slice(11, 16) : '');
  // « 20:00 » si même jour que la référence, « 01:10 (+1 j) » sinon.
  const hRel = (m, ref) => { const j = R.ecart(R.dateDe(ref), R.dateDe(m)); return `${heure(m)}${j ? ` <small>(${j > 0 ? '+' : ''}${j} j)</small>` : ''}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'direct';
  let courante = stock.lire(CLE_COURANTE) || '';
  const filtre = { journal: 'ouverts' };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const bascule = (id) => E.bascules.find((b) => b.id === id);
  const etape = (id) => E.etapes.find((x) => x.id === id);
  const membre = (id) => E.membres.find((m) => m.id === id);
  const etapesB = (id) => R.etapesDe(E, id);
  const membresB = (id) => E.membres.filter((m) => m.basculeId === id);
  const nomMembre = (id) => { const m = membre(id); return m ? (m.nom || `${m.role} (à nommer)`) : ''; };
  const phaseNom = (c) => (B.phases.find((p) => p.code === c) || { nom: c }).nom;
  const synth = (b) => R.synthese(E, b, now());
  const ORDRE_STATUT = { repli: 0, 'en-cours': 1, preparation: 2, terminee: 3, revenue: 4 };
  // Bascule affichée : celle choisie si elle existe, sinon en cours, sinon la prochaine, sinon la plus récente.
  function choisie() {
    if (!E) return null;
    const b = bascule(courante);
    if (b && !b.archivee) return b;
    const vivantes = E.bascules.filter((x) => !x.archivee).map((x) => ({ b: x, s: synth(x) }));
    if (!vivantes.length) return null;
    vivantes.sort((a, c) => ORDRE_STATUT[a.s.statut] - ORDRE_STATUT[c.s.statut] || (a.s.statut === 'preparation' ? a.s.debut - c.s.debut : c.s.debut - a.s.debut));
    return vivantes[0].b;
  }
  function choisir(id) { courante = id; stock.ecrire(CLE_COURANTE, id); }

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
        toast('Un autre appareil a modifié la bascule entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (BSC-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Organisation fictive, sans nom d'entreprise, de logiciel ni d'enseigne. Tout est relatif à l'heure
  // d'ouverture : une migration EN COURS (démarrée il y a 3 h 25, 30 min de retard cumulé, import en
  // cours, incident majeur ouvert, go/no-go final à venir), un déménagement EN PRÉPARATION (étape sans
  // responsable), une répétition passée avec NO-GO et RETOUR ARRIÈRE, une ouverture de site TERMINÉE.
  // L'historique est simulé avec les vraies règles (planifier) : les heures réelles sont cohérentes.
  function donneesDemo() {
    const e = etatVide();
    const t = Math.floor(now() / 5) * 5;
    const PRENOMS = { PIL: 'Claire M.', DEC: 'Thomas R.', TEC: 'Inès B.', MET: 'Hugo L.', SUP: 'Nadia K.', COM: 'Julien P.', LOG: 'Sami D.', SEC: 'Léa F.', EXP: 'Marc V.' };
    const ROLE = Object.fromEntries(B.roles.map((r) => [r.nom, r.code]));
    function creer(code, nom, debutMin, heuresFenetre, extra = {}) {
      const debut = depuisMin(debutMin);
      const r = R.depuisModele(B, code, { nom, debut, finFenetre: depuisMin(debutMin + heuresFenetre * 60), ...extra });
      const OU = { PIL: 'Salle de crise', DEC: 'Pont téléphonique, joignable à chaque go/no-go', TEC: 'Salle technique', MET: 'Sur site, bureau des référents', SUP: 'Plateau support', LOG: 'Sur site, quai de chargement', SEC: 'Poste de sécurité' };
      r.membres.forEach((m) => { m.nom = PRENOMS[ROLE[m.role]] || ''; m.joignable = OU[ROLE[m.role]] || ''; });
      e.bascules.push(r.bascule); e.etapes.push(...r.etapes); e.membres.push(...r.membres);
      return r;
    }
    // Joue le déroulé d'un groupe jusqu'à `jusqua` : chaque étape démarre dès que ses prédécesseurs
    // sont finis, dure sa durée + extra[index du modèle] ; un NO-GO arrête le groupe.
    function jouer(liste, depart, jusqua, extra = {}, nogo = -1) {
      for (let k = 0; k < 200; k++) {
        const plan = R.planifier(liste, depart, { mode: 'estime' });
        const suiv = R.ordreCalcul(liste).find((x) => x.statut === 'a-faire' && R.predecesseurs(x, liste).every((p) => R.finie(liste.find((y) => y.id === p))));
        if (!suiv) return;
        const d = plan[suiv.id].debut;
        if (d > jusqua) return;
        const i = suiv.ordre / 10 - 1;
        const fin = d + suiv.duree + (extra[i] || 0);
        suiv.debutReel = depuisMin(d);
        if (fin > jusqua) { suiv.statut = 'en-cours'; continue; }
        suiv.statut = 'fait'; suiv.finReel = depuisMin(fin);
        if (suiv.type === 'go') {
          suiv.decideur = suiv.responsable;
          if (i === nogo) { suiv.decision = 'nogo'; suiv.criteres.forEach((c, n) => { c.ok = n !== 2; }); return; }
          suiv.decision = 'go'; suiv.criteres.forEach((c) => { c.ok = true; });
        }
      }
    }
    const inc = (b, minutes, gravite, titre, x = {}) => e.incidents.push(R.normaliserIncident({ id: uid(), basculeId: b.id, heure: depuisMin(minutes), gravite, titre, ...x }));
    const parIndex = (r, i) => r.etapes[i];
    const principal = (r) => r.etapes.filter((x) => x.phase !== 'repli');

    // 1. Migration en cours : démarrée il y a 3 h 25 (12 h de fenêtre).
    const d1 = t - 205;
    const mig = creer('MIG', 'Migration de la messagerie et des fichiers partagés', d1, 12, { lieu: 'Salle de crise, 3e étage' });
    jouer(principal(mig), d1, t, { 0: 5, 4: 10, 6: 15 });
    parIndex(mig, 1).commentaire = 'Sauvegarde restaurée sur un poste de test la veille.';
    inc(mig.bascule, d1 + 22, 'mineur', 'Badge refusé à l\'entrée de la salle technique', { action: 'Accès ouvert par l\'accueil de nuit', resolu: true, heureResolution: depuisMin(d1 + 30), responsable: mig.membres.find((m) => m.role === 'Pilote de la bascule').id });
    inc(mig.bascule, d1 + 60, 'mineur', 'Une équipe en télétravail n\'a pas reçu le message d\'arrêt', { action: 'Message renvoyé à la liste de l\'équipe', etapeId: parIndex(mig, 2).id, responsable: mig.membres.find((m) => m.role === 'Communication interne').id });
    inc(mig.bascule, t - 12, 'majeur', 'Import plus lent que prévu sur les boîtes volumineuses', { action: 'Boîtes volumineuses importées en second lot, en parallèle', etapeId: parIndex(mig, 7).id, responsable: mig.membres.find((m) => m.role === 'Responsable technique').id });
    parIndex(mig, 7).note = 'Second lot lancé en parallèle pour les boîtes de plus de 10 Go.';

    // 2. Déménagement en préparation, le samedi qui suit dans 8 jours ou plus, 07:00 → 19:00.
    const j8 = R.ajout(auj(), 8);
    const jour2 = versMin(`${R.ajout(j8, (6 - R.versDate(j8).getDay() + 7) % 7)}T07:00`);
    const dem = creer('DEM', 'Déménagement des bureaux du 2e étage', jour2, 12, { lieu: 'Ancien site → nouveau bâtiment, même zone d\'activité' });
    dem.membres.find((m) => m.role === 'Référent métier').nom = '';
    parIndex(dem, 12).responsable = '';
    parIndex(dem, 11).criteres.push({ id: uid(), texte: 'Plan d\'évacuation affiché à chaque étage', ok: false });

    // 3. Répétition de la migration il y a 7 jours : NO-GO final, retour arrière exécuté.
    const d3 = versMin(`${R.ajout(auj(), -7)}T20:00`);
    const rep = creer('MIG', 'Répétition de la migration (à blanc)', d3, 12, { lieu: 'Salle de crise, 3e étage' });
    jouer(principal(rep), d3, d3 + 2000, { 4: 20, 7: 35, 11: 25 }, 13);
    const nogo = parIndex(rep, 13);
    nogo.commentaire = 'Écart de volumes sur les fichiers partagés : on revient en arrière et on corrige le script d\'export.';
    rep.bascule.repliLance = depuisMin(versMin(nogo.finReel) + 5);
    jouer(rep.etapes.filter((x) => x.phase === 'repli'), versMin(rep.bascule.repliLance), d3 + 2000, { 20: 15 });
    inc(rep.bascule, versMin(nogo.finReel) - 40, 'bloquant', 'Écart de volumes entre l\'ancien et le nouvel environnement', { action: 'NO-GO, retour arrière ; script d\'export à corriger avant la vraie bascule', etapeId: parIndex(rep, 12).id, resolu: true, heureResolution: depuisMin(versMin(nogo.finReel)), responsable: rep.membres.find((m) => m.role === 'Référent métier').id });
    inc(rep.bascule, d3 + 80, 'mineur', 'Sauvegarde finale plus longue que prévu', { action: 'Durée réelle reprise pour la vraie bascule', etapeId: parIndex(rep, 4).id, resolu: true, heureResolution: depuisMin(d3 + 110) });

    // 4. Ouverture d'un point de vente il y a 20 jours : terminée, petit retard rattrapé.
    const d4 = versMin(`${R.ajout(auj(), -20)}T06:30`);
    const ouv = creer('OUV', 'Ouverture du point de vente de la gare', d4, 3, { lieu: 'Hall de la gare, côté quais' });
    jouer(principal(ouv), d4, d4 + 2000, { 2: 15, 3: -5 });
    inc(ouv.bascule, d4 + 40, 'majeur', 'Terminal de paiement n° 2 hors ligne', { action: 'Terminal redémarré, vente test refaite', etapeId: parIndex(ouv, 2).id, resolu: true, heureResolution: depuisMin(d4 + 58), responsable: ouv.membres.find((m) => m.role === 'Responsable technique').id });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Pilotage de bascule · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="10" height="260" fill="#141414"/>
          <rect x="50" y="30" width="170" height="40" rx="20" fill="#141414"/>
          <rect x="140" y="90" width="210" height="40" rx="20" fill="#1D4E89"/>
          <rect x="250" y="150" width="150" height="40" rx="20" fill="#1D4E89"/>
          <path d="M440 150 L490 200 L440 250 L390 200 Z" fill="#F5B400"/>
          <rect x="50" y="230" width="200" height="40" rx="20" fill="#D9302A"/>
          <circle cx="500" cy="60" r="40" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Pilotage de bascule</p>
          <h1>Ta bascule, minute par minute.</h1>
          <p>Le déroulé horaire avec ses responsables, les points go/no-go et le plan de retour arrière, le retard recalculé en direct et le journal d'incidents, lisible sur un téléphone.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton pilotage de bascule</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes bascules sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon pilotage</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/bascule/">Voir le pilotage de bascule</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon pilotage'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  // Proposition : prochain samedi (ou dans 7 jours) à l'heure de départ du modèle.
  function dateProposee() { const d = new Date(); const ecartJ = ((6 - d.getDay()) + 7) % 7 || 7; return R.ajout(auj(), ecartJ); }
  const accueilVide = () => ({ etape: 1, nom: '', modele: 'MIG', date: dateProposee(), debut: '', fin: '' });
  let accueil = accueilVide();
  const modeleDe = (code) => B.modeles.find((m) => m.code === code) || B.modeles[0];
  const finProposee = (date, hhmm, heures) => depuisMin(versMin(`${date}T${hhmm}`) + heures * 60);

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ta journée de bascule, pilotée à la minute.</h1>
        <p class="intro">Tu pars d'une séquence type (migration informatique, déménagement, ouverture de site, mise en service, changement d'entrepôt) et tu l'adaptes : étapes, durées, responsables, points go/no-go et plan de retour arrière. Le jour J, tu notes les heures réelles d'un geste : le retard se recalcule et la fin estimée se met à jour.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const m = modeleDe(a.modele);
      const debut = a.debut || m.debut;
      const fin = a.fin || finProposee(a.date, debut, m.fenetreHeures);
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta première bascule</h1>
        <p class="intro">Choisis la séquence la plus proche : c'est un exemple générique à adapter. Tu pourras tout modifier dans l'onglet Déroulé.</p>
        <div class="form-accueil">
          <fieldset><legend>Séquence de départ</legend>
            <div class="modeles-choix">${B.modeles.map((x) => `<label class="modele-choix"><input type="radio" name="a-modele" value="${x.code}" ${x.code === a.modele ? 'checked' : ''}><span><b>${esc(x.court)}</b><small>${x.etapes.length ? `${pluriel(x.etapes.filter((y) => y.p !== 'repli').length, 'étape')} · ${pluriel(x.etapes.filter((y) => y.type === 'go').length, 'go/no-go', 'go/no-go')} · repli de ${x.etapes.filter((y) => y.p === 'repli').length} étapes` : 'Aucune étape : tu construis tout'}</small></span></label>`).join('')}</div>
          </fieldset>
          <label class="champ">Nom de la bascule<input id="a-nom" value="${esc(a.nom)}" maxlength="120" placeholder="${esc(m.court)}"></label>
          <div class="rang-champs">
            <label class="champ">Jour<input id="a-date" type="date" value="${a.date}"></label>
            <label class="champ">Heure de début<input id="a-debut" type="time" value="${debut}"></label>
          </div>
          <label class="champ">Fin de la fenêtre<small>Heure à laquelle tout doit être fini (ou revenu en arrière) : reprise de l'activité, ouverture au public…</small><input id="a-fin" type="datetime-local" value="${fin}"></label>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma bascule</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-date', 'date'); lier('#a-debut', 'debut'); lier('#a-fin', 'fin');
    document.querySelectorAll('[name=a-modele]').forEach((r) => r.addEventListener('change', (e) => { accueil.modele = e.target.value; accueil.debut = ''; accueil.fin = ''; ecranAccueil(); }));
    ['#a-date', '#a-debut'].forEach((s) => $(s)?.addEventListener('change', () => { if (!accueil.finTouchee) { accueil.fin = ''; ecranAccueil(); } }));
    $('#a-fin')?.addEventListener('change', () => { accueil.finTouchee = true; });
  }

  function terminerAccueil() {
    const a = accueil;
    const m = modeleDe(a.modele);
    const debut = `${a.date}T${a.debut || m.debut}`;
    if (!estDH(debut)) return ecranAccueil('Indique le jour et l\'heure de début.');
    const fin = a.fin || finProposee(a.date, a.debut || m.debut, m.fenetreHeures);
    if (!estDH(fin) || versMin(fin) <= versMin(debut)) return ecranAccueil('La fin de la fenêtre doit être après le début.');
    E = etatVide();
    const r = R.depuisModele(B, m.code, { nom: a.nom.trim() || m.court, debut, finFenetre: fin });
    r.bascule.creeLe = auj();
    E.bascules.push(r.bascule); E.etapes.push(...r.etapes); E.membres.push(...r.membres);
    choisir(r.bascule.id);
    accueil = accueilVide();
    vue = r.etapes.length ? 'equipe' : 'deroule';
    sauver();
    demarrer();
    toast(r.etapes.length ? 'Ta bascule est prête : nomme l\'équipe, puis adapte le déroulé.' : 'Ta bascule est créée : ajoute ses étapes.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    direct: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    deroule: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="10" height="4" rx="2" fill="currentColor"/><rect x="8" y="10" width="12" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="16" width="9" height="4" rx="2" fill="currentColor"/></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    equipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 21a6 6 0 0 1 12 0Z" fill="currentColor"/><path d="M14 21a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    bascules: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['direct', 'En direct'], ['deroule', 'Déroulé'], ['journal', 'Journal'], ['equipe', 'Équipe'], ['bascules', 'Bascules']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide au pilotage : les séquences types sont des exemples génériques à adapter à ton organisation, tes procédures et tes règles de sécurité, qui priment. Les heures estimées sont calculées à partir des durées saisies et des heures réelles notées ; la décision reste celle des personnes désignées.</p>';
  const STATUT_B = { preparation: ['ciel', 'En préparation'], 'en-cours': ['jaune', 'En cours'], terminee: ['vert', 'Terminée'], repli: ['rouge', 'Retour arrière en cours'], revenue: ['rose', 'Retour arrière effectué'] };
  const etiquetteB = (st) => `<span class="etiquette ${STATUT_B[st][0]}">${STATUT_B[st][1]}</span>`;
  const STATUT_E = { 'a-faire': ['sable', 'À faire'], 'en-cours': ['jaune', 'En cours'], fait: ['vert', 'Fait'], bloque: ['rouge', 'Bloqué'], saute: ['sable', 'Sauté'] };
  const etiquetteE = (st) => `<span class="etiquette ${STATUT_E[st][0]}">${STATUT_E[st][1]}</span>`;
  const TYPE_E = { go: '<span class="type-etape go">Go/no-go</span>', arret: '<span class="type-etape arret">Point d\'arrêt</span>', action: '' };
  const GRAV = { mineur: ['sable', 'Mineur'], majeur: ['jaune', 'Majeur'], bloquant: ['rouge', 'Bloquant'] };
  const etiquetteG = (g) => `<span class="etiquette ${GRAV[g][0]}">${GRAV[g][1]}</span>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const sansBascule = (titre) => `<div class="vue-tete"><div><h1>${titre}</h1></div></div>${videEtat('Aucune bascule pour l\'instant', 'Crée ta bascule à partir d\'une séquence type (migration, déménagement, ouverture de site, mise en service, changement d\'entrepôt) ou d\'un déroulé vierge.', `<button class="btn primaire" data-action="bascule">${ICONES.plus}Nouvelle bascule</button>`)}${AVERTISSEMENT}`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/bascule/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Journée de<br>bascule</span>
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
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Pilotage de bascule`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { direct: vueDirect, deroule: vueDeroule, journal: vueJournal, equipe: vueEquipe, bascules: vueBascules }[vue]();
    brancherInfobulles();
    $('#choix-bascule')?.addEventListener('change', (e) => { choisir(e.target.value); rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur de bascule commun aux vues.
  function choixBascule(b) {
    const vs = E.bascules.filter((x) => !x.archivee || x.id === b.id);
    if (vs.length < 2) return '';
    return `<label class="champ choix-bascule"><span class="sr-only">Bascule</span><select id="choix-bascule">${vs.map((x) => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.nom)} · ${dateCourte(x.debut.slice(0, 10))}</option>`).join('')}</select></label>`;
  }
  const fenetreTexte = (b) => `${dateLongue(b.debut.slice(0, 10))}, ${hDH(b.debut)}${b.finFenetre ? ` → ${b.finFenetre.slice(0, 10) !== b.debut.slice(0, 10) ? `${dateCourte(b.finFenetre.slice(0, 10))} ` : ''}${hDH(b.finFenetre)}` : ''}`;
  const dans = (m) => (m <= 0 ? 'maintenant' : `dans ${dureeTexte(m)}`);
  function compteARebours(m) {
    if (m <= 0) return 'maintenant';
    const j = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return j ? `dans ${pluriel(j, 'jour')}${h ? ` et ${h} h` : ''}` : `dans ${dureeTexte(m)}`;
  }

  // Boutons d'action d'une étape selon son type et son statut.
  function boutonsEtape(x, s, gros = false) {
    const c = gros ? 'btn' : 'btn petit';
    if (s.statut === 'terminee' || s.statut === 'revenue') return '';
    if (x.statut === 'fait' || x.statut === 'saute') return '';
    // Seul le déroulé courant se pilote : le plan de repli avant son lancement, la suite après.
    if (!s.courant.includes(x)) return '';
    if (x.type === 'go') return `<button class="${c} primaire" data-action="decider" data-id="${x.id}">Décider</button>`;
    if (x.statut === 'bloque') return `<button class="${c}" data-action="reprendre" data-id="${x.id}">Débloquer</button>`;
    if (x.statut === 'en-cours') return `<button class="${c} primaire" data-action="terminer" data-id="${x.id}">${x.type === 'arret' ? 'Valider' : 'Terminé'}</button><button class="${c}" data-action="bloquer" data-id="${x.id}">Bloqué</button>`;
    if (x.type === 'arret') return `<button class="${c}" data-action="terminer" data-id="${x.id}">Valider</button>`;
    return `<button class="${c}" data-action="demarrer" data-id="${x.id}">Démarrer</button>`;
  }

  // ---------- En direct ----------
  function vueDirect() {
    const b = choisie();
    if (!b) return sansBascule('En direct');
    const s = synth(b);
    const t = s.now;
    const tete = `<div class="vue-tete"><div><p class="surtitre">${etiquetteB(s.statut)}</p><h1>${esc(b.nom)}</h1><p>${esc(fenetreTexte(b))}${b.lieu ? ` · ${esc(b.lieu)}` : ''}</p></div>
      <div class="actions">${choixBascule(b)}<button class="btn" data-action="situation">Point de situation</button><button class="btn primaire" data-action="incident">${ICONES.plus}Incident</button></div></div>`;
    if (!s.principal.length && !s.repli.length) return `${tete}${videEtat('Déroulé vide', 'Ajoute les étapes de la bascule dans l\'onglet Déroulé.', '<button class="btn primaire" data-action="vue" data-vue="deroule">Ouvrir le déroulé</button>')}${AVERTISSEMENT}`;
    const tol = E.reglages.toleranceMinutes;
    const fini = s.statut === 'terminee' || s.statut === 'revenue';
    const tuileRetard = s.retard === null
      ? ['Retour arrière', `${s.avancement.faites}/${s.avancement.total}`, `étapes de repli faites · lancé à ${heure(s.repliLance)}`, 'var(--rouge)', 'rond']
      : [fini ? 'Écart final' : 'Retard cumulé', ecartTexte(s.retard), `fin ${fini ? 'réelle' : 'estimée'} ${heure(s.estimeFin)} · prévue ${heure(s.prevuFin)}`, s.retard > tol ? 'var(--rouge)' : s.retard > 0 ? 'var(--jaune)' : 'var(--vert)', 'rond'];
    const tuiles = [
      fini ? ['Fin', heure(s.estimeFin), dateLongue(R.dateDe(s.estimeFin)), 'var(--encre)', ''] : ['Heure', heure(t), dateLongue(R.dateDe(t)), 'var(--encre)', ''],
      tuileRetard,
      s.fenetre === null ? ['Fin de fenêtre', '–', 'à définir dans la bascule', 'var(--sable)', ''] : ['Marge', s.marge >= 0 ? dureeTexte(s.marge) : `−${dureeTexte(-s.marge)}`, `fin de fenêtre ${heure(s.fenetre)}`, s.marge < 0 ? 'var(--rouge)' : s.marge < E.reglages.margeRetourMinutes ? 'var(--jaune)' : 'var(--bleu)', ''],
      s.statut === 'en-cours' && s.limite !== null && s.repli.length ? ['Retour arrière', `≤ ${heure(s.limite)}`, s.limite - t >= 0 ? `décision possible encore ${dureeTexte(s.limite - t)}` : `limite dépassée de ${dureeTexte(t - s.limite)}`, s.limite - t < 0 ? 'var(--discret)' : s.limite - t <= E.reglages.margeRetourMinutes ? 'var(--rouge)' : 'var(--bleu)', 'rond']
        : ['Avancement', `${s.avancement.pct} %`, `${s.avancement.faites} sur ${pluriel(s.avancement.total, 'étape')}`, 'var(--bleu)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const progres = `<div class="progres" role="img" aria-label="Avancement : ${s.avancement.pct} %"><span style="width:${s.avancement.pct}%"></span></div>`;

    let gauche, droite;
    if (s.statut === 'preparation') {
      gauche = `<section><h2 class="titre-section">Avant le jour J <span>démarrage ${compteARebours(s.debut - t)}</span></h2>
        <div class="carte-direct"><p class="cd-gros">${heure(s.debut)} <small>${esc(dateLongue(R.dateDe(s.debut)))}</small></p>
        <p>${pluriel(s.principal.length, 'étape')} · fin prévue ${hRel(s.prevuFin, s.debut)}${s.fenetre !== null ? ` · fenêtre jusqu'à ${hRel(s.fenetre, s.debut)}` : ''}${s.limite !== null ? ` · retour arrière décidé au plus tard à ${hRel(s.limite, s.debut)}` : ''}</p>
        <div class="rang"><button class="btn" data-action="vue" data-vue="deroule">Voir le déroulé</button><button class="btn" data-action="vue" data-vue="equipe">Équipe</button><button class="btn" data-action="imprimer">Imprimer le déroulé</button></div></div></section>`;
      droite = `<section><h2 class="titre-section">À préparer <span>${pluriel(s.alertes.length, 'point')}</span></h2>${listeAlertes(s.alertes, 'Tout est prêt : chaque étape a un responsable, chaque go/no-go a ses critères, le plan de retour arrière existe.')}</section>`;
    } else if (fini) {
      const bl = R.bilan(E, s);
      gauche = `<section><h2 class="titre-section">Bilan <span>${s.statut === 'revenue' ? 'retour arrière effectué' : `fin ${heure(s.estimeFin)}`}</span></h2>
        ${bl.depassees.length ? `<ul class="liste-direct bilan">${bl.depassees.slice(0, 6).map((x) => `<li><div class="lien-ligne"><b>${esc(x.etape.titre)}</b><span>${dureeTexte(x.reelle)} au lieu de ${dureeTexte(x.prevue)}</span></div><span class="etiquette jaune">+${dureeTexte(x.ecart)}</span></li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucune étape plus longue que prévu</h3><p>Les durées réelles ont tenu le plan.</p></div></div>'}
        <p class="aide">Pour la prochaine fois : duplique cette bascule en reprenant les durées réelles, puis ajuste le déroulé.</p>
        <div class="rang" style="margin-top:12px"><button class="btn" data-action="dupliquer" data-id="${b.id}">Dupliquer</button><button class="btn" data-action="imprimer">Imprimer le déroulé</button><button class="btn" data-action="vue" data-vue="journal">Chronologie</button></div></section>`;
      droite = `<section><h2 class="titre-section">Incidents <span>${pluriel(bl.incidents.total, 'incident')}</span></h2>${listeIncidents(E.incidents.filter((i) => i.basculeId === b.id).sort((x, y) => (x.heure < y.heure ? -1 : 1)), s)}</section>`;
    } else {
      const maint = s.enCours.length ? s.enCours : (s.prochaine ? [s.prochaine] : []);
      const suite = s.restantes.filter((x) => !maint.includes(x)).slice(0, 4);
      gauche = `<section><h2 class="titre-section">${s.enCours.length ? 'En cours' : 'Prochaine étape'} <span>${s.repliLance !== null ? 'plan de retour arrière' : esc(phaseNom((maint[0] || {}).phase || ''))}</span></h2>
        ${maint.length ? `<ul class="cartes-direct">${maint.map((x) => carteDirect(x, s)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien à lancer</h3><p>Toutes les étapes du déroulé courant sont faites.</p></div></div>'}
        ${suite.length ? `<h3 class="sous-titre">À suivre</h3><ul class="liste-direct">${suite.map((x) => `<li><span class="heure-pastille">${heure(s.estime[x.id].debut)}</span><div class="lien-ligne"><b>${esc(x.titre)} ${TYPE_E[x.type]}</b><span>${dureeTexte(x.duree)}${x.responsable ? ` · ${esc(nomMembre(x.responsable))}` : ''}</span></div>${x.statut === 'bloque' ? etiquetteE('bloque') : ''}</li>`).join('')}</ul>` : ''}
        ${s.statut === 'en-cours' && s.repli.length ? `<div class="rang" style="margin-top:14px"><button class="btn danger" data-action="lancer-repli">Lancer le retour arrière</button></div>` : ''}</section>`;
      const d = s.prochaineDecision;
      const c = d ? R.etatCriteres(d) : null;
      droite = `${d ? `<section><h2 class="titre-section">Prochaine décision <span>${heure(s.estime[d.id].debut)} · ${dans(s.estime[d.id].debut - t)}</span></h2>
          <div class="carte-decision"><b>${esc(d.titre)}</b><span>${d.responsable ? esc(nomMembre(d.responsable)) : 'Décideur à désigner'} · critères ${c.ok}/${c.total}</span>
          <ul class="criteres-mini">${(d.criteres || []).map((x) => `<li class="${x.ok ? 'ok' : ''}">${x.ok ? '✓' : '○'} ${esc(x.texte)}</li>`).join('')}</ul>
          <div class="rang"><button class="btn primaire" data-action="decider" data-id="${d.id}">Décider</button></div></div></section>` : ''}
        <section><h2 class="titre-section">Alertes <span>${pluriel(s.alertes.length, 'alerte')}</span></h2>${listeAlertes(s.alertes, 'Rien à signaler : la bascule suit son déroulé.')}</section>
        <section><h2 class="titre-section">Incidents ouverts <span>${E.incidents.filter((i) => i.basculeId === b.id && !i.resolu).length}</span></h2>${listeIncidents(E.incidents.filter((i) => i.basculeId === b.id && !i.resolu).sort((x, y) => (x.heure < y.heure ? 1 : -1)), s, 'Aucun incident ouvert.')}</section>`;
    }
    return `${tete}<div class="tuiles">${tuiles}</div>${s.statut !== 'preparation' ? progres : ''}
      ${frise(s)}
      <div class="colonnes-apercu">${gauche}<div>${droite}</div></div>${AVERTISSEMENT}`;
  }

  function carteDirect(x, s) {
    const dr = estDH(x.debutReel) ? versMin(x.debutReel) : null;
    const ecoule = dr !== null ? s.now - dr : null;
    const depasse = ecoule !== null && ecoule > x.duree;
    return `<li class="carte-direct ${x.statut}">
      <div class="cd-ligne"><span class="cd-gros">${heure(s.estime[x.id].debut)}</span>${etiquetteE(x.statut)}${TYPE_E[x.type]}</div>
      <button class="lien-ligne" data-action="etape" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${x.responsable ? esc(nomMembre(x.responsable)) : 'Responsable à désigner'} · prévu ${dureeTexte(x.duree)}${ecoule !== null ? ` · ${depasse ? '<b class="negatif">' : ''}en cours depuis ${dureeTexte(ecoule)}${depasse ? '</b>' : ''}` : ''} · fin ${x.statut === 'en-cours' ? 'estimée' : 'prévue'} ${heure(s.estime[x.id].fin)}</span></button>
      ${x.note ? `<p class="cd-note">${esc(x.note)}</p>` : ''}
      <div class="rang">${boutonsEtape(x, s, true)}</div></li>`;
  }

  function listeAlertes(al, videTexte) {
    if (!al.length) return `<div class="vide-etat petit"><div><h3>Rien à signaler</h3><p>${videTexte}</p></div></div>`;
    const ico = { rouge: 'Agir', jaune: 'Surveiller', info: 'À préparer' };
    return `<ul class="alertes-bsc">${al.map((a) => `<li class="${a.niveau}"><span class="etiquette ${a.niveau === 'rouge' ? 'rouge' : a.niveau === 'jaune' ? 'jaune' : 'ciel'}">${ico[a.niveau]}</span><span>${esc(a.texte)}</span>${a.etapeId ? `<button class="btn lien" data-action="etape" data-id="${a.etapeId}">Voir</button>` : a.incidentId ? `<button class="btn lien" data-action="incident" data-id="${a.incidentId}">Voir</button>` : ''}</li>`).join('')}</ul>`;
  }

  function listeIncidents(l, s, videTexte = 'Aucun incident noté.') {
    if (!l.length) return `<div class="vide-etat petit"><div><h3>${videTexte}</h3><p>Note chaque incident à l'heure : il alimente le point de situation et le bilan.</p></div></div>`;
    return `<ul class="incidents">${l.map((i) => {
      const x = i.etapeId ? etape(i.etapeId) : null;
      return `<li class="${i.gravite} ${i.resolu ? 'resolu' : ''}"><span class="heure-pastille">${hDH(i.heure)}</span>
        <button class="lien-ligne" data-action="incident" data-id="${i.id}"><b>${esc(i.titre)}</b><span>${[x ? `Étape : ${x.titre}` : '', i.action ? `Action : ${i.action}` : '', i.responsable ? nomMembre(i.responsable) : ''].filter(Boolean).map(esc).join(' · ')}</span></button>
        <span class="alerte-droite">${etiquetteG(i.gravite)}${i.resolu ? `<span class="etiquette vert">Résolu ${hDH(i.heureResolution)}</span>` : (s && (s.statut === 'en-cours' || s.statut === 'repli') ? `<button class="btn petit" data-action="resoudre" data-id="${i.id}">Résolu</button>` : '<span class="etiquette sable">Ouvert</span>')}</span></li>`;
    }).join('')}</ul>`;
  }

  // Frise : par phase, le prévu (contour) et l'estimé ou réel (plein), avec maintenant, la limite de
  // retour arrière et la fin de fenêtre. Une seule série colorée ; repères nommés ; tableau accessible.
  function frise(s) {
    const tel = estTel();
    const phases = B.phases.filter((p) => (p.code === 'repli' ? s.repliLance !== null : s.principal.some((x) => x.phase === p.code)));
    const rangs = phases.map((p) => {
      const l = (p.code === 'repli' ? s.repli : s.principal).filter((x) => x.phase === p.code);
      // Après un retour arrière, les étapes jamais commencées de la bascule n'ont plus d'estimation.
      const suivies = s.repliLance !== null && p.code !== 'repli' ? l.filter((x) => x.statut !== 'a-faire') : l;
      const pv = l.map((x) => s.prevu[x.id]), es = suivies.map((x) => s.estime[x.id]);
      const r = { p, pd: Math.min(...pv.map((v) => v.debut)), pf: Math.max(...pv.map((v) => v.fin)), faites: l.filter(R.finie).length, n: l.length, sansEstime: !es.length };
      r.ed = es.length ? Math.min(...es.map((v) => v.debut)) : r.pd; r.ef = es.length ? Math.max(...es.map((v) => v.fin)) : r.pd;
      return r;
    });
    if (!rangs.length) return '';
    const W = tel ? 360 : 1000, G = tel ? 92 : 190, D = 12, H = 30;
    const repere = [s.now, s.fenetre, s.statut === 'en-cours' ? s.limite : null].filter((v) => v !== null);
    const min = Math.min(s.debut, ...rangs.map((r) => Math.min(r.pd, r.ed)));
    const maxBrut = Math.max(...rangs.map((r) => Math.max(r.pf, r.ef)), s.fenetre ?? 0);
    const enVue = (v) => v >= min - 60 && v <= maxBrut + 60;
    const max = Math.max(maxBrut, ...repere.filter(enVue)) + 10;
    const x = (v) => G + ((v - min) / (max - min)) * (W - G - D);
    const haut = 40, bas = 22;
    const h = haut + rangs.length * H + bas;
    // Graduations horaires : au plus 7.
    const pas = [60, 120, 180, 240, 360].find((p) => (max - min) / p <= (tel ? 4 : 7)) || 720;
    const ticks = [];
    for (let v = Math.ceil(min / pas) * pas; v <= max; v += pas) ticks.push(v);
    const lignes = rangs.map((r, i) => {
      const y = haut + i * H;
      const info = `<b>${esc(r.p.nom)}</b>Prévu ${heure(r.pd)} → ${heure(r.pf)}<br>${r.sansEstime ? 'Non réalisé (retour arrière)' : `${r.faites === r.n ? 'Réel' : 'Estimé'} ${heure(r.ed)} → ${heure(r.ef)}`}<br>${r.faites}/${r.n} étapes faites`;
      return `<g class="frise-rang" tabindex="0" data-info="${esc(info)}">
        <rect x="0" y="${y}" width="${W}" height="${H}" fill="transparent"/>
        <text x="0" y="${y + 19}" class="frise-nom">${esc(tel ? r.p.court : r.p.nom)}</text>
        <rect x="${x(r.pd)}" y="${y + 4}" width="${Math.max(2, x(r.pf) - x(r.pd))}" height="9" rx="4" class="frise-prevu"/>
        ${r.sansEstime ? '' : `<rect x="${x(r.ed)}" y="${y + 16}" width="${Math.max(2, x(r.ef) - x(r.ed))}" height="9" rx="4" class="frise-estime"/>`}</g>`;
    }).join('');
    const ligne = (v, cls, lib, ancre, ty) => `<line x1="${x(v)}" x2="${x(v)}" y1="${ty + 4}" y2="${h - bas + 2}" class="${cls}"/><text x="${x(v) + (ancre === 'end' ? -4 : 4)}" y="${ty}" text-anchor="${ancre}" class="frise-lib ${cls}">${lib}</text>`;
    const libs = [[s.statut === 'en-cours' ? s.limite : null, 'frise-limite', tel ? 'limite' : 'limite retour'], [s.fenetre, 'frise-fenetre', tel ? 'fenêtre' : 'fin de fenêtre'], [s.now, 'frise-now', 'maintenant']]
      .filter(([v]) => v !== null && enVue(v)).sort((a, c) => a[0] - c[0]);
    // Ancre à droite pour un repère proche du bord droit ; deux libellés trop proches : deux lignes.
    const finRang = [-1e9, -1e9];
    const reperes = libs.map(([v, cls, lib]) => {
      const px = x(v);
      const larg = lib.length * 6.6 + 8;
      const ancre = px + larg > W ? 'end' : 'start';
      const g = ancre === 'end' ? px - larg : px;
      const rangLib = g > finRang[0] ? 0 : 1;
      finRang[rangLib] = g + larg;
      return ligne(v, cls, lib, ancre, rangLib ? haut - 6 : haut - 20);
    }).join('');
    const axe = ticks.map((v) => `<text x="${x(v)}" y="${h - 4}" text-anchor="middle" class="frise-axe">${heure(v)}</text><line x1="${x(v)}" x2="${x(v)}" y1="${haut}" y2="${h - bas}" class="frise-grille"/>`).join('');
    return `<figure class="graphique frise"><figcaption class="frise-tete"><b>Frise de la bascule</b><span class="legende"><i class="lg-prevu"></i>Prévu<i class="lg-estime"></i>${s.statut === 'preparation' ? 'Estimé' : 'Réel ou estimé'}</span></figcaption>
      <svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Frise : début ${heure(s.debut)}, fin prévue ${heure(s.prevuFin)}, fin estimée ${heure(s.estimeFin)}">${axe}${lignes}${reperes}</svg>
      <div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir en tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Phase</th><th class="nb">Prévu</th><th class="nb">Réel ou estimé</th><th class="nb">Étapes faites</th></tr></thead>
      <tbody>${rangs.map((r) => `<tr><td>${esc(r.p.nom)}</td><td class="nb">${heure(r.pd)} → ${heure(r.pf)}</td><td class="nb">${r.sansEstime ? 'non réalisé' : `${heure(r.ed)} → ${heure(r.ef)}`}</td><td class="nb">${r.faites}/${r.n}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
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
        let x = re.left - rf.left + Math.min(re.width / 2, 200) - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 8;
        if (y < 4) y = re.bottom - rf.top + 8;
        bulle.style.left = `${x}px`;
        bulle.style.top = `${y}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Déroulé ----------
  function vueDeroule() {
    const b = choisie();
    if (!b) return sansBascule('Déroulé');
    const s = synth(b);
    const tete = `<div class="vue-tete"><div><h1>Déroulé</h1><p>${esc(b.nom)} · ${esc(fenetreTexte(b))}. Les heures prévues s'enchaînent d'après les durées ; dès qu'une étape démarre ou finit, la suite est recalculée.</p></div>
      <div class="actions">${choixBascule(b)}<button class="btn" data-action="imprimer">Imprimer</button><button class="btn" data-action="csv">CSV</button><button class="btn primaire" data-action="etape" data-phase="">${ICONES.plus}Étape</button></div></div>`;
    const resume = `<p class="resume-deroule">${etiquetteB(s.statut)} Début ${heure(s.debut)} · fin prévue ${hRel(s.prevuFin, s.debut)} · <b>fin ${s.statut === 'terminee' ? 'réelle' : 'estimée'} ${hRel(s.estimeFin, s.debut)}</b>${s.retard !== null ? ` (${ecartTexte(s.retard)})` : ''}${s.fenetre !== null ? ` · fenêtre jusqu'à ${hRel(s.fenetre, s.debut)}` : ''}</p>`;
    const blocs = B.phases.map((p) => {
      const repli = p.code === 'repli';
      const l = (repli ? s.repli : s.principal).filter((x) => x.phase === p.code);
      if (!l.length && !repli) return '';
      const total = l.length ? Math.max(...l.map((x) => s.prevu[x.id].fin)) - Math.min(...l.map((x) => s.prevu[x.id].debut)) : 0;
      const entete = repli
        ? `<div class="repli-tete"><p>${s.repliLance !== null ? `<b>Retour arrière lancé à ${heure(s.repliLance)}.</b> Ces étapes sont désormais le déroulé courant.` : `Durée du plan : <b>${dureeTexte(s.dureeRepli)}</b>${s.limite !== null ? ` · décision au plus tard à <b>${hRel(s.limite, s.debut)}</b>${b.limiteRetour ? ' (fixée à la main)' : ' (fin de fenêtre − durée du plan)'}` : ''}. Les heures affichées supposent un lancement à cette limite.`}</p>
          ${s.statut === 'en-cours' && l.length ? '<button class="btn danger petit" data-action="lancer-repli">Lancer le retour arrière</button>' : ''}</div>` : '';
      return `<section class="groupe-cat phase-${p.code}"><h2 class="titre-cat"><span class="tc-nom">${esc(p.nom)}</span><span>${pluriel(l.length, 'étape')}${l.length ? ` · ${dureeTexte(total)}` : ''}</span><button class="btn petit" data-action="etape" data-phase="${p.code}">${ICONES.plus}Ajouter</button></h2>
        ${entete}${l.length ? `<ol class="etapes">${l.map((x) => ligneEtape(x, s)).join('')}</ol>` : `<p class="aide">Aucune étape de retour arrière : décris comment revenir à la situation de départ (qui, quoi, combien de temps).</p>`}</section>`;
    }).join('');
    return `${tete}${resume}${blocs}${AVERTISSEMENT}`;
  }

  function ligneEtape(x, s) {
    const p = s.prevu[x.id], e = s.estime[x.id];
    const ecartFin = e.fin - p.fin;
    const tol = E.reglages.toleranceMinutes;
    const reel = x.statut === 'fait' || x.statut === 'en-cours';
    const cl = ecartFin > tol ? 'tard' : ecartFin > 0 ? 'leger' : '';
    const deps = Array.isArray(x.apres) ? (x.apres.length ? `après ${x.apres.map((id) => etape(id)?.titre).filter(Boolean).map((t) => `« ${t} »`).join(', ')}` : 'dès le début') : '';
    const c = x.type === 'go' ? R.etatCriteres(x) : null;
    const decision = x.decision ? `<span class="etiquette ${x.decision === 'go' ? 'vert' : 'rouge'}">${x.decision === 'go' ? 'GO' : 'NO-GO'}</span>` : '';
    return `<li class="etape ${x.statut} type-${x.type}">
      <div class="et-heures"><b>${heure(p.debut)}</b><span class="${x.statut === 'saute' ? '' : cl}">${x.statut === 'saute' ? 'sautée' : `${reel ? 'réel' : 'est.'} ${heure(e.debut)}`}</span></div>
      <button class="lien-ligne et-corps" data-action="etape" data-id="${x.id}"><b>${esc(x.titre)} ${TYPE_E[x.type]}</b>
        <span>${dureeTexte(x.duree)} · ${x.responsable ? esc(nomMembre(x.responsable)) : '<i class="manque">responsable à désigner</i>'}${deps ? ` · ${esc(deps)}` : ''}${x.pasAvant ? ` · pas avant ${hDH(x.pasAvant)}` : ''}</span>
        ${c ? `<span>Critères ${c.ok}/${c.total}${x.commentaire ? ` · ${esc(x.commentaire)}` : ''}</span>` : ''}${x.note ? `<span class="et-note">${esc(x.note)}</span>` : ''}</button>
      <div class="et-droite">${decision || etiquetteE(x.statut)}${x.statut === 'fait' || x.statut === 'en-cours' ? `<span class="et-ecart ${cl}">${x.statut === 'fait' ? `fin ${heure(e.fin)}` : `fin est. ${heure(e.fin)}`}${ecartFin ? ` (${ecartTexte(ecartFin)})` : ''}</span>` : ''}<span class="rang">${boutonsEtape(x, s)}</span></div></li>`;
  }

  // ---------- Journal ----------
  function vueJournal() {
    const b = choisie();
    if (!b) return sansBascule('Journal');
    const s = synth(b);
    const tous = E.incidents.filter((i) => i.basculeId === b.id);
    const ouverts = tous.filter((i) => !i.resolu);
    const tete = `<div class="vue-tete"><div><h1>Journal</h1><p>Incidents horodatés et chronologie de ${esc(b.nom)} : départs, fins, décisions go/no-go, retour arrière.</p></div>
      <div class="actions">${choixBascule(b)}<button class="btn" data-action="situation">Point de situation</button><button class="btn primaire" data-action="incident">${ICONES.plus}Incident</button></div></div>`;
    const filtres = [['ouverts', 'Incidents ouverts', ouverts.length], ['incidents', 'Tous les incidents', tous.length], ['chrono', 'Chronologie', null]];
    const barre = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Affichage">${filtres.map(([id, nom, n]) => `<button class="filtre" data-action="filtre-journal" data-f="${id}" aria-pressed="${filtre.journal === id}">${nom}${n !== null ? ` <small>${n}</small>` : ''}</button>`).join('')}</div></div>`;
    let corps;
    if (filtre.journal === 'chrono') {
      const ch = R.chronologie(E, b.id);
      corps = ch.length ? `<ol class="chrono">${ch.map((ev) => `<li class="ev-${ev.type}${ev.gravite ? ` g-${ev.gravite}` : ''}${ev.decision ? ` d-${ev.decision}` : ''}"><span class="heure-pastille">${heure(ev.quand)}${R.dateDe(ev.quand) !== R.dateDe(s.debut) ? `<small>${dateCourte(R.dateDe(ev.quand))}</small>` : ''}</span><span>${esc(ev.texte)}</span></li>`).join('')}</ol>`
        : videEtat('Rien encore', 'La chronologie se remplit au fil de la bascule : chaque démarrage, fin, décision et incident y apparaît avec son heure.');
    } else {
      const l = (filtre.journal === 'ouverts' ? ouverts : tous).sort((x, y) => (x.heure < y.heure ? 1 : -1));
      corps = listeIncidents(l, s, filtre.journal === 'ouverts' ? 'Aucun incident ouvert' : 'Aucun incident noté');
    }
    return `${tete}${barre}${corps}${AVERTISSEMENT}`;
  }

  // ---------- Équipe ----------
  function vueEquipe() {
    const b = choisie();
    if (!b) return sansBascule('Équipe');
    const s = synth(b);
    const ms = membresB(b.id);
    const l = s.principal.concat(s.repli);
    const tete = `<div class="vue-tete"><div><h1>Équipe</h1><p>Qui fait quoi pendant ${esc(b.nom)}. Un nom et un rôle suffisent : aucune coordonnée n'est demandée.</p></div>
      <div class="actions">${choixBascule(b)}<button class="btn" data-action="imprimer-equipe">Imprimer qui fait quoi</button><button class="btn primaire" data-action="membre">${ICONES.plus}Membre</button></div></div>`;
    const sans = l.filter((x) => !x.responsable);
    const cartes = ms.map((m) => {
      const siennes = l.filter((x) => x.responsable === m.id).sort((p, q) => (R.groupe(p) === R.groupe(q) ? s.prevu[p.id].debut - s.prevu[q.id].debut : R.groupe(p) === 'repli' ? 1 : -1));
      return `<li class="membre${m.nom ? '' : ' a-nommer'}"><div class="mb-tete"><span class="initiales">${esc((m.nom || m.role || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>
        <button class="lien-ligne" data-action="membre" data-id="${m.id}"><b>${m.nom ? esc(m.nom) : '<i class="manque">À nommer</i>'}</b><span>${esc(m.role)}${m.organisation ? ` · ${esc(m.organisation)}` : ''}</span></button></div>
        ${m.joignable ? `<p class="mb-joignable">${esc(m.joignable)}</p>` : ''}
        ${siennes.length ? `<ul class="mb-etapes">${siennes.map((x) => `<li><span class="nb">${heure(s.prevu[x.id].debut)}</span><span>${esc(x.titre)}${x.phase === 'repli' ? ' <small>(repli)</small>' : ''}</span>${x.statut !== 'a-faire' ? etiquetteE(x.statut) : ''}</li>`).join('')}</ul>` : '<p class="mention">Aucune étape attribuée.</p>'}</li>`;
    }).join('');
    return `${tete}
      ${ms.length ? `<ul class="membres">${cartes}</ul>` : videEtat('Aucun membre', 'Ajoute les personnes de la bascule avec leur rôle : pilote, décideur, technique, métier, support…', `<button class="btn primaire" data-action="membre">${ICONES.plus}Membre</button>`)}
      ${sans.length ? `<h2 class="titre-section">Sans responsable <span>${pluriel(sans.length, 'étape')}</span></h2><ul class="liste-direct">${sans.map((x) => `<li><span class="heure-pastille">${heure(s.prevu[x.id].debut)}</span><button class="lien-ligne" data-action="etape" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${esc(phaseNom(x.phase))}</span></button></li>`).join('')}</ul>` : ''}
      <div class="rgpd"><h2>Données des personnes</h2><p>Ne note que ce qui sert le jour J (prénom, rôle, où le trouver). Informe l'équipe que ces informations figurent dans l'outil et efface-les une fois la bascule terminée si tu n'en as plus besoin.</p></div>`;
  }

  // ---------- Bascules ----------
  function vueBascules() {
    const tete = `<div class="vue-tete"><div><h1>Bascules</h1><p>Chaque bascule a son déroulé, son équipe et son journal. Duplique une répétition pour préparer la vraie, ou une bascule réussie pour la suivante.</p></div>
      <div class="actions"><button class="btn primaire" data-action="bascule">${ICONES.plus}Nouvelle bascule</button></div></div>`;
    const carte = (b) => {
      const s = synth(b);
      return `<li class="carte-bascule ${s.statut}${b.archivee ? ' archivee' : ''}"><div class="cb-tete"><button class="lien-ligne" data-action="ouvrir" data-id="${b.id}"><b>${esc(b.nom)}</b><span>${esc(fenetreTexte(b))}</span></button>${etiquetteB(s.statut)}</div>
        <div class="vt-chiffres"><div><b>${s.avancement.faites}/${s.avancement.total}</b><span>étapes${s.repliLance !== null ? ' de repli' : ''}</span></div><div><b>${heure(s.estimeFin)}</b><span>fin ${s.statut === 'preparation' ? 'prévue' : s.statut === 'terminee' || s.statut === 'revenue' ? 'réelle' : 'estimée'}</span></div><div><b>${s.retard === null ? '–' : ecartTexte(s.retard)}</b><span>écart</span></div></div>
        ${b.lieu ? `<p class="mention">${esc(b.lieu)}</p>` : ''}
        <div class="rang"><button class="btn petit primaire" data-action="ouvrir" data-id="${b.id}">Ouvrir</button><button class="btn petit" data-action="modifier-bascule" data-id="${b.id}">Modifier</button><button class="btn petit" data-action="dupliquer" data-id="${b.id}">Dupliquer</button><button class="btn petit" data-action="archiver" data-id="${b.id}">${b.archivee ? 'Désarchiver' : 'Archiver'}</button></div></li>`;
    };
    const vivantes = E.bascules.filter((b) => !b.archivee).sort((a, c) => (a.debut < c.debut ? 1 : -1));
    const archivees = E.bascules.filter((b) => b.archivee);
    return `${tete}
      ${vivantes.length ? `<ul class="cartes-bascules">${vivantes.map(carte).join('')}</ul>` : videEtat('Aucune bascule', 'Crée ta première bascule à partir d\'une séquence type.', `<button class="btn primaire" data-action="bascule">${ICONES.plus}Nouvelle bascule</button>`)}
      ${archivees.length ? `<details class="plus-tard"><summary>Archivées (${archivees.length})</summary><ul class="cartes-bascules">${archivees.map(carte).join('')}</ul></details>` : ''}
      <h2 class="titre-section">Séquences types <span>exemples génériques, à adapter</span></h2>
      <ul class="modeles">${B.modeles.filter((m) => m.etapes.length).map((m) => `<li><b>${esc(m.nom)}</b><span>${esc(m.objectif)}</span><span class="mention">${pluriel(m.etapes.filter((x) => x.p !== 'repli').length, 'étape')} · ${pluriel(m.etapes.filter((x) => x.type === 'go').length, 'go/no-go', 'go/no-go')} · ${pluriel(m.etapes.filter((x) => x.type === 'arret').length, 'point')} d'arrêt · retour arrière en ${m.etapes.filter((x) => x.p === 'repli').length} étapes</span><button class="btn petit" data-action="bascule" data-modele="${m.code}">Partir de ce modèle</button></li>`).join('')}</ul>
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
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const optionsMembres = (bId, val, vide = 'À désigner') => `<option value="">${vide}</option>${membresB(bId).map((m) => `<option value="${m.id}" ${m.id === val ? 'selected' : ''}>${esc(m.nom || '(à nommer)')} · ${esc(m.role)}</option>`).join('')}`;
  // Heure saisie (HH:MM) → date et heure proche de maintenant.
  const lireHeure = (v) => R.heureVersDH(String(v || ''), nowDH());

  function enregistrer(liste, objet, message) {
    retenir();
    const i = E[liste].findIndex((x) => x.id === objet.id);
    if (i >= 0) E[liste][i] = objet; else E[liste].push(objet);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function modifierEtape(id, champs, message) {
    retenir();
    const i = E.etapes.findIndex((x) => x.id === id);
    if (i < 0) return;
    E.etapes[i] = R.normaliserEtape({ ...E.etapes[i], ...champs });
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }

  // Bascule : création (depuis un modèle) ou modification.
  function modaleBascule(id, modeleCode) {
    const b = id ? bascule(id) : null;
    if (id && !b) return;
    const m = modeleDe(modeleCode || 'MIG');
    const date = dateProposee();
    const x = b || { nom: '', debut: `${date}T${m.debut}`, finFenetre: finProposee(date, m.debut, m.fenetreHeures), limiteRetour: '', lieu: '', objectif: '' };
    const s = b ? synth(b) : null;
    const corps = `
      ${b ? '' : `<label class="champ">Séquence de départ<select name="modele">${B.modeles.map((y) => `<option value="${y.code}" ${y.code === m.code ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select><small>Un exemple générique : étapes, durées, critères et rôles à adapter.</small></label>`}
      <label class="champ">Nom<input name="nom" value="${esc(x.nom)}" maxlength="120" placeholder="${esc(m.court)}" required></label>
      <div class="rang-champs"><label class="champ">Début<input type="datetime-local" name="debut" value="${x.debut}" required></label><label class="champ">Fin de la fenêtre<input type="datetime-local" name="finFenetre" value="${x.finFenetre}"></label></div>
      <label class="champ">Limite de décision de retour arrière<small>${s && s.limite !== null && !x.limiteRetour ? `Laisse vide pour la calculer : fin de fenêtre − durée du plan de repli (actuellement ${heure(s.limite)}).` : 'Laisse vide pour la calculer : fin de fenêtre − durée du plan de repli.'}</small><input type="datetime-local" name="limiteRetour" value="${x.limiteRetour}"></label>
      <label class="champ">Lieu ou point de rassemblement<small>Facultatif : salle de crise, site, pont téléphonique…</small><input name="lieu" value="${esc(x.lieu)}" maxlength="120"></label>
      <label class="champ">Objectif<textarea name="objectif" maxlength="600">${esc(x.objectif || (b ? '' : m.objectif))}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(b ? 'Modifier la bascule' : 'Nouvelle bascule', corps, PIED(!!b), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${b.nom} », son déroulé, son équipe et son journal ?`)) return 'Suppression annulée.';
        retenir(); E = R.supprimerBascule(E, b.id); sauver(); rendre();
        toast('Bascule supprimée.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const debut = fd.get('debut'), fin = fd.get('finFenetre') || '', lim = fd.get('limiteRetour') || '';
      if (!estDH(debut)) return 'Indique la date et l\'heure de début.';
      if (fin && (!estDH(fin) || versMin(fin) <= versMin(debut))) return 'La fin de la fenêtre doit être après le début.';
      if (lim && (!estDH(lim) || versMin(lim) < versMin(debut))) return 'La limite de retour arrière doit être après le début.';
      const champs = { nom: String(fd.get('nom')).trim(), debut, finFenetre: fin, limiteRetour: lim, lieu: fd.get('lieu'), objectif: fd.get('objectif') };
      if (b) {
        // Décaler le début décale les heures « pas avant » des étapes du même écart.
        const delta = versMin(debut) - versMin(b.debut);
        retenir();
        if (delta) E.etapes = E.etapes.map((e) => (e.basculeId === b.id && e.pasAvant ? { ...e, pasAvant: depuisMin(versMin(e.pasAvant) + delta) } : e));
        Object.assign(b, R.normaliserBascule({ ...b, ...champs, nom: champs.nom || b.nom }));
        sauver(); rendre(); toast('Bascule enregistrée : les heures sont recalculées.', { libelle: 'Annuler', faire: annuler });
      } else {
        const code = fd.get('modele');
        const r = R.depuisModele(B, code, { nom: champs.nom || modeleDe(code).court, debut, finFenetre: fin, lieu: champs.lieu });
        Object.assign(r.bascule, { limiteRetour: lim, objectif: champs.objectif, creeLe: auj() });
        retenir();
        E.bascules.push(r.bascule); E.etapes.push(...r.etapes); E.membres.push(...r.membres);
        choisir(r.bascule.id);
        sauver();
        changerVue(r.etapes.length ? 'equipe' : 'deroule');
        toast('Bascule créée : nomme l\'équipe, puis adapte le déroulé.', { libelle: 'Annuler', faire: annuler });
      }
      return undefined;
    });
    // Changer de modèle propose ses heures (sauf si l'utilisateur les a déjà modifiées).
    const sel = modale().querySelector('[name=modele]');
    if (sel) {
      let touche = false;
      ['debut', 'finFenetre'].forEach((n) => modale().querySelector(`[name=${n}]`).addEventListener('input', () => { touche = true; }));
      sel.addEventListener('change', () => {
        const mm = modeleDe(sel.value);
        modale().querySelector('[name=nom]').placeholder = mm.court;
        modale().querySelector('[name=objectif]').value = mm.objectif;
        if (!touche) { modale().querySelector('[name=debut]').value = `${date}T${mm.debut}`; modale().querySelector('[name=finFenetre]').value = finProposee(date, mm.debut, mm.fenetreHeures); }
      });
    }
  }

  // Étape : titre, phase, type, durée, responsable, dépendances, statut et heures réelles.
  function modaleEtape(id, phaseDefaut) {
    const b = choisie();
    if (!b) return;
    const x0 = id ? etape(id) : null;
    if (id && !x0) return;
    const liste = etapesB(b.id);
    const phase = x0 ? x0.phase : (phaseDefaut || 'bascule');
    const x = x0 || { titre: '', phase, type: 'action', duree: 30, responsable: '', apres: null, pasAvant: '', statut: 'a-faire', debutReel: '', finReel: '', note: '', criteres: [] };
    const memes = (ph) => liste.filter((y) => y.id !== id && R.groupe(y) === R.groupe({ phase: ph }));
    const mode = Array.isArray(x.apres) ? (x.apres.length ? 'liste' : 'debut') : 'precedente';
    const casesApres = (ph, sel) => memes(ph).map((y) => `<label class="case"><input type="checkbox" name="apres" value="${y.id}" ${sel.includes(y.id) ? 'checked' : ''}> ${esc(y.titre)}</label>`).join('') || '<p class="mention">Aucune autre étape dans ce groupe.</p>';
    const corps = `
      <label class="champ">Étape<input name="titre" value="${esc(x.titre)}" maxlength="160" placeholder="Ex. : Sauvegarde finale" required></label>
      <div class="rang-champs"><label class="champ">Phase<small>&nbsp;</small><select name="phase">${B.phases.map((p) => `<option value="${p.code}" ${p.code === x.phase ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Durée<small>45, 1h30, 2h…</small><input name="duree" value="${dureeTexte(x.duree).replace(/ /g, '').replace('min', ' min')}" inputmode="text"></label></div>
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut trois">${[['action', 'Étape'], ['go', 'Go/no-go'], ['arret', 'Point d\'arrêt']].map(([v, l]) => `<label><input type="radio" name="type" value="${v}" ${x.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="bloc-criteres" ${x.type === 'go' ? '' : 'hidden'}><label class="champ">Critères de décision<small>Un par ligne : ce qui doit être vrai pour dire GO.</small><textarea name="criteres" rows="4">${esc((x.criteres || []).map((c) => c.texte).join('\n'))}</textarea></label></div>
      <p class="aide aide-arret" ${x.type === 'arret' ? '' : 'hidden'}>Point d'arrêt : on ne continue qu'une fois le contrôle validé par son responsable. Les étapes suivantes l'attendent.</p>
      <label class="champ">Responsable<select name="responsable">${optionsMembres(b.id, x.responsable)}</select></label>
      <fieldset class="champ"><legend>Commence après</legend><div class="choix-statut trois">${[['precedente', 'L\'étape précédente'], ['debut', 'Le début'], ['liste', 'Des étapes précises']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${mode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div class="cases-apres" ${mode === 'liste' ? '' : 'hidden'}>${casesApres(x.phase, Array.isArray(x.apres) ? x.apres : [])}</div></fieldset>
      <label class="champ">Pas avant<small>Facultatif : heure fixe (ouverture d'une fenêtre, arrivée d'un transporteur…).</small><input type="datetime-local" name="pasAvant" value="${x.pasAvant}"></label>
      <label class="champ">Note<textarea name="note" maxlength="600" rows="2">${esc(x.note)}</textarea></label>
      ${x0 ? `<fieldset class="cadre-champs champ"><legend>Le jour J<small>Ces heures se remplissent avec les boutons Démarrer et Terminé ; corrige-les ici au besoin.</small></legend>
        <div class="rang-champs"><label class="champ">Statut<select name="statut">${R.STATUTS.map((st) => `<option value="${st}" ${x.statut === st ? 'selected' : ''}>${STATUT_E[st][1]}</option>`).join('')}</select></label></div>
        <div class="rang-champs"><label class="champ">Début réel<input type="datetime-local" name="debutReel" value="${x.debutReel}"></label><label class="champ">Fin réelle<input type="datetime-local" name="finReel" value="${x.finReel}"></label></div></fieldset>
        <div class="rang"><button class="btn petit" type="button" data-action="deplacer" data-id="${x0.id}" data-sens="-1">Monter</button><button class="btn petit" type="button" data-action="deplacer" data-id="${x0.id}" data-sens="1">Descendre</button></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x0 ? 'Modifier l\'étape' : 'Nouvelle étape', corps, PIED(!!x0), (fd, choix) => {
      if (choix === 'supprimer') {
        retenir();
        const autres = E.etapes.filter((y) => y.basculeId !== b.id);
        E.etapes = autres.concat(R.retirerEtape(etapesB(b.id), x0.id));
        E.incidents = E.incidents.map((i) => (i.etapeId === x0.id ? { ...i, etapeId: '' } : i));
        sauver(); rendre();
        toast('Étape supprimée : ses suivantes reprennent ses dépendances.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const titre = String(fd.get('titre')).trim();
      if (!titre) return 'Donne un nom à l\'étape.';
      const duree = R.lireDuree(fd.get('duree'));
      if (duree === null) return 'Durée illisible : écris 45, 1h30 ou 2h.';
      const ph = fd.get('phase');
      const md = fd.get('mode');
      const apres = md === 'precedente' ? null : md === 'debut' ? [] : fd.getAll('apres');
      if (md === 'liste' && !apres.length) return 'Coche au moins une étape, ou choisis « L\'étape précédente ».';
      const nouvelId = x0 ? x0.id : uid();
      const ordre = x0 ? x0.ordre : (() => { const l = liste.filter((y) => y.phase === ph); const autres = liste.filter((y) => B.phases.findIndex((p) => p.code === y.phase) <= B.phases.findIndex((p) => p.code === ph)); return (l.length ? Math.max(...l.map((y) => y.ordre)) : autres.length ? Math.max(...autres.map((y) => y.ordre)) : 0) + 5; })();
      const provisoire = liste.filter((y) => y.id !== nouvelId).concat({ ...x, id: nouvelId, phase: ph, ordre, apres });
      if (apres && apres.length && R.creeCycle(provisoire, nouvelId, apres)) return 'Ces dépendances forment une boucle : une étape ne peut pas attendre une étape qui l\'attend.';
      const type = fd.get('type');
      const textes = String(fd.get('criteres') || '').split('\n').map((t) => t.trim()).filter(Boolean);
      const anciens = x.criteres || [];
      const criteres = type === 'go' ? textes.map((t) => anciens.find((c) => c.texte === t) || { id: uid(), texte: t, ok: false }) : [];
      const champs = { id: nouvelId, basculeId: b.id, titre, phase: ph, type, duree, responsable: fd.get('responsable'), apres, pasAvant: fd.get('pasAvant') || '', note: fd.get('note'), criteres, ordre };
      if (x0) {
        const st = fd.get('statut');
        const dr = fd.get('debutReel') || '', fr = fd.get('finReel') || '';
        if (dr && fr && versMin(fr) < versMin(dr)) return 'La fin réelle est avant le début réel.';
        Object.assign(champs, { statut: st, debutReel: dr, finReel: st === 'fait' ? (fr || (dr ? '' : nowDH())) : (st === 'saute' ? '' : fr) });
        if (st === 'a-faire') Object.assign(champs, { debutReel: '', finReel: '' });
      }
      enregistrer('etapes', R.normaliserEtape({ ...x0, ...champs }), x0 ? 'Étape enregistrée : les heures sont recalculées.' : 'Étape ajoutée.');
      return undefined;
    });
    const d = modale();
    d.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', () => {
      const v = d.querySelector('[name=type]:checked').value;
      d.querySelector('.bloc-criteres').hidden = v !== 'go';
      d.querySelector('.aide-arret').hidden = v !== 'arret';
    }));
    d.querySelectorAll('[name=mode]').forEach((r) => r.addEventListener('change', () => { d.querySelector('.cases-apres').hidden = d.querySelector('[name=mode]:checked').value !== 'liste'; }));
    d.querySelector('[name=phase]').addEventListener('change', (e) => {
      const coches = [...d.querySelectorAll('[name=apres]:checked')].map((c) => c.value);
      d.querySelector('.cases-apres').innerHTML = casesApres(e.target.value, coches);
    });
  }

  function deplacer(id, sens) {
    const x = etape(id);
    if (!x) return;
    const l = etapesB(x.basculeId).filter((y) => R.groupe(y) === R.groupe(x));
    const i = l.findIndex((y) => y.id === id);
    const j = i + sens;
    if (j < 0 || j >= l.length) return toast(sens < 0 ? 'Déjà en tête.' : 'Déjà en dernier.');
    retenir();
    const autre = l[j];
    const [o1, o2] = [x.ordre, autre.ordre];
    x.ordre = o2 === o1 ? o1 + sens : o2; autre.ordre = o1;
    if (x.phase !== autre.phase) x.phase = autre.phase; // on change de phase en passant la limite
    sauver(); rendre();
    toast(`« ${x.titre} » déplacée.`, { libelle: 'Annuler', faire: annuler });
  }

  // Décision go/no-go : critères cochés, GO ou NO-GO, décideur, heure, commentaire.
  function modaleDecision(id) {
    const x = etape(id);
    if (!x) return;
    const b = bascule(x.basculeId);
    const corps = `
      <p>${esc(x.titre)} · ${esc(b.nom)}</p>
      <fieldset class="champ"><legend>Critères<small>Coche ce qui est vérifié.</small></legend>
        <div class="criteres-cases">${(x.criteres || []).map((c) => `<label class="case"><input type="checkbox" name="ok" value="${c.id}" ${c.ok ? 'checked' : ''}> ${esc(c.texte)}</label>`).join('') || '<p class="mention">Aucun critère défini pour ce point (ajoute-les en modifiant l\'étape).</p>'}</div></fieldset>
      <p class="apercu" data-reco></p>
      <fieldset class="champ"><legend>Décision</legend><div class="choix-statut deux decision-choix"><label><input type="radio" name="decision" value="go" ${x.decision === 'go' ? 'checked' : ''}><span>GO : on continue</span></label><label><input type="radio" name="decision" value="nogo" ${x.decision === 'nogo' ? 'checked' : ''}><span>NO-GO</span></label></div></fieldset>
      <label class="case lancer-repli" hidden><input type="checkbox" name="repli" checked> Lancer le retour arrière à cette heure</label>
      <div class="rang-champs"><label class="champ">Décideur<select name="decideur">${optionsMembres(b.id, x.decideur || x.responsable, 'Non précisé')}</select></label><label class="champ">Heure<input type="time" name="heure" value="${hDH(x.finReel) || heure(now())}"></label></div>
      <label class="champ">Commentaire<textarea name="commentaire" rows="2" maxlength="400">${esc(x.commentaire)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Décision go/no-go', corps, '<button class="btn primaire" value="ok">Enregistrer la décision</button><button class="btn" value="criteres">Garder les critères seulement</button><button class="btn" value="annuler">Annuler</button>', (fd, choix) => {
      const coches = fd.getAll('ok');
      const criteres = (x.criteres || []).map((c) => ({ ...c, ok: coches.includes(c.id) }));
      if (choix === 'criteres') { modifierEtape(x.id, { criteres }, 'Critères enregistrés.'); return undefined; }
      const dec = fd.get('decision');
      if (!dec) return 'Choisis GO ou NO-GO.';
      const h = lireHeure(fd.get('heure'));
      if (!h) return 'Heure illisible.';
      retenir();
      const i = E.etapes.findIndex((y) => y.id === x.id);
      E.etapes[i] = R.normaliserEtape({ ...x, criteres, decision: dec, decideur: fd.get('decideur'), commentaire: fd.get('commentaire'), statut: 'fait', finReel: h, debutReel: x.debutReel && versMin(x.debutReel) <= versMin(h) ? x.debutReel : '' });
      if (dec === 'nogo' && fd.get('repli')) b.repliLance = h;
      sauver(); rendre();
      toast(dec === 'go' ? 'GO enregistré : la bascule continue.' : (fd.get('repli') ? 'NO-GO : retour arrière lancé, le plan de repli devient le déroulé courant.' : 'NO-GO enregistré.'), { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const d = modale();
    const maj = () => {
      const c = d.querySelectorAll('[name=ok]'), ok = d.querySelectorAll('[name=ok]:checked').length;
      d.querySelector('[data-reco]').textContent = c.length ? (ok === c.length ? `Tous les critères sont cochés (${ok}/${c.length}) : rien ne s'oppose au GO.` : `${ok}/${c.length} critères cochés : un NO-GO ou un report se discute.`) : '';
      d.querySelector('.lancer-repli').hidden = d.querySelector('[name=decision]:checked')?.value !== 'nogo' || !synth(b).repli.length || !!b.repliLance;
    };
    d.querySelectorAll('[name=ok],[name=decision]').forEach((el) => el.addEventListener('change', maj));
    maj();
  }

  function modaleBloquer(id) {
    const x = etape(id);
    if (!x) return;
    const corps = `<p>${esc(x.titre)}</p>
      <label class="champ">Ce qui bloque<textarea name="note" rows="3" maxlength="600" required>${esc(x.note)}</textarea></label>
      <label class="case"><input type="checkbox" name="incident" checked> Noter aussi un incident bloquant dans le journal</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Étape bloquée', corps, '<button class="btn primaire" value="ok">Marquer bloquée</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const note = String(fd.get('note')).trim();
      if (!note) return 'Décris ce qui bloque, en une ligne.';
      retenir();
      const i = E.etapes.findIndex((y) => y.id === x.id);
      E.etapes[i] = R.normaliserEtape({ ...x, statut: 'bloque', note });
      if (fd.get('incident')) E.incidents.push(R.normaliserIncident({ id: uid(), basculeId: x.basculeId, heure: nowDH(), gravite: 'bloquant', titre: `${x.titre} : ${note}`.slice(0, 160), etapeId: x.id, responsable: x.responsable }));
      sauver(); rendre();
      toast('Étape bloquée : la fin estimée tient compte de l\'attente.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  function modaleIncident(id, etapeId) {
    const b = id ? bascule(E.incidents.find((i) => i.id === id)?.basculeId) : choisie();
    if (!b) return;
    const i0 = id ? E.incidents.find((i) => i.id === id) : null;
    const x = i0 || { heure: nowDH(), gravite: 'mineur', titre: '', etapeId: etapeId || (synth(b).enCours[0]?.id || ''), action: '', responsable: '', resolu: false, heureResolution: '' };
    const corps = `
      <div class="rang-champs"><label class="champ">Heure<input type="time" name="heure" value="${hDH(x.heure)}"></label><label class="champ">Étape liée<select name="etapeId"><option value="">Aucune</option>${etapesB(b.id).map((y) => `<option value="${y.id}" ${y.id === x.etapeId ? 'selected' : ''}>${esc(y.titre)}</option>`).join('')}</select></label></div>
      <fieldset class="champ"><legend>Gravité</legend><div class="choix-statut trois">${B.gravites.map((g) => `<label><input type="radio" name="gravite" value="${g.code}" ${x.gravite === g.code ? 'checked' : ''}><span>${g.nom}</span></label>`).join('')}</div><small class="mention">${B.gravites.map((g) => `${g.nom} : ${g.aide}`).join(' · ')}</small></fieldset>
      <label class="champ">Ce qui se passe<input name="titre" value="${esc(x.titre)}" maxlength="160" required placeholder="Ex. : sauvegarde plus lente que prévu"></label>
      <label class="champ">Action menée<textarea name="action" rows="2" maxlength="600">${esc(x.action)}</textarea></label>
      <label class="champ">Suivi par<select name="responsable">${optionsMembres(b.id, x.responsable, 'Non précisé')}</select></label>
      <div class="rang-champs"><label class="case"><input type="checkbox" name="resolu" ${x.resolu ? 'checked' : ''}> Résolu</label><label class="champ">À<input type="time" name="heureResolution" value="${hDH(x.heureResolution)}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i0 ? 'Incident' : 'Nouvel incident', corps, PIED(!!i0), (fd, choix) => {
      if (choix === 'supprimer') {
        retenir(); E.incidents = E.incidents.filter((i) => i.id !== i0.id); sauver(); rendre();
        toast('Incident supprimé.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const titre = String(fd.get('titre')).trim();
      if (!titre) return 'Décris l\'incident en une ligne.';
      const ref = i0 ? i0.heure : nowDH();
      const h = R.heureVersDH(fd.get('heure'), ref);
      if (!h) return 'Heure illisible.';
      const resolu = !!fd.get('resolu');
      const hr = resolu ? (R.heureVersDH(fd.get('heureResolution') || heure(now()), h) || nowDH()) : '';
      enregistrer('incidents', R.normaliserIncident({ ...x, id: i0?.id || uid(), basculeId: b.id, heure: h, gravite: fd.get('gravite'), titre, etapeId: fd.get('etapeId'), action: fd.get('action'), responsable: fd.get('responsable'), resolu, heureResolution: hr }), i0 ? 'Incident enregistré.' : 'Incident noté au journal.');
      return undefined;
    });
  }

  function modaleMembre(id) {
    const b = choisie();
    if (!b) return;
    const m0 = id ? membre(id) : null;
    const x = m0 || { nom: '', role: '', organisation: '', joignable: '', note: '' };
    const corps = `
      <label class="champ">Nom ou prénom<input name="nom" value="${esc(x.nom)}" maxlength="80" placeholder="Ex. : Claire M."></label>
      <label class="champ">Rôle<input name="role" value="${esc(x.role)}" maxlength="80" list="roles-types" required placeholder="Ex. : Responsable technique"><datalist id="roles-types">${B.roles.map((r) => `<option value="${esc(r.nom)}">`).join('')}</datalist></label>
      <label class="champ">Équipe ou organisation<small>Facultatif : service, prestataire…</small><input name="organisation" value="${esc(x.organisation)}" maxlength="80"></label>
      <label class="champ">Où le trouver le jour J<small>Facultatif : sur site, salle de crise, pont téléphonique, astreinte… Aucune coordonnée n'est nécessaire.</small><input name="joignable" value="${esc(x.joignable)}" maxlength="120"></label>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="300">${esc(x.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m0 ? 'Membre de l\'équipe' : 'Nouveau membre', corps, PIED(!!m0), (fd, choix) => {
      if (choix === 'supprimer') {
        retenir(); E = R.supprimerMembre(E, m0.id); sauver(); rendre();
        toast('Membre retiré : ses étapes n\'ont plus de responsable.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const role = String(fd.get('role')).trim();
      if (!role && !String(fd.get('nom')).trim()) return 'Indique au moins un rôle.';
      enregistrer('membres', R.normaliserMembre({ ...x, id: m0?.id || uid(), basculeId: b.id, nom: String(fd.get('nom')).trim(), role, organisation: fd.get('organisation'), joignable: fd.get('joignable'), note: fd.get('note') }), m0 ? 'Membre enregistré.' : 'Membre ajouté.');
      return undefined;
    });
  }

  function modaleSituation() {
    const b = choisie();
    if (!b) return;
    const texte = R.pointSituation(E, synth(b));
    ouvrirModale('Point de situation', `<p>À coller dans un message, un fil de discussion ou un compte rendu. Calculé à ${heure(now())}.</p><pre class="apercu-histo">${esc(texte)}</pre>`,
      '<button class="btn primaire" value="copier">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (_, choix) => {
        if (choix === 'copier') {
          navigator.clipboard?.writeText(texte).then(() => toast('Point de situation copié.'), () => toast('Copie impossible : sélectionne le texte à la main.'));
        }
        return undefined;
      });
  }

  function modaleDupliquer(id) {
    const b = bascule(id);
    if (!b) return;
    const s = synth(b);
    const fini = s.principal.some((x) => x.statut === 'fait');
    const debutPropose = `${R.ajout(auj(), 7)}T${hDH(b.debut)}`;
    const corps = `<p>Copie le déroulé, l'équipe et les critères de « ${esc(b.nom)} ». Les statuts, heures réelles, décisions et incidents repartent à zéro.</p>
      <label class="champ">Nom de la copie<input name="nom" value="${esc(b.nom.replace(/^Répétition de la /, '').replace(/\s*\(à blanc\)$/, ''))}${/Répétition/.test(b.nom) ? '' : ' (copie)'}" maxlength="120"></label>
      <label class="champ">Début<input type="datetime-local" name="debut" value="${debutPropose}"></label>
      ${fini ? '<label class="case"><input type="checkbox" name="reelles" checked> Reprendre les durées réellement mesurées des étapes faites</label>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Dupliquer la bascule', corps, '<button class="btn primaire" value="ok">Dupliquer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = R.dupliquer(E, id, { nom: String(fd.get('nom')).trim(), debut: fd.get('debut'), dureesReelles: !!fd.get('reelles') });
      if (!r) return 'Indique la date et l\'heure de début.';
      r.bascule.creeLe = auj();
      retenir();
      E.bascules.push(r.bascule); E.etapes.push(...r.etapes); E.membres.push(...r.membres);
      choisir(r.bascule.id);
      sauver(); changerVue('deroule');
      toast('Bascule dupliquée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  function modaleLancerRepli() {
    const b = choisie();
    if (!b) return;
    const s = synth(b);
    const corps = `<p>Le retour arrière remplace la suite du déroulé par le plan de repli (${pluriel(s.repli.length, 'étape')}, ${dureeTexte(s.dureeRepli)}). Les étapes restantes de la bascule ne sont plus suivies.</p>
      ${s.limite !== null && now() > s.limite ? `<p class="cd-alerte">La limite de décision (${heure(s.limite)}) est dépassée : le retour arrière risque de finir après la fin de fenêtre.</p>` : ''}
      <label class="champ">Lancé à<input type="time" name="heure" value="${heure(now())}"></label><p class="erreur" role="alert"></p>`;
    ouvrirModale('Lancer le retour arrière', corps, '<button class="btn primaire danger" value="ok">Lancer le retour arrière</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const h = lireHeure(fd.get('heure'));
      if (!h) return 'Heure illisible.';
      retenir(); b.repliLance = h; sauver(); changerVue('direct');
      toast('Retour arrière lancé : suis le plan de repli.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // ---------- Actions rapides sur une étape ----------
  function demarrerEtape(id) {
    const x = etape(id);
    if (!x) return;
    modifierEtape(id, { statut: 'en-cours', debutReel: nowDH(), finReel: '' }, `« ${x.titre} » démarrée à ${heure(now())}.`);
  }
  function terminerEtape(id) {
    const x = etape(id);
    if (!x) return;
    modifierEtape(id, { statut: 'fait', finReel: nowDH() }, `« ${x.titre} » ${x.type === 'arret' ? 'validée' : 'terminée'} à ${heure(now())}.`);
  }
  function reprendreEtape(id) {
    const x = etape(id);
    if (!x) return;
    modifierEtape(id, { statut: x.debutReel ? 'en-cours' : 'a-faire' }, `« ${x.titre} » débloquée.`);
  }
  function resoudre(id) {
    const i = E.incidents.find((x) => x.id === id);
    if (!i) return;
    enregistrer('incidents', { ...i, resolu: true, heureResolution: nowDH() }, `Incident résolu à ${heure(now())}.`);
  }

  // ---------- Impression ----------
  function imprimer(html) {
    const el = $('#impression');
    el.innerHTML = html;
    el.hidden = false;
    document.body.classList.add('imprime');
    if (modale().open) modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }
  function imprimerDeroule() {
    const b = choisie();
    if (!b) return;
    const s = synth(b);
    const lignes = (l) => l.map((x) => `<tr class="${x.type !== 'action' ? 'imp-cle' : ''}"><td class="nb">${heure(s.prevu[x.id].debut)}</td><td class="nb">${dureeTexte(x.duree)}</td><td><b>${esc(x.titre)}</b>${x.type === 'go' ? ' · GO/NO-GO' : x.type === 'arret' ? ' · POINT D\'ARRÊT' : ''}${x.type === 'go' && x.criteres.length ? `<br><small>${x.criteres.map((c) => `☐ ${esc(c.texte)}`).join('<br>')}</small>` : ''}</td><td>${esc(nomMembre(x.responsable))}</td><td class="nb">${x.statut === 'a-faire' ? '' : `${STATUT_E[x.statut][1]} ${x.debutReel ? hDH(x.debutReel) : ''}${x.finReel ? `→${hDH(x.finReel)}` : ''}`}</td><td class="imp-case"></td></tr>`).join('');
    const parPhase = B.phases.map((p) => { const l = (p.code === 'repli' ? s.repli : s.principal).filter((x) => x.phase === p.code); return l.length ? `<tr class="imp-phase"><td colspan="6">${esc(p.nom)}${p.code === 'repli' && s.limite !== null ? ` · décision au plus tard à ${heure(s.limite)}, durée ${dureeTexte(s.dureeRepli)}` : ''}</td></tr>${lignes(l)}` : ''; }).join('');
    imprimer(`<header class="imp-tete"><div><p class="surtitre">Déroulé de bascule</p><h1>${esc(b.nom)}</h1><p>${esc(fenetreTexte(b))}${b.lieu ? ` · ${esc(b.lieu)}` : ''}</p></div>
      <div class="imp-km"><b>${heure(s.debut)} → ${heure(s.prevuFin)}</b><span>${s.fenetre !== null ? `fenêtre jusqu'à ${heure(s.fenetre)}` : ''}</span></div></header>
      ${b.objectif ? `<p class="imp-ct">${esc(b.objectif)}</p>` : ''}
      <table class="tableau"><thead><tr><th class="nb">Heure</th><th class="nb">Durée</th><th>Étape</th><th>Responsable</th><th class="nb">Réel</th><th>✓</th></tr></thead><tbody>${parPhase}</tbody></table>
      <h2 class="imp-equipe">Équipe</h2><p>${membresB(b.id).map((m) => `<b>${esc(m.role)}</b> : ${esc(m.nom || 'à nommer')}${m.joignable ? ` (${esc(m.joignable)})` : ''}`).join(' · ')}</p>
      <p class="mention">Imprimé le ${dateLongue(auj())} à ${heure(now())}. Heures prévues d'après les durées saisies.</p>`);
  }
  function imprimerEquipe() {
    const b = choisie();
    if (!b) return;
    const s = synth(b);
    const l = s.principal.concat(s.repli);
    imprimer(`<header class="imp-tete"><div><p class="surtitre">Qui fait quoi</p><h1>${esc(b.nom)}</h1><p>${esc(fenetreTexte(b))}</p></div></header>
      <table class="tableau"><thead><tr><th>Rôle</th><th>Nom</th><th>Où le trouver</th><th>Étapes</th></tr></thead><tbody>${membresB(b.id).map((m) => `<tr><td><b>${esc(m.role)}</b></td><td>${esc(m.nom || 'à nommer')}</td><td>${esc(m.joignable)}</td><td>${l.filter((x) => x.responsable === m.id).map((x) => `${heure(s.prevu[x.id].debut)} ${esc(x.titre)}${x.phase === 'repli' ? ' (repli)' : ''}`).join('<br>')}</td></tr>`).join('')}</tbody></table>
      <p class="mention">Imprimé le ${dateLongue(auj())}.</p>`);
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const b = choisie();
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Alertes</h3><p class="aide">Seuils des alertes de la vue En direct, en minutes.</p>
        <div class="rang-champs"><label class="champ">Retard toléré<input name="toleranceMinutes" inputmode="numeric" value="${r.toleranceMinutes}"></label><label class="champ">Décision proche<input name="alerteMinutes" inputmode="numeric" value="${r.alerteMinutes}"></label><label class="champ">Avant la limite de retour<input name="margeRetourMinutes" inputmode="numeric" value="${r.margeRetourMinutes}"></label></div></div>
      <p class="erreur" role="alert"></p>
      ${b ? `<div class="groupe"><h3>Exporter</h3><p class="aide">Le déroulé de « ${esc(b.nom)} » en tableur (CSV) : heures prévues, estimées ou réelles, statuts, écarts.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button><button class="btn petit" type="button" data-action="imprimer">Imprimer le déroulé</button></div></div>` : ''}
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes bascules sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le pilotage à ton écran d'accueil pour l'ouvrir comme une application pendant la bascule, en salle de crise ou sur le terrain.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les bascules sont enregistrées en ligne, liées à ta clé, et ne sont ni lues ni partagées par QME. Pour l'équipe, un prénom et un rôle suffisent : aucune coordonnée n'est demandée. Efface les noms quand tu n'en as plus besoin.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Séquences types rédigées pour QME (version ${B.version}) : exemples génériques et fictifs, à adapter à tes procédures, qui priment. Les heures sont calculées sur cet appareil à partir des durées et des heures réelles saisies. Aucun envoi de message, aucune connexion à un agenda ou à une autre application : le point de situation se copie, le déroulé s'imprime ou s'exporte.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom) => { const n = Number(String(fd.get(nom)).trim()); return Number.isInteger(n) && n >= 0 && n <= 600 ? n : null; };
      const vals = { toleranceMinutes: lire('toleranceMinutes'), alerteMinutes: lire('alerteMinutes'), margeRetourMinutes: lire('margeRetourMinutes') };
      if (Object.values(vals).some((x) => x === null)) return 'Une valeur est illisible : écris un nombre entier de minutes (600 au plus).';
      E.reglages = R.normaliserReglages({ ...r, ...vals }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.bascules) || !Array.isArray(donnees.etapes)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.bascules.length, 'bascule')}, ${pluriel(donnees.etapes.length, 'étape')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du pilotage de bascule.'); }
    });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `pilotage-bascule-${auj()}.json`);
  const exporterCsv = () => { const b = choisie(); if (b) telecharger(R.csvDeroule(E, B, synth(b)), 'text/csv;charset=utf-8', `deroule-${R.plat(b.nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${auj()}.csv`); };

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
      <p>Enregistre ce pilotage sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); courante = ''; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'imprimer': imprimerDeroule(); break;
      case 'imprimer-equipe': imprimerEquipe(); break;
      case 'fermer': modale().close(); break;
      case 'bascule': modaleBascule(null, el.dataset.modele); break;
      case 'modifier-bascule': modaleBascule(id); break;
      case 'ouvrir': choisir(id); changerVue('direct'); break;
      case 'dupliquer': modaleDupliquer(id); break;
      case 'archiver': { const b = bascule(id); if (!b) break; retenir(); b.archivee = !b.archivee; if (b.archivee && courante === id) choisir(''); sauver(); rendre(); toast(b.archivee ? 'Bascule archivée.' : 'Bascule désarchivée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'etape': if (el.closest('#modale') && !el.closest('.modale-corps')) break; if (modale().open) modale().close(); modaleEtape(id || null, el.dataset.phase); break;
      case 'deplacer': deplacer(id, Number(el.dataset.sens)); break;
      case 'demarrer': demarrerEtape(id); break;
      case 'terminer': terminerEtape(id); break;
      case 'bloquer': modaleBloquer(id); break;
      case 'reprendre': reprendreEtape(id); break;
      case 'decider': modaleDecision(id); break;
      case 'incident': if (modale().open) modale().close(); modaleIncident(id || null); break;
      case 'resoudre': resoudre(id); break;
      case 'membre': modaleMembre(id || null); break;
      case 'situation': modaleSituation(); break;
      case 'lancer-repli': modaleLancerRepli(); break;
      case 'filtre-journal': filtre.journal = el.dataset.f; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // l'heure a avancé
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // L'heure avance : la vue En direct et le déroulé se recalculent chaque minute (jamais pendant une saisie).
  let derniereMinute = now();
  setInterval(() => {
    const m = now();
    if (m === derniereMinute || !E || !$('#vue') || modale().open || document.visibilityState !== 'visible') return;
    derniereMinute = m;
    if (vue === 'direct' || vue === 'deroule') rendre();
  }, 15000);

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
  window.__bascule = { etat: () => E, regles: R };
  init();
})();
