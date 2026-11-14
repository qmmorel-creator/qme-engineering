// Gestion de compétition sportive QME : inscriptions, catégories, épreuves, vagues et horaires, saisie des
// scores, classement paramétrable, mode écran et lien public en lecture seule.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi d'e-mail, aucun connecteur.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CMP;
  const API = '/api/templates';
  const API_PUBLIC = '/api/competition/public';
  const PRODUIT = 'CMP';
  const CLE_CODE = 'qme-cmp-code';
  const CLE_CACHE = 'qme-cmp-cache';
  const CLE_DEMO = 'qme-cmp-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cmp-ecran-accueil';
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
  const { versDate, nombre } = R;
  const auj = () => R.iso(new Date());
  const maintenantMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const rangTexte = (r) => (r === null || r === undefined ? '–' : r === 1 ? '1er' : `${r}e`);
  const rangCourt = (r) => (r === null || r === undefined ? '–' : r === 1 ? '1er' : `${r}e`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { cat: '', statut: 'tous', q: '', ep: '', catScore: '', catClass: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const participant = (id) => E.participants.find((p) => p.id === id);
  const categorie = (id) => E.categories.find((c) => c.id === id);
  const epreuve = (id) => E.epreuves.find((x) => x.id === id);
  const couleurCat = (id) => B.couleurs[Math.max(0, E.categories.findIndex((c) => c.id === id)) % B.couleurs.length];
  const typeDe = (t) => B.types.find((x) => x.id === t);

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
    planifierPublication();
    if (session.demo) return;
    majSync('attente');
    clearTimeout(minuterie);
    minuterie = setTimeout(envoyer, 600);
  }

  async function appel(chemin, options = {}, base = API) {
    const r = await fetch(base + chemin, { ...options, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(options.headers || {}) } });
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
        toast('Un autre appareil a modifié la compétition entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return false;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open && !document.activeElement?.matches?.('[data-s]')) rendre();
        return true;
      }
    } catch { majSync('horsligne'); }
    return false;
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

  // ---------- Publication du classement public ----------
  let minuteriePub = null;
  const lienPublic = () => `${location.origin}${location.pathname}?ecran=${session.demo ? 'demo' : encodeURIComponent(E.publication.id || '')}`;
  const nouveauSel = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (o) => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[o & 31]).join('');
  function planifierPublication() {
    if (!E?.publication?.active || session.demo) return;
    clearTimeout(minuteriePub);
    minuteriePub = setTimeout(() => { if (E?.publication?.active) publier().catch(() => {}); }, 4000);
  }
  async function publier() {
    if (session.demo) { E.publication.publieLe = new Date().toISOString(); cache(); return true; }
    if (!E.publication.sel) E.publication.sel = nouveauSel();
    const { statut, corps } = await appel('', { method: 'PUT', body: JSON.stringify({ sel: E.publication.sel, instantane: R.instantane(E) }) }, API_PUBLIC);
    if (statut !== 200) throw new Error(corps?.erreur || 'Publication impossible pour l\'instant.');
    const change = E.publication.id !== corps.id;
    E.publication.id = corps.id;
    E.publication.publieLe = corps.publieLe;
    if (change) { cache(true); clearTimeout(minuterie); minuterie = setTimeout(envoyer, 600); }
    return true;
  }
  async function retirerPublication(sel) {
    clearTimeout(minuteriePub);
    if (session.demo || !sel) return;
    await appel(`?sel=${encodeURIComponent(sel)}`, { method: 'DELETE' }, API_PUBLIC);
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
  // « Défi d'hiver Exemple », aujourd'hui : 39 inscrits fictifs en 6 catégories (dont des binômes), 4 épreuves.
  // Épreuves 1 et 2 jouées et validées, épreuve 3 en cours (scores partiels), finale à venir avec ses vagues.
  // États forcés : forfait, absent, disqualifié, temps limite (CAP+), égalité départagée et ex aequo, inscrit
  // sans accord d'affichage public, non payés, inscrit tardif hors vagues, épreuve réservée à certaines catégories.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    let graine = 20261114;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const m = Math.min(Math.max(maintenantMin(), 300), 1300);
    const h = (dm) => R.hhmm(Math.round((m + dm) / 5) * 5);
    e.competition = { nom: 'Défi d\'hiver Exemple', lieu: 'Salle Exemple, plateau principal', organisation: 'Association Exemple Sport', dateDebut: t, dateFin: t };
    const cats = [['eh', 'Élite hommes', 8, 1], ['ef', 'Élite femmes', 6, 0.95], ['ih', 'Intermédiaire hommes', 9, 0.75], ['if', 'Intermédiaire femmes', 7, 0.7], ['ms', 'Masters 40+', 5, 0.65], ['bx', 'Binômes mixtes', 4, 0.8]];
    e.categories = cats.map(([id, nom]) => R.normaliserCategorie({ id, nom, equipe: id === 'bx', taille: 2 }));
    const prenomsH = ['Hugo', 'Malik', 'Théo', 'Nathan', 'Yanis', 'Lucas', 'Romain', 'Samir', 'Bastien', 'Kévin', 'Julien', 'Arnaud', 'Damien', 'Mehdi', 'Pierre', 'Antoine', 'Loïc', 'Cyril'];
    const prenomsF = ['Léa', 'Inès', 'Camille', 'Sarah', 'Manon', 'Chloé', 'Nadia', 'Julie', 'Elsa', 'Amandine', 'Lina', 'Pauline', 'Océane', 'Margaux'];
    const noms = ['Moreau', 'Garnier', 'Lefort', 'Benali', 'Roux', 'Fabre', 'Perrin', 'Chevalier', 'Mallet', 'Navarro', 'Lambert', 'Girard', 'Collin', 'Barbier', 'Renaud', 'Aubry', 'Masson', 'Delorme', 'Ferrand', 'Hamel', 'Marchal', 'Royer', 'Vidal', 'Carré'];
    const clubs = ['Box Exemple Nord', 'Salle Exemple Centre', 'Club Exemple Rive', 'Association Exemple Sport', 'Indépendant'];
    const binomes = ['Les Exemples du Lac', 'Duo Exemple', 'Team Exemple Sud', 'Binôme Exemple 7'];
    let dossard = 1, ih = 0, iF = 0, iN = 0;
    const niveaux = new Map();
    for (const [id, , n, niv] of cats) {
      for (let k = 0; k < n; k++) {
        const femme = id === 'ef' || id === 'if' || (id === 'ms' && k % 2);
        const nom = id === 'bx' ? binomes[k] : `${femme ? prenomsF[iF++ % prenomsF.length] : prenomsH[ih++ % prenomsH.length]} ${noms[iN++ % noms.length]}`;
        const p = R.normaliserParticipant({
          id: uid(), nom, categorie: id, club: clubs[(dossard * 7) % clubs.length], dossard: dossard++, statut: k === 0 ? 'confirme' : (alea() < 0.7 ? 'confirme' : 'inscrit'),
          paye: true, pieces: true, email: k % 3 === 0 ? `participant${dossard}@exemple.fr` : '',
          membres: id === 'bx' ? [`${prenomsF[(k * 3) % prenomsF.length]} ${noms[(k * 5) % noms.length]}`, `${prenomsH[(k * 5 + 2) % prenomsH.length]} ${noms[(k * 7 + 3) % noms.length]}`] : [],
        });
        e.participants.push(p);
        niveaux.set(p.id, Math.max(0.05, Math.min(1, niv - 0.35 * (k / n) + (alea() - 0.5) * 0.3)));
      }
    }
    const P = (cat, k) => e.participants.filter((p) => p.categorie === cat)[k];
    P('ih', 8).statut = 'forfait'; P('ih', 8).note = 'Blessé la veille, prévenu par téléphone.';
    P('if', 3).public = false;
    P('ms', 2).paye = false; P('if', 5).paye = false; P('if', 5).pieces = false;
    const ep = (base, extra) => R.normaliserEpreuve({ ...B.epreuves.find((x) => x.id === base), id: uid(), date: t, couloirs: 8, battementMin: 4, ...extra });
    e.epreuves = [
      ep('couplet-temps', { heure: h(-250), ordre: 'dossard' }),
      ep('amrap-12', { heure: h(-160) }),
      ep('charge-fenetre', { heure: h(-50), categories: ['eh', 'ef', 'ih', 'if', 'ms'], description: 'Fenêtre de 8 min pour trouver la charge maximale d\'épaulé. Binômes non concernés.' }),
      ep('finale', { heure: h(40), coefficient: 2, description: '3 tours : 10 thrusters, 10 tractions, 10 burpees. Temps limite 8 min. Points doublés.' }),
    ];
    const [e1, e2, e3, e4] = e.epreuves;
    const noter = (epr, p, s) => { e.scores[epr.id] ||= {}; e.scores[epr.id][p.id] = R.normaliserScore(s); };
    const base3 = { eh: 105, ef: 72, ih: 82, if: 55, ms: 70 };
    e1.vagues = R.genererVagues(e, e1.id);
    for (const p of e.participants.filter((x) => R.concerne(e1, x))) {
      const a = niveaux.get(p.id);
      const temps = Math.round(330 + (1 - a) * 330 + alea() * 70);
      if (temps > 600) noter(e1, p, { statut: 'cap', valeur: 150 - Math.min(40, Math.round((temps - 600) / 4) + 3), valide: true });
      else noter(e1, p, { statut: 'ok', valeur: temps, valide: true });
    }
    noter(e1, P('ih', 6), { statut: 'dq', valide: true });
    e2.vagues = R.genererVagues(e, e2.id);
    for (const p of e.participants.filter((x) => R.concerne(e2, x))) {
      const a = niveaux.get(p.id);
      noter(e2, p, { valeur: Math.round(140 + a * 120 + alea() * 30), departage: Math.round(400 - a * 120 + alea() * 30), valide: true });
    }
    noter(e2, P('ef', 1), { valeur: e.scores[e2.id][P('ef', 0).id].valeur, departage: e.scores[e2.id][P('ef', 0).id].departage + 6, valide: true });
    noter(e2, P('if', 4), { valeur: e.scores[e2.id][P('if', 2).id].valeur, departage: e.scores[e2.id][P('if', 2).id].departage, valide: true });
    noter(e2, P('ms', 4), { statut: 'dns', valide: true });
    e3.vagues = R.genererVagues(e, e3.id);
    e3.vagues.forEach((v, i) => {
      for (const pid of v.couloirs) {
        if (!pid || i > 2) continue;
        const p = e.participants.find((x) => x.id === pid);
        if (i === 2 && v.couloirs.indexOf(pid) > 3) continue;
        noter(e3, p, { valeur: Math.round((base3[p.categorie] * (0.8 + niveaux.get(pid) * 0.22 + alea() * 0.08)) * 2) / 2, valide: i < 2 });
      }
    });
    e4.vagues = R.genererVagues(e, e4.id);
    // Inscrite tardive, arrivée après la génération des vagues.
    e.participants.push(R.normaliserParticipant({ id: uid(), nom: 'Ophélie Tessier', categorie: 'if', club: 'Club Exemple Rive', dossard: dossard++, statut: 'inscrit', paye: false, note: 'Inscrite sur place.' }));
    e.publication = { active: false, sel: null, id: null, publieLe: null };
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Gestion de compétition sportive · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="150" y="90" width="110" height="190" fill="#F5B400"/>
          <rect x="30" y="160" width="110" height="120" fill="#1D4E89"/>
          <rect x="270" y="200" width="110" height="80" fill="#D9302A"/>
          <circle cx="205" cy="45" r="32" fill="#141414"/>
          <circle cx="470" cy="150" r="90" fill="#F0EDE6"/>
          <path d="M470 150 L470 60 A90 90 0 0 1 560 150 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion de compétition sportive</p>
          <h1>Du premier inscrit au podium.</h1>
          <p>Inscriptions, catégories, vagues et horaires, scores saisis au bord du plateau, classement calculé en direct et affiché sur grand écran.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta compétition</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta compétition est enregistrée en ligne : toute l'équipe d'organisation l'ouvre avec la même clé, sur ordinateur et sur téléphone.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma compétition</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec une compétition d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/competition/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma compétition'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, nom: '', lieu: '', organisation: '', dateDebut: '', dateFin: '', format: 'individuel', heure: '09:00' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ta compétition.</h1>
        <p class="intro">Tu crées les catégories et les épreuves, tu inscris les participants, puis les vagues, les horaires et le classement se calculent. Rien n'est envoyé aux participants : c'est ton outil d'organisation.</p>
        <div class="grille-champs" style="margin-top:20px">
          <label class="champ">Nom de la compétition<input id="a-nom" value="${esc(a.nom)}" maxlength="100" placeholder="Ex. : Défi d'hiver du club"></label>
          <label class="champ">Lieu <small>Facultatif.</small><input id="a-lieu" value="${esc(a.lieu)}" maxlength="100"></label>
          <label class="champ">Organisation <small>Club ou association, facultatif.</small><input id="a-org" value="${esc(a.organisation)}" maxlength="100"></label>
          <div class="rang-champs"><label class="champ">Premier jour<input type="date" id="a-debut" value="${esc(a.dateDebut)}"></label><label class="champ">Dernier jour <small>Si plusieurs jours.</small><input type="date" id="a-fin" value="${esc(a.dateFin)}"></label></div>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="a-err" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton format de départ</h1>
        <p class="intro">Catégories et épreuves proposées, toutes modifiables ensuite. Les épreuves sont génériques : renomme-les et décris tes mouvements.</p>
        <fieldset class="champ" style="margin-top:16px;border:0;padding:0"><legend class="sr-only">Format</legend>
          <div class="choix-activite">${B.formats.map((f) => `<label><input type="radio" name="format" value="${f.id}" ${f.id === a.format ? 'checked' : ''}><span><b>${esc(f.nom)}</b><small>${esc(f.detail)}</small></span></label>`).join('')}</div>
        </fieldset>
        <label class="champ" style="max-width:220px;margin-top:20px">Heure de la première épreuve<input type="time" id="a-heure" value="${esc(a.heure)}"></label>
        <p class="aide" style="max-width:720px;margin-top:16px">Les épreuves suivantes sont placées toutes les deux heures et demie : ajuste-les dans « Épreuves » une fois les vagues générées.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma compétition</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-lieu', 'lieu'); lier('#a-org', 'organisation'); lier('#a-debut', 'dateDebut'); lier('#a-fin', 'dateFin'); lier('#a-heure', 'heure');
    document.querySelectorAll('[name=format]').forEach((el) => el.addEventListener('change', () => { accueil.format = el.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    E.competition = { nom: a.nom.trim() || 'Ma compétition', lieu: a.lieu.trim(), organisation: a.organisation.trim(), dateDebut: R.estDate(a.dateDebut) ? a.dateDebut : null, dateFin: R.estDate(a.dateFin) ? a.dateFin : (R.estDate(a.dateDebut) ? a.dateDebut : null) };
    const f = B.formats.find((x) => x.id === a.format) || B.formats[0];
    E.categories = f.categories.map(([nom, taille]) => R.normaliserCategorie({ nom, equipe: Boolean(taille), taille: taille || 2 }));
    const h0 = R.estHeure(a.heure) ? R.minutes(a.heure) : 540;
    E.epreuves = f.epreuves.map((id, i) => { const m = B.epreuves.find((x) => x.id === id); return R.normaliserEpreuve({ ...m, id: uid(), date: E.competition.dateDebut, heure: R.hhmm(h0 + i * 150) }); });
    accueil = { etape: 1, nom: '', lieu: '', organisation: '', dateDebut: '', dateFin: '', format: 'individuel', heure: '09:00' };
    vue = 'inscrits';
    sauver();
    demarrer();
    toast('Ta compétition est prête. Inscris tes premiers participants.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    inscrits: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    epreuves: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    scores: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    classement: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="5" width="6" height="16" fill="currentColor"/><rect x="2" y="10" width="6" height="11" fill="none" stroke="currentColor" stroke-width="2"/><rect x="16" y="13" width="6" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Aperçu'], ['inscrits', 'Inscrits'], ['epreuves', 'Épreuves'], ['scores', 'Scores'], ['classement', 'Classement']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'organisation, pas un logiciel fédéral homologué : les règles de classement sont celles que tu choisis dans « Classement › Règles ». Données personnelles des participants : collecte limitée au nécessaire, aucune donnée de santé, coordonnées jamais publiées (RGPD).</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="34" y="24" width="28" height="72" fill="#F5B400"/><rect x="0" y="48" width="30" height="48" fill="#1D4E89"/><rect x="66" y="64" width="30" height="32" fill="#D9302A"/><circle cx="48" cy="10" r="10" fill="#141414"/></svg>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/competition/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Compétition fictive, gardée sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion de<br>compétition</span>
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
    if (ecranOuvert) { majEcranApp(); }
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · ${E.competition.nom || 'Compétition'}`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, inscrits: vueInscrits, epreuves: vueEpreuves, scores: vueScores, classement: vueClassement }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    brancherScores();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const pastilleCat = (id) => { const c = categorie(id); return c ? `<span class="pastille-cat" style="--c:${couleurCat(id)}">${esc(c.nom)}</span>` : '<span class="etiquette rouge">Sans catégorie</span>'; };
  const puces = (action, actif, avecToutes, compte) => `<div class="filtres" role="group" aria-label="Catégorie">${avecToutes ? `<button class="filtre" data-action="${action}" data-cat="" aria-pressed="${!actif}">Toutes <small>${compte ? compte('') : ''}</small></button>` : ''}${E.categories.map((c) => `<button class="filtre filtre-cat" style="--c:${couleurCat(c.id)}" data-action="${action}" data-cat="${c.id}" aria-pressed="${actif === c.id}">${esc(c.nom)}${compte ? ` <small>${compte(c.id)}</small>` : ''}</button>`).join('')}</div>`;

  // ---------- Tableau de bord ----------
  function lignesProgramme(liste) {
    return `<ul class="prochains">${liste.map((x) => `<li><span class="date-pastille ${x.enCours ? 'alerte' : ''}"><b>${esc(x.h.debut)}</b>${x.enCours ? 'en piste' : `vague ${x.numero}`}</span>
      <button class="lien-ligne" data-action="voir-vague" data-ep="${x.epreuve.id}" data-i="${x.numero - 1}"><b>${esc(x.epreuve.nom)} · vague ${x.numero}</b><span>${esc(categorie(x.vague.categorie)?.nom || '')} · ${pluriel(x.vague.couloirs.filter(Boolean).length, 'couloir occupé', 'couloirs occupés')}${x.date && x.date !== auj() ? ` · ${fmt(x.date, { day: 'numeric', month: 'short' })}` : ''}</span></button>
      <span class="nb">${esc(x.h.fin)}</span></li>`).join('')}</ul>`;
  }

  function vueTableau() {
    const s = R.synthese(E);
    const c = E.competition;
    const titre = `<div class="vue-tete"><div><h1>${esc(c.nom || 'Ma compétition')}</h1><p>${[c.dateDebut && (c.dateFin && c.dateFin !== c.dateDebut ? `Du ${fmt(c.dateDebut, { day: 'numeric', month: 'long' })} au ${fmt(c.dateFin)}` : dateLongue(c.dateDebut)), c.lieu, c.organisation].filter(Boolean).map(esc).join(' · ') || 'Renseigne la date et le lieu dans les Réglages.'}</p></div>
        <div class="actions"><button class="btn" data-action="mode-ecran">Mode écran</button><button class="btn primaire" data-action="vue" data-vue="scores">Saisir des scores</button></div></div>`;
    if (!E.categories.length && !E.participants.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Tout commence par les catégories</h3><p>Crée les catégories (niveaux, hommes, femmes, équipes), puis inscris les participants.</p><div class="actions"><button class="btn primaire" data-action="categories">${ICONES.plus}Créer les catégories</button></div></div></div>${AVERTISSEMENT}`;
    }
    const pis = R.enPiste(E, auj(), maintenantMin());
    const prochaine = pis.suivantes[0];
    const hors = new Map();
    for (const ep of E.epreuves) for (const p of R.horsVagues(E, ep)) { if (!hors.has(p.id)) hors.set(p.id, { p, eps: [] }); hors.get(p.id).eps.push(ep.nom); }
    const alertes = [
      ...s.repos.map((x) => ({ niv: x.ecart < 0 ? 'rouge' : 'jaune', t: `${esc(x.participant.nom)} : ${x.ecart < 0 ? 'deux vagues se chevauchent' : `${x.ecart} min de repos seulement`}`, d: `${esc(x.avant.epreuve.nom)} (${x.avant.h.debut}) puis ${esc(x.apres.epreuve.nom)} (${x.apres.h.debut})`, action: 'vue', vue: 'epreuves' })),
      ...[...hors.values()].map(({ p, eps }) => ({ niv: 'jaune', t: `${esc(p.nom)} n'est dans aucune vague`, d: `${eps.length > 1 ? pluriel(eps.length, 'épreuve') : esc(eps[0])} : régénère les vagues ou place-le dans un couloir libre`, action: 'vue', vue: 'epreuves' })),
      ...(s.sansCategorie ? [{ niv: 'rouge', t: `${pluriel(s.sansCategorie, 'inscrit')} sans catégorie`, d: 'Hors classement tant qu\'aucune catégorie n\'est choisie', action: 'vue', vue: 'inscrits' }] : []),
      ...s.sansVagues.map((ep) => ({ niv: 'ciel', t: `${esc(ep.nom)} : vagues à générer`, d: 'Les horaires et l\'ordre de passage se calculent à la génération', action: 'vue', vue: 'epreuves' })),
      ...(s.nonPayes ? [{ niv: 'ciel', t: `${pluriel(s.nonPayes, 'inscription')} non payée${s.nonPayes > 1 ? 's' : ''}`, d: 'Filtre « Non payés » dans les inscrits', action: 'filtre-statut', statut: 'nonpaye' }] : []),
    ];
    const tuiles = [
      ['Inscrits', String(s.engages), `${pluriel(E.categories.length, 'catégorie')}${s.forfaits ? ` · ${pluriel(s.forfaits, 'forfait')}` : ''}`, 'var(--bleu)', ''],
      ['Scores saisis', `${s.saisis}/${s.attendus}`, `${s.valides} validés · ${pluriel(E.epreuves.length, 'épreuve')}`, 'var(--jaune)', 'rond'],
      ['Prochaine vague', prochaine ? prochaine.h.debut : '–', prochaine ? `${prochaine.epreuve.nom} · ${categorie(prochaine.vague.categorie)?.nom || ''}` : (pis.enCours ? 'Dernière vague en piste' : 'Aucune vague à venir aujourd\'hui'), 'var(--rouge)', ''],
      ['Alertes', String(alertes.length), alertes.length ? 'Repos, vagues, inscriptions' : 'Rien à signaler', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${esc(v)}</b><span>${esc(d)}</span></div>`).join('');
    const prog = [...(pis.enCours ? [{ ...pis.enCours, enCours: true }] : []), ...pis.suivantes.slice(0, pis.enCours ? 4 : 5)];
    const maxCat = Math.max(1, ...s.parCategorie.map((x) => x.nb));
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">En piste et à suivre <span>Horaires calculés depuis les vagues</span></h2>
          ${prog.length ? lignesProgramme(prog) : `<div class="vide-etat petit"><div><h3>${E.epreuves.some((x) => x.vagues.length) ? 'Aucune vague à venir aujourd\'hui' : 'Pas encore de vagues'}</h3><p>${E.epreuves.some((x) => x.vagues.length) ? 'Le programme complet est dans « Épreuves ».' : 'Génère les vagues de chaque épreuve dans « Épreuves » : les horaires suivent.'}</p></div></div>`}
          <h2 class="titre-section">Alertes</h2>
          ${alertes.length ? `<ul class="alertes">${alertes.slice(0, 8).map((a) => `<li class="niv-${a.niv}"><button class="lien-ligne" data-action="${a.action}" ${a.vue ? `data-vue="${a.vue}"` : ''} ${a.statut ? `data-statut="${a.statut}"` : ''}><b>${a.t}</b><span>${a.d}</span></button></li>`).join('')}</ul>${alertes.length > 8 ? `<p class="mention">Et ${alertes.length - 8} autres.</p>` : ''}` : '<p class="aide">Aucune alerte : repos suffisants, tous les inscrits sont dans les vagues.</p>'}
        </section>
        <section>
          <h2 class="titre-section">Inscrits par catégorie</h2>
          <figure class="graphique"><div class="barres-cats">${s.parCategorie.map((x) => `<div class="barre-cat"><span class="bc-nom">${esc(x.categorie.nom)}</span><span class="bc-piste"><span class="bc-barre" style="width:${(x.nb / maxCat) * 100}%;background:${couleurCat(x.categorie.id)}"></span></span><span class="bc-val"><b>${x.nb}</b></span></div>`).join('')}</div></figure>
          <h2 class="titre-section">Podiums provisoires</h2>
          ${podiums()}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function podiums() {
    const blocs = E.categories.map((c) => ({ c, cg: R.classementGeneral(E, c.id) })).filter((x) => x.cg.epreuves.length);
    if (!blocs.length) return '<div class="vide-etat petit"><div><h3>Pas encore de score</h3><p>Les podiums apparaissent dès la première épreuve saisie.</p></div></div>';
    return `<div class="podiums">${blocs.map(({ c, cg }) => `<button class="podium" data-action="voir-classement" data-cat="${c.id}" style="--c:${couleurCat(c.id)}"><span class="podium-cat">${esc(c.nom)}${cg.provisoire ? ' <small>provisoire</small>' : ''}</span>${cg.lignes.slice(0, 3).map((l) => `<span class="podium-l"><b>${rangTexte(l.rang)}</b>${esc(l.participant.nom)}<em>${nombre(l.total)}</em></span>`).join('')}</button>`).join('')}</div>`;
  }

  // ---------- Inscrits ----------
  const FILTRES_ST = [['tous', 'Tous'], ['confirme', 'Confirmés'], ['inscrit', 'À confirmer'], ['nonpaye', 'Non payés'], ['forfait', 'Forfaits']];
  const garderSt = (p, f) => f === 'tous' || (f === 'nonpaye' ? !p.paye && R.engage(p) : p.statut === f);

  function vueInscrits() {
    const q = filtre.q.trim().toLowerCase();
    const base = E.participants.filter((p) => !filtre.cat || p.categorie === filtre.cat);
    const liste = base.filter((p) => garderSt(p, filtre.statut) && (!q || `${p.dossard} ${p.nom} ${p.club} ${p.membres.join(' ')}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.dossard || 0) - (b.dossard || 0));
    const compteCat = (id) => E.participants.filter((p) => (!id || p.categorie === id) && R.engage(p)).length;
    return `
      <div class="vue-tete"><div><h1>Inscrits</h1><p>Athlètes et équipes, par catégorie. Le dossard se numérote tout seul. Les coordonnées restent privées : elles ne s'affichent jamais sur l'écran ni sur le lien public.</p></div>
        <div class="actions"><button class="btn" data-action="categories">Catégories</button><button class="btn" data-action="importer">Coller une liste</button><button class="btn primaire" data-action="nouvel-inscrit">${ICONES.plus}Inscrire</button></div></div>
      ${E.categories.length ? `<div class="outils-liste">${puces('filtre-cat', filtre.cat, true, compteCat)}</div>` : ''}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Statut">${FILTRES_ST.map(([id, lib]) => `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${base.filter((p) => garderSt(p, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Nom, dossard, club" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'inscrit')}</p><ul class="lignes-fac">${liste.map(ligneInscrit).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.participants.length ? 'Aucun inscrit ne correspond' : 'Aucun inscrit'}</h3><p>${E.participants.length ? 'Change le filtre ou la recherche.' : 'Inscris les participants un par un, ou colle une liste depuis ton tableur ou ton formulaire d\'inscription.'}</p><div class="actions"><button class="btn primaire" data-action="nouvel-inscrit">${ICONES.plus}Inscrire</button><button class="btn" data-action="importer">Coller une liste</button></div></div></div>`}
      <details class="plus-tard"><summary>Mention d'information RGPD à mettre sur ton formulaire d'inscription</summary><p class="aide">${esc(B.mentionRgpd)}</p><div class="rang" style="padding-bottom:12px"><button class="btn petit" data-action="copier-mention">Copier la mention</button></div></details>
      ${AVERTISSEMENT}`;
  }

  function ligneInscrit(p) {
    const tags = [pastilleCat(p.categorie)];
    if (p.statut === 'forfait') tags.push('<span class="etiquette rouge">Forfait</span>');
    else if (p.statut === 'inscrit') tags.push('<span class="etiquette jaune">À confirmer</span>');
    if (!p.paye && R.engage(p)) tags.push('<span class="etiquette rose">Non payé</span>');
    if (!p.pieces && R.engage(p)) tags.push('<span class="etiquette sable">Pièces à vérifier</span>');
    if (!p.public) tags.push('<span class="etiquette ciel">Dossard seulement en public</span>');
    const detail = [p.club, p.membres.length ? p.membres.join(' et ') : ''].filter(Boolean).map(esc).join(' · ');
    return `<li class="ligne-fac ${p.statut === 'forfait' ? 'st-resilie' : ''}">
      <button class="ligne-info" data-action="modifier-inscrit" data-id="${p.id}">
        <b><span class="dossard">${p.dossard ?? '–'}</span>${esc(p.nom)}</b>
        <span class="ligne-detail">${detail || 'Sans club'}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      ${p.email || p.telephone ? `<div class="ligne-droite"><span class="ligne-proch">${p.email ? '✉' : ''}${p.telephone ? ' ☎' : ''}</span></div>` : ''}
    </li>`;
  }

  // ---------- Épreuves et vagues ----------
  function vueEpreuves() {
    const s = R.synthese(E);
    return `
      <div class="vue-tete"><div><h1>Épreuves et vagues</h1><p>Dans l'ordre du programme. Les vagues se remplissent par catégorie, de façon équilibrée ; leurs horaires suivent l'heure de début, le temps limite et le battement.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-epreuve">${ICONES.plus}Nouvelle épreuve</button></div></div>
      ${s.repos.length ? `<p class="aide alerte-taux">${pluriel(s.repos.length, 'alerte')} de repos (moins de ${E.reglages.reposMin} min entre deux vagues d'un même participant) : décale l'heure d'une épreuve ou régénère ses vagues.</p>` : ''}
      ${E.epreuves.length ? `<div class="liste-epreuves">${E.epreuves.map(carteEpreuve).join('')}</div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune épreuve</h3><p>Ajoute tes épreuves dans l'ordre du programme : type de score, temps limite, départage.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-epreuve">${ICONES.plus}Nouvelle épreuve</button></div></div></div>`}
      <h2 class="titre-section">Repères</h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  function carteEpreuve(ep, i) {
    const engages = E.participants.filter((p) => R.concerne(ep, p));
    const saisis = engages.filter((p) => R.score(E, ep.id, p.id)).length;
    const hors = R.horsVagues(E, ep);
    const cats = ep.categories.length ? ep.categories.map((id) => categorie(id)?.nom).filter(Boolean).join(', ') : 'Toutes les catégories';
    const infos = [typeDe(ep.type).nom, ep.capMin ? `temps limite ${nombre(ep.capMin)} min` : '', ep.type === 'temps' && ep.repsTotal ? `${ep.repsTotal} reps au total` : '', ep.departage ? 'départage au temps' : '', ep.coefficient !== 1 ? `coefficient ${nombre(ep.coefficient)}` : ''].filter(Boolean).join(' · ');
    const ouvert = filtre.ep === ep.id;
    const vagues = ep.vagues.map((v, k) => ({ v, k, h: R.horaire(ep, k) }));
    return `<section class="carte-epreuve" id="ep-${ep.id}">
      <div class="ce-tete">
        <span class="ce-num">${i + 1}</span>
        <div class="ce-titre"><h2>${esc(ep.nom)}</h2><p>${esc(infos)}</p><p class="mention">${esc(cats)}${ep.heure ? ` · début ${ep.date && ep.date !== E.competition.dateDebut ? `${fmt(ep.date, { day: 'numeric', month: 'short' })} ` : ''}${ep.heure}` : ' · heure à fixer'}${vagues.length ? ` · fin ${vagues.at(-1).h?.fin || '–'}` : ''}</p></div>
        <div class="ce-actions">
          <button class="btn-icone petit" data-action="monter" data-id="${ep.id}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icone petit" data-action="descendre" data-id="${ep.id}" aria-label="Descendre" ${i === E.epreuves.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn petit" data-action="modifier-epreuve" data-id="${ep.id}">Modifier</button>
        </div>
      </div>
      ${ep.description ? `<p class="ce-desc">${esc(ep.description)}</p>` : ''}
      <div class="ce-pied">
        <span class="etiquette ${saisis === engages.length && engages.length ? 'vert' : saisis ? 'jaune' : 'sable'}">${saisis}/${engages.length} scores</span>
        <span class="etiquette ${ep.vagues.length ? 'ciel' : 'rose'}">${ep.vagues.length ? pluriel(ep.vagues.length, 'vague') : 'Vagues à générer'}</span>
        ${hors.length ? `<span class="etiquette rouge">${pluriel(hors.length, 'inscrit')} hors vagues</span>` : ''}
        <span class="ce-boutons">
          <button class="btn petit" data-action="generer" data-id="${ep.id}">${ep.vagues.length ? 'Régénérer les vagues' : 'Générer les vagues'}</button>
          ${ep.vagues.length ? `<button class="btn petit" data-action="imprimer" data-id="${ep.id}">Feuilles de juge</button><button class="btn petit" data-action="deplier" data-id="${ep.id}" aria-expanded="${ouvert}">${ouvert ? 'Masquer' : 'Voir'} les vagues</button>` : ''}
          <button class="btn petit primaire" data-action="saisir" data-id="${ep.id}">Scores</button>
        </span>
      </div>
      ${ouvert && vagues.length ? `<div class="vagues">${vagues.map(({ v, k, h }) => `<div class="vague" style="--c:${couleurCat(v.categorie)}">
          <div class="vague-tete"><b>Vague ${k + 1}</b><span>${h ? `${h.debut} – ${h.fin}` : 'heure à fixer'} · ${esc(categorie(v.categorie)?.nom || 'Catégorie supprimée')}</span><button class="btn lien" data-action="modifier-vague" data-ep="${ep.id}" data-i="${k}">Modifier</button></div>
          <ol class="couloirs">${v.couloirs.map((pid, c) => { const p = participant(pid); return `<li><span class="couloir">${c + 1}</span>${p ? `<b>${esc(p.nom)}</b><small>${p.dossard ?? ''}</small>` : '<em>Libre</em>'}</li>`; }).join('')}</ol>
        </div>`).join('')}</div>` : ''}
    </section>`;
  }

  // ---------- Scores ----------
  function epreuveCourante() {
    let ep = epreuve(filtre.ep);
    if (!ep) {
      // Par défaut : la première épreuve dont des scores manquent.
      const dans = (x, p) => !x.vagues.length || x.vagues.some((v) => v.couloirs.includes(p.id));
      ep = E.epreuves.find((x) => E.participants.some((p) => R.concerne(x, p) && dans(x, p) && !R.score(E, x.id, p.id))) || E.epreuves[0];
      filtre.ep = ep?.id || '';
    }
    return ep;
  }
  function catCourante(ep, cle) {
    const ok = (id) => E.categories.some((c) => c.id === id) && (!ep || !ep.categories.length || ep.categories.includes(id));
    const peuplee = (id) => E.participants.some((p) => p.categorie === id && R.engage(p));
    if (!ok(filtre[cle])) filtre[cle] = (E.categories.find((c) => ok(c.id) && peuplee(c.id)) || E.categories.find((c) => ok(c.id)) || {}).id || '';
    return filtre[cle];
  }

  function vueScores() {
    const ep = epreuveCourante();
    const titre = '<div class="vue-tete"><div><h1>Scores</h1><p>Par épreuve et par catégorie, dans l\'ordre des vagues. Chaque saisie est enregistrée aussitôt et le rang se recalcule ; coche « validé » quand la feuille du juge est signée.</p></div></div>';
    if (!ep) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune épreuve</h3><p>Crée d'abord les épreuves.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-epreuve">${ICONES.plus}Nouvelle épreuve</button></div></div></div>`;
    const cat = catCourante(ep, 'catScore');
    const lignes = cat ? R.ordreSaisie(E, ep, cat) : [];
    const c = cat ? R.classementEpreuve(E, ep, cat) : null;
    const rangs = new Map(c ? c.lignes.map((l) => [l.participant.id, l]) : []);
    const t = typeDe(ep.type);
    const enTete = ep.type === 'temps' ? `<span>Temps</span><span>Reps au temps limite</span>${ep.departage ? '<span>Départage</span>' : ''}` : `<span>${ep.type === 'reps' ? 'Répétitions' : ep.type === 'charge' ? 'Charge (kg)' : 'Points'}</span>${ep.departage ? '<span>Départage</span>' : ''}`;
    let vaguePrec = null;
    const rows = lignes.map(({ participant: p, place }) => {
      const s = R.score(E, ep.id, p.id);
      const sep = place && place.vague !== vaguePrec ? `<li class="separateur-vague">Vague ${place.vague}${(() => { const h = R.horaire(ep, place.vague - 1); return h ? ` · ${h.debut}` : ''; })()}</li>` : (!place && vaguePrec !== 'hors' && ep.vagues.length ? '<li class="separateur-vague">Hors vagues</li>' : '');
      vaguePrec = place ? place.vague : 'hors';
      const val = s && (s.statut === 'ok') ? (ep.type === 'temps' ? R.afficherTemps(s.valeur) : String(s.valeur).replace('.', ',')) : '';
      const cap = s && s.statut === 'cap' ? String(s.valeur) : '';
      const dep = s && s.departage !== null ? R.afficherTemps(s.departage) : '';
      const l = rangs.get(p.id);
      return `${sep}<li class="ligne-score" data-p="${p.id}">
        <span class="ls-nom">${place ? `<span class="couloir">${place.couloir}</span>` : ''}<b>${esc(p.nom)}</b><small>${p.dossard ? `n° ${p.dossard}` : ''}</small></span>
        <span class="ls-champs">
          ${ep.type === 'temps' ? `<label><span class="sr-only">Temps de ${esc(p.nom)}</span><input data-s="valeur" value="${esc(val)}" inputmode="decimal" placeholder="mm:ss" autocomplete="off" ${s && (s.statut === 'dns' || s.statut === 'dq') ? 'disabled' : ''}></label>
            <label><span class="sr-only">Répétitions au temps limite de ${esc(p.nom)}</span><input data-s="cap" value="${esc(cap)}" inputmode="numeric" placeholder="reps" autocomplete="off" ${s && (s.statut === 'dns' || s.statut === 'dq') ? 'disabled' : ''}></label>`
          : `<label><span class="sr-only">Score de ${esc(p.nom)}</span><input data-s="valeur" value="${esc(val)}" inputmode="decimal" placeholder="${ep.type === 'charge' ? 'kg' : ep.type === 'reps' ? 'reps' : 'pts'}" autocomplete="off" ${s && (s.statut === 'dns' || s.statut === 'dq') ? 'disabled' : ''}></label>`}
          ${ep.departage ? `<label><span class="sr-only">Départage de ${esc(p.nom)}</span><input data-s="departage" value="${esc(dep)}" inputmode="decimal" placeholder="mm:ss" autocomplete="off"></label>` : ''}
          <label><span class="sr-only">Statut de ${esc(p.nom)}</span><select data-s="statut"><option value="">—</option><option value="dns" ${s?.statut === 'dns' ? 'selected' : ''}>Absent</option><option value="dq" ${s?.statut === 'dq' ? 'selected' : ''}>Disqualifié</option></select></label>
          <label class="case ls-valide"><input type="checkbox" data-s="valide" ${s?.valide ? 'checked' : ''} ${s ? '' : 'disabled'}><span>Validé</span></label>
        </span>
        <span class="ls-rang" data-rang>${celluleRang(l)}</span>
      </li>`;
    }).join('');
    return `${titre}
      <div class="outils-liste"><div class="filtres" role="group" aria-label="Épreuve">${E.epreuves.map((x, i) => `<button class="filtre" data-action="choisir-ep" data-id="${x.id}" aria-pressed="${x.id === ep.id}">${i + 1}. ${esc(x.nom.replace(/^Épreuve \d+ · /, ''))}</button>`).join('')}</div></div>
      <div class="outils-liste">${puces('choisir-cat-score', cat, false, (id) => { const n = E.participants.filter((p) => p.categorie === id && R.concerne(ep, p)); return `${n.filter((p) => R.score(E, ep.id, p.id)).length}/${n.length}`; })}</div>
      <p class="aide">${esc(t.detail)}${ep.type === 'temps' && ep.capMin ? ` Temps limite : ${nombre(ep.capMin)} min${ep.repsTotal ? `, ${ep.repsTotal} répétitions au total (affichage « CAP+n »)` : ''}.` : ''}${ep.departage ? ' Départage : le temps le plus court l\'emporte à score égal.' : ''}</p>
      ${!cat ? '<p class="aide">Aucune catégorie concernée par cette épreuve.</p>' : lignes.length ? `<div class="entete-scores ${ep.type === 'temps' ? 'temps' : ''} ${ep.departage ? 'dep' : ''}"><span>Participant</span><span class="ls-champs-tete">${enTete}<span>Statut</span><span></span></span><span>Rang</span></div><ul class="lignes-scores">${rows}</ul>
        <p class="resume-liste" id="resume-scores">${resumeScores(c)}</p>` : '<div class="vide-etat petit"><div><h3>Personne dans cette catégorie</h3><p>Inscris des participants ou choisis une autre catégorie.</p></div></div>'}
      ${AVERTISSEMENT}`;
  }
  const resumeScores = (c) => `${c.nbClasses} classé${c.nbClasses > 1 ? 's' : ''} · ${c.nbAttente} en attente${c.lignes.length - c.nbClasses - c.nbAttente ? ` · ${c.lignes.length - c.nbClasses - c.nbAttente} absent ou disqualifié` : ''}`;
  function celluleRang(l) {
    if (!l) return '';
    if (l.rang) return `<b>${rangTexte(l.rang)}</b><small>${esc(l.affichage)}</small>`;
    return l.etat === 'sans' ? `<small>${esc(l.affichage)}</small>` : '<small>À saisir</small>';
  }

  // Saisie : lit la ligne, enregistre le score, met à jour les rangs sans tout redessiner.
  function brancherScores() {
    document.querySelectorAll('.ligne-score').forEach((li) => {
      li.querySelectorAll('[data-s]').forEach((champ) => champ.addEventListener('change', () => lireLigneScore(li)));
    });
  }
  function lireLigneScore(li) {
    const ep = epreuve(filtre.ep);
    const pid = li.dataset.p;
    if (!ep) return;
    const v = (k) => li.querySelector(`[data-s="${k}"]`);
    const statut = v('statut').value;
    let s = null, err = '';
    const dep = ep.departage ? v('departage').value.trim() : '';
    const departage = dep ? R.lireTemps(dep) : null;
    if (dep && departage === null) err = 'Départage illisible : écris par exemple 4:12.';
    if (statut) s = { statut, valeur: null };
    else if (ep.type === 'temps') {
      const tv = v('valeur').value.trim(), cv = v('cap').value.trim();
      if (tv) { const t = R.lireTemps(tv); if (t === null) err = 'Temps illisible : écris par exemple 8:45.'; else { s = { statut: 'ok', valeur: t }; if (ep.capMin && t > ep.capMin * 60) err = `Temps au-delà du temps limite (${nombre(ep.capMin)} min) : vérifie, ou note les répétitions au temps limite.`; } }
      else if (cv) { const r = R.lireValeur(cv, { entier: true }); if (r === null) err = 'Répétitions illisibles : un nombre entier.'; else { s = { statut: 'cap', valeur: r }; if (ep.repsTotal && r > ep.repsTotal) err = `Plus de répétitions (${r}) que le total de l'épreuve (${ep.repsTotal}).`; } }
    } else {
      const x = v('valeur').value.trim();
      if (x) { const r = R.lireValeur(x, { entier: ep.type === 'reps' }); if (r === null) err = ep.type === 'reps' ? 'Répétitions illisibles : un nombre entier.' : 'Valeur illisible : écris par exemple 82,5.'; else s = { statut: 'ok', valeur: r }; }
    }
    li.classList.toggle('invalide', Boolean(err) && !s);
    li.title = err;
    if (err && !s) { toast(err); return; }
    if (err) toast(err);
    E.scores[ep.id] ||= {};
    if (s) { s.departage = departage; s.valide = v('valide').checked; E.scores[ep.id][pid] = R.normaliserScore(s); } else delete E.scores[ep.id][pid];
    v('valide').disabled = !s;
    if (!s) v('valide').checked = false;
    li.querySelectorAll('[data-s="valeur"],[data-s="cap"]').forEach((x) => { x.disabled = Boolean(statut); });
    sauver();
    const c = R.classementEpreuve(E, ep, filtre.catScore);
    for (const l of c.lignes) { const cel = document.querySelector(`.ligne-score[data-p="${l.participant.id}"] [data-rang]`); if (cel) cel.innerHTML = celluleRang(l); }
    const r = $('#resume-scores'); if (r) r.textContent = resumeScores(c);
  }

  // ---------- Classement ----------
  function vueClassement() {
    const cat = catCourante(null, 'catClass');
    const titre = `<div class="vue-tete"><div><h1>Classement</h1><p>${esc(R.METHODES[E.reglages.methode])}. Départage : ${esc(R.DEPARTAGES[E.reglages.departage].toLowerCase())}.</p></div>
      <div class="actions"><button class="btn" data-action="regles">Règles</button><button class="btn" data-action="partage">Lien public${E.publication.active ? ' · actif' : ''}</button><button class="btn primaire" data-action="mode-ecran">Mode écran</button></div></div>`;
    if (!cat) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune catégorie</h3><p>Crée les catégories et inscris les participants.</p></div></div>`;
    const cg = R.classementGeneral(E, cat);
    const eps = cg.toutes;
    const bareme = E.reglages.methode === 'bareme';
    const tableau = cg.lignes.length ? `<div class="defile"><table class="tableau tableau-classement"><caption class="sr-only">Classement ${esc(categorie(cat).nom)}</caption>
      <thead><tr><th class="nb">Rang</th><th>Participant</th>${eps.map((ep, i) => `<th class="nb" title="${esc(ep.nom)}">É${i + 1}${ep.coefficient !== 1 ? ` ×${nombre(ep.coefficient)}` : ''}</th>`).join('')}<th class="nb">Total</th></tr></thead>
      <tbody>${cg.lignes.map((l) => `<tr class="${l.rang <= 3 ? `podium-${l.rang}` : ''}"><td class="nb"><b>${rangTexte(l.rang)}</b>${l.exaequo ? '<small class="exaequo">ex aequo</small>' : ''}</td><td><button class="btn lien lien-nom" data-action="modifier-inscrit" data-id="${l.participant.id}">${esc(l.participant.nom)}</button><small class="club">${esc(l.participant.club)}</small></td>${eps.map((ep) => { const x = l.resultats[ep.id]; return `<td class="nb res">${x ? `<b>${x.rang ? rangCourt(x.rang) : '–'}</b><small>${esc(x.affichage || (x.etat === 'attente' ? 'à saisir' : ''))}</small>${bareme ? `<small>${nombre(x.points)} pts</small>` : ''}` : '<small>·</small>'}</td>`; }).join('')}<td class="nb total"><b>${nombre(l.total)}</b></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vide-etat petit"><div><h3>Personne dans cette catégorie</h3></div></div>';
    const cartes = cg.lignes.length ? `<ol class="public-liste classement-tel">${cg.lignes.map((l) => `<li class="${l.rang <= 3 ? `podium-${l.rang}` : ''}"><span class="pl-rang">${l.rang}</span><button class="pl-nom lien-ligne" data-action="modifier-inscrit" data-id="${l.participant.id}"><b>${esc(l.participant.nom)}</b><small>${esc(l.participant.club)}${l.exaequo ? ' · ex aequo' : ''}</small><small class="pl-res">${eps.map((ep, i) => { const x = l.resultats[ep.id]; return `É${i + 1} : ${x?.rang ? rangCourt(x.rang) : '–'}${x?.affichage ? ` (${esc(x.affichage)})` : ''}`; }).join(' · ')}</small></button><span class="pl-total">${nombre(l.total)}<small>${bareme ? 'pts' : 'total'}</small></span></li>`).join('')}</ol>` : '';
    return `${titre}
      <div class="outils-liste">${puces('choisir-cat-class', cat, false)}</div>
      ${cg.provisoire && cg.lignes.length ? `<p class="aide">Classement provisoire : ${cg.manquants ? `${pluriel(cg.manquants, 'score')} à saisir` : ''}${cg.manquants && cg.epreuves.length < eps.length ? ', ' : ''}${cg.epreuves.length < eps.length ? `${pluriel(eps.length - cg.epreuves.length, 'épreuve')} pas encore jouée${eps.length - cg.epreuves.length > 1 ? 's' : ''}` : ''}. Sans score, un participant prend ${bareme ? '0 point' : 'le rang qui suit le dernier classé'}.</p>` : ''}
      ${tableau}${cartes}
      ${cg.forfaits.length ? `<p class="mention" style="margin-top:12px">Forfait : ${cg.forfaits.map((p) => esc(p.nom)).join(', ')}.</p>` : ''}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv-classement">Exporter le classement (CSV)</button><button class="btn petit" data-action="imprimer-classement">Imprimer</button></div>
      <h2 class="titre-section">Épreuves</h2>
      <ul class="legende-ep">${eps.map((ep, i) => `<li><b>É${i + 1}</b> ${esc(ep.nom)} <small>${esc(typeDe(ep.type).nom)}</small></li>`).join('')}</ul>
      ${AVERTISSEMENT}`;
  }

  // ---------- Écran (mode écran de l'application et lien public) ----------
  let ecranOuvert = false, minuterieEcran = null, minuterieRelecture = null, pageEcran = 0;
  const pub = { inst: null, id: null, onglet: 'classement', cat: '', q: '', rotation: false, erreur: '', lu: null };

  function pagesEcran(inst) {
    const n = inst.ecran?.lignes || 10;
    const pages = [];
    for (const c of inst.categories) for (let i = 0; i < Math.max(1, c.lignes.length); i += n) pages.push({ c, debut: i, n });
    return pages;
  }
  function enPisteInst(inst) {
    const t = auj(), m = maintenantMin();
    const prog = inst.programme.filter((x) => x.debut && (x.date || inst.dateDebut));
    const quand = (x) => R.instant(x.date || inst.dateDebut, R.minutes(x.debut));
    const now = R.instant(t, m);
    const enCours = prog.find((x) => quand(x) <= now && now < R.instant(x.date || inst.dateDebut, R.minutes(x.fin)));
    const suivante = prog.filter((x) => quand(x) > now).sort((a, b) => quand(a) - quand(b))[0];
    return { enCours, suivante };
  }
  const nomEp = (inst, id) => inst.epreuves.find((x) => x.id === id)?.nom || '';

  function htmlRotation(inst) {
    const pages = pagesEcran(inst);
    if (!pages.length) return '<div class="ecran-vide"><h2>Le classement s\'affichera ici</h2><p>Dès les premiers scores.</p></div>';
    const p = pages[pageEcran % pages.length];
    const c = p.c;
    const eps = c.epreuves.map((id) => inst.epreuves.find((x) => x.id === id)).filter(Boolean).slice(0, 6);
    const lignes = c.lignes.slice(p.debut, p.debut + p.n);
    const parCat = pages.filter((x) => x.c === c);
    const { enCours, suivante } = enPisteInst(inst);
    const piste = (x, lib) => (x ? `<span><small>${lib}</small><b>${esc(nomEp(inst, x.epreuve))} · vague ${x.numero}</b> ${esc(x.categorie)} · ${esc(x.debut)}</span>` : '');
    return `<div class="ecran-tete"><div><p class="ecran-compet">${esc(inst.nom)}</p><h2>${esc(c.nom)}${parCat.length > 1 ? ` <small>${parCat.indexOf(p) + 1}/${parCat.length}</small>` : ''}</h2></div><div class="ecran-heure" data-horloge>${R.hhmm(maintenantMin())}</div></div>
      ${c.provisoire ? '<p class="ecran-provisoire">Classement provisoire</p>' : ''}
      <table class="ecran-table"><thead><tr><th>Rang</th><th>Participant</th>${eps.map((ep) => `<th>${esc(ep.nom.replace(/^Épreuve (\d+) · .*/, 'É$1'))}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr class="${l.rang <= 3 ? `podium-${l.rang}` : ''}"><td class="er-rang">${l.rang ?? '–'}</td><td class="er-nom"><b>${esc(l.nom)}</b><small>${esc(l.club)}</small></td>${eps.map((ep) => { const i = c.epreuves.indexOf(ep.id); const r = l.resultats[i] || [null, 0, '']; return `<td class="er-res"><b>${r[0] ?? '–'}</b><small>${esc(r[2])}</small></td>`; }).join('')}<td class="er-total">${nombre(l.total)}</td></tr>`).join('')}</tbody></table>
      <div class="ecran-pied">${piste(enCours, 'En piste')}${piste(suivante, 'Ensuite')}<span class="ecran-pages">${pages.map((x, i) => `<i class="${i === pageEcran % pages.length ? 'actif' : ''}"></i>`).join('')}</span></div>`;
  }

  // Mode écran dans l'application : plein écran, rotation, relecture des données toutes les 15 s.
  function ouvrirEcranApp() {
    ecranOuvert = true; pageEcran = 0;
    let el = $('#ecran');
    if (!el) { el = document.createElement('div'); el.id = 'ecran'; el.className = 'ecran rotation'; document.body.appendChild(el); }
    el.hidden = false;
    document.body.classList.add('ecran-actif');
    majEcranApp();
    document.documentElement.requestFullscreen?.().catch(() => {});
    clearInterval(minuterieEcran);
    minuterieEcran = setInterval(() => { pageEcran++; majEcranApp(); }, E.reglages.ecranSecondes * 1000);
    clearInterval(minuterieRelecture);
    minuterieRelecture = setInterval(() => { rafraichir().then((ch) => { if (ch) majEcranApp(); }); }, 15000);
  }
  function majEcranApp() {
    const el = $('#ecran');
    if (!el || !E) return;
    el.innerHTML = `${htmlRotation(R.instantane(E))}<button class="ecran-fermer" data-action="fermer-ecran" aria-label="Quitter le mode écran">Quitter</button>`;
  }
  function fermerEcranApp() {
    ecranOuvert = false;
    clearInterval(minuterieEcran); clearInterval(minuterieRelecture);
    const el = $('#ecran'); if (el) el.hidden = true;
    document.body.classList.remove('ecran-actif');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  // Page publique (?ecran=<id>) : lecture seule, relue toutes les 30 s ; liste sur téléphone, rotation au choix.
  async function ouvrirPublic(id) {
    document.body.classList.add('public');
    pub.id = id;
    pub.rotation = !estTel() && innerWidth >= 1100 && !matchMedia('(pointer:coarse)').matches;
    await chargerPublic();
    setInterval(chargerPublic, 30000);
    setInterval(() => { if (pub.rotation) { pageEcran++; rendrePublic(); } else { const h = $('[data-horloge]'); if (h) h.textContent = R.hhmm(maintenantMin()); } }, (pub.inst?.ecran?.secondes || 15) * 1000);
  }
  async function chargerPublic() {
    try {
      if (pub.id === 'demo') {
        const d = stock.lire(CLE_DEMO);
        pub.inst = R.instantane(d ? normaliser(d) : donneesDemo(), new Date().toISOString());
        pub.erreur = '';
      } else {
        const r = await fetch(`${API_PUBLIC}/${encodeURIComponent(pub.id)}`, { cache: 'no-cache' });
        if (r.status === 404) { pub.inst = null; pub.erreur = 'Ce classement n\'est pas ou plus publié. L\'organisation l\'a peut-être retiré.'; }
        else if (!r.ok) throw new Error();
        else { pub.inst = await r.json(); pub.erreur = ''; }
      }
      pub.lu = new Date();
    } catch { if (!pub.inst) pub.erreur = 'Pas de connexion : nouvel essai dans 30 secondes.'; }
    rendrePublic();
  }
  function rendrePublic() {
    const inst = pub.inst;
    document.title = inst ? `${inst.nom || 'Classement'} · classement en direct` : 'Classement en direct · QME';
    if (!inst) { $('#racine').innerHTML = `<div class="public-erreur">${FORME_VIDE}<h1>Classement indisponible</h1><p>${esc(pub.erreur)}</p></div>`; return; }
    if (pub.rotation) {
      $('#racine').innerHTML = `<div class="ecran rotation public-rotation">${htmlRotation(inst)}<button class="ecran-fermer" data-action="public-liste">Vue liste</button></div>`;
      return;
    }
    if (!inst.categories.some((c) => c.id === pub.cat)) pub.cat = inst.categories[0]?.id || '';
    const c = inst.categories.find((x) => x.id === pub.cat);
    const q = pub.q.trim().toLowerCase();
    const { enCours, suivante } = enPisteInst(inst);
    const dates = [inst.dateDebut && fmt(inst.dateDebut, { day: 'numeric', month: 'long', year: 'numeric' }), inst.lieu].filter(Boolean).map(esc).join(' · ');
    let corps;
    if (pub.onglet === 'classement') {
      corps = c ? `<div class="filtres public-cats" role="group" aria-label="Catégorie">${inst.categories.map((x) => `<button class="filtre" data-action="public-cat" data-cat="${esc(x.id)}" aria-pressed="${x.id === pub.cat}">${esc(x.nom)}</button>`).join('')}</div>
        ${c.provisoire ? '<p class="mention">Classement provisoire : des scores restent à saisir ou des épreuves à jouer.</p>' : ''}
        <ol class="public-liste">${c.lignes.filter((l) => !q || l.nom.toLowerCase().includes(q)).map((l) => `<li class="${l.rang <= 3 ? `podium-${l.rang}` : ''}"><span class="pl-rang">${l.rang ?? '–'}</span><span class="pl-nom"><b>${esc(l.nom)}</b><small>${esc(l.club)}</small><small class="pl-res">${c.epreuves.map((id, i) => { const r = l.resultats[i] || [null, 0, '']; return `${esc(nomEp(inst, id).replace(/^Épreuve (\d+) · .*/, 'É$1'))} : ${r[0] ? rangCourt(r[0]) : '–'}${r[2] ? ` (${esc(r[2])})` : ''}`; }).join(' · ')}</small></span><span class="pl-total">${nombre(l.total)}<small>${inst.methode === 'bareme' ? 'pts' : 'total'}</small></span></li>`).join('')}</ol>` : '<p class="aide">Pas encore de classement.</p>';
    } else {
      const parEp = inst.epreuves.map((ep) => ({ ep, vagues: inst.programme.filter((v) => v.epreuve === ep.id && (!q || v.couloirs.some((n) => n && n.toLowerCase().includes(q)))) })).filter((x) => x.vagues.length);
      corps = parEp.length ? parEp.map(({ ep, vagues }) => `<h2 class="titre-section">${esc(ep.nom)}</h2><div class="vagues">${vagues.map((v) => `<div class="vague ${enCours === v ? 'en-cours' : ''}"><div class="vague-tete"><b>${esc(v.debut || '')} · vague ${v.numero}</b><span>${esc(v.categorie)}${enCours === v ? ' · en piste' : ''}</span></div><ol class="couloirs">${v.couloirs.map((n, i) => `<li class="${n && q && n.toLowerCase().includes(q) ? 'trouve' : ''}"><span class="couloir">${i + 1}</span>${n ? `<b>${esc(n)}</b>` : '<em>Libre</em>'}</li>`).join('')}</ol></div>`).join('')}</div>`).join('') : '<p class="aide">Aucune vague ne correspond.</p>';
    }
    $('#racine').innerHTML = `<div class="public">
      <header class="public-tete"><p class="surtitre">Classement en direct</p><h1>${esc(inst.nom || 'Compétition')}</h1><p>${dates}</p>
        ${enCours || suivante ? `<p class="public-piste">${enCours ? `<b>En piste</b> ${esc(nomEp(inst, enCours.epreuve))} · vague ${enCours.numero} · ${esc(enCours.categorie)}` : ''}${enCours && suivante ? '<br>' : ''}${suivante ? `<b>Ensuite</b> ${esc(suivante.debut)} · ${esc(nomEp(inst, suivante.epreuve))} · vague ${suivante.numero} · ${esc(suivante.categorie)}` : ''}</p>` : ''}</header>
      <div class="public-barre"><div class="segment" role="group" aria-label="Affichage"><button data-action="public-onglet" data-o="classement" aria-pressed="${pub.onglet === 'classement'}">Classement</button><button data-action="public-onglet" data-o="programme" aria-pressed="${pub.onglet === 'programme'}">Programme</button></div>
        <label class="champ recherche"><span class="sr-only">Trouver un participant</span><input id="public-q" type="search" placeholder="Trouver un participant" value="${esc(pub.q)}"></label></div>
      ${corps}
      <footer class="public-pied"><span>Mis à jour ${inst.publieLe ? `à ${new Date(inst.publieLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''} · relu toutes les 30 secondes</span><button class="btn petit" data-action="public-rotation">Plein écran</button><span>Lecture seule · <a href="/catalogue/competition/">Gestion de compétition QME</a></span></footer>
    </div>`;
    $('#public-q')?.addEventListener('input', (e) => { pub.q = e.target.value; const pos = e.target.selectionStart; rendrePublic(); const n = $('#public-q'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider) {
    const d = modale();
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = await auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;

  function modaleInscrit(id) {
    const p = id ? participant(id) : null;
    if (id && !p) return;
    if (!E.categories.length) { toast('Crée d\'abord les catégories.'); modaleCategories(); return; }
    const v = p || { nom: '', categorie: filtre.cat || E.categories[0].id, club: '', membres: [], dossard: R.prochainDossard(E), statut: 'confirme', paye: false, pieces: false, email: '', telephone: '', public: true, note: '' };
    const cat0 = categorie(v.categorie);
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 110px">Dossard<input name="dossard" inputmode="numeric" value="${v.dossard ?? ''}"></label>
        <label class="champ">Nom <small id="lib-nom">${cat0?.equipe ? 'Nom de l\'équipe.' : 'Prénom et nom.'}</small><input name="nom" maxlength="80" required value="${esc(v.nom)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="categorie" id="ins-cat">${E.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}${v.categorie && !cat0 ? '<option value="" selected>Sans catégorie</option>' : ''}</select></label>
        <label class="champ">Club ou salle <small>Facultatif, affiché au classement.</small><input name="club" list="l-clubs" maxlength="80" value="${esc(v.club)}"></label>
      </div>
      <label class="champ" id="champ-membres" ${cat0?.equipe ? '' : 'hidden'}>Membres de l'équipe <small>Un par ligne. Jamais publiés.</small><textarea name="membres" rows="3">${esc(v.membres.join('\n'))}</textarea></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${Object.entries(R.STATUTS).map(([k, l]) => `<label><input type="radio" name="statut" value="${k}" ${v.statut === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="rang-cases"><label class="case"><input type="checkbox" name="paye" ${v.paye ? 'checked' : ''}> Inscription payée</label><label class="case"><input type="checkbox" name="pieces" ${v.pieces ? 'checked' : ''}> Pièces vérifiées (licence, décharge)</label></div>
      <label class="case"><input type="checkbox" name="public" ${v.public ? 'checked' : ''}> Accepte que son nom apparaisse sur l'écran et le lien public (sinon : « Dossard ${v.dossard ?? 'n'} »)</label>
      <fieldset class="champ cadre-champs"><legend>Contact <small>Facultatif, privé : jamais affiché ni publié. À effacer après la compétition (Réglages).</small></legend>
        <div class="rang-champs"><label class="champ">E-mail<input name="email" type="email" maxlength="120" value="${esc(v.email)}" autocomplete="off"></label><label class="champ">Téléphone<input name="telephone" type="tel" maxlength="30" value="${esc(v.telephone)}" autocomplete="off"></label></div></fieldset>
      <label class="champ">Note <small>Privée. N'y mets aucune donnée de santé.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${listeDonnees('l-clubs', E.participants.map((x) => x.club))}
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Inscrire</button><button class="btn" value="encore">Inscrire et continuer</button>';
    ouvrirModale(p ? `Modifier ${esc(p.nom)}` : 'Nouvel inscrit', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${p.nom} », ses scores et sa place dans les vagues ? Pour un abandon, choisis plutôt « Forfait ».`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerParticipant(E, p.id);
        sauver(); rendre(); toast(`« ${p.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom.';
      const dossard = String(fd.get('dossard') || '').trim() ? Number(fd.get('dossard')) : null;
      if (dossard !== null && !(Number.isInteger(dossard) && dossard > 0)) return 'Dossard : un nombre entier.';
      if (dossard && E.participants.some((x) => x.dossard === dossard && x.id !== p?.id)) return `Le dossard ${dossard} est déjà pris (prochain libre : ${R.prochainDossard(E)}).`;
      retenir();
      const donnees = R.normaliserParticipant({ id: p?.id || uid(), nom, dossard, categorie: fd.get('categorie'), club: fd.get('club'), membres: fd.get('membres'), statut: fd.get('statut'), paye: !!fd.get('paye'), pieces: !!fd.get('pieces'), public: !!fd.get('public'), email: fd.get('email'), telephone: fd.get('telephone'), note: fd.get('note') });
      if (p) Object.assign(p, donnees); else E.participants.push(donnees);
      sauver(); rendre();
      toast(p ? `« ${nom} » enregistré.` : `« ${nom} » inscrit, dossard ${donnees.dossard ?? '–'}.`, { libelle: 'Annuler', faire: annuler });
      if (action === 'encore') { filtre.cat = donnees.categorie; setTimeout(() => modaleInscrit(null), 0); }
    });
    const d = modale();
    d.querySelector('#ins-cat').addEventListener('change', (e) => { const c = categorie(e.target.value); d.querySelector('#champ-membres').hidden = !c?.equipe; d.querySelector('#lib-nom').textContent = c?.equipe ? 'Nom de l\'équipe.' : 'Prénom et nom.'; });
  }

  function modaleCategories() {
    const ligne = (c) => `<li class="ligne-cat" data-id="${c.id}"><span class="puce-couleur" style="background:${c.id ? couleurCat(c.id) : 'var(--trait)'}"></span><input name="nom" maxlength="60" value="${esc(c.nom)}" aria-label="Nom de la catégorie" placeholder="Ex. : Élite femmes"><label class="case"><input type="checkbox" name="equipe" ${c.equipe ? 'checked' : ''}> Équipe de</label><input name="taille" type="number" min="2" max="12" value="${c.taille || 2}" aria-label="Taille de l'équipe"><small>${c.id ? pluriel(E.participants.filter((p) => p.categorie === c.id).length, 'inscrit') : 'nouvelle'}</small><button type="button" class="btn-suppr" data-action="suppr-cat" aria-label="Retirer la catégorie">×</button></li>`;
    const corps = `<p class="aide">L'ordre des catégories est celui des vagues et de l'écran. Retirer une catégorie laisse ses inscrits « sans catégorie » (hors classement) : réaffecte-les ensuite.</p>
      <ul class="liste-cats" id="liste-cats">${E.categories.map(ligne).join('')}</ul>
      <button type="button" class="btn petit" data-action="ajout-cat">${ICONES.plus}Ajouter une catégorie</button>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Catégories', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', () => {
      const lignes = [...document.querySelectorAll('#liste-cats .ligne-cat')];
      const cats = lignes.map((li) => ({ id: li.dataset.id || uid(), nom: li.querySelector('[name=nom]').value.trim(), equipe: li.querySelector('[name=equipe]').checked, taille: Number(li.querySelector('[name=taille]').value) })).filter((c) => c.nom);
      const noms = cats.map((c) => c.nom.toLowerCase());
      if (new Set(noms).size !== noms.length) return 'Deux catégories portent le même nom.';
      retenir();
      E.categories = cats.map(R.normaliserCategorie);
      sauver(); rendre(); toast(`${pluriel(cats.length, 'catégorie')} enregistrée${cats.length > 1 ? 's' : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().dataset.modeleCat = ligne({ id: '', nom: '', equipe: false, taille: 2 });
  }

  function modaleImport() {
    const corps = `<p class="aide">Colle une ligne par inscrit, depuis ton tableur ou l'export de ton formulaire : <b>Nom ; Catégorie ; Club ; E-mail ; Téléphone</b> (point-virgule, tabulation ou virgule). Seul le nom est obligatoire ; la catégorie doit porter exactement le nom d'une catégorie existante.</p>
      <label class="champ">Liste<textarea name="liste" rows="9" placeholder="Léa Exemple;Élite femmes;Box Exemple&#10;Hugo Exemple;Intermédiaire hommes"></textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Coller une liste', corps, '<button class="btn primaire" value="ok">Inscrire</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = R.lireListe(fd.get('liste'), E);
      if (!r.participants.length) return 'Aucune ligne lisible.';
      retenir();
      E.participants.push(...r.participants);
      sauver(); rendre();
      toast(`${pluriel(r.participants.length, 'inscrit')} ajouté${r.participants.length > 1 ? 's' : ''}${r.inconnues.length ? ` ; catégories inconnues (${r.inconnues.join(', ')}) : inscrits sans catégorie` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEpreuve(id) {
    const ep = id ? epreuve(id) : null;
    const v = ep || R.normaliserEpreuve({ nom: `Épreuve ${E.epreuves.length + 1}`, type: 'temps', capMin: 10, date: E.competition.dateDebut, heure: E.epreuves.at(-1)?.heure ? R.hhmm(R.minutes(E.epreuves.at(-1).heure) + 120) : '09:00' });
    const corps = `
      ${ep ? '' : `<label class="champ">Partir d'un modèle <small>Épreuves génériques, à renommer et adapter.</small><select id="modele"><option value="">Épreuve vierge</option>${B.epreuves.map((m) => `<option value="${m.id}">${esc(m.nom.replace(/^Épreuve \d+ · /, ''))}</option>`).join('')}</select></label>`}
      <label class="champ">Nom<input name="nom" maxlength="80" required value="${esc(v.nom)}"></label>
      <fieldset class="champ"><legend>Type de score</legend><div class="choix-statut deux">${B.types.map((t) => `<label title="${esc(t.detail)}"><input type="radio" name="type" value="${t.id}" ${v.type === t.id ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Description <small>Format et mouvements, repris sur les feuilles de juge.</small><textarea name="description" rows="3" maxlength="600">${esc(v.description)}</textarea></label>
      <div class="rang-champs">
        <label class="champ">Temps limite (min)<input name="capMin" inputmode="decimal" value="${v.capMin ?? ''}"></label>
        <label class="champ" id="champ-reps">Répétitions au total <small>Pour « CAP+n ».</small><input name="repsTotal" inputmode="numeric" value="${v.repsTotal ?? ''}"></label>
        <label class="champ">Coefficient<input name="coefficient" inputmode="decimal" value="${String(v.coefficient).replace('.', ',')}"></label>
      </div>
      <label class="case"><input type="checkbox" name="departage" ${v.departage ? 'checked' : ''}> Départage au temps (temps de passage noté par le juge)</label>
      <fieldset class="champ"><legend>Catégories concernées <small>Aucune cochée : toutes.</small></legend><div class="rang-cases">${E.categories.map((c) => `<label class="case"><input type="checkbox" name="cat" value="${c.id}" ${v.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Jour<input type="date" name="date" value="${v.date || ''}"></label>
        <label class="champ">Heure de début<input type="time" name="heure" value="${v.heure || ''}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Couloirs<input type="number" name="couloirs" min="1" max="40" value="${v.couloirs}"></label>
        <label class="champ">Battement entre vagues (min)<input type="number" name="battementMin" min="0" max="120" value="${v.battementMin}"></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    const pied = ep
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer l\'épreuve</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(ep ? `Modifier ${esc(ep.nom)}` : 'Nouvelle épreuve', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const n = Object.keys(E.scores[ep.id] || {}).length;
        if (!confirm(`Supprimer « ${ep.nom} »${n ? ` et ses ${pluriel(n, 'score')}` : ''} ?`)) { garderOuverte(); return; }
        retenir();
        E.epreuves = E.epreuves.filter((x) => x.id !== ep.id); delete E.scores[ep.id];
        sauver(); rendre(); toast(`« ${ep.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'épreuve.';
      const num = (k) => { const b = String(fd.get(k) || '').trim(); return b ? R.lireValeur(b) : undefined; };
      const capMin = num('capMin'), coefficient = num('coefficient'), repsTotal = num('repsTotal');
      if (capMin === null || coefficient === null || repsTotal === null) return 'Vérifie le temps limite, le total de répétitions et le coefficient (nombres).';
      if (coefficient === 0) return 'Le coefficient doit être supérieur à 0.';
      const type = fd.get('type');
      if (ep && ep.type !== type && Object.keys(E.scores[ep.id] || {}).length && !confirm('Changer le type de score rend les scores déjà saisis difficiles à lire. Continuer ?')) { garderOuverte(); return; }
      retenir();
      const donnees = R.normaliserEpreuve({ ...(ep || {}), id: ep?.id || uid(), nom, type, description: fd.get('description'), capMin: capMin ?? null, repsTotal: type === 'temps' ? repsTotal ?? null : null, coefficient: coefficient ?? 1, departage: !!fd.get('departage'), categories: fd.getAll('cat'), date: fd.get('date'), heure: fd.get('heure'), couloirs: fd.get('couloirs'), battementMin: fd.get('battementMin'), vagues: ep?.vagues || [] });
      if (ep) Object.assign(ep, donnees); else { E.epreuves.push(donnees); E.scores[donnees.id] = {}; }
      sauver(); rendre();
      toast(ep ? `« ${nom} » enregistrée.` : `« ${nom} » créée : génère ses vagues quand les inscriptions sont closes.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { d.querySelector('#champ-reps').hidden = d.querySelector('[name=type]:checked')?.value !== 'temps'; };
    d.querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', maj));
    maj();
    d.querySelector('#modele')?.addEventListener('change', (e) => {
      const m = B.epreuves.find((x) => x.id === e.target.value);
      if (!m) return;
      d.querySelector('[name=nom]').value = m.nom;
      d.querySelector(`[name=type][value=${m.type}]`).checked = true;
      d.querySelector('[name=description]').value = m.description;
      d.querySelector('[name=capMin]').value = m.capMin ?? '';
      d.querySelector('[name=repsTotal]').value = m.repsTotal ?? '';
      d.querySelector('[name=departage]').checked = Boolean(m.departage);
      maj();
    });
  }

  function modaleGenerer(id) {
    const ep = epreuve(id);
    if (!ep) return;
    const n = E.participants.filter((p) => R.concerne(ep, p)).length;
    const scores = Object.keys(E.scores[ep.id] || {}).length;
    const idx = E.epreuves.indexOf(ep);
    const corps = `
      <p>${pluriel(n, 'participant engagé', 'participants engagés')}, vagues par catégorie dans l'ordre des catégories.</p>
      <div class="rang-champs">
        <label class="champ">Couloirs par vague<input type="number" name="couloirs" min="1" max="40" value="${ep.couloirs}"></label>
        <label class="champ">Heure de début<input type="time" name="heure" value="${ep.heure || ''}"></label>
        <label class="champ">Battement (min)<input type="number" name="battementMin" min="0" max="120" value="${ep.battementMin}"></label>
      </div>
      <fieldset class="champ"><legend>Ordre de passage</legend><div class="choix-statut trois">${Object.entries(R.ORDRES).map(([k, l]) => `<label title="${esc(l)}"><input type="radio" name="ordre" value="${k}" ${ep.ordre === k ? 'checked' : ''}><span>${esc(l.split(' (')[0])}</span></label>`).join('')}</div></fieldset>
      <p class="aide">${idx === 0 ? 'Première épreuve : sans classement provisoire, l\'ordre « classement » suit les dossards.' : 'Classement provisoire : celui des épreuves précédentes ; les mieux classés passent dans la dernière vague de leur catégorie.'} Les vagues sont équilibrées (10 inscrits sur 8 couloirs : deux vagues de 5). Durée d'une vague : temps limite (${nombre(ep.capMin ?? 10)} min) + battement.</p>
      ${ep.vagues.length ? `<p class="aide alerte-taux">Les ${pluriel(ep.vagues.length, 'vague')} actuelle${ep.vagues.length > 1 ? 's' : ''} ser${ep.vagues.length > 1 ? 'ont' : 'a'} remplacée${ep.vagues.length > 1 ? 's' : ''}${scores ? ` (les ${pluriel(scores, 'score')} déjà saisi${scores > 1 ? 's' : ''} sont gardés)` : ''}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Vagues · ${esc(ep.nom)}`, corps, '<button class="btn primaire" value="ok">Générer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const couloirs = Math.round(Number(fd.get('couloirs')));
      if (!(couloirs >= 1 && couloirs <= 40)) return 'Entre 1 et 40 couloirs.';
      if (!n) return 'Aucun participant engagé dans cette épreuve.';
      retenir();
      Object.assign(ep, R.normaliserEpreuve({ ...ep, couloirs, heure: fd.get('heure'), battementMin: fd.get('battementMin'), ordre: fd.get('ordre') }));
      ep.vagues = R.genererVagues(E, ep.id);
      filtre.ep = ep.id;
      sauver(); rendre();
      toast(`${pluriel(ep.vagues.length, 'vague')} générée${ep.vagues.length > 1 ? 's' : ''}${ep.heure ? `, fin vers ${R.horaire(ep, ep.vagues.length - 1)?.fin}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleVague(epId, i) {
    const ep = epreuve(epId);
    const v = ep?.vagues[i];
    if (!v) return;
    const candidats = E.participants.filter((p) => R.concerne(ep, p) && p.categorie === v.categorie);
    const autres = E.participants.filter((p) => R.concerne(ep, p) && p.categorie !== v.categorie);
    const options = (sel) => `<option value="">Libre</option><optgroup label="${esc(categorie(v.categorie)?.nom || '')}">${candidats.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.dossard ?? ''} · ${esc(p.nom)}</option>`).join('')}</optgroup>${autres.length ? `<optgroup label="Autres catégories">${autres.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.dossard ?? ''} · ${esc(p.nom)}</option>`).join('')}</optgroup>` : ''}`;
    const nb = Math.max(ep.couloirs, v.couloirs.length);
    const corps = `<p class="mention">${(() => { const h = R.horaire(ep, i); return h ? `${h.debut} – ${h.fin} · ` : ''; })()}${esc(categorie(v.categorie)?.nom || '')}. Un participant placé ici est retiré de son autre vague de cette épreuve.</p>
      <ol class="choix-couloirs">${Array.from({ length: nb }, (_, c) => `<li><span class="couloir">${c + 1}</span><select name="c${c}" aria-label="Couloir ${c + 1}">${options(v.couloirs[c])}</select></li>`).join('')}</ol>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`${esc(ep.nom)} · vague ${i + 1}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const choix = Array.from({ length: nb }, (_, c) => fd.get(`c${c}`) || null);
      const pris = choix.filter(Boolean);
      if (new Set(pris).size !== pris.length) return 'Un même participant est placé dans deux couloirs.';
      retenir();
      for (const [k, w] of ep.vagues.entries()) if (k !== i) w.couloirs = w.couloirs.map((x) => (pris.includes(x) ? null : x));
      v.couloirs = choix;
      while (v.couloirs.length && !v.couloirs.at(-1)) v.couloirs.pop();
      sauver(); rendre(); toast(`Vague ${i + 1} enregistrée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleRegles() {
    const r = E.reglages;
    const corps = `
      <fieldset class="champ"><legend>Méthode</legend><div class="choix-statut deux">${Object.entries(R.METHODES).map(([k, l]) => `<label title="${esc(l)}"><input type="radio" name="methode" value="${k}" ${r.methode === k ? 'checked' : ''}><span>${k === 'rang' ? 'Somme des rangs' : 'Barème de points'}</span></label>`).join('')}</div></fieldset>
      <p class="aide" id="aide-methode"></p>
      <div class="rang-champs" id="champs-bareme">
        <label class="champ">Points du 1er<input name="premier" inputmode="numeric" value="${r.bareme.premier}"></label>
        <label class="champ">Écart par place<input name="pas" inputmode="decimal" value="${String(r.bareme.pas).replace('.', ',')}"></label>
        <label class="champ">Plancher<input name="plancher" inputmode="decimal" value="${String(r.bareme.plancher).replace('.', ',')}"></label>
      </div>
      <fieldset class="champ"><legend>Départage du classement général</legend><div class="choix-radio">${Object.entries(R.DEPARTAGES).map(([k, l]) => `<label class="case"><input type="radio" name="departage" value="${k}" ${r.departage === k ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Noms sur l'écran et le lien public <small>Les équipes gardent leur nom ; un inscrit sans accord apparaît sous son dossard.</small></legend><div class="choix-statut deux"><label><input type="radio" name="nomPublic" value="complet" ${r.nomPublic === 'complet' ? 'checked' : ''}><span>Prénom Nom</span></label><label><input type="radio" name="nomPublic" value="initiale" ${r.nomPublic === 'initiale' ? 'checked' : ''}><span>Prénom N.</span></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ">Repos minimum (min)<input type="number" name="reposMin" min="0" max="600" value="${r.reposMin}"></label>
        <label class="champ">Écran : secondes par page<input type="number" name="ecranSecondes" min="5" max="120" value="${r.ecranSecondes}"></label>
        <label class="champ">Écran : lignes par page<input type="number" name="ecranLignes" min="4" max="30" value="${r.ecranLignes}"></label>
      </div>
      <p class="aide">Ex aequo dans une épreuve : même rang (1, 2, 2, 4). Sans score (absent, disqualifié, pas encore saisi) : le rang qui suit le dernier classé, ou 0 point. Forfait : hors classement.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Règles de classement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const premier = R.lireValeur(fd.get('premier'), { entier: true }), pas = R.lireValeur(fd.get('pas')), plancher = R.lireValeur(fd.get('plancher') || '0');
      if (premier === null || pas === null || plancher === null) return 'Vérifie le barème (nombres positifs).';
      retenir();
      E.reglages = R.normaliser({ ...E, reglages: { methode: fd.get('methode'), bareme: { premier, pas, plancher }, departage: fd.get('departage'), nomPublic: fd.get('nomPublic'), reposMin: fd.get('reposMin'), ecranSecondes: fd.get('ecranSecondes'), ecranLignes: fd.get('ecranLignes') } }, DEFAUTS).reglages;
      sauver(); rendre(); toast('Règles enregistrées : classement recalculé.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const b = d.querySelector('[name=methode]:checked').value === 'bareme';
      d.querySelector('#champs-bareme').hidden = !b;
      d.querySelector('#aide-methode').textContent = b ? 'Chaque place rapporte des points : 1er = points du 1er, puis l\'écart en moins à chaque place, jamais sous le plancher. Coefficient de l\'épreuve appliqué. Le total le plus haut gagne.' : 'Chaque épreuve donne un rang (multiplié par le coefficient) ; on additionne. Le total le plus bas gagne. Simple et lisible pour une compétition locale.';
    };
    d.querySelectorAll('[name=methode]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  function modalePartage() {
    const p = E.publication;
    const lien = p.active && (p.id || session.demo) ? lienPublic() : '';
    const corps = `
      <p>Un lien en <b>lecture seule</b> pour les spectateurs et les athlètes : classement par catégorie, programme des vagues, recherche d'un nom, et un mode plein écran pour une télévision. Il se met à jour tout seul quelques secondes après chaque saisie.</p>
      <ul class="liste-puces"><li>Publié : nom (selon les Règles), club, catégorie, scores, rangs et horaires de passage.</li><li>Jamais publié : e-mails, téléphones, notes, paiements, membres d'équipe.</li><li>Un inscrit sans accord d'affichage apparaît sous son dossard.</li><li>Effacé du serveur 30 jours après la compétition, ou dès que tu le retires.</li></ul>
      ${session.demo ? '<p class="aide">En démo, rien n\'est publié : le lien ouvre l\'aperçu public sur cet appareil.</p>' : ''}
      ${p.active ? `<label class="champ">Lien public<input id="lien-public" readonly value="${esc(lien)}"></label>
        <div class="rang"><button type="button" class="btn petit primaire" data-action="copier-lien">Copier le lien</button><a class="btn petit" href="${esc(lien)}" target="_blank" rel="noopener">Ouvrir</a><button type="button" class="btn petit" data-action="publier-maintenant">Mettre à jour maintenant</button></div>
        <p class="mention">${p.publieLe ? `Dernière publication : ${new Date(p.publieLe).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : ''}</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p.active
      ? '<button class="btn primaire" value="annuler">Fermer</button><button class="btn" value="changer">Changer de lien</button><button class="btn danger gauche" value="retirer">Retirer le lien</button>'
      : '<button class="btn primaire" value="activer">Publier le classement</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale('Lien public', corps, pied, async (_, action) => {
      try {
        if (action === 'activer') {
          if (!session.demo && !navigator.onLine) return 'Pas de connexion : la publication a besoin d\'internet.';
          E.publication.active = true;
          await publier();
          sauver(); rendre(); garderOuverte(); modalePartage();
          toast('Classement publié : copie le lien pour le partager.');
        } else if (action === 'retirer') {
          if (!confirm('Retirer le lien ? Les spectateurs ne verront plus le classement.')) { garderOuverte(); return; }
          await retirerPublication(E.publication.sel);
          E.publication = { active: false, sel: null, id: null, publieLe: null };
          sauver(); rendre(); toast('Lien retiré et classement effacé du serveur.');
        } else if (action === 'changer') {
          if (!confirm('Changer de lien ? L\'ancien cessera de fonctionner.')) { garderOuverte(); return; }
          await retirerPublication(E.publication.sel);
          E.publication.sel = null; E.publication.id = null;
          await publier();
          sauver(); rendre(); garderOuverte(); modalePartage(); toast('Nouveau lien créé.');
        }
      } catch (x) {
        if (action === 'activer') E.publication.active = false;
        return x.message === 'Failed to fetch' ? 'Pas de connexion : réessaie une fois en ligne.' : x.message;
      }
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const c = E.competition;
    const nbContacts = E.participants.filter((p) => p.email || p.telephone).length;
    const corps = `
      <label class="champ">Nom de la compétition<input name="nom" maxlength="100" value="${esc(c.nom)}"></label>
      <div class="rang-champs"><label class="champ">Lieu<input name="lieu" maxlength="100" value="${esc(c.lieu)}"></label><label class="champ">Organisation<input name="organisation" maxlength="100" value="${esc(c.organisation)}"></label></div>
      <div class="rang-champs"><label class="champ">Premier jour<input type="date" name="dateDebut" value="${c.dateDebut || ''}"></label><label class="champ">Dernier jour<input type="date" name="dateFin" value="${c.dateFin || ''}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Règles de classement</h3><div class="rang"><button class="btn petit" type="button" data-action="regles">Ouvrir les règles</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte en tableur (CSV, point-virgule).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-inscrits">Inscrits (sans coordonnées)</button><button class="btn petit" type="button" data-action="csv-inscrits-contacts">Inscrits avec coordonnées</button><button class="btn petit" type="button" data-action="csv-classement">Classement</button></div></div>
      <div class="groupe"><h3>Données personnelles (RGPD)</h3><p class="aide">${pluriel(nbContacts, 'inscrit')} avec e-mail ou téléphone. Après la compétition, efface les coordonnées : noms, catégories et scores restent pour le classement.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="effacer-contacts" ${nbContacts ? '' : 'disabled'}>Effacer les coordonnées</button><button class="btn petit" type="button" data-action="copier-mention">Copier la mention d'information</button></div></div>
      <div class="groupe"><h3>Nouvelle compétition</h3><p class="aide">Garde les catégories, les épreuves et les règles ; efface les inscrits, les vagues et les scores (télécharge une copie avant). Le lien public est retiré.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="nouvelle-compet">Repartir pour une nouvelle édition</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'La compétition est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="mention">Les bénévoles de la table de marque et les juges peuvent ouvrir la compétition avec la même clé : leurs saisies arrivent ici.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application au bord du plateau.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Outil d'organisation, pas un logiciel fédéral homologué. Aucun e-mail envoyé, aucun connecteur : le partage se fait par le lien public en lecture seule, l'impression ou l'export. Épreuves génériques rédigées pour QME, sans nom d'épreuve de référence.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const d1 = fd.get('dateDebut'), d2 = fd.get('dateFin');
      if (d1 && d2 && d2 < d1) return 'Le dernier jour précède le premier.';
      retenir();
      E.competition = { nom: String(fd.get('nom') || '').trim(), lieu: String(fd.get('lieu') || '').trim(), organisation: String(fd.get('organisation') || '').trim(), dateDebut: R.estDate(d1) ? d1 : null, dateFin: R.estDate(d2) ? d2 : (R.estDate(d1) ? d1 : null) };
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.participants) || !Array.isArray(d.epreuves)) throw new Error();
        if (!confirm(`Remplacer la compétition actuelle par cette copie (${pluriel(d.participants.length, 'inscrit')}, ${pluriel(d.epreuves.length, 'épreuve')}) ?`)) return;
        const pubAvant = E.publication;
        E = normaliser(d); delete E.majLe; E.publication = pubAvant;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de la compétition.'); }
    });
  }

  // ---------- Impression ----------
  function imprimer(html) {
    $('#impression').innerHTML = html;
    document.body.classList.add('imprime');
    const fin = () => { document.body.classList.remove('imprime'); $('#impression').innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
    setTimeout(() => { if (!matchMedia('print').matches) fin(); }, 1500);
  }
  function feuillesJuge(epId) {
    const ep = epreuve(epId);
    if (!ep?.vagues.length) return;
    const c = E.competition;
    imprimer(ep.vagues.map((v, i) => {
      const h = R.horaire(ep, i);
      return `<section class="feuille"><header><p>${esc(c.nom)}${c.lieu ? ` · ${esc(c.lieu)}` : ''}</p><h1>${esc(ep.nom)} · vague ${i + 1}</h1><p><b>${esc(categorie(v.categorie)?.nom || '')}</b>${h ? ` · ${h.debut} – ${h.fin}` : ''} · ${esc(typeDe(ep.type).nom)}${ep.capMin ? ` · temps limite ${nombre(ep.capMin)} min` : ''}${ep.repsTotal && ep.type === 'temps' ? ` · ${ep.repsTotal} reps` : ''}</p>${ep.description ? `<p class="desc">${esc(ep.description)}</p>` : ''}</header>
        <table><thead><tr><th>Couloir</th><th>Dossard</th><th>Participant</th><th>${ep.type === 'temps' ? 'Temps ou reps au cap' : 'Score'}</th>${ep.departage ? '<th>Départage</th>' : ''}<th>Signature athlète</th><th>Juge</th></tr></thead>
        <tbody>${Array.from({ length: Math.max(ep.couloirs, v.couloirs.length) }, (_, k) => { const p = participant(v.couloirs[k]); return `<tr><td>${k + 1}</td><td>${p?.dossard ?? ''}</td><td>${p ? esc(p.nom) : '—'}</td><td></td>${ep.departage ? '<td></td>' : ''}<td></td><td></td></tr>`; }).join('')}</tbody></table></section>`;
    }).join(''));
  }
  function imprimerClassement() {
    const c = E.competition;
    imprimer(E.categories.map((cat) => {
      const cg = R.classementGeneral(E, cat.id);
      if (!cg.lignes.length) return '';
      return `<section class="feuille"><header><p>${esc(c.nom)}</p><h1>Classement · ${esc(cat.nom)}${cg.provisoire ? ' (provisoire)' : ''}</h1></header>
        <table><thead><tr><th>Rang</th><th>Participant</th><th>Club</th>${cg.toutes.map((ep, i) => `<th>É${i + 1}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${cg.lignes.map((l) => `<tr><td>${l.rang}</td><td>${esc(l.participant.nom)}</td><td>${esc(l.participant.club)}</td>${cg.toutes.map((ep) => { const x = l.resultats[ep.id]; return `<td>${x ? `${x.rang ?? '–'} · ${esc(x.affichage)}` : ''}</td>`; }).join('')}<td>${nombre(l.total)}</td></tr>`).join('')}</tbody></table></section>`;
    }).join(''));
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `competition-${auj()}.json`);
  async function copier(texte, message) {
    try { await navigator.clipboard.writeText(texte); toast(message); } catch { toast('Copie impossible ici : sélectionne le texte à la main.'); }
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
    setTimeout(() => { if (!modale().open && !dejaInstalle() && !ecranOuvert) modaleEcranAccueil(true); }, 900);
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
  function deplacerEpreuve(id, sens) {
    const i = E.epreuves.findIndex((x) => x.id === id), j = i + sens;
    if (i < 0 || j < 0 || j >= E.epreuves.length) return;
    retenir();
    [E.epreuves[i], E.epreuves[j]] = [E.epreuves[j], E.epreuves[i]];
    sauver(); rendre();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); fermerEcranApp(); deconnecter(); break;
      case 'accueil-suivant': {
        if (accueil.dateDebut && accueil.dateFin && accueil.dateFin < accueil.dateDebut) { $('#a-err').textContent = 'Le dernier jour précède le premier.'; break; }
        accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'regles': modaleRegles(); break;
      case 'partage': modalePartage(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'categories': modaleCategories(); break;
      case 'ajout-cat': { const ul = $('#liste-cats'); ul.insertAdjacentHTML('beforeend', modale().dataset.modeleCat); ul.lastElementChild.querySelector('input').focus(); break; }
      case 'suppr-cat': {
        const li = el.closest('.ligne-cat');
        const n = li.dataset.id ? E.participants.filter((p) => p.categorie === li.dataset.id).length : 0;
        if (!n || confirm(`Cette catégorie compte ${pluriel(n, 'inscrit')} : ils resteront sans catégorie. La retirer ?`)) li.remove();
        break;
      }
      case 'importer': modaleImport(); break;
      case 'nouvel-inscrit': modaleInscrit(null); break;
      case 'modifier-inscrit': modaleInscrit(id); break;
      case 'filtre-cat': filtre.cat = el.dataset.cat; rendre(); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; if (vue !== 'inscrits') changerVue('inscrits'); else rendre(); break;
      case 'nouvelle-epreuve': modaleEpreuve(null); break;
      case 'modifier-epreuve': modaleEpreuve(id); break;
      case 'monter': deplacerEpreuve(id, -1); break;
      case 'descendre': deplacerEpreuve(id, 1); break;
      case 'generer': modaleGenerer(id); break;
      case 'deplier': filtre.ep = filtre.ep === id ? '' : id; rendre(); break;
      case 'modifier-vague': modaleVague(el.dataset.ep, Number(el.dataset.i)); break;
      case 'voir-vague': filtre.ep = el.dataset.ep; changerVue('epreuves'); setTimeout(() => document.getElementById(`ep-${el.dataset.ep}`)?.scrollIntoView({ block: 'start' }), 0); break;
      case 'imprimer': feuillesJuge(id); break;
      case 'imprimer-classement': imprimerClassement(); break;
      case 'saisir': filtre.ep = id; changerVue('scores'); break;
      case 'choisir-ep': filtre.ep = id; rendre(); break;
      case 'choisir-cat-score': filtre.catScore = el.dataset.cat; rendre(); break;
      case 'choisir-cat-class': filtre.catClass = el.dataset.cat; rendre(); break;
      case 'voir-classement': filtre.catClass = el.dataset.cat; changerVue('classement'); break;
      case 'mode-ecran': ouvrirEcranApp(); break;
      case 'fermer-ecran': fermerEcranApp(); break;
      case 'csv-inscrits': telecharger(R.versCsvInscrits(E), 'text/csv;charset=utf-8', `inscrits-${auj()}.csv`); break;
      case 'csv-inscrits-contacts': telecharger(R.versCsvInscrits(E, { contacts: true }), 'text/csv;charset=utf-8', `inscrits-coordonnees-${auj()}.csv`); break;
      case 'csv-classement': telecharger(R.versCsvClassement(E), 'text/csv;charset=utf-8', `classement-${auj()}.csv`); break;
      case 'copier-mention': copier(B.mentionRgpd, 'Mention copiée : colle-la sur ton formulaire d\'inscription.'); break;
      case 'copier-lien': copier(lienPublic(), 'Lien copié.'); break;
      case 'publier-maintenant': publier().then(() => { toast('Classement public mis à jour.'); }).catch((x) => toast(x.message === 'Failed to fetch' ? 'Pas de connexion.' : x.message)); break;
      case 'effacer-contacts': {
        if (!confirm('Effacer les e-mails et téléphones de tous les inscrits ? Pense à exporter la liste avant si tu en as encore besoin.')) break;
        retenir();
        const r = R.effacerCoordonnees(E);
        E = r.etat;
        modale().close(); sauver(); rendre(); toast(`Coordonnées effacées (${pluriel(r.n, 'inscrit')}).`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'nouvelle-compet': {
        if (!confirm('Repartir pour une nouvelle édition ? Inscrits, vagues et scores seront effacés (télécharge une copie avant).')) break;
        retenir();
        const sel = E.publication.sel;
        retirerPublication(sel).catch(() => {});
        E = normaliser({ ...E, participants: [], scores: {}, epreuves: E.epreuves.map((x) => ({ ...x, vagues: [] })), competition: { ...E.competition, dateDebut: null, dateFin: null }, publication: {} });
        modale().close(); sauver(); changerVue('inscrits'); toast('Nouvelle édition prête : catégories, épreuves et règles gardées.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'public-cat': pub.cat = el.dataset.cat; rendrePublic(); break;
      case 'public-onglet': pub.onglet = el.dataset.o; rendrePublic(); break;
      case 'public-rotation': pub.rotation = true; pageEcran = 0; rendrePublic(); document.documentElement.requestFullscreen?.().catch(() => {}); break;
      case 'public-liste': pub.rotation = false; if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); rendrePublic(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ecranOuvert && !modale().open) fermerEcranApp(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); planifierPublication(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E || pub.id) return;
    rafraichir();
    if (!modale().open && !document.activeElement?.matches?.('[data-s]')) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const params = new URLSearchParams(location.search);
    if (params.has('ecran')) return ouvrirPublic(params.get('ecran'));
    const code = stock.lire(CLE_CODE);
    if (params.has('demo') && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (params.has('demo')) history.replaceState(null, '', location.pathname);
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
  window.__competition = { etat: () => E, regles: R };
  init();
})();
