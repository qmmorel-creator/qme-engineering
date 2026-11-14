// Carnet de voiture QME : entretiens faits et à venir (date ou kilométrage, la première atteinte),
// contrôle technique, kilométrage, dépenses, consommation plein à plein, coût au km, historique imprimable.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CAR;
  const API = '/api/templates';
  const PRODUIT = 'CAR';
  const CLE_CODE = 'qme-car-code';
  const CLE_CACHE = 'qme-car-cache';
  const CLE_DEMO = 'qme-car-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-car-ecran-accueil';

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
  const { ajout, ajoutMois, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const euros = (n, dec = 2) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec });
  const eurosRond = (n) => euros(n, Math.abs(n) >= 100 ? 0 : 2);
  const km = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} km`;
  const dec = (n, d = 1) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const vide = (x) => x === null || x === undefined || x === '';
  const quand = (s) => { const n = ecart(s, auj()); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : n > 0 ? `il y a ${pluriel(n, 'jour')}` : `dans ${pluriel(-n, 'jour')}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const filtre = { vehicule: '', periode: '12m', groupe: '', tout: false };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const vehicule = (id) => E.vehicules.find((v) => v.id === id);
  const actives = () => E.vehicules.filter((v) => v.actif !== false);
  const nomV = (id) => { const v = vehicule(id); return v ? v.nom : 'Voiture supprimée'; };
  const energie = (code) => R.energieDe(B, code).nom;
  const categorie = (c) => B.categories.find((x) => x.code === c);
  const synth = (v) => R.syntheseVehicule(E, B, v, auj());
  const alerteRg = () => ({ jours: E.reglages.alerteJours, km: E.reglages.alerteKm });
  // Voiture choisie dans le filtre (si elle existe encore), sinon toutes.
  const choisie = () => (filtre.vehicule && vehicule(filtre.vehicule) ? filtre.vehicule : '');

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
        toast('Un autre appareil a modifié le carnet entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (CAR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Foyer fictif, 3 voitures en service et 1 vendue, sans marque ni modèle, plaques fictives évidentes.
  // Historique simulé à des dates relatives à aujourd'hui, couvrant tous les états : vidange en retard
  // (date dépassée), contrôle technique proche, contre-visite à faire, pneus proches au kilométrage,
  // kilométrage à mettre à jour, consommation essence, diesel et électrique. Prix saisis, fictifs.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n) => ajoutMois(t, n);
    const v = (x) => { const o = R.normaliserVehicule({ id: uid(), ...x }, B); e.vehicules.push(o); return o; };
    const kmLe = (o, ratio, date) => Math.round(o.kmAchat + ratio * ecart(o.achat, date));
    const dep = (o, date, categorie, montant, extra = {}) => date <= t && e.depenses.push(R.normaliserDepense({ id: uid(), vehiculeId: o.id, date, categorie, montant, ...extra }, B));
    const ent = (o, date, ops, cout, garage, extra = {}) => e.entretiens.push(R.normaliserEntretien({ id: uid(), vehiculeId: o.id, date, km: extra.km ?? kmLe(o, extra.ratio, date), operations: ops, cout, garage, note: extra.note || '' }));
    const ct = (o, date, resultat, cout, extra = {}) => e.controles.push(R.normaliserControle({ id: uid(), vehiculeId: o.id, date, km: extra.km ?? kmLe(o, extra.ratio, date), nature: extra.nature || 'periodique', resultat, cout, centre: extra.centre || 'Centre de contrôle' }));
    // Variation déterministe (pas de hasard : la démo est la même à chaque ouverture du jour).
    const vari = (k, amp) => Math.sin(k * 2.17) * amp;

    // 1. Citadine essence : la voiture du quotidien.
    const cit = v({ nom: 'Citadine essence', immat: 'AA-123-AA', energie: 'ES', miseEnCirculation: m(-74), achat: m(-36), kmAchat: 52000, notes: 'Pneus été, roue de secours sous le coffre.' });
    const rc = 30 / 1; // ≈ 900 km par mois
    for (let k = 0, d = j(-420); d <= j(-3); k++, d = ajout(d, 14 + (k % 3))) {
      const litres = Math.round((31 + vari(k, 3)) * 10) / 10;
      dep(cit, d, 'CAR', Math.round(litres * (1.82 + vari(k + 1, 0.06)) * 100) / 100, { quantite: litres, km: kmLe(cit, rc, d) + Math.round(vari(k, 30)), plein: true, libelle: 'Plein' });
    }
    ent(cit, m(-13), ['VID'], 89, 'Centre auto', { ratio: rc, note: 'Vidange rapide' });
    ent(cit, m(-10), ['REV', 'FHA', 'FRE', 'PNE'], 245, 'Garage du centre', { ratio: rc, note: 'Révision annuelle' });
    ent(cit, m(-22), ['LDF', 'CLI', 'BAT'], 140, 'Garage du centre', { ratio: rc });
    ent(cit, m(-20), ['FAI', 'LDR'], 95, 'Garage du centre', { ratio: rc });
    ct(cit, ajout(m(-24), 18), 'favorable', 78, { ratio: rc });
    for (let k = 0; k < 13; k++) dep(cit, ajout(m(-k), -(Number(t.slice(8, 10)) - 5)), 'ASS', 41.5, { libelle: 'Assurance mensuelle' });
    dep(cit, j(-40), 'STA', 18, { libelle: 'Parking gare, 3 jours' });
    dep(cit, j(-95), 'PEA', 23.4, { libelle: 'Vacances' });
    dep(cit, j(-88), 'PEA', 23.4, { libelle: 'Vacances, retour' });
    dep(cit, j(-150), 'AUT', 12, { libelle: 'Lavage' });
    dep(cit, j(-200), 'REP', 186, { libelle: 'Remplacement d\'un phare' });

    // 2. Break diesel : grands trajets ; pneus proches au kilométrage, relevé ancien.
    const brk = v({ nom: 'Break diesel', immat: 'BB-456-BB', energie: 'GO', miseEnCirculation: m(-30), achat: m(-30), kmAchat: 10 });
    const rb = 50; // ≈ 1 500 km par mois
    const finBrk = j(-68);
    for (let k = 0, d = j(-400); d <= finBrk; k++, d = ajout(d, 19 + (k % 4))) {
      const litres = Math.round((56 + vari(k, 4)) * 10) / 10;
      dep(brk, d, 'CAR', Math.round(litres * (1.71 + vari(k + 2, 0.05)) * 100) / 100, { quantite: litres, km: kmLe(brk, rb, d) + Math.round(vari(k, 40)), plein: true, libelle: 'Plein' });
    }
    ent(brk, m(-19), ['LDF', 'CLI', 'BAT', 'FAI'], 165, 'Atelier de la zone', { ratio: rb });
    ent(brk, m(-7), ['REV', 'VID', 'FHA', 'FRE'], 310, 'Atelier de la zone', { ratio: rb });
    ent(brk, ajout(finBrk, -172), ['PNE'], 0, 'Centre pneus', { ratio: rb, note: 'Montage et équilibrage' });
    dep(brk, ajout(finBrk, -172), 'PNE', 520, { libelle: '4 pneus toutes saisons' });
    dep(brk, m(-4), 'ASS', 620, { libelle: 'Assurance annuelle' });
    dep(brk, j(-75), 'REP', 380, { libelle: 'Pare-brise' });
    dep(brk, j(-110), 'PEA', 64.8, { libelle: 'Autoroute, aller-retour' });

    // 3. Compacte électrique : recharges en kWh ; contre-visite à faire.
    const ele = v({ nom: 'Compacte électrique', immat: 'CC-789-CC', energie: 'EL', miseEnCirculation: m(-51), achat: m(-12), kmAchat: 38000, ctDernier: ajout(m(-24), -20) });
    const re = 33; // ≈ 1 000 km par mois
    for (let k = 0, d = ajout(m(-12), 6); d <= j(-1); k++, d = ajout(d, 6 + (k % 3))) {
      const rapide = k % 9 === 4;
      const kwh = Math.round((rapide ? 38 : 31 + vari(k, 4)) * 10) / 10;
      dep(ele, d, 'REC', Math.round(kwh * (rapide ? 0.49 : 0.21) * 100) / 100, { quantite: kwh, km: kmLe(ele, re, d) + Math.round(vari(k, 20)), plein: true, libelle: rapide ? 'Borne rapide' : 'Recharge à domicile' });
    }
    ent(ele, m(-5), ['REV', 'FHA', 'FRE', 'PNE'], 145, 'Garage du centre', { ratio: re });
    ct(ele, j(-36), 'majeure', 78, { ratio: re });
    dep(ele, m(-12), 'ASS', 540, { libelle: 'Assurance annuelle' });
    for (let k = 0; k < 12; k++) dep(ele, ajout(m(-k), -2), 'FIN', 189, { libelle: 'Mensualité du crédit' });
    dep(ele, j(-20), 'STA', 6.5, { libelle: 'Stationnement centre-ville' });

    // 4. Ancienne voiture vendue : gardée pour son historique.
    const anc = v({ nom: 'Ancienne citadine diesel', immat: 'DD-000-DD', energie: 'GO', miseEnCirculation: m(-140), achat: m(-60), kmAchat: 98000, actif: false, venteLe: m(-8) });
    ent(anc, m(-20), ['REV', 'VID', 'FAI'], 230, 'Garage du centre', { ratio: 25 });
    ent(anc, m(-44), ['DIS', 'LDR'], 690, 'Garage du centre', { ratio: 25, note: 'Kit de distribution et pompe à eau' });
    ct(anc, m(-26), 'favorable', 75, { ratio: 25 });
    e.releves.push(R.normaliserReleve({ id: uid(), vehiculeId: anc.id, date: m(-8), km: kmLe(anc, 25, m(-8)) }));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Carnet de voiture · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <circle cx="360" cy="230" r="50" fill="#141414"/>
          <circle cx="500" cy="230" r="50" fill="#141414"/>
          <circle cx="360" cy="230" r="18" fill="#F0EDE6"/>
          <circle cx="500" cy="230" r="18" fill="#F0EDE6"/>
          <path d="M310 200 L350 110 H500 L540 200 Z" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Carnet de voiture</p>
          <h1>Ta voiture, entretenue à temps.</h1>
          <p>Les entretiens à faire selon la date ou le kilométrage, le contrôle technique, chaque plein et chaque dépense, et ce que ta voiture te coûte vraiment au kilomètre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton carnet de voiture</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton carnet est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon carnet</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/voiture/">Voir le carnet de voiture</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon carnet'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', immat: '', energie: 'ES', miseEnCirculation: '', km: '', ctDernier: '' });
  let accueil = accueilVide();
  const optionsEnergie = (val) => B.energies.map((x) => `<option value="${x.code}" ${x.code === val ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton carnet de voiture, en deux minutes.</h1>
        <p class="intro">Tu notes ta voiture, puis au fil de l'eau tes pleins, tes entretiens et tes dépenses : le carnet calcule les prochaines échéances (à la date ou au kilométrage, la première atteinte), le contrôle technique, ta consommation et ton coût au kilomètre.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta première voiture</h1>
        <p class="intro">Le kilométrage d'aujourd'hui sert de point de départ. Tu ajouteras d'autres voitures ensuite, dans l'onglet Voitures.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Nom de la voiture<small>Comme tu l'appelles : « La petite », « Break »…</small><input id="a-nom" value="${esc(a.nom)}" maxlength="60" placeholder="Ma voiture"></label>
            <label class="champ">Immatriculation<small>Facultatif.</small><input id="a-immat" value="${esc(a.immat)}" maxlength="16" autocapitalize="characters" placeholder="AA-123-AA"></label>
          </div>
          <div class="rang-champs">
            <label class="champ">Énergie<select id="a-energie">${optionsEnergie(a.energie)}</select></label>
            <label class="champ">1re mise en circulation<small>Sur la carte grise (case B).</small><input id="a-mec" type="date" value="${a.miseEnCirculation}"></label>
          </div>
          <div class="rang-champs">
            <label class="champ">Kilométrage aujourd'hui<input id="a-km" inputmode="numeric" value="${esc(a.km)}" placeholder="Ex. : 48 500"></label>
            <label class="champ">Dernier contrôle technique<small>Facultatif : sinon, l'échéance part de la mise en circulation.</small><input id="a-ct" type="date" value="${a.ctDernier}"></label>
          </div>
          <p class="erreur" role="alert">${esc(erreur)}</p>
          <p class="aide">Un plan d'entretien indicatif est proposé selon l'énergie. <b>Le carnet d'entretien du constructeur prime</b> : recopie ses intervalles dans l'onglet Entretiens.</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon carnet</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-immat', 'immat'); lier('#a-km', 'km'); lier('#a-mec', 'miseEnCirculation'); lier('#a-ct', 'ctDernier');
    $('#a-energie')?.addEventListener('change', (e) => { accueil.energie = e.target.value; });
  }

  function terminerAccueil() {
    const a = accueil;
    const k = R.lireNombre(a.km);
    if (k === null) return ecranAccueil('Indique le kilométrage du compteur aujourd\'hui (en chiffres).');
    if (a.miseEnCirculation && (!R.estDate(a.miseEnCirculation) || a.miseEnCirculation > auj())) return ecranAccueil('Date de mise en circulation illisible ou future.');
    E = etatVide();
    E.vehicules.push(R.normaliserVehicule({ id: uid(), nom: a.nom.trim() || 'Ma voiture', immat: a.immat, energie: a.energie, miseEnCirculation: a.miseEnCirculation || null, achat: auj(), kmAchat: Math.round(k), ctDernier: a.ctDernier || null }, B));
    accueil = accueilVide();
    vue = 'entretiens';
    sauver();
    demarrer();
    toast('Ton carnet est prêt. Vérifie le plan d\'entretien avec le carnet du constructeur.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    entretiens: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    depenses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    voitures: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['entretiens', 'Entretiens'], ['depenses', 'Dépenses'], ['voitures', 'Voitures']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide au suivi : ce n\'est ni un conseil mécanique ni un conseil financier. Le plan d\'entretien proposé est indicatif et <b>le carnet d\'entretien du constructeur prime</b>. Les échéances du contrôle technique suivent les règles des Réglages (source et date de vérification indiquées) ; les coûts sont calculés à partir de ta saisie, sans prix intégré.</p>';
  const ETATS = { retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], ok: ['vert', 'À jour'], sans: ['sable', 'Sans échéance'] };
  const etiquetteEtat = (et) => `<span class="etiquette ${ETATS[et][0]}">${ETATS[et][1]}</span>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/voiture/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Carnet de<br>voiture</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Carnet de voiture`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, entretiens: vueEntretiens, depenses: vueDepenses, voitures: vueVoitures }[vue]();
    brancherInfobulles();
    $('#filtre-voiture')?.addEventListener('change', (e) => { filtre.vehicule = e.target.value; rendre(); });
    $('#filtre-periode')?.addEventListener('change', (e) => { filtre.periode = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur de voiture commun aux vues (toutes, ou une seule).
  function choixVoiture() {
    const vs = E.vehicules;
    if (vs.length < 2) return '';
    return `<label class="champ choix-voiture"><span class="sr-only">Voiture</span><select id="filtre-voiture"><option value="">Toutes les voitures</option>${vs.map((v) => `<option value="${v.id}" ${choisie() === v.id ? 'selected' : ''}>${esc(v.nom)}${v.actif === false ? ' (vendue)' : ''}</option>`).join('')}</select></label>`;
  }
  const plaque = (v) => (v.immat ? `<span class="plaque">${esc(v.immat)}</span>` : '');
  // « à 65 000 km ou le 01/03/2027 » pour une échéance d'entretien.
  function texteEcheance(e) {
    const p = [];
    if (e.echKm !== null) p.push(`à ${km(e.echKm)}`);
    if (e.echDate) p.push(`le ${dateCourte(e.echDate)}`);
    return p.join(' ou ');
  }
  function detailRestant(e) {
    const p = [];
    if (e.kmRestant !== null) p.push(e.kmRestant <= 0 ? `dépassé de ${km(-e.kmRestant)}` : `encore ${km(e.kmRestant)}`);
    if (e.joursRestant !== null) p.push(e.joursRestant < 0 ? `date passée depuis ${pluriel(-e.joursRestant, 'jour')}` : e.joursRestant === 0 ? 'aujourd\'hui' : `dans ${pluriel(e.joursRestant, 'jour')}`);
    if (e.dateKm && e.echKm !== null && e.kmRestant > 0) p.push(`km atteint vers le ${dateCourte(e.dateKm)}`);
    return p.join(' · ');
  }
  function texteCT(s) {
    const c = s.ct;
    if (c.nature === 'aucune') return 'Échéance non calculée : indique la mise en circulation ou la périodicité';
    if (c.nature === 'contre-visite') return `Contre-visite au plus tard le ${dateCourte(c.echeance)}${c.critique ? ' · défaillance critique : ne plus circuler avant réparation' : ''}`;
    return `${c.premier ? 'Premier contrôle' : 'Prochain contrôle'} au plus tard le ${dateCourte(c.echeance)}${c.des && c.des > auj() ? `, possible dès le ${dateCourte(c.des)}` : ''}`;
  }

  // ---------- Tableau de bord ----------
  function periode12() { const t = auj(); return [ajout(ajoutMois(t, -12), 1), t]; }

  function vueBord() {
    const t = auj();
    const vid = choisie();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>Ce qui est à faire, et ce que ${vid ? 'cette voiture' : 'tes voitures'} te coûte${vid ? '' : 'nt'}.</p></div>
        <div class="actions">${choixVoiture()}<button class="btn" data-action="releve">Relevé km</button><button class="btn primaire" data-action="depense">${ICONES.plus}Plein ou dépense</button></div></div>`;
    if (!E.vehicules.length) return `${titre}${videEtat('Aucune voiture pour l\'instant', 'Ajoute ta voiture : son kilométrage, sa mise en circulation et son énergie suffisent pour calculer les échéances.', `<button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter une voiture</button>`)}${AVERTISSEMENT}`;
    const al = R.alertes(E, B, t).filter((a) => !vid || a.vehiculeId === vid);
    const [du, au] = periode12();
    const c = R.couts(E, B, vid || null, du, au);
    const retards = al.filter((a) => a.etat === 'retard').length;
    const tuiles = [
      ['À faire', String(retards), retards ? 'en retard' : 'rien en retard', 'var(--rouge)', 'rond'],
      ['Bientôt', String(al.length - retards), `dans les ${E.reglages.alerteJours} jours ou ${km(E.reglages.alerteKm)}`, 'var(--jaune)', ''],
      ['Coût mensuel', eurosRond(c.coutMensuel), 'moyenne des 12 derniers mois', 'var(--bleu)', 'rond'],
      ['Coût au km', c.coutKm === null ? '–' : euros(c.coutKm), c.coutKm === null ? 'pas encore assez de km' : `sur ${km(c.km)} parcourus`, 'var(--encre)', ''],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const vs = (vid ? [vehicule(vid)] : actives());
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>${pluriel(al.length, 'échéance')}</span></h2>
          ${al.length ? `<ul class="alertes-liste">${al.map(ligneAlerte).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Tout est à jour</h3><p>Les entretiens et le contrôle technique apparaissent ici quand leur échéance approche (date ou kilométrage).</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">${vid ? 'La voiture' : 'Mes voitures'}</h2>
          <ul class="mini-voitures">${vs.map(miniVoiture).join('')}</ul>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function ligneAlerte(a) {
    const v = vehicule(a.vehiculeId);
    const action = a.type === 'entretien' ? `data-action="entretien" data-vehicule="${a.vehiculeId}" data-op="${a.refId}"` : a.type === 'ct' ? `data-action="controle" data-vehicule="${a.vehiculeId}" data-nature="${a.refId === 'contre-visite' ? 'contre-visite' : 'periodique'}"` : `data-action="releve" data-vehicule="${a.vehiculeId}"`;
    const bouton = a.type === 'releve' ? 'Noter' : 'C\'est fait';
    return `<li class="${a.etat}"><span class="date-pastille ${a.etat === 'retard' ? 'alerte' : ''}"><b>${versDate(a.date).getDate()}</b>${fmt(a.date, { month: 'short' }).replace('.', '')}</span>
      <div class="lien-ligne"><b>${esc(a.titre)}</b><span>${esc(v?.nom || '')} · ${esc(a.detail)}</span></div>
      <span class="alerte-droite">${etiquetteEtat(a.etat)}<button class="btn petit" ${action}>${bouton}</button></span></li>`;
  }

  function miniVoiture(v) {
    const s = synth(v);
    const conso = R.categoriesEnergie(B, v.energie).map((cat) => { const c = R.consommation(E.depenses, v.id, cat); return c.moyenne === null ? '' : `${dec(c.moyenne)} ${c.unite}/100 km`; }).filter(Boolean).join(' · ');
    const p = s.prochain;
    return `<li style="--c:${s.pire === 'retard' ? 'var(--rouge)' : s.pire === 'proche' ? 'var(--jaune)' : 'var(--vert)'}">
      <button class="lien-ligne" data-action="aller-voiture" data-id="${v.id}"><b>${esc(v.nom)} ${plaque(v)}</b><span>${km(s.km)}${s.ry ? ` · ≈ ${Math.round(s.ry * 30.4).toLocaleString('fr-FR')} km par mois` : ''}${conso ? ` · ${conso}` : ''}</span>
      <span>${p ? `${esc(p.op.nom)} : ${texteEcheance(p)}` : 'Aucun entretien planifié'}</span><span>${esc(texteCT(s))}</span></button></li>`;
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

  // ---------- Entretiens ----------
  function vueEntretiens() {
    const vid = choisie();
    const vs = vid ? [vehicule(vid)] : actives();
    const titre = `<div class="vue-tete"><div><h1>Entretiens</h1><p>Chaque opération a son échéance à la date ou au kilométrage : la première atteinte compte. Le carnet d'entretien du constructeur prime sur le plan proposé.</p></div>
        <div class="actions">${choixVoiture()}<button class="btn primaire" data-action="entretien" data-vehicule="${vid}">${ICONES.plus}Noter un entretien</button></div></div>`;
    if (!vs.length) return `${titre}${videEtat('Aucune voiture en service', 'Ajoute une voiture pour voir son plan d\'entretien.', `<button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter une voiture</button>`)}${AVERTISSEMENT}`;
    const rang = { retard: 0, proche: 1, ok: 2, sans: 3 };
    const blocs = vs.map((v) => {
      const s = synth(v);
      const ents = [...s.entretiens].sort((a, b) => rang[a.etat] - rang[b.etat] || (a.prevue || '9').localeCompare(b.prevue || '9'));
      const ctEt = s.ctEtat;
      const histo = [...E.entretiens.filter((e) => e.vehiculeId === v.id).map((e) => ({ ...e, genre: 'entretien' })), ...E.controles.filter((c) => c.vehiculeId === v.id).map((c) => ({ ...c, genre: 'controle' }))]
        .sort((a, b) => b.date.localeCompare(a.date));
      const nomOp = (id) => v.plan.find((o) => o.id === id)?.nom || B.entretiens.find((o) => o.code === id)?.nom || id;
      return `<section class="groupe-cat">
        <h2 class="titre-cat"><span class="tc-nom">${esc(v.nom)} ${plaque(v)}</span><span>${km(s.km)}${s.dernier ? ` · noté ${quand(s.dernier)}` : ''}</span><button class="btn petit" data-action="plan" data-id="${v.id}">Modifier le plan</button></h2>
        <ul class="plan-liste">
          <li class="op ${ctEt}"><div class="op-info"><b>Contrôle technique</b><span>${esc(texteCT(s))}</span>${s.ct.ref ? `<span class="op-der">Dernier : ${dateCourte(s.ct.ref)}</span>` : ''}</div>
            <div class="op-droite">${ctEt === 'sans' ? '' : etiquetteEtat(ctEt)}<button class="btn petit" data-action="controle" data-vehicule="${v.id}" data-nature="${s.ct.nature === 'contre-visite' ? 'contre-visite' : 'periodique'}">Noter</button></div></li>
          ${ents.map((e) => `<li class="op ${e.etat}"><div class="op-info"><b>${esc(e.op.nom)}</b><span>${e.etat === 'sans' ? 'Aucun intervalle : indique des km ou des mois' : `Prochaine fois ${texteEcheance(e)}${e.echKm !== null && e.echDate ? ', la première atteinte' : ''}`}</span><span class="op-der">${e.dernier ? `Fait le ${dateCourte(e.dernier.date)}${vide(e.dernier.km) ? '' : ` à ${km(e.dernier.km)}`}` : `Pas encore noté · compté depuis ${e.refDate ? dateCourte(e.refDate) : 'l\'entrée'}${e.refKm ? ` (${km(e.refKm)})` : ''}`}${e.etat !== 'sans' ? ` · ${detailRestant(e)}` : ''}</span></div>
            <div class="op-droite">${etiquetteEtat(e.etat)}<button class="btn petit" data-action="entretien" data-vehicule="${v.id}" data-op="${e.op.id}">C'est fait</button></div></li>`).join('')}
        </ul>
        <details class="plus-tard"${histo.length && histo.length <= 4 ? ' open' : ''}><summary>Historique · ${pluriel(histo.length, 'intervention')}</summary>
          ${histo.length ? `<ul class="histo-liste">${histo.map((h) => `<li><button class="lien-ligne" data-action="${h.genre === 'controle' ? 'controle' : 'entretien'}" data-id="${h.id}" data-vehicule="${v.id}"><b>${dateCourte(h.date)}${vide(h.km) ? '' : ` · ${km(h.km)}`}</b><span>${h.genre === 'controle' ? `${h.nature === 'contre-visite' ? 'Contre-visite' : 'Contrôle technique'} · ${{ favorable: 'favorable', majeure: 'défaillance majeure', critique: 'défaillance critique' }[h.resultat]}` : esc(h.operations.map(nomOp).join(', ') || 'Entretien')}${h.garage || h.centre ? ` · ${esc(h.garage || h.centre)}` : ''}</span></button><span class="nb">${h.cout ? euros(h.cout) : ''}</span></li>`).join('')}</ul>` : '<p class="aide">Aucun entretien noté pour cette voiture.</p>'}
          <div class="rang" style="margin:10px 0 12px"><button class="btn petit" data-action="historique" data-id="${v.id}">Historique pour la revente</button></div>
        </details>
      </section>`;
    }).join('');
    return `${titre}${blocs}${AVERTISSEMENT}`;
  }

  // ---------- Dépenses ----------
  const PERIODES = [['12m', '12 derniers mois'], ['annee', 'Cette année'], ['tout', 'Depuis le début']];
  function bornesPeriode() {
    const t = auj();
    if (filtre.periode === 'annee') return [`${t.slice(0, 4)}-01-01`, t];
    if (filtre.periode === 'tout') return ['1900-01-01', t];
    return periode12();
  }

  function vueDepenses() {
    const vid = choisie();
    const [du, au] = bornesPeriode();
    const c = R.couts(E, B, vid || null, du, au);
    const titre = `<div class="vue-tete"><div><h1>Dépenses</h1><p>Carburant ou recharge, entretien, réparations, pneus, assurance, péage, stationnement, contrôle technique : ce que ${vid ? 'cette voiture' : 'tes voitures'} te coûte${vid ? '' : 'nt'}, au mois et au kilomètre.</p></div>
        <div class="actions">${choixVoiture()}<label class="champ choix-periode"><span class="sr-only">Période</span><select id="filtre-periode">${PERIODES.map(([k, l]) => `<option value="${k}" ${filtre.periode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn primaire" data-action="depense" data-vehicule="${vid}">${ICONES.plus}Plein ou dépense</button></div></div>`;
    if (!E.vehicules.length) return `${titre}${videEtat('Aucune voiture', 'Ajoute une voiture pour noter ses dépenses.', `<button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter une voiture</button>`)}${AVERTISSEMENT}`;
    const tuiles = [
      ['Total', eurosRond(c.total), `${PERIODES.find((p) => p[0] === filtre.periode)[1].toLowerCase()}`, 'var(--encre)', ''],
      ['Coût mensuel', eurosRond(c.coutMensuel), `sur ${dec(c.mois, 1)} mois`, 'var(--bleu)', 'rond'],
      ['Coût au km', c.coutKm === null ? '–' : euros(c.coutKm), 'tout compris, hors achat', 'var(--rouge)', 'rond'],
      ['Parcourus', km(c.km), 'd\'après les compteurs notés', 'var(--jaune)', ''],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const groupes = B.groupes.map((g2) => ({ ...g2, total: c.parGroupe[g2.code] || 0 }));
    const maxG = Math.max(1, ...groupes.map((g2) => g2.total));
    const graphGroupes = `<figure class="graphique"><figcaption class="sr-only">Dépenses par poste</figcaption><div class="barres-cats">${groupes.map((g2) => `<div class="barre-cat" tabindex="0" data-info="<b>${esc(g2.nom)}</b>${euros(g2.total)} · ${c.total ? Math.round(g2.total / c.total * 100) : 0} % du total${c.km >= 1 ? `<br>${euros(g2.total / c.km, 3)} par km` : ''}"><span class="bc-nom">${esc(g2.nom)}</span><span class="bc-piste"><span class="bc-barre" style="width:${g2.total / maxG * 100}%"></span></span><span class="bc-val">${eurosRond(g2.total)}</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>`;
    const mois = R.coutsParMois(E, vid || null, au, 12);
    const maxM = Math.max(1, ...mois.map((m) => m.total));
    const iMax = mois.reduce((im, m, i) => (m.total > mois[im].total ? i : im), 0);
    const nomMois = (m) => fmt(`${m}-01`, { month: 'short' }).replace('.', '');
    const graphMois = `<figure class="graphique"><figcaption class="sr-only">Dépenses par mois, 12 derniers mois</figcaption><div class="projection">${mois.map((m, i) => `<div class="col-proj ${i === mois.length - 1 ? 'actif' : ''} ${i === iMax ? 'max' : ''}" tabindex="0" data-info="<b>${esc(fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' }))}</b>${euros(m.total)}"><span class="cp-val">${m.total ? eurosRond(m.total).replace(/\s?€/, '') : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${m.total / maxM * 100}%"></span></span><span class="cp-mois">${nomMois(m.mois)}</span></div>`).join('')}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Mois</th><th class="nb">Dépenses</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${esc(fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' }))}</td><td class="nb">${euros(m.total)}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
    // Consommation par voiture et par énergie.
    const vs = vid ? [vehicule(vid)] : E.vehicules.filter((v) => v.actif !== false);
    const conso = vs.flatMap((v) => R.categoriesEnergie(B, v.energie).map((cat) => ({ v, cat, c: R.consommation(E.depenses, v.id, cat) })));
    const blocConso = conso.length ? `<ul class="conso-liste">${conso.map(({ v, cat, c: k }) => `<li><div><b>${esc(v.nom)}</b><span>${cat === 'CAR' ? 'Carburant, plein à plein' : 'Recharge, d\'une recharge complète à l\'autre'}</span></div>
      <div class="conso-chiffres"><span><b>${k.moyenne === null ? '–' : dec(k.moyenne)}</b><small>${k.unite}/100 km en moyenne</small></span><span><b>${k.derniere ? dec(k.derniere.pour100) : '–'}</b><small>${k.unite}/100 km au dernier ${cat === 'CAR' ? 'plein' : 'intervalle'}</small></span><span><b>${k.prixMoyen === null ? '–' : euros(k.prixMoyen, cat === 'CAR' ? 3 : 3)}</b><small>prix moyen saisi par ${k.unite}</small></span></div>
      ${k.moyenne === null ? `<p class="aide">${k.nombre ? 'Il faut deux pleins complets avec le compteur noté pour calculer la consommation.' : `Aucun ${cat === 'CAR' ? 'plein' : 'recharge'} noté.`}</p>` : ''}</li>`).join('')}</ul>` : '';
    // Journal.
    const lignes = c.lignes.filter((x) => !filtre.groupe || categorie(x.categorie)?.groupe === filtre.groupe);
    const nbG = (gr) => c.lignes.filter((x) => !gr || categorie(x.categorie)?.groupe === gr).length;
    const journal = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Filtrer par poste">${[['', 'Toutes'], ...B.groupes.map((g2) => [g2.code, g2.nom])].map(([k, l]) => `<button class="filtre" data-action="filtre-groupe" data-groupe="${k}" aria-pressed="${filtre.groupe === k}">${esc(l)} <small>${nbG(k)}</small></button>`).join('')}</div><button class="btn petit" data-action="csv">Exporter en CSV</button></div>
      ${lignes.length ? `<ul class="journal">${lignes.slice(0, filtre.tout ? 500 : 25).map(ligneJournal).join('')}</ul>${lignes.length > 25 && !filtre.tout ? `<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="journal-tout">Afficher les ${pluriel(lignes.length, 'ligne')}</button></div>` : ''}${filtre.tout && lignes.length > 500 ? `<p class="aide">Les 500 lignes les plus récentes sont affichées ; l'export CSV contient tout.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune dépense sur cette période</h3><p>Note un plein, une recharge ou une dépense : elle apparaît ici et dans les coûts.</p></div></div>'}`;
    return `${titre}<div class="tuiles">${tuiles}</div>
      <div class="colonnes-graph"><section><h2 class="titre-section">Par poste</h2>${graphGroupes}</section><section><h2 class="titre-section">Par mois <span>12 derniers mois, en euros</span></h2>${graphMois}</section></div>
      ${blocConso ? `<h2 class="titre-section">Consommation <span>calculée d'après tes pleins</span></h2>${blocConso}` : ''}
      <h2 class="titre-section">Journal <span>${pluriel(lignes.length, 'ligne')}</span></h2>${journal}
      ${AVERTISSEMENT}`;
  }

  function ligneJournal(x) {
    const cat = categorie(x.categorie);
    const action = x.source === 'depense' ? 'depense' : x.source === 'controle' ? 'controle' : 'entretien';
    const q = !vide(x.quantite) ? ` · ${dec(x.quantite, 1)} ${R.UNITE[x.categorie]}` : '';
    const d = E.depenses.find((y) => y.id === x.id);
    return `<li><button class="lien-ligne" data-action="${action}" data-id="${x.id}" data-vehicule="${x.vehiculeId}"><b>${esc(cat?.nom || x.categorie)}${x.libelle ? ` <span class="numero">${esc(x.libelle)}</span>` : ''}</b><span>${dateCourte(x.date)} · ${esc(nomV(x.vehiculeId))}${q}${vide(x.km) ? '' : ` · ${km(x.km)}`}${d?.categorie && (d.categorie === 'CAR' || d.categorie === 'REC') && !d.plein ? ' · appoint' : ''}</span></button><span class="nb">${euros(x.montant)}</span></li>`;
  }

  // ---------- Voitures ----------
  function vueVoitures() {
    const liste = [...E.vehicules].sort((a, b) => (a.actif === false) - (b.actif === false));
    const enService = liste.filter((v) => v.actif !== false), vendues = liste.filter((v) => v.actif === false);
    return `<div class="vue-tete"><div><h1>Voitures</h1><p>La fiche de chaque voiture, son kilométrage et son historique imprimable pour la revente.</p></div>
        <div class="actions"><button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter une voiture</button></div></div>
      ${enService.length ? `<ul class="voitures">${enService.map(carteVoiture).join('')}</ul>` : videEtat('Aucune voiture en service', 'Ajoute ta voiture pour commencer ton carnet.', `<button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter une voiture</button>`)}
      ${vendues.length ? `<h2 class="titre-section">Vendues <span>gardées pour leur historique</span></h2><ul class="voitures">${vendues.map(carteVoiture).join('')}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  function carteVoiture(v) {
    const s = synth(v);
    const inactif = v.actif === false;
    const [du, au] = periode12();
    const c = R.couts(E, B, v.id, du, au);
    const p = s.prochain;
    return `<li class="voiture ${inactif ? 'inactif' : ''}" style="--c:${inactif ? 'var(--trait)' : s.pire === 'retard' ? 'var(--rouge)' : s.pire === 'proche' ? 'var(--jaune)' : 'var(--vert)'}">
      <div class="vt-tete">${plaque(v)}<div class="vt-nom"><b>${esc(v.nom)}</b><small>${esc(energie(v.energie))}${v.miseEnCirculation ? ` · mise en circulation ${fmt(v.miseEnCirculation, { month: 'short', year: 'numeric' })}` : ''}${inactif ? ` · vendue${v.venteLe ? ` le ${dateCourte(v.venteLe)}` : ''}` : ''}</small></div></div>
      <div class="vt-chiffres">
        <div><b>${km(s.km).replace(' km', '')}</b><span>km${s.dernier ? `, noté ${quand(s.dernier)}` : ''}</span></div>
        <div><b>${s.ry ? Math.round(s.ry * 30.4).toLocaleString('fr-FR') : '–'}</b><span>km par mois</span></div>
        <div><b>${inactif ? '–' : eurosRond(c.coutMensuel)}</b><span>par mois (12 mois)</span></div>
      </div>
      ${inactif ? '' : `<ul class="vt-echeances"><li>${s.ctEtat === 'sans' ? '' : etiquetteEtat(s.ctEtat)} ${esc(texteCT(s))}</li><li>${p ? `${etiquetteEtat(p.etat)} ${esc(p.op.nom)} : ${texteEcheance(p)}` : 'Aucun entretien planifié'}</li></ul>`}
      ${v.notes ? `<p class="vt-notes">${esc(v.notes)}</p>` : ''}
      <div class="rang vt-actions">${inactif ? '' : `<button class="btn petit" data-action="releve" data-vehicule="${v.id}">Relevé km</button>`}<button class="btn petit" data-action="historique" data-id="${v.id}">Historique</button><button class="btn petit" data-action="vehicule" data-id="${v.id}">Modifier</button></div>
    </li>`;
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
  const optionsVoitures = (val, toutes = false) => (toutes ? E.vehicules : E.vehicules.filter((v) => v.actif !== false || v.id === val)).map((v) => `<option value="${v.id}" ${v.id === val ? 'selected' : ''}>${esc(v.nom)}${v.immat ? ` · ${esc(v.immat)}` : ''}</option>`).join('');
  const voitureParDefaut = (val) => (val && vehicule(val) ? val : choisie() || actives()[0]?.id || E.vehicules[0]?.id);
  const valKm = (x) => (vide(x) ? '' : Number(x).toLocaleString('fr-FR'));
  // Lit un kilométrage saisi : '' si vide, null si illisible.
  const lireKm = (s) => { const t = String(s ?? '').trim(); if (!t) return ''; const n = R.lireNombre(t); return n === null ? null : Math.round(n); };
  // Vérifie le compteur d'une saisie (cohérent avec les autres points de la voiture).
  function controleKm(vehiculeId, date, k, ignorerId) {
    if (k === '') return null;
    const v = vehicule(vehiculeId);
    return v ? R.verifierReleve(R.pointsKm(E, v), date, k, ignorerId) : null;
  }
  function enregistrer(liste, objet, message) {
    retenir();
    const i = E[liste].findIndex((x) => x.id === objet.id);
    if (i >= 0) E[liste][i] = objet; else E[liste].push(objet);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function supprimer(liste, id, message) {
    retenir();
    E[liste] = E[liste].filter((x) => x.id !== id);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }

  // Voiture : identité, mise en circulation, entrée dans le carnet, contrôle technique, vente.
  function modaleVehicule(id) {
    const v = id ? vehicule(id) : null;
    if (id && !v) return;
    const x = v || { nom: '', immat: '', type: 'M1', energie: 'ES', miseEnCirculation: '', achat: auj(), kmAchat: '', ctDernier: '', ctPremierMois: 0, ctMois: 0, notes: '', actif: true, venteLe: '' };
    const corps = `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="60" value="${esc(x.nom)}" placeholder="Ma voiture" required></label>
        <label class="champ">Immatriculation<small>Facultatif.</small><input name="immat" maxlength="16" value="${esc(x.immat)}" autocapitalize="characters"></label></div>
      <div class="rang-champs"><label class="champ">Énergie<select name="energie">${optionsEnergie(x.energie)}</select></label>
        <label class="champ">1re mise en circulation<input type="date" name="miseEnCirculation" value="${x.miseEnCirculation || ''}"></label></div>
      <div class="rang-champs"><label class="champ">Entrée dans le carnet<small>Achat ou début du suivi.</small><input type="date" name="achat" value="${x.achat || ''}"></label>
        <label class="champ">Kilométrage à cette date<input name="kmAchat" inputmode="numeric" value="${valKm(x.kmAchat)}"></label></div>
      <fieldset class="champ"><legend>Type <small>La règle du contrôle technique intégrée concerne la voiture particulière. Pour un autre véhicule, saisis sa périodicité.</small></legend>
        <div class="choix-statut deux"><label><input type="radio" name="type" value="M1" ${x.type !== 'AUTRE' ? 'checked' : ''}><span>Voiture particulière</span></label><label><input type="radio" name="type" value="AUTRE" ${x.type === 'AUTRE' ? 'checked' : ''}><span>Autre véhicule</span></label></div></fieldset>
      <div class="rang-champs" data-autre ${x.type === 'AUTRE' ? '' : 'hidden'}><label class="champ">1er contrôle après (mois)<small>0 = aucun calcul.</small><input name="ctPremierMois" inputmode="numeric" value="${x.ctPremierMois || ''}"></label>
        <label class="champ">Puis tous les (mois)<input name="ctMois" inputmode="numeric" value="${x.ctMois || ''}"></label></div>
      <label class="champ">Dernier contrôle technique connu<small>Avant de tenir ce carnet. Les contrôles notés ensuite le remplacent.</small><input type="date" name="ctDernier" value="${x.ctDernier || ''}"></label>
      <label class="champ">Notes<textarea name="notes" maxlength="400">${esc(x.notes)}</textarea></label>
      ${v ? `<div class="cadre-champs"><label class="case"><input type="checkbox" name="vendue" ${x.actif === false ? 'checked' : ''}> Voiture vendue (gardée pour son historique, sans alerte)</label><label class="champ">Vendue le<input type="date" name="venteLe" value="${x.venteLe || ''}"></label></div>` : '<p class="aide">Un plan d\'entretien indicatif est proposé selon l\'énergie : <b>le carnet d\'entretien du constructeur prime</b>, recopie ses intervalles dans « Modifier le plan ».</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(v ? 'Modifier la voiture' : 'Nouvelle voiture', corps, PIED(!!v), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = ['releves', 'entretiens', 'controles', 'depenses'].reduce((s, l) => s + E[l].filter((y) => y.vehiculeId === v.id).length, 0);
        if (!confirm(`Supprimer « ${v.nom} »${n ? ` et ses ${pluriel(n, 'saisie')}` : ''} ? Pour garder son historique, coche plutôt « Voiture vendue ».`)) return '';
        retenir(); E = R.supprimerVehicule(E, v.id); sauver(); rendre();
        toast('Voiture supprimée.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const k = lireKm(fd.get('kmAchat'));
      if (k === null) return 'Kilométrage illisible : écris par exemple 48 500.';
      const mec = fd.get('miseEnCirculation'), achat = fd.get('achat');
      if (mec && mec > auj()) return 'La mise en circulation ne peut pas être dans le futur.';
      if (achat && mec && achat < mec) return 'L\'entrée dans le carnet précède la mise en circulation.';
      const energieAvant = v?.energie;
      const n = R.normaliserVehicule({ ...(v || {}), id: v?.id || uid(), nom: fd.get('nom'), immat: fd.get('immat'), energie: fd.get('energie'), type: fd.get('type'), miseEnCirculation: mec || null, achat: achat || null, kmAchat: k,
        ctDernier: fd.get('ctDernier') || null, ctPremierMois: fd.get('ctPremierMois'), ctMois: fd.get('ctMois'), notes: fd.get('notes'),
        actif: v ? !fd.get('vendue') : true, venteLe: fd.get('vendue') ? (fd.get('venteLe') || auj()) : null, plan: v ? v.plan : undefined }, B);
      if (v && k !== '' && achat) { const pts = R.pointsKm(E, v).filter((p) => p.source !== 'entree'); const err = R.verifierReleve(pts, achat, k); if (err) return `Kilométrage d'entrée ${err.toLowerCase()}`; }
      enregistrer('vehicules', n, v ? 'Voiture enregistrée.' : 'Voiture ajoutée, avec un plan d\'entretien indicatif.');
      if (v && energieAvant !== n.energie) toast('Énergie changée : vérifie le plan d\'entretien (« Modifier le plan »).');
    });
    const d = modale();
    d.querySelectorAll('[name=type]').forEach((el) => el.addEventListener('change', () => { d.querySelector('[data-autre]').hidden = el.value !== 'AUTRE' || !el.checked; }));
  }

  // Plan d'entretien d'une voiture : opérations, intervalles, dernière fois connue.
  function modalePlan(id) {
    const v = vehicule(id);
    if (!v) return;
    let plan = structuredClone(v.plan);
    const ligne = (o, i) => `<li class="plan-ligne"><div class="rang-champs"><label class="champ pl-nom">Opération<input data-p="${i}" data-k="nom" value="${esc(o.nom)}" maxlength="80"></label><button type="button" class="btn-suppr" data-action="plan-suppr" data-i="${i}" aria-label="Retirer ${esc(o.nom)}">×</button></div>
      <div class="rang-champs"><label class="champ">Tous les (km)<input data-p="${i}" data-k="km" inputmode="numeric" value="${o.km ? o.km.toLocaleString('fr-FR') : ''}" placeholder="—"></label><label class="champ">ou tous les (mois)<input data-p="${i}" data-k="mois" inputmode="numeric" value="${o.mois || ''}" placeholder="—"></label></div>
      <div class="rang-champs"><label class="champ">Dernière fois connue<small>Si pas encore notée.</small><input type="date" data-p="${i}" data-k="depuis" value="${o.depuis || ''}"></label><label class="champ">à (km)<small>&nbsp;</small><input data-p="${i}" data-k="depuisKm" inputmode="numeric" value="${valKm(o.depuisKm)}"></label></div></li>`;
    const dessiner = () => {
      const ul = modale().querySelector('.plan-edit');
      ul.innerHTML = plan.map(ligne).join('');
      ul.querySelectorAll('[data-p]').forEach((el) => el.addEventListener('input', () => { plan[Number(el.dataset.p)][el.dataset.k] = el.value; }));
    };
    const corps = `<p class="aide"><b>Le carnet d'entretien du constructeur prime.</b> Les intervalles proposés sont des ordres de grandeur indicatifs, rédigés pour cet outil : recopie ceux du carnet de ta voiture. Laisse vide le critère qui ne s'applique pas ; l'échéance est la première atteinte.</p>
      <ul class="plan-edit"></ul>
      <div class="rang"><button type="button" class="btn petit" data-action="plan-ajout">${ICONES.plus}Ajouter une opération</button><button type="button" class="btn petit" data-action="plan-defaut">Reprendre le plan proposé</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Plan d'entretien · ${esc(v.nom)}`, corps, PIED(false), () => {
      const n = [];
      for (const o of plan) {
        if (!String(o.nom).trim()) continue;
        const kmI = String(o.km ?? '').trim() ? R.lireNombre(o.km) : 0, mo = String(o.mois ?? '').trim() ? R.lireNombre(o.mois) : 0;
        if (kmI === null || mo === null) return `Intervalle illisible pour « ${o.nom} ».`;
        const dk = lireKm(o.depuisKm);
        if (dk === null) return `Kilométrage illisible pour « ${o.nom} ».`;
        n.push(R.normaliserOp({ ...o, km: kmI, mois: mo, depuis: o.depuis || null, depuisKm: dk }));
      }
      enregistrer('vehicules', { ...v, plan: n }, 'Plan d\'entretien enregistré.');
    });
    dessiner();
    // Boutons de la modale (retirer, ajouter, reprendre le plan proposé), appelés par le gestionnaire global.
    editionPlan = (action, i) => {
      if (action === 'plan-suppr') { plan.splice(Number(i), 1); dessiner(); }
      if (action === 'plan-ajout') { plan.push({ id: uid(), nom: 'Nouvelle opération', km: 0, mois: 12, depuis: null, depuisKm: '' }); dessiner(); modale().querySelector('.plan-edit li:last-child input')?.focus(); }
      if (action === 'plan-defaut' && confirm('Remplacer le plan par le plan indicatif proposé pour cette énergie ?')) { plan = R.planDefaut(B, v.energie); dessiner(); }
    };
  }
  let editionPlan = null;

  function modaleReleve(vehiculeId) {
    if (!E.vehicules.length) return toast('Ajoute d\'abord une voiture.');
    const vid = voitureParDefaut(vehiculeId);
    const corps = `<label class="champ">Voiture<select name="vehiculeId">${optionsVoitures(vid)}</select></label>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${auj()}" max="${auj()}"></label><label class="champ">Compteur (km)<input name="km" inputmode="numeric" required placeholder="Ex. : 48 500"></label></div>
      <p class="aide" data-dernier></p><p class="erreur" role="alert"></p>`;
    ouvrirModale('Relevé kilométrique', corps, PIED(false), (fd) => {
      const k = lireKm(fd.get('km'));
      if (k === null || k === '') return 'Indique le compteur en chiffres.';
      const err = controleKm(fd.get('vehiculeId'), fd.get('date'), k);
      if (err) return err;
      enregistrer('releves', R.normaliserReleve({ id: uid(), vehiculeId: fd.get('vehiculeId'), date: fd.get('date'), km: k }), 'Kilométrage noté.');
    });
    const maj = () => { const v = vehicule(modale().querySelector('[name=vehiculeId]').value); const s = v && synth(v); modale().querySelector('[data-dernier]').textContent = s ? `Dernier compteur connu : ${km(s.km)}${s.dernier ? `, le ${dateCourte(s.dernier)}` : ''}.` : ''; };
    modale().querySelector('[name=vehiculeId]').addEventListener('change', maj); maj();
  }

  // Entretien fait : opérations du plan cochées, garage, coût.
  function modaleEntretien(vehiculeId, id, opId) {
    if (!E.vehicules.length) return toast('Ajoute d\'abord une voiture.');
    const e = id ? E.entretiens.find((x) => x.id === id) : null;
    if (id && !e) return;
    const vid = e?.vehiculeId || voitureParDefaut(vehiculeId);
    const x = e || { date: auj(), km: '', operations: opId ? [opId] : [], garage: '', cout: 0, note: '' };
    if (!e && vehicule(vid)) x.km = synth(vehicule(vid)).km || '';
    const cases = (v) => (v?.plan || []).map((o) => `<label class="case"><input type="checkbox" name="op" value="${esc(o.id)}" ${x.operations.includes(o.id) ? 'checked' : ''}> ${esc(o.nom)}</label>`).join('') || '<p class="aide">Le plan de cette voiture est vide : ajoute des opérations dans « Modifier le plan ».</p>';
    const corps = `<label class="champ">Voiture<select name="vehiculeId">${optionsVoitures(vid, !!e)}</select></label>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${x.date}" max="${auj()}"></label><label class="champ">Compteur (km)<input name="km" inputmode="numeric" value="${valKm(x.km)}"></label></div>
      <fieldset class="champ cadre-champs"><legend>Opérations faites <small>Chacune repart de cette date et de ce kilométrage.</small></legend><div class="cases-ops">${cases(vehicule(vid))}</div></fieldset>
      <div class="rang-champs"><label class="champ">Garage<small>Facultatif.</small><input name="garage" maxlength="80" value="${esc(x.garage)}"></label><label class="champ">Coût (€)<small>Facture, pièces et main-d'œuvre.</small><input name="cout" inputmode="decimal" value="${x.cout ? String(x.cout).replace('.', ',') : ''}"></label></div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(x.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'entretien' : 'Entretien fait', corps, PIED(!!e), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer cet entretien ?')) return ''; supprimer('entretiens', e.id, 'Entretien supprimé.'); return undefined; }
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      const k = lireKm(fd.get('km'));
      if (k === null) return 'Kilométrage illisible.';
      const cout = String(fd.get('cout') || '').trim() ? R.lireNombre(fd.get('cout')) : 0;
      if (cout === null) return 'Coût illisible : écris par exemple 185,50.';
      const ops = fd.getAll('op');
      if (!ops.length && !String(fd.get('note')).trim()) return 'Coche au moins une opération, ou décris l\'intervention en note.';
      const err = controleKm(fd.get('vehiculeId'), fd.get('date'), k, e?.id);
      if (err) return err;
      enregistrer('entretiens', R.normaliserEntretien({ id: e?.id || uid(), vehiculeId: fd.get('vehiculeId'), date: fd.get('date'), km: k, operations: ops, garage: fd.get('garage'), cout, note: fd.get('note') }), 'Entretien noté : les échéances sont recalculées.');
    });
    modale().querySelector('[name=vehiculeId]').addEventListener('change', (ev) => { x.operations = []; modale().querySelector('.cases-ops').innerHTML = cases(vehicule(ev.target.value)); });
  }

  // Contrôle technique ou contre-visite.
  function modaleControle(vehiculeId, id, nature) {
    if (!E.vehicules.length) return toast('Ajoute d\'abord une voiture.');
    const c = id ? E.controles.find((x) => x.id === id) : null;
    if (id && !c) return;
    const vid = c?.vehiculeId || voitureParDefaut(vehiculeId);
    const x = c || { date: auj(), km: vehicule(vid) ? synth(vehicule(vid)).km || '' : '', nature: nature || 'periodique', resultat: 'favorable', centre: '', cout: 0 };
    const s = B.ct.source;
    const radio = (nom, val, opts) => `<div class="choix-statut ${opts.length === 3 ? 'trois' : 'deux'}">${opts.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${val === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    const corps = `<label class="champ">Voiture<select name="vehiculeId">${optionsVoitures(vid, !!c)}</select></label>
      <fieldset class="champ"><legend>Nature</legend>${radio('nature', x.nature, [['periodique', 'Contrôle périodique'], ['contre-visite', 'Contre-visite']])}</fieldset>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${x.date}" max="${auj()}"></label><label class="champ">Compteur (km)<input name="km" inputmode="numeric" value="${valKm(x.km)}"></label></div>
      <fieldset class="champ"><legend>Résultat <small>Tel qu'indiqué sur le procès-verbal.</small></legend>${radio('resultat', x.resultat, [['favorable', 'Favorable'], ['majeure', 'Défaillance majeure'], ['critique', 'Défaillance critique']])}</fieldset>
      <div class="rang-champs"><label class="champ">Centre<small>Facultatif.</small><input name="centre" maxlength="80" value="${esc(x.centre)}"></label><label class="champ">Coût (€)<input name="cout" inputmode="decimal" value="${x.cout ? String(x.cout).replace('.', ',') : ''}"></label></div>
      <p class="aide">Favorable : valable ${E.reglages.ctPeriodiqueMois} mois. Défaillance majeure ou critique : contre-visite dans les ${E.reglages.ctContreVisiteMois} mois ; une défaillance critique limite la validité au jour du contrôle. Source : ${esc(s.editeur)}, vérifiée le ${esc(s.verifie)}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Modifier le contrôle' : 'Contrôle technique', corps, PIED(!!c), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer ce contrôle ?')) return ''; supprimer('controles', c.id, 'Contrôle supprimé.'); return undefined; }
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      const k = lireKm(fd.get('km'));
      if (k === null) return 'Kilométrage illisible.';
      const cout = String(fd.get('cout') || '').trim() ? R.lireNombre(fd.get('cout')) : 0;
      if (cout === null) return 'Coût illisible.';
      const err = controleKm(fd.get('vehiculeId'), fd.get('date'), k, c?.id);
      if (err) return err;
      enregistrer('controles', R.normaliserControle({ id: c?.id || uid(), vehiculeId: fd.get('vehiculeId'), date: fd.get('date'), km: k, nature: fd.get('nature'), resultat: fd.get('resultat'), centre: fd.get('centre'), cout }), 'Contrôle noté : l\'échéance est recalculée.');
    });
  }

  // Plein, recharge ou autre dépense.
  function modaleDepense(id, vehiculeId) {
    if (!E.vehicules.length) return toast('Ajoute d\'abord une voiture.');
    const dp = id ? E.depenses.find((x) => x.id === id) : null;
    if (id && !dp) return;
    const vid = dp?.vehiculeId || voitureParDefaut(vehiculeId);
    const x = dp || { date: auj(), categorie: R.categoriesEnergie(B, vehicule(vid)?.energie)[0] || 'CAR', montant: '', libelle: '', km: '', quantite: '', plein: true, oubli: false };
    const cats = B.categories.filter((c2) => !c2.auto);
    const corps = `<label class="champ">Voiture<select name="vehiculeId">${optionsVoitures(vid, !!dp)}</select></label>
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${cats.map((c2) => `<option value="${c2.code}" ${x.categorie === c2.code ? 'selected' : ''}>${esc(c2.nom)}</option>`).join('')}</select></label><label class="champ">Date<input type="date" name="date" value="${x.date}" max="${auj()}"></label></div>
      <div class="rang-champs"><label class="champ">Montant payé (€)<input name="montant" inputmode="decimal" value="${x.montant ? String(x.montant).replace('.', ',') : ''}" required></label><label class="champ" data-energie><span data-unite>Litres</span><input name="quantite" inputmode="decimal" value="${vide(x.quantite) ? '' : String(x.quantite).replace('.', ',')}"></label></div>
      <div data-energie class="cadre-champs">
        <label class="champ">Compteur (km)<small>Indispensable pour calculer la consommation.</small><input name="km" inputmode="numeric" value="${valKm(x.km)}"></label>
        <label class="case"><input type="checkbox" name="plein" ${x.plein ? 'checked' : ''}> <span data-plein>Réservoir plein</span></label>
        <label class="case"><input type="checkbox" name="oubli" ${x.oubli ? 'checked' : ''}> Un passage précédent n'a pas été noté</label>
        <p class="apercu" data-apercu></p>
      </div>
      <label class="champ">Libellé<small>Facultatif.</small><input name="libelle" maxlength="120" value="${esc(x.libelle)}"></label>
      <p class="aide" data-aide-cat hidden>L'entretien et le contrôle technique se notent dans l'onglet Entretiens : leur coût est compté ici automatiquement.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(dp ? 'Modifier la dépense' : 'Plein ou dépense', corps, PIED(!!dp), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer cette dépense ?')) return ''; supprimer('depenses', dp.id, 'Dépense supprimée.'); return undefined; }
      const cat = fd.get('categorie');
      const nrj = cat === 'CAR' || cat === 'REC';
      const m = R.lireNombre(fd.get('montant'));
      if (m === null) return 'Montant illisible : écris par exemple 62,40.';
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      const q = nrj && String(fd.get('quantite') || '').trim() ? R.lireNombre(fd.get('quantite')) : '';
      if (q === null) return `Quantité illisible : écris par exemple ${cat === 'REC' ? '32,5' : '41,2'}.`;
      const k = nrj ? lireKm(fd.get('km')) : '';
      if (k === null) return 'Kilométrage illisible.';
      const err = nrj ? controleKm(fd.get('vehiculeId'), fd.get('date'), k, dp?.id) : null;
      if (err) return err;
      const n = R.normaliserDepense({ id: dp?.id || uid(), vehiculeId: fd.get('vehiculeId'), date: fd.get('date'), categorie: cat, montant: m, libelle: fd.get('libelle'), km: k, quantite: q, plein: !!fd.get('plein'), oubli: !!fd.get('oubli') }, B);
      enregistrer('depenses', n, nrj ? `${cat === 'REC' ? 'Recharge notée' : 'Plein noté'}.` : 'Dépense notée.');
      if (nrj && n.plein && n.km !== '') {
        const c2 = R.consommation(E.depenses, n.vehiculeId, cat);
        if (c2.derniere && c2.derniere.au === n.date) toast(`Consommation depuis le plein précédent : ${dec(c2.derniere.pour100)} ${c2.unite}/100 km.`, { libelle: 'Annuler', faire: annuler });
      }
    });
    const d = modale();
    const maj = () => {
      const cat = d.querySelector('[name=categorie]').value;
      const nrj = cat === 'CAR' || cat === 'REC';
      d.querySelectorAll('[data-energie]').forEach((el) => { el.hidden = !nrj; });
      d.querySelector('[data-unite]').textContent = cat === 'REC' ? 'kWh rechargés' : 'Litres';
      d.querySelector('[data-plein]').textContent = cat === 'REC' ? 'Recharge jusqu\'à ton niveau habituel (ex. 80 % ou 100 %)' : 'Réservoir plein';
      const m = R.lireNombre(d.querySelector('[name=montant]').value), q = R.lireNombre(d.querySelector('[name=quantite]').value);
      d.querySelector('[data-apercu]').textContent = nrj && m && q ? `Soit ${euros(m / q, 3)} par ${cat === 'REC' ? 'kWh' : 'litre'} (prix saisi).` : '';
      if (!dp && !d.querySelector('[name=libelle]').value) d.querySelector('[name=libelle]').placeholder = cat === 'CAR' ? 'Plein' : cat === 'REC' ? 'Recharge à domicile, borne…' : '';
    };
    d.querySelector('[name=categorie]').addEventListener('change', maj);
    d.querySelector('[name=vehiculeId]').addEventListener('change', (ev) => {
      if (dp) return;
      const cats2 = R.categoriesEnergie(B, vehicule(ev.target.value)?.energie);
      const sel = d.querySelector('[name=categorie]');
      if ((sel.value === 'CAR' || sel.value === 'REC') && !cats2.includes(sel.value)) { sel.value = cats2[0]; maj(); }
    });
    d.querySelectorAll('[name=montant],[name=quantite]').forEach((el) => el.addEventListener('input', maj));
    maj();
  }

  // Historique pour la revente : aperçu, impression et texte à copier.
  function modaleHistorique(id) {
    const v = vehicule(id);
    if (!v) return;
    let montants = false;
    const corps = `<p>L'historique d'entretien de <b>${esc(v.nom)}</b>, à imprimer ou à copier pour un acheteur. Il reprend les entretiens, les contrôles techniques, les réparations et les pneus.</p>
      <label class="case"><input type="checkbox" name="montants"> Afficher les montants</label>
      <pre class="apercu-histo" data-histo></pre>`;
    ouvrirModale('Historique pour la revente', corps, '<button class="btn primaire" value="imprimer">Imprimer</button><button class="btn" value="copier">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (_, choix) => {
      if (choix === 'imprimer') { imprimerHistorique(v, montants); return undefined; }
      if (choix === 'copier') {
        const t = R.texteHistorique(R.historique(E, B, v, auj(), { montants }), auj());
        navigator.clipboard?.writeText(t).then(() => toast('Historique copié : colle-le dans un message ou une annonce.'), () => toast('Copie impossible : sélectionne le texte à la main.'));
        modale().dataset.garder = '1';
      }
      return undefined;
    });
    const maj = () => { modale().querySelector('[data-histo]').textContent = R.texteHistorique(R.historique(E, B, v, auj(), { montants }), auj()); };
    modale().querySelector('[name=montants]').addEventListener('change', (e) => { montants = e.target.checked; maj(); });
    maj();
  }

  function imprimerHistorique(v, montants) {
    const t = auj();
    const h = R.historique(E, B, v, t, { montants });
    const el = $('#impression');
    el.innerHTML = `<header class="imp-tete"><div><p class="surtitre">Historique d'entretien</p><h1>${esc(v.nom)}</h1><p>${[v.immat, h.energie, v.miseEnCirculation ? `1re mise en circulation : ${dateLongue(v.miseEnCirculation)}` : ''].filter(Boolean).map(esc).join(' · ')}</p></div>
      <div class="imp-km"><b>${km(h.km)}</b><span>au ${dateLongue(h.dernier || t)}</span></div></header>
      ${h.ct.nature === 'periodique' && h.ct.ref ? `<p class="imp-ct">Dernier contrôle technique : ${dateLongue(h.ct.ref)} · prochain au plus tard le ${dateLongue(h.ct.echeance)}</p>` : h.ct.nature === 'contre-visite' ? `<p class="imp-ct">Contre-visite à faire au plus tard le ${dateLongue(h.ct.echeance)}</p>` : ''}
      <table class="tableau"><thead><tr><th>Date</th><th class="nb">Km</th><th>Intervention</th><th>Par</th>${montants ? '<th class="nb">Montant</th>' : ''}</tr></thead>
      <tbody>${h.lignes.map((l) => `<tr><td>${dateCourte(l.date)}</td><td class="nb">${vide(l.km) ? '' : Number(l.km).toLocaleString('fr-FR')}</td><td><b>${esc(l.type)}</b>${l.detail ? ` · ${esc(l.detail)}` : ''}</td><td>${esc(l.par)}</td>${montants ? `<td class="nb">${l.montant ? euros(l.montant) : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${montants ? 5 : 4}">Aucun entretien noté.</td></tr>`}</tbody></table>
      <p class="mention">Établi le ${dateLongue(t)} à partir du carnet tenu par le propriétaire ; les factures font foi.</p>`;
    el.hidden = false;
    document.body.classList.add('imprime');
    modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const s = B.ct.source;
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Alertes</h3><p class="aide">Une échéance passe en « Bientôt » quand il reste moins de ces jours ou de ces kilomètres.</p>
        <div class="rang-champs"><label class="champ">Jours avant<input name="alerteJours" inputmode="numeric" value="${r.alerteJours}"></label><label class="champ">Km avant<input name="alerteKm" inputmode="numeric" value="${r.alerteKm}"></label><label class="champ">Relevé ancien après (jours)<input name="releveAncienJours" inputmode="numeric" value="${r.releveAncienJours}"></label></div></div>
      <div class="groupe"><h3>Contrôle technique <span class="etiquette jaune">Règle datée</span></h3>
        <p class="aide">Voiture particulière : ${esc(s.resume)}<br><b>Source</b> : ${esc(s.titre)}, ${esc(s.editeur)} (${esc(s.url)}), page « vérifiée le ${esc(s.verifie)} », consultée le ${esc(s.consulte)}. Si la règle change, modifie les valeurs ci-dessous. Deux-roues, camping-car ou utilitaire : choisis « Autre véhicule » sur sa fiche et saisis sa périodicité.</p>
        <div class="rang-champs"><label class="champ">1er contrôle avant (mois)<small>Après la mise en circulation.</small><input name="ctPremierMois" inputmode="numeric" value="${r.ctPremierMois}"></label><label class="champ">Puis tous les (mois)<small>&nbsp;</small><input name="ctPeriodiqueMois" inputmode="numeric" value="${r.ctPeriodiqueMois}"></label><label class="champ">Contre-visite sous (mois)<small>&nbsp;</small><input name="ctContreVisiteMois" inputmode="numeric" value="${r.ctContreVisiteMois}"></label></div>
        <label class="champ">Règle vérifiée le<input type="date" name="ctVerifieLe" value="${r.ctVerifieLe || ''}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tout le journal des dépenses (pleins, recharges, entretiens, contrôles) en tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton carnet est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le carnet à ton écran d'accueil pour l'ouvrir comme une application, à la pompe ou au garage.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le carnet est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Il ne contient que ce que tu saisis ; aucune géolocalisation.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Plan d'entretien et catégories rédigés pour QME (version ${B.version}) : intervalles indicatifs, le carnet d'entretien du constructeur prime. Aucun prix de carburant ou d'électricité intégré : tu saisis ce que tu paies. Aucune connexion à un garage, une assurance ou une autre application. Outil d'aide, pas un conseil mécanique ni financier.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom, maxi) => { const n = R.lireNombre(fd.get(nom)); return n !== null && n <= maxi ? Math.round(n) : null; };
      const vals = { alerteJours: lire('alerteJours', 365), alerteKm: lire('alerteKm', 50000), releveAncienJours: lire('releveAncienJours', 730), ctPremierMois: lire('ctPremierMois', 240), ctPeriodiqueMois: lire('ctPeriodiqueMois', 240), ctContreVisiteMois: lire('ctContreVisiteMois', 24) };
      if (Object.values(vals).some((x) => x === null)) return 'Une valeur est illisible ou trop grande : écris un nombre entier.';
      if (!vals.ctContreVisiteMois) return 'Le délai de contre-visite doit être d\'au moins 1 mois.';
      E.reglages = R.normaliserReglages({ ...r, ...vals, ctVerifieLe: fd.get('ctVerifieLe') || r.ctVerifieLe }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés : les échéances sont recalculées.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.vehicules) || !Array.isArray(donnees.depenses)) throw new Error();
        if (!confirm(`Remplacer ton carnet actuel par cette copie (${pluriel(donnees.vehicules.length, 'voiture')}, ${pluriel(donnees.depenses.length, 'dépense')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du carnet.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `carnet-voiture-${auj()}.json`);
  const exporterCsv = () => telecharger(R.csvJournal(E, B), 'text/csv;charset=utf-8', `depenses-voiture-${auj()}.csv`);

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
      <p>Enregistre ce carnet sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    // Les boutons propres à la modale du plan sont gérés par la modale elle-même.
    if (action.startsWith('plan-')) { if (editionPlan && modale().querySelector('.plan-edit')) editionPlan(action, el.dataset.i); return; }
    const dansModale = !!el.closest('#modale');
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
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'vehicule': if (dansModale) break; modaleVehicule(id || null); break;
      case 'plan': modalePlan(id); break;
      case 'releve': modaleReleve(el.dataset.vehicule); break;
      case 'entretien': modaleEntretien(el.dataset.vehicule, id || null, el.dataset.op); break;
      case 'controle': modaleControle(el.dataset.vehicule, id || null, el.dataset.nature); break;
      case 'depense': modaleDepense(id || null, el.dataset.vehicule); break;
      case 'historique': modaleHistorique(id); break;
      case 'aller-voiture': filtre.vehicule = id; changerVue('entretiens'); break;
      case 'filtre-groupe': filtre.groupe = el.dataset.groupe; filtre.tout = false; rendre(); break;
      case 'journal-tout': filtre.tout = true; rendre(); break;
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
  window.__voiture = { etat: () => E, regles: R };
  init();
})();
