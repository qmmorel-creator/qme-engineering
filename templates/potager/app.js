// Calendrier du potager QME : cultures choisies avec les fenêtres saisies par le jardinier (semis sous abri, semis
// en pleine terre, plantation, récolte), décalage en semaines pour sa région, « à faire cette semaine », frise des
// 12 mois, parcelles et rotation des familles, journal des semis et des récoltes, bilan des récoltes.
// Aucune période ni association fournie (pas de source dont la licence a été vérifiée) ; aucune météo, aucun
// service externe. Données synchronisées par clé de licence ou code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PTG;
  const API = '/api/templates';
  const PRODUIT = 'PTG';
  const CLE_CODE = 'qme-ptg-code';
  const CLE_CACHE = 'qme-ptg-cache';
  const CLE_DEMO = 'qme-ptg-demo';
  const CLE_PREF = 'qme-ptg-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ptg-ecran-accueil';

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
  const auj = () => R.iso(new Date());
  const anAuj = () => R.annee(auj());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const kg = (n) => `${R.nombreFr(n, n >= 10 ? 1 : 2)} kg`;
  const UNITES = Object.fromEntries(B.unites);
  const TYPES_J = Object.fromEntries(B.typesJournal);
  const LIEUX_S = Object.fromEntries(B.lieuxSemis);
  const OP = Object.fromEntries(B.operations.map((o) => [o.code, o]));
  const qteTexte = (e) => (e.quantite ? `${R.nombreFr(e.quantite, 3)} ${e.unite === 'piece' && e.quantite > 1 ? 'pièces' : e.unite === 'botte' && e.quantite > 1 ? 'bottes' : e.unite === 'litre' && e.quantite > 1 ? 'litres' : UNITES[e.unite]}` : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  const pref = stock.lire(CLE_PREF) || {};
  const filtre = { op: pref.op || '', famille: '', type: '', anCal: null, anParc: null, anJ: null, toutJ: false };
  let annulation = null;

  const etatVide = (codes, nb) => R.etatVide(B, codes, nb);
  const normaliser = (d) => R.normaliser(d, B);
  const trouver = (l, id) => (E[l] || []).find((x) => x.id === id);
  const culture = (id) => R.cultureDe(E, id);
  const parcelle = (id) => R.parcelleDe(E, id);
  const famille = (code) => R.familleDe(B, code);
  const couleurFamille = (code) => { const i = B.familles.findIndex((f) => f.code === code); return i < 0 ? { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' } : B.couleurs[i % B.couleurs.length]; };
  const nomCulture = (c) => (c ? `${c.nom}${c.variete ? ` ${c.variete}` : ''}` : '');
  const nomEntree = (e) => nomCulture(culture(e.culture)) || e.nomCulture || '';
  const dec = () => E.reglages.decalage || 0;
  function sauverPref() { stock.ecrire(CLE_PREF, { op: filtre.op }); }

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
        toast('Un autre appareil a modifié le potager entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte puis retire le journal ancien (Réglages).');
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
  // Code interne (PTG-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Jardin fictif. Les fenêtres sont saisies POUR L'EXEMPLE, relatives à la quinzaine du jour (pour montrer chaque
  // état quel que soit le mois d'ouverture de la démo) : ce ne sont pas des conseils de culture. États couverts :
  // fenêtre qui commence, en cours, qui finit, faite cette semaine, passée sans rien noter, plus tard ce mois-ci,
  // le mois prochain, récolte en cours avec quantités, culture sans fenêtre ; placements sur trois ans avec une
  // alerte de rotation et une alerte « à éloigner », une parcelle vide cette année ; 14 mois de journal.
  function donneesDemo() {
    const a = auj();
    const Y = R.annee(a);
    const q0 = R.quinzaineDe(a);
    const F = (d1, d2) => ({ de: (q0 + d1 + 48) % 24, a: (q0 + d2 + 48) % 24 });
    const e = etatVide([], 0);
    e.reglages = R.normaliserReglages({ jardin: 'Jardin des Tilleuls (fictif)', decalage: 0, rotation: 1 });
    const C = (id, nom, fam, fenetres, x = {}) => { e.cultures.push(R.normaliserCulture({ id, nom, famille: fam, base: x.base || '', variete: x.variete || '', fenetres, amis: x.amis || [], eloigner: x.eloigner || [], note: x.note || '' })); };
    C('ail', 'Ail', 'amaryllidacees', { plantation: F(-1, 0), recolte: F(14, 15) }, { variete: 'violet' });
    C('mache', 'Mâche', 'caprifoliacees', { semisPleine: F(-2, 0), recolte: F(0, 6) });
    C('laitue', 'Laitue', 'asteracees', { semisAbri: F(0, 1), plantation: F(2, 3), recolte: F(4, 7) }, { variete: 'batavia' });
    C('feve', 'Fève', 'fabacees', { semisPleine: F(1, 2), recolte: F(11, 13) });
    C('epinard', 'Épinard', 'amaranthacees', { semisPleine: F(-3, -1), recolte: F(2, 6) });
    C('poireau', 'Poireau', 'amaryllidacees', { semisAbri: F(-14, -12), plantation: F(-8, -6), recolte: F(-2, 6) });
    C('kale', 'Chou kale', 'brassicacees', { plantation: F(-10, -8), recolte: F(-3, 4) });
    C('radis', 'Radis', 'brassicacees', { semisPleine: F(3, 12), recolte: F(5, 14) }, { variete: 'demi-long' });
    C('tomate', 'Tomate', 'solanacees', { semisAbri: F(7, 8), plantation: F(11, 12), recolte: F(15, 20) }, { variete: 'cœur de bœuf', amis: ['basilic'] });
    C('courgette', 'Courgette', 'cucurbitacees', { semisAbri: F(9, 10), plantation: F(12, 13), recolte: F(14, 20) });
    C('haricot', 'Haricot nain', 'fabacees', { semisPleine: F(12, 15), recolte: F(15, 19) });
    C('carotte', 'Carotte', 'apiacees', { semisPleine: F(8, 14), recolte: F(13, 21) });
    C('pdt', 'Pomme de terre', 'solanacees', { plantation: F(9, 11), recolte: F(14, 17) }, { variete: 'chair ferme' });
    C('basilic', 'Basilic', 'lamiacees', { semisAbri: F(8, 10), plantation: F(11, 12), recolte: F(13, 19) });
    C('echalote', 'Échalote', 'amaryllidacees', { plantation: F(-1, 1), recolte: F(12, 14) }, { variete: 'grise' });
    C('oignon', 'Oignon', 'amaryllidacees', { plantation: F(7, 9), recolte: F(14, 16) }, { eloigner: ['feve'], note: 'Noté d\'après mon livre de jardinage (exemple fictif).' });
    C('rhubarbe', 'Rhubarbe', 'polygonacees', {}, { note: 'Fenêtres à recopier de mon carnet.' });
    // Parcelles
    const P = (id, nom, type, surface) => e.parcelles.push(R.normaliserParcelle({ id, nom, type, surface }));
    P('p1', 'Planche 1', 'planche', 6); P('p2', 'Planche 2', 'planche', 6); P('p3', 'Planche 3', 'planche', 6); P('p4', 'Planche 4', 'planche', 6);
    P('carre', 'Carré des aromatiques', 'carre', 1.2); P('serre', 'Serre', 'serre', 8);
    const L = (an, parc, cult) => e.placements.push(R.normaliserPlacement({ id: uid(), annee: an, parcelle: parc, culture: cult }));
    L(Y - 2, 'p1', 'haricot'); L(Y - 2, 'p2', 'tomate'); L(Y - 2, 'p3', 'courgette'); L(Y - 2, 'p4', 'carotte'); L(Y - 2, 'carre', 'basilic');
    L(Y - 1, 'p1', 'tomate'); L(Y - 1, 'p1', 'basilic'); L(Y - 1, 'p2', 'pdt'); L(Y - 1, 'p3', 'carotte'); L(Y - 1, 'p3', 'radis'); L(Y - 1, 'p4', 'courgette'); L(Y - 1, 'p4', 'haricot'); L(Y - 1, 'serre', 'laitue'); L(Y - 1, 'carre', 'basilic');
    L(Y, 'p1', 'pdt'); L(Y, 'p2', 'poireau'); L(Y, 'p2', 'carotte'); L(Y, 'p3', 'feve'); L(Y, 'p3', 'oignon'); L(Y, 'p4', 'ail'); L(Y, 'p4', 'kale'); L(Y, 'serre', 'mache'); L(Y, 'serre', 'laitue'); L(Y, 'serre', 'tomate'); L(Y, 'serre', 'basilic'); L(Y, 'p4', 'echalote');
    // Journal : occurrences entièrement passées des 14 derniers mois, reproductibles (graine fixe).
    let graine = 11;
    const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
    const J = (date, type, cult, x = {}) => { if (date < a) e.journal.push(R.normaliserEntree({ id: uid(), date, type, culture: cult, parcelle: x.parcelle || '', lieu: x.lieu || '', quantite: x.quantite || 0, unite: x.unite || 'kg', note: x.note || '' })); };
    const depuis = `${Y - 1}-01-01`;
    const ouEst = (cult, date) => e.placements.find((p) => p.culture === cult && p.annee === R.annee(date))?.parcelle || '';
    const recolteDe = { echalote: [0.4, 'kg'], ail: [0.3, 'kg'], mache: [150, 'g'], laitue: [1, 'piece'], feve: [0.5, 'kg'], epinard: [200, 'g'], poireau: [0.8, 'kg'], kale: [250, 'g'], radis: [1, 'botte'], tomate: [1.6, 'kg'], courgette: [2, 'piece'], haricot: [0.45, 'kg'], carotte: [0.7, 'kg'], pdt: [3, 'kg'], basilic: [40, 'g'], oignon: [1.2, 'kg'] };
    for (const c of e.cultures) {
      for (const op of R.OPS) {
        const f = c.fenetres[op];
        if (!f) continue;
        for (const o of R.occurrencesSur(f, { debut: depuis, fin: a }, 0)) {
          const passee = o.fin < a;
          if (op !== 'recolte') {
            if (!passee || o.debut < depuis || c.id === 'epinard') continue;
            const d = R.ajout(o.debut, 4 + Math.floor(hasard() * 6));
            J(d, op === 'plantation' ? 'plantation' : 'semis', c.id, { lieu: op === 'semisAbri' ? 'abri' : op === 'semisPleine' ? 'pleine' : '', parcelle: op === 'semisAbri' ? '' : ouEst(c.id, d) });
            if (op !== 'plantation') J(R.ajout(d, 7 + Math.floor(hasard() * 5)), 'levee', c.id);
          } else {
            const [q, u] = recolteDe[c.id] || [1, 'kg'];
            for (let d = R.ajout(o.debut < depuis ? depuis : o.debut, 3); d <= o.fin && d < a; d = R.ajout(d, 9 + Math.floor(hasard() * 7))) {
              const facteur = 0.6 + hasard() * 0.9;
              J(d, 'recolte', c.id, { quantite: u === 'piece' || u === 'botte' ? Math.max(1, Math.round(q * facteur * 2)) : Math.round(q * facteur * (u === 'g' ? 1 : 100)) / (u === 'g' ? 1 : 100), unite: u, parcelle: ouEst(c.id, d) });
            }
          }
        }
      }
    }
    // Faits cette semaine et notes.
    J(R.ajout(a, -3), 'plantation', 'ail', { parcelle: 'p4', note: '40 caïeux' });
    J(R.ajout(a, -6), 'note', '', { parcelle: 'p1', note: 'Paillage de feuilles mortes sur la planche 1.' });
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Calendrier du potager · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="170" width="250" height="110" rx="18" fill="#F0EDE6"/>
          <rect x="40" y="190" width="50" height="70" rx="10" fill="#1D4E89"/>
          <rect x="110" y="190" width="50" height="70" rx="10" fill="#F5B400"/>
          <rect x="180" y="190" width="70" height="70" rx="10" fill="#D9302A"/>
          <circle cx="400" cy="100" r="78" fill="#F5B400"/>
          <path d="M300 280 A80 80 0 0 1 460 280 Z" fill="#1D4E89"/>
          <path d="M120 150 L150 60 L180 150 Z" fill="#141414"/>
          <circle cx="150" cy="40" r="18" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Calendrier du potager</p>
          <h1>Chaque semis à sa date.</h1>
          <p>Tes cultures avec tes dates, ce qu'il y a à semer, planter et récolter cette semaine, la rotation de tes planches et le bilan de tes récoltes.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton potager</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton calendrier est enregistré en ligne et te suit sur tous tes appareils : le téléphone au jardin, l'ordinateur pour préparer la saison.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon potager</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/potager/">Voir le calendrier du potager</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon potager'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const PROPOSES = ['tomate', 'courgette', 'haricot-nain', 'carotte', 'radis', 'laitue', 'poireau', 'pomme-de-terre'];
  const accueilVide = () => ({ etape: 1, jardin: '', planches: 4, cultures: [...PROPOSES] });
  let accueil = accueilVide();
  const SANS_PERIODES = '<div class="note-source" role="note"><b>Les dates sont les tiennes.</b> L\'outil ne fournit aucune période de semis ou de récolte ni aucune association : chaque jardin, chaque région et chaque variété a les siennes, et nous n\'avons pas trouvé de calendrier public réutilisable dont la source soit vérifiée. Recopie celles de tes sachets de graines, de ton livre ou de ton carnet : l\'outil s\'occupe du reste.</div>';

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton potager, ton calendrier.</h1>
        <p class="intro">Tu choisis tes cultures et tu notes leurs fenêtres (semis sous abri, semis en pleine terre, plantation, récolte). Chaque semaine, l'outil te dit quoi faire, il tient le journal de tes semis et de tes récoltes, et il surveille la rotation de tes planches.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        ${SANS_PERIODES}
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton jardin et tes cultures</h1>
        <p class="intro">Coche ce que tu cultives : tu ajouteras les fenêtres ensuite, culture par culture (onglet Cultures). Tout se modifie plus tard.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Nom du jardin <small>facultatif</small><input id="a-jardin" value="${esc(a.jardin)}" maxlength="60" placeholder="Ex. : Potager, Jardin partagé"></label>
            <label class="champ">Planches à créer <small>0 à 12, renommables</small><input id="a-planches" type="number" min="0" max="12" inputmode="numeric" value="${a.planches}"></label>
          </div>
          <div class="choix-types">${B.familles.map((f) => `<fieldset class="groupe-types"><legend>${esc(f.nom)}${f.ancien ? ` <small>${esc(f.ancien)}</small>` : ''}</legend>${B.legumes.filter((l) => l[3] === f.code).map(([code, nom]) => `<label class="case"><input type="checkbox" name="a-culture" value="${code}" ${a.cultures.includes(code) ? 'checked' : ''}> ${esc(nom)}</label>`).join('')}</fieldset>`).join('')}</div>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon potager</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#a-jardin')?.addEventListener('input', (e) => { accueil.jardin = e.target.value; });
    $('#a-planches')?.addEventListener('input', (e) => { accueil.planches = R.entier(e.target.value, 0, 12, 0); });
    document.querySelectorAll('[name=a-culture]').forEach((c) => c.addEventListener('change', () => { accueil.cultures = [...document.querySelectorAll('[name=a-culture]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide(a.cultures, a.planches);
    E.reglages.jardin = String(a.jardin || '').trim().slice(0, 60);
    accueil = accueilVide();
    vue = 'cultures';
    sauver();
    demarrer();
    toast(E.cultures.length ? 'Ton potager est prêt : ajoute les fenêtres de tes cultures.' : 'Ton potager est prêt : ajoute tes cultures.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="9" height="4" rx="1.5" fill="currentColor"/><rect x="7" y="11" width="12" height="4" rx="1.5" fill="currentColor"/><rect x="13" y="17" width="9" height="4" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    parcelles: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    cultures: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    imprimer: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="3" width="12" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="8" width="18" height="9" rx="2" fill="currentColor"/><rect x="7" y="14" width="10" height="7" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['semaine', 'Cette semaine'], ['calendrier', 'Calendrier'], ['parcelles', 'Parcelles'], ['journal', 'Journal'], ['cultures', 'Cultures']];
  const AVERTISSEMENT = '<p class="mention avertissement">Les dates affichées viennent de tes saisies (et de ton décalage en semaines) : l\'outil ne fournit aucune période de culture ni aucune association, et ne tient pas compte de la météo. Fie-toi aussi à l\'état de ton sol et au temps qu\'il fait.</p>';
  const NOTE_DEMO = '<p class="aide note-demo"><b>Démo :</b> jardin et dates fictifs, saisis pour l\'exemple et calés sur la date du jour pour montrer chaque situation. Ce ne sont pas des conseils de culture.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" rx="10" fill="#1D4E89"/><circle cx="66" cy="30" r="30" fill="#F5B400"/><path d="M8 34 L28 0 L48 34 Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, txt, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${txt}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const etiquetteOp = (op) => `<span class="etiquette op op-${op}">${esc(OP[op].court)}</span>`;
  const pastilleFam = (code, txt) => { const c = couleurFamille(code); return `<span class="pastille-type" style="--f:${c.fond};--t:${c.texte}" aria-hidden="true">${esc((txt || famille(code)?.nom || '?').slice(0, 1))}</span>`; };
  const puceCulture = (c) => (c ? `<span class="puce-culture" style="--f:${couleurFamille(c.famille).fond};--t:${couleurFamille(c.famille).texte}">${esc(nomCulture(c))}</span>` : '');
  const periodeTexte = (o) => (o.debut === o.fin ? `le ${R.dateFr(o.debut)}` : `du ${R.dateFr(o.debut)}${R.annee(o.debut) !== R.annee(o.fin) ? ` ${R.annee(o.debut)}` : ''} au ${R.dateFr(o.fin)}${R.annee(o.fin) !== anAuj() || R.annee(o.debut) !== R.annee(o.fin) ? ` ${R.annee(o.fin)}` : ''}`);
  const anneeFiltre = (k) => { if (!filtre[k]) filtre[k] = anAuj(); return filtre[k]; };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/potager/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Jardin fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Calendrier<br>du potager</span>
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
    const c = R.compteSemaine(E, auj());
    const nb = c.semer + c.planter;
    const og = $('.onglet[data-vue="semaine"]');
    if (og) og.querySelector('em')?.remove();
    if (og && nb) og.insertAdjacentHTML('beforeend', `<em class="pastille-nb" aria-label="${nb} semis ou plantations à faire cette semaine">${nb > 99 ? '99+' : nb}</em>`);
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Calendrier du potager`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, calendrier: vueCalendrier, parcelles: vueParcelles, journal: vueJournal, cultures: vueCultures }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function brancherVue() {
    $('#f-famille')?.addEventListener('change', (e) => { filtre.famille = e.target.value; rendre(); });
  }

  // ---------- Cette semaine ----------
  function ligneAFaire(x, { passee = false } = {}) {
    const c = culture(x.culture);
    if (!c) return '';
    const o = x.occurrence;
    let detail = periodeTexte(o);
    let etat = '';
    if (passee) etat = `<span class="ligne-alerte niv-passee">Fenêtre finie ${x.depuis === 1 ? 'hier' : `il y a ${x.depuis} jours`}, rien de noté au journal</span>`;
    else if (x.fait) etat = `<span class="ligne-alerte niv-fait">Fait le ${esc(R.dateFr(x.fait.date))}${x.fait.type === 'repiquage' ? ' (repiquage)' : ''}</span>`;
    else if (x.op === 'recolte') {
      const l = R.recoltes(E, c.id, o.debut);
      const total = l.reduce((s, e) => s + R.versKg(e), 0);
      etat = l.length ? `<span class="ligne-alerte">Dernière récolte le ${esc(R.dateFr(l[0].date))} · ${pluriel(l.length, 'récolte')}${total ? ` · ${kg(total)}` : ''} depuis le début de la fenêtre</span>` : '<span class="ligne-alerte">Aucune récolte notée dans cette fenêtre</span>';
    } else if (x.moment === 'aVenir') etat = `<span class="ligne-alerte">Commence ${o.debut === R.ajout(auj(), 1) ? 'demain' : `le ${esc(R.dateFr(o.debut))}`}</span>`;
    else if (x.moment === 'commence') etat = '<span class="ligne-alerte niv-commence">La fenêtre s\'ouvre</span>';
    else if (x.moment === 'finit' || x.joursRestants <= 7) etat = `<span class="ligne-alerte niv-finit">${x.joursRestants <= 0 ? 'Dernier jour' : `Dernière semaine : finit ${x.joursRestants === 1 ? 'demain' : `dans ${x.joursRestants} jours`}`}</span>`;
    else etat = `<span class="ligne-alerte">En cours, jusqu'au ${esc(R.dateFr(o.fin))}</span>`;
    const classe = passee ? 'alerte-depasse' : x.fait ? 'st-fait' : x.op !== 'recolte' && (x.moment === 'finit' || x.joursRestants <= 7) && x.moment !== 'aVenir' ? 'alerte-proche' : '';
    const bouton = x.op === 'recolte'
      ? `<button class="btn petit" type="button" data-action="noter" data-culture="${c.id}" data-op="recolte">Noter une récolte</button>`
      : x.fait ? '' : `<button class="btn petit" type="button" data-action="noter" data-culture="${c.id}" data-op="${x.op}">Noter</button>`;
    return `<li class="ligne-abs ${classe}">
      <button type="button" class="ligne-info" data-action="culture" data-id="${c.id}">
        <b>${pastilleFam(c.famille)}${esc(nomCulture(c))} ${etiquetteOp(x.op)}</b>
        <span class="ligne-detail">${esc(OP[x.op].nom)} · ${esc(detail)}</span>
        ${etat}
      </button>
      ${bouton ? `<div class="ligne-droite"><div class="rang">${bouton}</div></div>` : ''}
    </li>`;
  }

  function vueSemaine() {
    const a = auj();
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(E.reglages.jardin || 'Potager')} · ${esc(R.dateFrLongue(a))}</p><h1>Cette semaine</h1></div><div class="actions"><button class="btn primaire" data-action="noter">${ICONES.plus}Noter au journal</button></div></div>`;
    if (!E.cultures.length) return `${tete}${videEtat('Aucune culture', 'Choisis ce que tu cultives et note les fenêtres de semis, de plantation et de récolte : ce qu\'il y a à faire s\'affichera ici chaque semaine.', '<button class="btn primaire" data-action="vue" data-vue="cultures">Ajouter mes cultures</button>')}${AVERTISSEMENT}`;
    const avec = E.cultures.filter(R.aDesFenetres);
    if (!avec.length) return `${tete}${videEtat('Aucune fenêtre saisie', `Tu as ${pluriel(E.cultures.length, 'culture')} : ouvre chacune et note ses fenêtres (d'après le sachet de graines ou ton carnet).`, '<button class="btn primaire" data-action="vue" data-vue="cultures">Saisir les fenêtres</button>')}${AVERTISSEMENT}`;
    const s = R.semaine(a), m = R.mois(a), m2 = R.mois(a, 1);
    const semaineL = R.aFaire(E, s, a);
    const cleItem = (x) => `${x.culture}|${x.op}|${x.occurrence.debut}`;
    const dejaVus = new Set(semaineL.map(cleItem));
    const plusTard = R.aFaire(E, m, a).filter((x) => !dejaVus.has(cleItem(x)) && x.occurrence.debut > s.fin);
    const prochain = R.aFaire(E, m2, a).filter((x) => x.occurrence.debut > m.fin && x.occurrence.debut <= m2.fin && !dejaVus.has(cleItem(x)));
    const passees = R.passees(E, a);
    const c = R.compteSemaine(E, a);
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">À semer</p><b>${c.semer}</b><span>cette semaine</span></div>
      <div class="tuile rond" style="--c:#2E7D4F"><p class="surtitre">À planter</p><b>${c.planter}</b><span>plantation ou repiquage</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">À récolter</p><b>${c.recolter}</b><span>fenêtres de récolte</span></div>
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Fenêtres passées</p><b>${passees.length}</b><span>sans rien noter (3 sem.)</span></div>
    </div>`;
    const decal = dec() ? `<p class="resume-liste">Dates décalées de ${dec() > 0 ? '+' : ''}${pluriel(dec(), 'semaine')} par rapport à tes fenêtres (Réglages).</p>` : '';
    const bloc = (titre, sous, l, opts) => (l.length ? `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">${titre}</span><span>${sous}</span></h2><ul class="lignes-abs">${l.map((x) => ligneAFaire(x, opts)).join('')}</ul></section>` : '');
    const vSemaine = semaineL.length
      ? bloc('Cette semaine', `du lundi ${R.dateFr(s.debut)} au dimanche ${R.dateFr(s.fin)} · ${pluriel(semaineL.filter((x) => x.fait).length, 'fait')}`, semaineL)
      : `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Cette semaine</span></h2>${videEtat('Rien au calendrier cette semaine', 'Aucune de tes fenêtres ne tombe cette semaine. Regarde plus bas ce qui arrive, ou la frise de l\'année.', '<button class="btn" data-action="vue" data-vue="calendrier">Voir le calendrier</button>')}</section>`;
    const sans = E.cultures.length - avec.length;
    const sansTxt = sans ? `<p class="resume-liste">${pluriel(sans, 'culture')} sans fenêtre saisie : <button class="btn lien" data-action="vue" data-vue="cultures">les compléter</button></p>` : '';
    const prochainHtml = prochain.length ? `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Le mois prochain</span><span>${R.MOIS[R.versDate(m2.debut).getMonth()]} : fenêtres qui s'ouvrent</span></h2><ul class="mini-liste">${prochain.map((x) => `<li><span>${etiquetteOp(x.op)}<b>${esc(nomCulture(culture(x.culture)))}</b> <small class="aide-inline">à partir du ${esc(R.dateFr(x.occurrence.debut))}</small></span></li>`).join('')}</ul></section>` : '';
    return `${tete}${session.demo ? NOTE_DEMO : ''}${tuiles}${decal}${vSemaine}
      ${bloc('Fenêtres passées sans rien noter', 'semis ou plantation : note-le si c\'est fait, sinon c\'est pour l\'an prochain', passees, { passee: true })}
      ${bloc('Plus tard ce mois-ci', R.MOIS[R.versDate(a).getMonth()], plusTard)}
      ${prochainHtml}${sansTxt}${AVERTISSEMENT}`;
  }

  // ---------- Calendrier (frise des 12 mois) ----------
  function vueCalendrier() {
    const an = anneeFiltre('anCal');
    const tete = `<div class="vue-tete"><div><p class="surtitre">Frise des 12 mois, par quinzaine${dec() ? ` · décalage ${dec() > 0 ? '+' : ''}${dec()} sem.` : ''}</p><h1>Calendrier ${an}</h1></div><div class="actions"><div class="rang"><button class="btn petit" data-action="an-cal" data-d="-1" aria-label="Année précédente">← ${an - 1}</button><button class="btn petit" data-action="an-cal" data-d="1" aria-label="Année suivante">${an + 1} →</button></div><button class="btn" data-action="imprimer">${ICONES.imprimer}Imprimer</button></div></div>`;
    if (!E.cultures.length) return `${tete}${videEtat('Aucune culture', 'Ajoute tes cultures et leurs fenêtres : la frise de l\'année se dessine toute seule.', '<button class="btn primaire" data-action="vue" data-vue="cultures">Ajouter mes cultures</button>')}`;
    const filtres = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Opération"><button class="filtre" data-action="filtre-op" data-f="" aria-pressed="${!filtre.op}">Tout</button>${B.operations.map((o) => `<button class="filtre" data-action="filtre-op" data-f="${o.code}" aria-pressed="${filtre.op === o.code}"><i class="lg op-${o.code}"></i>${esc(o.court)}</button>`).join('')}</div>
      <label class="champ recherche"><span class="sr-only">Famille</span><select id="f-famille"><option value="">Toutes les familles</option>${B.familles.filter((f) => E.cultures.some((c) => c.famille === f.code)).map((f) => `<option value="${f.code}" ${filtre.famille === f.code ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label></div>`;
    const ops = filtre.op ? [filtre.op] : R.OPS;
    const qAuj = R.annee(auj()) === an ? R.quinzaineDe(auj()) : -1;
    const liste = E.cultures.filter((c) => !filtre.famille || c.famille === filtre.famille);
    const avec = liste.filter((c) => ops.some((k) => c.fenetres[k]));
    const sans = liste.filter((c) => !ops.some((k) => c.fenetres[k]));
    const entete = `<div class="frise-ligne frise-tete" aria-hidden="true"><span class="frise-nom"></span><span class="frise-cases"><b class="frise-op"></b>${R.MOIS_COURTS.map((m, i) => `<span class="frise-mois ${Math.floor(qAuj / 2) === i ? 'actif' : ''}" style="grid-column:${i * 2 + 2}/span 2"><span class="long">${m}</span><span class="court">${R.INITIALES[i]}</span></span>`).join('')}</span></div>`;
    const lignes = avec.map((c) => {
      const rangs = ops.filter((k) => c.fenetres[k]).map((k) => {
        const f = R.frise(c.fenetres[k], an, dec());
        return `<span class="frise-rang" role="img" aria-label="${esc(OP[k].nom)} : ${esc(R.texteFenetre(c.fenetres[k]))}"><b class="frise-op" aria-hidden="true">${esc(OP[k].court)}</b>${f.map((on, q) => `<i class="${on ? `on op-${k}` : ''}${q === qAuj ? ' auj' : ''}${q % 2 ? ' fin-mois' : ''}"></i>`).join('')}</span>`;
      }).join('');
      return `<div class="frise-ligne"><button type="button" class="frise-nom" data-action="culture" data-id="${c.id}">${pastilleFam(c.famille)}<span>${esc(c.nom)}${c.variete ? ` <small>${esc(c.variete)}</small>` : ''}</span></button><span class="frise-cases frise-rangs">${rangs}</span></div>`;
    }).join('');
    const legende = `<p class="legende">${B.operations.map((o) => `<span><i class="lg op-${o.code}"></i>${esc(o.nom)}</span>`).join('')}${qAuj >= 0 ? '<span><i class="lg lg-auj"></i>Quinzaine en cours</span>' : ''}</p>`;
    const frise = avec.length ? `<div class="frise" aria-label="Calendrier ${an}">${entete}${lignes}</div>${legende}` : videEtat('Rien à afficher', filtre.op ? `Aucune culture n'a de fenêtre « ${esc(OP[filtre.op].nom)} ».` : 'Aucune fenêtre saisie pour ces cultures.');
    const sansTxt = sans.length ? `<p class="resume-liste">Sans fenêtre${filtre.op ? ` « ${esc(OP[filtre.op].court)} »` : ''} : ${sans.map((c) => `<button class="btn lien" data-action="culture" data-id="${c.id}">${esc(nomCulture(c))}</button>`).join(', ')}</p>` : '';
    return `${tete}${filtres}<div class="impression-titre"><b>${esc(E.reglages.jardin || 'Calendrier du potager')}</b> · ${an}${dec() ? ` · décalage ${dec() > 0 ? '+' : ''}${dec()} semaine(s)` : ''}</div>${frise}${sansTxt}${AVERTISSEMENT}`;
  }

  // ---------- Parcelles et rotation ----------
  function vueParcelles() {
    const an = anneeFiltre('anParc');
    const ans = R.annees(E, auj());
    const tete = `<div class="vue-tete"><div><p class="surtitre">Où pousse quoi, et rotation des familles</p><h1>Parcelles ${an}</h1></div><div class="actions"><button class="btn primaire" data-action="placer">${ICONES.plus}Placer une culture</button><button class="btn" data-action="parcelle">Ajouter une parcelle</button></div></div>`;
    const filtres = `<div class="filtres" role="group" aria-label="Année">${ans.map((x) => `<button class="filtre" data-action="an-parc" data-f="${x}" aria-pressed="${x === an}">${x}</button>`).join('')}</div>`;
    if (!E.parcelles.length) return `${tete}${videEtat('Aucune parcelle', 'Ajoute tes planches, carrés, serre ou bacs, puis place tes cultures dessus chaque année : l\'outil te signale une même famille au même endroit.', '<button class="btn primaire" data-action="parcelle">Ajouter une parcelle</button>')}`;
    const alertes = R.alertesAnnee(E, an);
    const nRot = E.reglages.rotation;
    const texteAlerte = (x) => (x.type === 'rotation'
      ? `<b>${esc(nomCulture(culture(x.cultureEnCause)))}</b> sur ${esc(parcelle(x.parcelle)?.nom)} : ${esc(famille(x.famille)?.nom || 'même famille')}, comme ${esc(nomCulture(culture(x.culture)))} en ${x.annee}.`
      : `<b>${esc(nomCulture(culture(x.cultureEnCause)))}</b> et <b>${esc(nomCulture(culture(x.culture)))}</b> sur ${esc(parcelle(x.parcelle)?.nom)} : tu les as notées « à éloigner ».`);
    const resume = alertes.length
      ? `<section class="alertes-bloc" aria-label="Alertes"><h2>${pluriel(alertes.length, 'alerte')} en ${an}</h2><ul>${alertes.map((x) => `<li><span class="etiquette ${x.type === 'rotation' ? 'jaune' : 'rose'}">${x.type === 'rotation' ? 'Rotation' : 'À éloigner'}</span><span>${texteAlerte(x)}</span></li>`).join('')}</ul></section>`
      : `<p class="resume-liste ok">Aucune alerte en ${an} : pas de même famille au même endroit ${nRot > 1 ? `ces ${nRot} dernières années` : 'l\'année précédente'}, pas de cultures « à éloigner » côte à côte.</p>`;
    const cartes = E.parcelles.map((p) => {
      const pl = R.placementsDe(E, p.id, an);
      const al = alertes.filter((x) => x.parcelle === p.id);
      const histo = R.historiqueParcelle(E, p.id).filter((h) => h.annee < an).slice(0, 3);
      const amis = new Set();
      for (const x of pl) for (const y of R.voisinage(E, x).amis) amis.add([x.culture, y].sort().join('|'));
      return `<li class="carte-parcelle ${al.length ? 'avec-alerte' : ''}">
        <div class="cp-tete"><button type="button" class="lien-ligne" data-action="parcelle" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${esc(B.typesParcelle[p.type])}${p.surface ? ` · ${R.nombreFr(p.surface)} m²` : ''}</span></button><button class="btn petit" type="button" data-action="placer" data-parcelle="${p.id}">${ICONES.plus}<span class="sr-only">Placer une culture sur ${esc(p.nom)}</span><span aria-hidden="true">Placer</span></button></div>
        ${pl.length ? `<ul class="puces-cultures">${pl.map((x) => { const c = culture(x.culture); const a2 = al.filter((y) => y.placement === x.id || (y.type === 'eloigner' && y.culture === x.culture)); return `<li class="${a2.length ? 'alerte' : ''}">${puceCulture(c)}${a2.length ? '<span class="sr-only"> (alerte)</span><span class="signe" aria-hidden="true">!</span>' : ''}<button class="btn-suppr" type="button" data-action="suppr-placement" data-id="${x.id}" aria-label="Retirer ${esc(nomCulture(c))} de ${esc(p.nom)} en ${an}">×</button></li>`; }).join('')}</ul>` : '<p class="vide-parcelle">Rien de prévu ici en ' + an + '.</p>'}
        ${al.map((x) => `<p class="cp-alerte ${x.type}">${texteAlerte(x)}</p>`).join('')}
        ${amis.size ? `<p class="cp-amis">Bons voisins notés : ${[...amis].map((k) => k.split('|').map((i) => esc(culture(i)?.nom)).join(' et ')).join(' ; ')}.</p>` : ''}
        ${histo.length ? `<p class="cp-histo">${histo.map((h) => `<span><b>${h.annee}</b> ${h.familles.length ? h.familles.map((f) => esc(famille(f)?.nom || f)).join(', ') : '—'}</span>`).join('')}</p>` : ''}
      </li>`;
    }).join('');
    return `${tete}${filtres}${resume}<ul class="cartes-parcelles">${cartes}</ul>
      <p class="mention avertissement">Rotation : l'outil compare la famille botanique de chaque culture à celles cultivées sur la même parcelle ${nRot > 1 ? `les ${nRot} années précédentes` : 'l\'année précédente'} (réglable dans Réglages). Les cultures « à éloigner » et les « bons voisins » sont ceux que tu as notés sur tes cultures : l'outil n'en fournit aucun.</p>`;
  }

  // ---------- Journal et bilan des récoltes ----------
  function vueJournal() {
    const an = anneeFiltre('anJ');
    const ans = R.annees(E, auj()).filter((x) => x <= anAuj());
    const tete = `<div class="vue-tete"><div><p class="surtitre">Semis, levées, plantations, récoltes</p><h1>Journal ${an}</h1></div><div class="actions"><button class="btn primaire" data-action="noter">${ICONES.plus}Noter</button></div></div>`;
    const filtresAn = `<div class="filtres" role="group" aria-label="Année">${ans.map((x) => `<button class="filtre" data-action="an-j" data-f="${x}" aria-pressed="${x === an}">${x}</button>`).join('')}</div>`;
    if (!E.journal.length) return `${tete}${videEtat('Journal vide', 'Note un semis, une levée, une plantation ou une récolte (avec sa quantité) : le calendrier coche ce qui est fait et le bilan de la saison se construit ici.', '<button class="btn primaire" data-action="noter">Noter au journal</button>')}`;
    const b = R.bilan(E, an);
    const evol = b.kgAvant ? Math.round(((b.kg - b.kgAvant) / b.kgAvant) * 100) : null;
    const autres = [b.autres.piece ? pluriel(R.nombreFr(b.autres.piece), 'pièce') : '', b.autres.botte ? pluriel(R.nombreFr(b.autres.botte), 'botte') : '', b.autres.litre ? `${R.nombreFr(b.autres.litre)} L` : ''].filter(Boolean).join(' · ');
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Récoltes notées</p><b>${b.nb}</b><span>en ${an}</span></div>
      <div class="tuile rond" style="--c:#2E7D4F"><p class="surtitre">Poids récolté</p><b>${kg(b.kg)}</b><span>${autres || 'g et kg additionnés'}</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Cultures</p><b>${b.parCulture.length}</b><span>récoltées en ${an}</span></div>
      <div class="tuile rond" style="--c:#E58C74"><p class="surtitre">Par rapport à ${an - 1}</p><b>${evol === null ? '—' : `${evol > 0 ? '+' : ''}${evol} %`}</b><span>${b.kgAvant ? `${kg(b.kgAvant)} en ${an - 1}` : `rien de pesé en ${an - 1}`}</span></div>
    </div>`;
    const maxC = Math.max(0.001, ...b.parCulture.map((x) => x.kg));
    const valC = (x) => [x.kg ? kg(x.kg) : '', x.piece ? pluriel(R.nombreFr(x.piece), 'pièce') : '', x.botte ? pluriel(R.nombreFr(x.botte), 'botte') : '', x.litre ? `${R.nombreFr(x.litre)} L` : ''].filter(Boolean).join(' · ');
    const parCulture = b.parCulture.length ? `<div class="graphique"><div class="barres-cats">${b.parCulture.map((x) => `<div class="barre-cat"><span class="bc-nom">${esc(nomEntree({ culture: x.culture }) || 'Culture supprimée')}</span><span class="bc-piste"><span class="bc-barre" style="width:${(x.kg / maxC) * 100}%"></span></span><span class="bc-val">${valC(x)}</span></div>`).join('')}</div></div>` : '<p class="aide">Aucune récolte notée cette année.</p>';
    const maxM = Math.max(0.001, ...b.parMois);
    const iMax = b.parMois.indexOf(Math.max(...b.parMois));
    const parMois = `<div class="graphique"><div class="projection" role="img" aria-label="Poids récolté par mois en ${an}">${b.parMois.map((v, i) => `<div class="col-proj ${i === iMax && v ? 'max' : ''}"><span class="cp-val">${v ? R.nombreFr(v, v >= 10 ? 0 : 1) : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${(v / maxM) * 100}%"></span></span><span class="cp-mois">${R.INITIALES[i]}<span class="sr-only">${R.MOIS[i]}</span></span></div>`).join('')}</div>
      <p class="legende"><span><i class="lg lg-bleu"></i>kg récoltés par mois (g convertis ; pièces et bottes à part)</span></p>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Mois</th><th class="nb">kg</th></tr></thead><tbody>${b.parMois.map((v, i) => `<tr><td>${R.MOIS[i]}</td><td class="nb">${R.nombreFr(v, 2)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${R.nombreFr(b.kg, 2)}</td></tr></tfoot></table></div></details></div>`;
    const types = B.typesJournal;
    const filtresT = `<div class="filtres" role="group" aria-label="Opération"><button class="filtre" data-action="filtre-type" data-f="" aria-pressed="${!filtre.type}">Tout</button>${types.map(([k, n]) => `<button class="filtre" data-action="filtre-type" data-f="${k}" aria-pressed="${filtre.type === k}">${esc(n)}</button>`).join('')}</div>`;
    const toutes = E.journal.filter((e) => R.annee(e.date) === an && (!filtre.type || e.type === filtre.type)).sort((x, y) => y.date.localeCompare(x.date));
    const entrees = filtre.toutJ ? toutes : toutes.slice(0, 40);
    const parMoisJ = new Map();
    for (const e of entrees) { const k = e.date.slice(0, 7); if (!parMoisJ.has(k)) parMoisJ.set(k, []); parMoisJ.get(k).push(e); }
    const ETQ = { semis: 'rose', levee: 'jaune', repiquage: 'vert', plantation: 'vert', recolte: 'ciel', note: 'sable' };
    const liste = entrees.length ? [...parMoisJ.entries()].map(([k, l]) => `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">${R.MOIS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}</span><span>${pluriel(l.length, 'entrée')}</span></h2><ul class="journal">${l.map((e) => `<li><button type="button" class="j-ligne" data-action="entree" data-id="${e.id}"><span class="date-pastille"><b>${R.versDate(e.date).getDate()}</b>${R.MOIS_COURTS[R.versDate(e.date).getMonth()]}</span><span class="j-corps"><span class="j-titre"><span class="etiquette ${ETQ[e.type]}">${esc(TYPES_J[e.type])}</span><b>${esc(nomEntree(e) || (e.type === 'note' ? 'Note' : 'Culture supprimée'))}</b>${e.quantite ? ` <span class="j-qte">${esc(qteTexte(e))}</span>` : ''}</span><span class="j-detail">${[e.lieu ? LIEUX_S[e.lieu] : '', parcelle(e.parcelle)?.nom || '', e.note].filter(Boolean).map(esc).join(' · ')}</span></span></button></li>`).join('')}</ul></section>`).join('') : `<p class="aide">Aucune entrée${filtre.type ? ` « ${esc(TYPES_J[filtre.type])} »` : ''} en ${an}.</p>`;
    return `${tete}${filtresAn}
      <h2 class="titre-section">Bilan des récoltes <span>${an}</span></h2>${tuiles}
      <div class="colonnes-apercu"><section><h2 class="titre-section">Par culture</h2>${parCulture}</section><section><h2 class="titre-section">Par mois</h2>${parMois}</section></div>
      <h2 class="titre-section">Entrées <span>${pluriel(toutes.length, 'entrée')}${toutes.length > entrees.length ? `, les ${entrees.length} plus récentes affichées` : ''}</span></h2>${filtresT}${liste}${toutes.length > entrees.length ? `<p class="resume-liste"><button class="btn" data-action="tout-j">Afficher les ${toutes.length} entrées</button></p>` : ''}`;
  }

  // ---------- Cultures et familles ----------
  function vueCultures() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.cultures.length, 'culture')} · fenêtres et voisins saisis par toi</p><h1>Mes cultures</h1></div><div class="actions"><button class="btn primaire" data-action="culture">${ICONES.plus}Ajouter une culture</button></div></div>`;
    const fen = (c, k) => (c.fenetres[k] ? `<div class="fen op-bord-${k}"><dt>${esc(OP[k].court)}</dt><dd>${esc(R.texteFenetre(c.fenetres[k]))}</dd></div>` : '');
    const cartes = E.cultures.length ? `<ul class="cartes-cat">${[...E.cultures].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((c) => {
      const v = [c.amis.length ? `bons voisins : ${c.amis.map((i) => culture(i)?.nom).filter(Boolean).join(', ')}` : '', c.eloigner.length ? `à éloigner : ${c.eloigner.map((i) => culture(i)?.nom).filter(Boolean).join(', ')}` : ''].filter(Boolean).join(' · ');
      return `<li class="carte-cat"><button type="button" class="ligne-info" data-action="culture" data-id="${c.id}"><b>${pastilleFam(c.famille)}${esc(c.nom)}${c.variete ? ` <small class="aide-inline">${esc(c.variete)}</small>` : ''}</b><span class="ligne-detail">${esc(famille(c.famille)?.nom || 'Famille non précisée')}</span>
        ${R.aDesFenetres(c) ? `<dl class="fenetres">${R.OPS.map((k) => fen(c, k)).join('')}</dl>` : '<span class="ligne-alerte niv-finit">Fenêtres à saisir</span>'}
        ${v ? `<span class="ligne-detail">${esc(v)}</span>` : ''}</button></li>`;
    }).join('')}</ul>` : videEtat('Aucune culture', 'Ajoute ce que tu cultives : choisis dans la liste de 60 légumes (la famille botanique se remplit seule) ou saisis un nom libre.', '<button class="btn primaire" data-action="culture">Ajouter une culture</button>');
    const mes = new Set(E.cultures.map((c) => c.base));
    const familles = `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Familles botaniques</span><span>${B.legumes.length} légumes de la base, pour la rotation</span></h2>
      <div class="familles">${B.familles.map((f) => `<details class="famille"><summary>${pastilleFam(f.code, f.nom)}<b>${esc(f.nom)}</b>${f.ancien ? ` <small>${esc(f.ancien)}</small>` : ''}<span class="aide-inline">${B.legumes.filter((l) => l[3] === f.code).length}</span></summary><ul>${B.legumes.filter((l) => l[3] === f.code).map(([code, nom, latin]) => `<li><span>${esc(nom)} <i>${esc(latin)}</i></span>${mes.has(code) ? '<span class="etiquette vert">cultivé</span>' : `<button class="btn petit" type="button" data-action="ajout-base" data-code="${code}">Ajouter</button>`}</li>`).join('')}</ul></details>`).join('')}</div>
      <p class="aide">Base : noms courants, noms latins et familles botaniques (classification APG IV, ancien nom entre parenthèses), connaissance botanique générale. <b>Aucune période de culture ni association n'est fournie</b> : faute de source publique vérifiée et réutilisable, ce sont tes données.</p></section>`;
    return `${tete}${session.demo ? NOTE_DEMO : SANS_PERIODES}${cartes}${familles}`;
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
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const optionsQ = (v) => Array.from({ length: R.NB_Q }, (_, q) => `<option value="${q}" ${q === v ? 'selected' : ''}>${esc(R.libelleQuinzaine(q))}</option>`).join('');

  // Culture : nom (liste de la base), variété, famille, 4 fenêtres, voisins, note ; aperçu des dates réelles.
  function modaleCulture(id, depuisBase) {
    const c0 = id ? trouver('cultures', id) : null;
    const b0 = depuisBase ? B.legumes.find((l) => l[0] === depuisBase) : null;
    const c = c0 || R.normaliserCulture({ id: uid(), nom: b0?.[1] || '', famille: b0?.[3] || '', base: b0?.[0] || '' });
    if (!c0 && !b0) c.nom = '';
    const qd = R.quinzaineDe(auj());
    const autres = E.cultures.filter((x) => x.id !== c.id).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
    const imp = c0 ? R.impactCulture(E, c0.id) : null;
    const blocFen = (o) => { const f = c.fenetres[o.code]; return `<fieldset class="cadre-champs fen-champ op-bord-${o.code}"><legend><label class="case"><input type="checkbox" name="a-${o.code}" ${f ? 'checked' : ''}> ${esc(o.nom)}</label></legend>
      <div class="rang-champs" data-fen="${o.code}" ${f ? '' : 'hidden'}><label class="champ">De<select name="de-${o.code}">${optionsQ(f ? f.de : qd)}</select></label><label class="champ">À<select name="a-q-${o.code}">${optionsQ(f ? f.a : (qd + 1) % 24)}</select></label></div></fieldset>`; };
    const voisins = (cle, titre) => (autres.length ? `<fieldset class="champ"><legend>${titre}</legend><div class="cases-voisins">${autres.map((x) => `<label class="case"><input type="checkbox" name="${cle}" value="${x.id}" ${c[cle].includes(x.id) ? 'checked' : ''}> ${esc(nomCulture(x))}</label>`).join('')}</div></fieldset>` : '');
    const corps = `
      <div class="rang-champs">
        <label class="champ">Culture<input name="nom" id="m-nom" value="${esc(c.nom)}" maxlength="60" list="legumes" placeholder="Ex. : tomate" required autocomplete="off"><datalist id="legumes">${B.legumes.map((l) => `<option value="${esc(l[1])}">`).join('')}</datalist></label>
        <label class="champ">Variété <small>facultatif</small><input name="variete" value="${esc(c.variete)}" maxlength="60" placeholder="Ex. : cerise"></label>
      </div>
      <label class="champ">Famille botanique <small>sert à la rotation</small><select name="famille" id="m-famille"><option value="">Non précisée</option>${B.familles.map((f) => `<option value="${f.code}" ${c.famille === f.code ? 'selected' : ''}>${esc(f.nom)}${f.ancien ? ` (${esc(f.ancien)})` : ''}</option>`).join('')}</select></label>
      <p class="aide">Fenêtres : recopie les périodes de ton sachet de graines, de ton livre ou de ton carnet, par quinzaine. « De » après « À » : la fenêtre passe l'hiver (de novembre à mars, par exemple).</p>
      ${B.operations.map(blocFen).join('')}
      <div class="apercu" id="apercu" aria-live="polite"></div>
      ${autres.length ? `<details class="champs-aide" ${c.amis.length || c.eloigner.length ? 'open' : ''}><summary>Voisins au potager <small class="aide-inline">tes notes, aucune n'est fournie</small></summary>${voisins('amis', 'Bons voisins')}${voisins('eloigner', 'À éloigner (alerte si sur la même parcelle)')}</details>` : ''}
      <label class="champ">Note <small>facultatif</small><input name="note" value="${esc(c.note)}" maxlength="300"></label>
      ${imp && (imp.journal || imp.placements) ? `<p class="aide">Cette culture a ${pluriel(imp.journal, 'entrée')} au journal et ${pluriel(imp.placements, 'placement')} sur les parcelles. Supprimée, elle disparaît des parcelles ; le journal garde son nom.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c0 ? 'Modifier la culture' : 'Nouvelle culture', corps, PIED(!!c0), (fd, v) => {
      if (v === 'supprimer') {
        if (imp && (imp.journal || imp.placements) && !confirm(`Supprimer « ${c0.nom} » ? Elle sera retirée de ${pluriel(imp.placements, 'placement')} ; le journal garde son nom.`)) { modale().dataset.garder = '1'; return undefined; }
        retenir(); E = R.supprimerCulture(E, c0.id); sauver(); rendre();
        toast('Culture supprimée.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const n = lire(fd);
      const err = R.validerCulture(E, n, fd.get('nom'));
      if (err) return err;
      retenir();
      const i = E.cultures.findIndex((x) => x.id === n.id);
      if (i >= 0) E.cultures[i] = n; else E.cultures.push(n);
      sauver(); rendre();
      toast(c0 ? 'Culture modifiée.' : `« ${n.nom} » ajoutée.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    function lire(fd) {
      const nom = String(fd.get('nom') || '').trim();
      const b = B.legumes.find((l) => R.plat(l[1]) === R.plat(nom));
      const fenetres = Object.fromEntries(R.OPS.map((k) => [k, fd.get(`a-${k}`) === 'on' ? { de: Number(fd.get(`de-${k}`)), a: Number(fd.get(`a-q-${k}`)) } : null]));
      return R.normaliserCulture({ ...c, nom, variete: fd.get('variete'), famille: fd.get('famille'), base: b?.[0] || '', fenetres, amis: fd.getAll('amis'), eloigner: fd.getAll('eloigner').filter((x) => !fd.getAll('amis').includes(x)), note: fd.get('note') });
    }
    const maj = () => {
      const fd = new FormData(f);
      for (const k of R.OPS) f.querySelector(`[data-fen="${k}"]`).hidden = fd.get(`a-${k}`) !== 'on';
      const n = lire(fd);
      const an = anAuj();
      const l = R.OPS.filter((k) => n.fenetres[k]).map((k) => {
        const o = R.occurrence(n.fenetres[k], R.occurrence(n.fenetres[k], an, dec()).fin < auj() ? an + 1 : an, dec());
        return `<li>${etiquetteOp(k)} ${esc(periodeTexte(o))}${R.passeAnnee(n.fenetres[k]) ? ' <small class="aide-inline">passe l\'hiver</small>' : ''}</li>`;
      });
      $('#apercu').innerHTML = l.length ? `<p><b>Prochaines dates réelles</b>${dec() ? ` (décalage ${dec() > 0 ? '+' : ''}${dec()} sem.)` : ''} :</p><ul class="apercu-liste">${l.join('')}</ul>` : '<p>Aucune fenêtre : coche une opération pour la placer dans le calendrier.</p>';
    };
    // Nom pris dans la base : famille proposée.
    $('#m-nom').addEventListener('change', (e) => { const b = B.legumes.find((l) => R.plat(l[1]) === R.plat(e.target.value)); if (b && !$('#m-famille').value) $('#m-famille').value = b[3]; });
    $('#m-nom').addEventListener('input', (e) => { const b = B.legumes.find((l) => R.plat(l[1]) === R.plat(e.target.value)); if (b && !c0) $('#m-famille').value = b[3]; });
    f.addEventListener('input', maj);
    f.addEventListener('change', maj);
    maj();
  }

  function modaleParcelle(id) {
    const p0 = id ? trouver('parcelles', id) : null;
    const p = p0 || { nom: `Planche ${E.parcelles.length + 1}`, type: 'planche', surface: 0, note: '' };
    const n = p0 ? E.placements.filter((x) => x.parcelle === p0.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" value="${esc(p.nom)}" maxlength="60" required></label>
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut trois">${Object.entries(B.typesParcelle).map(([k, v]) => `<label><input type="radio" name="type" value="${k}" ${p.type === k ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs"><label class="champ">Surface <small>facultatif, en m²</small><input name="surface" inputmode="decimal" value="${p.surface ? esc(R.nombreFr(p.surface)) : ''}"></label><label class="champ">Note <small>facultatif</small><input name="note" value="${esc(p.note)}" maxlength="200"></label></div>
      ${n ? `<p class="aide">${pluriel(n, 'placement')} sur cette parcelle (toutes années) : la supprimer les retire aussi.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p0 ? 'Modifier la parcelle' : 'Nouvelle parcelle', corps, PIED(!!p0), (fd, v) => {
      if (v === 'supprimer') {
        if (n && !confirm(`Supprimer « ${p0.nom} » et ses ${pluriel(n, 'placement')} ?`)) { modale().dataset.garder = '1'; return undefined; }
        retenir(); E = R.supprimerParcelle(E, p0.id); sauver(); rendre(); toast('Parcelle supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined;
      }
      if (!String(fd.get('nom') || '').trim()) return 'Donne un nom à la parcelle.';
      const s = String(fd.get('surface') || '').trim();
      if (s && !(Number(s.replace(',', '.')) >= 0)) return 'Surface invalide.';
      retenir();
      const np = R.normaliserParcelle({ id: p0?.id || uid(), nom: fd.get('nom'), type: fd.get('type'), surface: s, note: fd.get('note') });
      if (p0) E.parcelles[E.parcelles.findIndex((x) => x.id === p0.id)] = np; else E.parcelles.push(np);
      sauver(); rendre(); toast(p0 ? 'Parcelle modifiée.' : 'Parcelle ajoutée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // Placement : une culture sur une parcelle une année, avec l'aperçu des alertes avant d'enregistrer.
  function modalePlacement(parcelleId) {
    if (!E.parcelles.length) { toast('Ajoute d\'abord une parcelle.'); return; }
    if (!E.cultures.length) { toast('Ajoute d\'abord une culture (onglet Cultures).'); return; }
    const an = anneeFiltre('anParc');
    const tri = [...E.cultures].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
    const corps = `
      <div class="rang-champs">
        <label class="champ">Parcelle<select name="parcelle">${E.parcelles.map((p) => `<option value="${p.id}" ${p.id === parcelleId ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Année<input name="annee" type="number" min="1900" max="2200" inputmode="numeric" value="${an}"></label>
      </div>
      <label class="champ">Culture<select name="culture">${tri.map((c) => `<option value="${c.id}">${esc(nomCulture(c))}${c.famille ? ` · ${esc(famille(c.famille)?.nom || '')}` : ''}</option>`).join('')}</select></label>
      <div class="apercu" id="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Placer une culture', corps, '<button class="btn primaire" value="ok">Placer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = R.placer(E, { parcelle: fd.get('parcelle'), culture: fd.get('culture'), annee: R.entier(fd.get('annee'), 1900, 2200, an) });
      if (r.doublon) return 'Cette culture est déjà sur cette parcelle cette année-là.';
      if (!r.ajoute) return 'Choisis une parcelle et une culture.';
      retenir(); E = r.etat; filtre.anParc = r.placement.annee; sauver(); rendre();
      const al = R.alertesAnnee(E, r.placement.annee).filter((x) => x.placement === r.placement.id || x.culture === r.placement.culture);
      toast(`« ${culture(r.placement.culture).nom} » placée sur ${parcelle(r.placement.parcelle).nom}${al.length ? ` : ${pluriel(al.length, 'alerte')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    const maj = () => {
      const fd = new FormData(f);
      const essai = R.placer(E, { parcelle: fd.get('parcelle'), culture: fd.get('culture'), annee: R.entier(fd.get('annee'), 1900, 2200, an) });
      const el = $('#apercu');
      if (essai.doublon) { el.innerHTML = '<p class="cd-alerte">Déjà placée ici cette année-là.</p>'; return; }
      if (!essai.ajoute) { el.innerHTML = ''; return; }
      const e2 = essai.etat, p = essai.placement;
      const rot = R.alertesRotation(e2, p);
      const v = R.voisinage(e2, p);
      const l = [
        ...rot.map((x) => `<p class="cd-alerte">Rotation : ${esc(famille(x.famille)?.nom || 'même famille')}, comme ${esc(nomCulture(R.cultureDe(e2, x.culture)))} ici en ${x.annee}.</p>`),
        ...v.eloigner.map((x) => `<p class="cd-alerte">À éloigner de ${esc(nomCulture(R.cultureDe(e2, x)))}, déjà sur cette parcelle.</p>`),
        ...v.amis.map((x) => `<p>Bon voisin : ${esc(nomCulture(R.cultureDe(e2, x)))}.</p>`),
      ];
      el.innerHTML = l.length ? l.join('') : `<p>Aucune alerte : pas de même famille ici ${E.reglages.rotation > 1 ? `ces ${E.reglages.rotation} dernières années` : 'l\'année précédente'}.</p>`;
    };
    f.addEventListener('input', maj); f.addEventListener('change', maj); maj();
  }

  // Entrée du journal : création (préremplie depuis « Cette semaine ») ou modification.
  function modaleEntree(id, pre = {}) {
    if (!E.cultures.length && !id) { toast('Ajoute d\'abord une culture (onglet Cultures).'); return; }
    const e0 = id ? trouver('journal', id) : null;
    const opVersType = { semisAbri: ['semis', 'abri'], semisPleine: ['semis', 'pleine'], plantation: ['plantation', ''], recolte: ['recolte', ''] };
    const [t0, l0] = opVersType[pre.op] || ['semis', ''];
    const ouEst = (cid) => E.placements.find((p) => p.culture === cid && p.annee === anAuj())?.parcelle || '';
    const e = e0 || { date: auj(), type: t0, culture: pre.culture || '', parcelle: pre.culture ? ouEst(pre.culture) : '', lieu: l0, quantite: 0, unite: 'kg', note: '' };
    const tri = [...E.cultures].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
    const corps = `
      <fieldset class="champ"><legend>Opération</legend><div class="choix-statut trois">${B.typesJournal.map(([k, n]) => `<label><input type="radio" name="type" value="${k}" ${e.type === k ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Date<input name="date" type="date" value="${e.date}" required></label>
        <label class="champ">Culture<select name="culture" id="m-culture"><option value="">${e0 && !e0.culture && e0.nomCulture ? esc(e0.nomCulture) + ' (supprimée)' : '—'}</option>${tri.map((c) => `<option value="${c.id}" ${c.id === e.culture ? 'selected' : ''}>${esc(nomCulture(c))}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Parcelle <small>facultatif</small><select name="parcelle" id="m-parcelle"><option value="">—</option>${E.parcelles.map((p) => `<option value="${p.id}" ${p.id === e.parcelle ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ" id="bloc-lieu">Semé<select name="lieu"><option value="">Non précisé</option>${B.lieuxSemis.map(([k, n]) => `<option value="${k}" ${e.lieu === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs" id="bloc-qte">
        <label class="champ">Quantité récoltée<input name="quantite" inputmode="decimal" value="${e.quantite ? esc(R.nombreFr(e.quantite, 3)) : ''}" placeholder="Ex. : 1,5"></label>
        <label class="champ">Unité<select name="unite">${B.unites.map(([k, n]) => `<option value="${k}" ${e.unite === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Note <small>facultatif</small><input name="note" value="${esc(e.note)}" maxlength="300" placeholder="Ex. : levée irrégulière, arrosé"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e0 ? 'Modifier l\'entrée' : 'Noter au journal', corps, PIED(!!e0), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.journal = E.journal.filter((x) => x.id !== e0.id); sauver(); rendre(); toast('Entrée supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      const q = String(fd.get('quantite') || '').trim();
      if (fd.get('type') === 'recolte' && q && !(Number(q.replace(',', '.')) >= 0)) return 'Quantité invalide.';
      const n = R.normaliserEntree({ ...(e0 || {}), id: e0?.id || uid(), date: fd.get('date'), type: fd.get('type'), culture: fd.get('culture'), parcelle: fd.get('parcelle'), lieu: fd.get('lieu'), quantite: q, unite: fd.get('unite'), note: fd.get('note') });
      const err = R.validerEntree(E, n);
      if (err) return err;
      retenir();
      const i = E.journal.findIndex((x) => x.id === n.id);
      if (i >= 0) E.journal[i] = n; else E.journal.push(n);
      sauver(); rendre();
      toast(e0 ? 'Entrée modifiée.' : `${TYPES_J[n.type]}${nomEntree(n) ? ` de ${nomEntree(n).toLowerCase()}` : ''} noté${n.type === 'note' || n.type === 'levee' || n.type === 'plantation' || n.type === 'recolte' ? 'e' : ''}${n.quantite ? ` : ${qteTexte(n)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    const maj = () => {
      const fd = new FormData(f);
      $('#bloc-lieu').hidden = fd.get('type') !== 'semis';
      $('#bloc-qte').hidden = fd.get('type') !== 'recolte';
    };
    $('#m-culture').addEventListener('change', (ev) => { const p = ouEst(ev.target.value); if (p && !$('#m-parcelle').value) $('#m-parcelle').value = p; });
    f.addEventListener('change', maj); maj();
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const corps = `
      <label class="champ">Nom du jardin<small>facultatif</small><input name="jardin" value="${esc(E.reglages.jardin)}" maxlength="60"></label>
      <div class="rang-champs">
        <label class="champ">Décalage <small>en semaines, de −8 à +8 : + si tes dates arrivent plus tard que celles de tes fenêtres</small><input name="decalage" type="number" min="-8" max="8" inputmode="numeric" value="${E.reglages.decalage}"></label>
        <label class="champ">Rotation <small>années sans remettre une même famille au même endroit (1 à 5)</small><input name="rotation" type="number" min="1" max="5" inputmode="numeric" value="${E.reglages.rotation}"></label>
      </div>
      <p class="aide">Le décalage est le tien : l'outil ne contient aucun zonage climatique. Par exemple, si tu sèmes d'habitude deux semaines après la date du sachet, règle +2.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-cultures">Cultures et fenêtres</button><button class="btn petit" type="button" data-action="csv-journal">Journal</button><button class="btn petit" type="button" data-action="csv-parcelles">Plan des parcelles</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton potager est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${Math.round(t / 1000)} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte puis retire le journal ancien.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer le journal avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le calendrier à ton écran d'accueil pour l'ouvrir comme une application, au jardin.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Base intégrée : ${B.legumes.length} légumes avec leur nom latin et leur famille botanique (classification APG IV), connaissance botanique générale. Aucune période de semis, de plantation ou de récolte et aucune association ne sont fournies : la seule source publique française trouvée (fiche d'une direction régionale de l'agriculture, consultée le 14/11/2026) n'indiquait pas clairement une licence de réutilisation ; les fenêtres et les voisins sont donc les tiens. Aucune météo, aucun service externe, aucune connexion à une autre application.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      E.reglages = R.normaliserReglages({ ...E.reglages, jardin: fd.get('jardin'), decalage: fd.get('decalage'), rotation: fd.get('rotation') });
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.cultures) || !Array.isArray(donnees.journal)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.cultures.length, 'culture')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du calendrier du potager.'); }
    });
  }
  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.journal.filter((x) => x.date < d).length;
    if (!n) { toast('Aucune entrée avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'entrée')} antérieure${n > 1 ? 's' : ''} au ${R.dateFrLongue(d)} ? Pense à exporter le journal en CSV avant.`)) return;
    retenir();
    E = R.purgerAvant(E, d).etat;
    modale().close(); sauver(); rendre();
    toast(`${pluriel(n, 'entrée retirée', 'entrées retirées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `potager-${auj()}.json`);
  const CSV = 'text/csv;charset=utf-8';

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
      <p>Enregistre ton calendrier du potager sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-cultures': telecharger(R.csvCultures(E, B), CSV, `cultures-${auj()}.csv`); break;
      case 'csv-journal': telecharger(R.csvJournal(E, B), CSV, `journal-potager-${auj()}.csv`); break;
      case 'csv-parcelles': telecharger(R.csvParcelles(E, B), CSV, `parcelles-${auj()}.csv`); break;
      case 'purger': purger(); break;
      case 'fermer': modale().close(); break;
      case 'imprimer': window.print(); break;
      case 'culture': if (modale().open) modale().close(); modaleCulture(id || null); break;
      case 'ajout-base': modaleCulture(null, el.dataset.code); break;
      case 'parcelle': if (modale().open) modale().close(); modaleParcelle(id || null); break;
      case 'placer': modalePlacement(el.dataset.parcelle || ''); break;
      case 'suppr-placement': retenir(); E.placements = E.placements.filter((p) => p.id !== id); sauver(); rendre(); toast('Culture retirée de la parcelle.', { libelle: 'Annuler', faire: annuler }); break;
      case 'noter': modaleEntree(null, { culture: el.dataset.culture, op: el.dataset.op }); break;
      case 'entree': modaleEntree(id); break;
      case 'filtre-op': filtre.op = el.dataset.f; sauverPref(); rendre(); break;
      case 'filtre-type': filtre.type = el.dataset.f; filtre.toutJ = false; rendre(); break;
      case 'an-cal': filtre.anCal = anneeFiltre('anCal') + Number(el.dataset.d); rendre(); break;
      case 'an-parc': filtre.anParc = Number(el.dataset.f); rendre(); break;
      case 'an-j': filtre.anJ = Number(el.dataset.f); filtre.toutJ = false; rendre(); break;
      case 'tout-j': filtre.toutJ = true; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // le jour a pu changer : semaine recalculée
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
  window.__ptg = { etat: () => E, regles: R };
  init();
})();
