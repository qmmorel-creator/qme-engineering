// Pilote de travaux maison QME : devis comparés par poste, budget, planning des artisans, réserves.
// Données synchronisées par clé de licence (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'TRV';
  const CLE_CODE = 'qme-trv-code';
  const CLE_CACHE = 'qme-trv-cache';
  const CLE_DEMO = 'qme-trv-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-trv-ecran-accueil';
  const NOM = 'Pilote de travaux';

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
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? R.dateFr(s) : '–');
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return fmt(s);
  };
  const eur = (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: (Number(n) || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const pct = (n) => `${String(n).replace('.', ',')} %`;
  const valeurMontant = (n) => (n || n === 0 ? String(n).replace('.', ',') : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'devis';
  let annulation = null;
  const filtre = { pieceId: '' };

  const etatVide = () => ({ version: 1, chantier: { nom: '', debut: null }, reglages: { imprevus: B.imprevusDefaut },
    pieces: [], artisans: [], postes: [], devis: [], paiements: [], imprevus: [], interventions: [], reserves: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, chantier: { ...v.chantier, ...(d.chantier || {}) }, reglages: { ...v.reglages, ...(d.reglages || {}) },
      pieces: tab(d.pieces), artisans: tab(d.artisans),
      postes: tab(d.postes).map((p) => ({ code: 'AUT', pieceId: null, budget: 0, retenuId: null, notes: '', reception: null, ...p })),
      devis: tab(d.devis).map((x) => ({ inclus: '', exclus: '', delai: '', assurance: null, note: 0, ref: '', date: null, ...x })),
      paiements: tab(d.paiements), imprevus: tab(d.imprevus), interventions: tab(d.interventions),
      reserves: tab(d.reserves).map((r) => ({ photo: '', statut: 'ouverte', leveeLe: null, ...r })) };
  };
  const piece = (id) => E.pieces.find((x) => x.id === id);
  const poste = (id) => E.postes.find((x) => x.id === id);
  const artisan = (id) => E.artisans.find((x) => x.id === id);
  const devisDe = (id) => E.devis.find((x) => x.id === id);
  const type = (code) => B.postes.find((p) => p.code === code) || B.postes.find((p) => p.code === 'AUT');
  const nomPiece = (id) => piece(id)?.nom || 'Tout le logement';
  const pieceIntervention = (i) => poste(i.posteId)?.pieceId ?? null;
  const rangIntervention = (i) => type(poste(i.posteId)?.code).rang;
  const nomIntervention = (i) => poste(i.posteId)?.nom || 'Poste supprimé';
  const artisanRetenu = (p) => artisan(devisDe(p.retenuId)?.artisanId);
  const postesTries = () => [...E.postes].sort((a, b) => type(a.code).rang - type(b.code).rang || a.nom.localeCompare(b.nom));

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
        if (!modale().open) rendre();
        toast('Un autre appareil a modifié ton chantier entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis allège les textes les plus longs.');
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
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    if (E && E.chantier.nom) { cache(false); demarrer(); } else ecranAccueil();
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

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const t = auj();
    const j = (n) => ajout(t, n);
    const D = etatVide();
    D.chantier = { nom: 'Appartement T3 · rue des Tilleuls', debut: j(-30) };
    D.reglages.imprevus = 10;
    const pc = {};
    ['Cuisine', 'Salle de bains', 'Séjour', 'Chambre'].forEach((nom) => { pc[nom] = { id: uid(), nom }; D.pieces.push(pc[nom]); });
    const ar = {};
    [['garnier', 'Plomberie Garnier', 'Plombier'], ['chauvin', 'Chauvin Sanitaire', 'Plombier'], ['rousseau', 'Élec Rousseau', 'Électricien'], ['blanc', 'Blanc Électricité', 'Électricien'],
      ['navarro', 'Plâtrerie Navarro', 'Plaquiste'], ['lefevre', 'Carrelages Lefèvre', 'Carreleur'], ['roux', 'Atelier Roux Carrelage', 'Carreleur'], ['dupuis', 'Dupuis Rénovation', 'Entreprise générale'],
      ['bonnet', 'Peintures Bonnet', 'Peintre'], ['vasseur', 'Agencement Vasseur', 'Cuisiniste'], ['sols', 'Sols et Parquets Fabre', 'Parqueteur'], ['demol', 'Démolition Perrin', 'Entreprise de démolition']]
      .forEach(([k, nom, metier]) => { ar[k] = { id: uid(), nom, metier, contact: '' }; D.artisans.push(ar[k]); });
    const po = {};
    const nouveauPoste = (k, code, pieceNom, budget, notes = '') => { po[k] = { id: uid(), code, nom: type(code).nom, pieceId: pieceNom ? pc[pieceNom].id : null, budget, retenuId: null, notes, reception: null }; D.postes.push(po[k]); };
    nouveauPoste('dem', 'DEM', null, 2500);
    nouveauPoste('plb', 'PLB', null, 4200, 'Colonne d\'évacuation à vérifier à la dépose.');
    nouveauPoste('ele', 'ELE', null, 5200);
    nouveauPoste('iso', 'ISO', null, 6000);
    nouveauPoste('car', 'CAR', 'Salle de bains', 3600, 'Faïence toute hauteur côté douche.');
    nouveauPoste('san', 'SAN', 'Salle de bains', 1500);
    nouveauPoste('pei', 'PEI', null, 4500);
    nouveauPoste('sol', 'SOL', 'Séjour', 3000);
    nouveauPoste('cui', 'CUI', 'Cuisine', 9000);
    const dv = (k, a, ht, ttc, o = {}) => { const d = { id: uid(), posteId: po[k].id, artisanId: ar[a].id, ref: '', date: j(-50), ht, ttc, inclus: '', exclus: '', delai: '', assurance: true, note: 3, ...o }; D.devis.push(d); return d; };
    po.dem.retenuId = dv('dem', 'demol', 2100, 2310, { ref: 'D-2041', inclus: 'Dépose cuisine et salle de bains, cloison séjour, évacuation en benne', exclus: 'Désamiantage éventuel', delai: '1 semaine', note: 4 }).id;
    dv('dem', 'dupuis', 2400, 2640, { inclus: 'Dépose complète, évacuation', delai: '1 semaine', note: 3 });
    po.plb.retenuId = dv('plb', 'garnier', 3600, 3960, { ref: 'GAR-118', inclus: 'Alimentations et évacuations cuisine et salle de bains, mise en service', exclus: 'Fourniture des sanitaires', delai: '5 jours', note: 4 }).id;
    dv('plb', 'chauvin', 3300, 3630, { inclus: 'Alimentations cuisine et salle de bains', exclus: 'Évacuations, mise en service', delai: '1 semaine', assurance: null, note: 3 });
    dv('plb', 'dupuis', 4100, 4510, { inclus: 'Réseaux complets, mise en service, nettoyage', delai: '4 jours', note: 3 });
    po.ele.retenuId = dv('ele', 'rousseau', 4300, 4730, { ref: 'ER-77', inclus: 'Tableau neuf, 24 prises, 11 points lumineux, saignées rebouchées', exclus: 'Luminaires', delai: '2 semaines', note: 5 }).id;
    dv('ele', 'blanc', 4050, 4455, { inclus: 'Tableau neuf, 20 prises, 9 points lumineux', exclus: 'Rebouchage des saignées', delai: '3 semaines', note: 3 });
    po.iso.retenuId = dv('iso', 'navarro', 5000, 5275, { ref: 'PN-2026-31', inclus: 'Doublage isolant murs extérieurs, cloisons, bandes et enduits', delai: '12 jours', note: 4 }).id;
    dv('car', 'lefevre', 3100, 3410, { ref: 'CL-560', inclus: 'Étanchéité douche, faïence toute hauteur, sol, plinthes', exclus: 'Fourniture du carrelage', delai: '5 jours', note: 4 });
    dv('car', 'roux', 2750, 3025, { inclus: 'Faïence, sol', exclus: 'Étanchéité, fourniture', delai: '4 jours', assurance: false, note: 3 });
    dv('car', 'dupuis', 3400, 3910, { inclus: 'Étanchéité, faïence, sol, fourniture du carrelage', delai: '6 jours', note: 3 });
    dv('pei', 'bonnet', 3900, 4290, { inclus: 'Murs et plafonds, 2 couches mat, préparation des supports', exclus: 'Boiseries', delai: '8 jours', note: 4 });
    dv('sol', 'sols', 2600, 2860, { inclus: 'Parquet contrecollé posé flottant, sous-couche, plinthes', delai: '4 jours', note: 4 });
    dv('sol', 'dupuis', 2500, 2875, { inclus: 'Parquet, sous-couche', exclus: 'Plinthes', delai: '5 jours', assurance: null, note: 2 });
    po.cui.retenuId = dv('cui', 'vasseur', 7600, 8360, { ref: 'AV-0932', inclus: 'Meubles, plan de travail, pose, raccordements', exclus: 'Électroménager', delai: 'Livraison 6 semaines après commande', note: 4 }).id;
    // Paiements : démolition soldée, acomptes ailleurs.
    const paie = (k, n, montant, libelle) => D.paiements.push({ id: uid(), posteId: po[k].id, date: j(n), montant, libelle });
    paie('dem', -32, 693, 'Acompte 30 %'); paie('dem', -24, 1617, 'Solde');
    paie('plb', -26, 1188, 'Acompte 30 %'); paie('plb', -15, 2772, 'Solde');
    paie('ele', -24, 1419, 'Acompte 30 %');
    paie('iso', -11, 1582.5, 'Acompte 30 %');
    paie('cui', -45, 3344, 'Acompte 40 % à la commande');
    D.imprevus.push({ id: uid(), posteId: po.plb.id, date: j(-25), libelle: 'Colonne d\'évacuation fissurée découverte à la dépose', montant: 640 });
    D.imprevus.push({ id: uid(), posteId: po.iso.id, date: j(-6), libelle: 'Reprise du plafond de la chambre', montant: 380 });
    D.imprevus.push({ id: uid(), posteId: null, date: j(-27), libelle: 'Benne supplémentaire', montant: 180 });
    // Planning : terminé, en cours, à venir, un chevauchement et un ordre inhabituel.
    const inter = (k, a, d, f, provisoire = false) => D.interventions.push({ id: uid(), posteId: po[k].id, artisanId: a ? ar[a].id : null, debut: j(d), fin: j(f), provisoire });
    inter('dem', 'demol', -30, -26);
    inter('plb', 'garnier', -25, -19);
    inter('ele', 'rousseau', -22, -12);
    inter('iso', 'navarro', -10, 2);
    inter('car', null, 4, 8, true);
    inter('san', 'garnier', 6, 7, true);
    inter('pei', 'bonnet', 8, 16);
    inter('sol', null, 17, 20, true);
    inter('cui', 'vasseur', 21, 23);
    // Réceptions et réserves.
    po.dem.reception = j(-26);
    po.plb.reception = j(-19);
    po.ele.reception = j(-12);
    const res = (k, n, description, statut = 'ouverte', photo = '', levee = null) => D.reserves.push({ id: uid(), posteId: po[k].id, description, constat: j(n), photo, statut, leveeLe: levee === null ? null : j(levee) });
    res('dem', -26, 'Gravats restants dans la cave', 'levee', '', -24);
    res('plb', -19, 'Goutte au raccord d\'évacuation sous l\'évier', 'ouverte', 'IMG_2231');
    res('ele', -12, 'Prise du séjour (mur nord) sans courant', 'ouverte', 'IMG_2290');
    res('ele', -12, 'Cache de boîte de dérivation manquant dans la chambre', 'levee', '', -8);
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM} maison · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M10 140 L140 20 L270 140 Z" fill="#D9302A"/>
          <rect x="30" y="140" width="220" height="140" fill="#F5B400"/>
          <rect x="110" y="200" width="60" height="80" fill="#141414"/>
          <rect x="300" y="20" width="250" height="260" fill="#1D4E89"/>
          <rect x="330" y="60" width="190" height="22" fill="#F0EDE6"/>
          <rect x="330" y="110" width="120" height="22" fill="#F0EDE6"/>
          <rect x="390" y="160" width="130" height="22" fill="#F5B400"/>
          <rect x="330" y="210" width="90" height="22" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Pilote de travaux maison</p>
          <h1>Tes travaux, devis par devis.</h1>
          <p>Compare les devis de tes artisans, suis ce qui est engagé et payé, coordonne les interventions et note les défauts à reprendre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton chantier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton chantier est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon chantier</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon chantier'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    document.title = `Bienvenue · ${NOM}`;
    const t = auj();
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ton chantier en deux minutes.</h1>
        <p class="intro">Choisis un modèle : il crée les pièces, les postes de travaux et un planning provisoire, à ajuster avec tes artisans. Tout reste modifiable ensuite.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Nom du chantier<input name="nom" required maxlength="80" placeholder="Ex. : Maison de la rue Haute"></label>
            <label class="champ">Début envisagé des travaux<input type="date" name="debut" value="${ajout(t, 14)}"></label>
          </div>
          <fieldset class="champ sans-cadre"><legend>Modèle de départ</legend>
            <div class="filieres">
              ${B.modeles.map((m, i) => `<label class="filiere modele" style="--c:${['#D9302A', '#1D4E89', '#F5B400'][i % 3]}"><input type="radio" name="modele" value="${m.id}" ${i === 0 ? 'checked' : ''}><b>${esc(m.nom)}</b><span>${esc(m.detail)} · ${pluriel(m.etapes.length, 'poste')}</span></label>`).join('')}
              <label class="filiere modele" style="--c:var(--trait)"><input type="radio" name="modele" value=""><b>Partir de zéro</b><span>Je crée mes pièces et mes postes moi-même</span></label>
            </div>
          </fieldset>
          <label class="champ" style="max-width:320px">Provision pour imprévus (% du budget)<small>Une réserve à garder de côté ; tu pourras la changer.</small><input type="number" name="imprevus" min="0" max="50" step="1" value="${B.imprevusDefaut}"></label>
          <p class="aide">Outil de suivi : les montants sont ceux que tu saisis, le devis signé et les factures font foi. Ce n'est pas un conseil financier, fiscal ni juridique.</p>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer mon chantier</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = String(f.get('nom') || '').trim();
      const err = e.target.querySelector('.erreur');
      if (!nom) { err.textContent = 'Donne un nom à ton chantier.'; e.target.nom.focus(); return; }
      const debut = R.estDate(f.get('debut')) ? f.get('debut') : t;
      const imp = Number(f.get('imprevus'));
      E = etatVide();
      E.chantier = { nom, debut };
      E.reglages.imprevus = Number.isFinite(imp) && imp >= 0 && imp <= 50 ? imp : B.imprevusDefaut;
      const m = B.modeles.find((x) => x.id === f.get('modele'));
      if (m) { const r = R.appliquerModele(m, debut, B, uid); E.pieces = r.pieces; E.postes = r.postes; E.interventions = r.interventions; }
      sauver();
      demarrer();
      toast(m ? `Chantier créé avec ${pluriel(E.postes.length, 'poste')}. Ajoute tes premiers devis.` : 'Chantier créé. Ajoute ton premier poste.');
      if (!m) setTimeout(() => modalePoste(), 250);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    devis: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="18" fill="currentColor"/><rect x="13" y="8" width="8" height="13" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="10" height="4" fill="currentColor"/><rect x="8" y="10" width="12" height="4" fill="currentColor"/><rect x="14" y="16" width="8" height="4" fill="currentColor"/></svg>',
    reserves: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 12l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['devis', 'Devis'], ['budget', 'Budget'], ['planning', 'Planning'], ['reserves', 'Réserves'], ['guide', 'Guide']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (filtre.pieceId && filtre.pieceId !== '__tout' && !piece(filtre.pieceId)) filtre.pieceId = '';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/travaux/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Pilote<br>de travaux</span>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · ${NOM}`;
    $('#vue').innerHTML = { devis: vueDevis, budget: vueBudget, planning: vuePlanning, reserves: vueReserves, guide: vueGuide }[vue]();
    if (vue === 'devis') $('#filtre-piece')?.addEventListener('change', (e) => { filtre.pieceId = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 44 L36 8 L72 44 Z" fill="#D9302A"/><rect x="8" y="44" width="56" height="52" fill="#F5B400"/><circle cx="78" cy="78" r="18" fill="#1D4E89"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const tuile = (surtitre, valeur, detail, c, rond = false) => `<div class="tuile ${rond ? 'rond' : ''}" style="--c:${c}"><p class="surtitre">${surtitre}</p><b>${valeur}</b><span>${detail}</span></div>`;

  // ---------- Vue Devis (comparateur par poste) ----------
  const LIB_ALERTE = {
    assurance: ['rouge', 'Assurance non déclarée'],
    'assurance-inconnue': ['jaune', 'Assurance à demander'],
    tva: ['jaune', 'Taux mixte ou à vérifier'],
    montants: ['rouge', 'TTC inférieur au HT'],
    inclus: ['contour', 'Contenu non noté'],
  };

  function etatPoste(p) {
    const n = E.devis.filter((d) => d.posteId === p.id).length;
    if (p.retenuId && devisDe(p.retenuId)) return ['bleu', `Retenu · ${artisanRetenu(p)?.nom || 'artisan'}`];
    if (!n) return ['jaune', 'À chiffrer'];
    return ['encre', `${pluriel(n, 'devis', 'devis')} à comparer`];
  }

  function vueDevis() {
    if (!E.postes.length) return `<div class="vue-tete"><div><h1>Devis</h1><p>${esc(E.chantier.nom)}</p></div></div>${videEtat('Aucun poste de travaux', 'Un poste = un corps de métier dans une pièce (ex. : carrelage de la salle de bains). Ajoute-le, puis les devis reçus pour le comparer.', '<button class="btn primaire" data-action="poste-nouveau">Ajouter un poste</button><button class="btn" data-action="modele">Appliquer un modèle</button>')}`;
    const g = R.budgetGlobal(E);
    const retenus = E.postes.filter((p) => p.retenuId && devisDe(p.retenuId)).length;
    const groupes = [{ id: null, nom: 'Tout le logement' }, ...E.pieces].filter((x) => !filtre.pieceId || (filtre.pieceId === '__tout' ? x.id === null : x.id === filtre.pieceId));
    const blocs = groupes.map((gr) => {
      const liste = postesTries().filter((p) => (p.pieceId || null) === gr.id || (gr.id === null && p.pieceId && !piece(p.pieceId)));
      if (!liste.length) return '';
      return `<h2 class="titre-section">${esc(gr.nom)} <span>${pluriel(liste.length, 'poste')}</span></h2><div class="postes">${liste.map(cartePoste).join('')}</div>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Devis</h1><p>${esc(E.chantier.nom)} · ${pluriel(E.postes.length, 'poste')}, ${retenus} retenu${retenus > 1 ? 's' : ''}, ${pluriel(g.aChiffrer, 'poste')} sans devis retenu.</p></div>
        <div class="actions"><button class="btn primaire" data-action="devis-nouveau">Ajouter un devis</button><button class="btn" data-action="poste-nouveau">Nouveau poste</button><button class="btn" data-action="artisans">Artisans (${E.artisans.length})</button></div></div>
      <div class="filtres-ligne">
        <label class="champ">Pièce<select id="filtre-piece"><option value="">Toutes les pièces</option><option value="__tout" ${filtre.pieceId === '__tout' ? 'selected' : ''}>Tout le logement</option>${E.pieces.map((x) => `<option value="${x.id}" ${x.id === filtre.pieceId ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <p class="legende-alertes"><span class="etiquette rouge">Rouge</span> à régler avant de signer · <span class="etiquette jaune">Jaune</span> à vérifier</p>
      </div>
      ${blocs || videEtat('Aucun poste dans cette pièce', 'Choisis une autre pièce ou ajoute un poste.', '<button class="btn" data-action="poste-nouveau">Nouveau poste</button>')}`;
  }

  function cartePoste(p) {
    const [c, lib] = etatPoste(p);
    const liste = R.comparer(E.devis.filter((d) => d.posteId === p.id), B.tva.taux);
    const b = R.budgetPoste(p, E);
    const tp = type(p.code);
    return `<article class="poste" id="poste-${p.id}">
      <header class="poste-tete">
        <div><p class="surtitre">${esc(tp.metier)}</p><h3>${esc(p.nom)}</h3></div>
        <div class="poste-chiffres"><span>Prévu <b>${p.budget ? eur(p.budget) : '–'}</b></span>${b.retenu ? `<span>Retenu <b>${eur(b.devis)}</b></span>` : ''}<span class="etiquette ${c}">${esc(lib)}</span></div>
      </header>
      ${p.notes ? `<p class="poste-notes">${esc(p.notes)}</p>` : ''}
      ${liste.length ? `<div class="comparateur">${liste.map((d) => carteDevis(d, p)).join('')}</div>` : '<p class="poste-vide">Aucun devis pour ce poste. Demandes-en au moins deux pour comparer à périmètre égal.</p>'}
      <details class="verifier"><summary>Points à vérifier sur un devis de ${esc(tp.nom.toLowerCase())}</summary><ul>${tp.verifier.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></details>
      <div class="poste-pied"><button class="btn petit" data-action="devis-nouveau" data-poste="${p.id}">Ajouter un devis</button><button class="btn petit lien" data-action="poste-modifier" data-id="${p.id}">Modifier le poste</button></div>
    </article>`;
  }

  function carteDevis(d, p) {
    const a = artisan(d.artisanId);
    const retenu = p.retenuId === d.id;
    const etoiles = `<span class="points" aria-label="Note ${d.note || 0} sur 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= (d.note || 0) ? 'plein' : ''}"></i>`).join('')}</span>`;
    const assurance = d.assurance === true ? 'Oui' : d.assurance === false ? 'Non' : 'Inconnue';
    return `<div class="devis ${retenu ? 'retenu' : ''}">
      <div class="devis-tete"><b>${esc(a?.nom || 'Artisan inconnu')}</b>${retenu ? '<span class="etiquette bleu">Retenu</span>' : d.moinsCher ? '<span class="etiquette">Moins cher</span>' : ''}</div>
      <p class="devis-ttc">${eur(d.ttc)} <small>TTC</small></p>
      <p class="devis-sous">${eur(d.ht)} HT · TVA ${d.taux === null ? '–' : pct(d.taux)}${d.ecart ? ` · <b>+${eur(d.ecart)}</b> (+${pct(d.ecartPct)})` : ''}</p>
      <dl class="devis-dl">
        <dt>Inclus</dt><dd>${esc(d.inclus) || '<i>non noté</i>'}</dd>
        ${d.exclus ? `<dt>Non inclus</dt><dd>${esc(d.exclus)}</dd>` : ''}
        <dt>Délai</dt><dd>${esc(d.delai) || '–'}</dd>
        <dt>Assurance</dt><dd>${assurance}</dd>
        <dt>Note</dt><dd>${etoiles}</dd>
      </dl>
      ${d.alertes.length ? `<p class="devis-alertes">${d.alertes.map((x) => `<span class="etiquette ${LIB_ALERTE[x][0]}">${LIB_ALERTE[x][1]}</span>`).join('')}</p>` : ''}
      <div class="devis-actions">${retenu ? `<button class="btn petit" data-action="devis-liberer" data-id="${d.id}">Ne plus retenir</button>` : `<button class="btn petit primaire" data-action="devis-retenir" data-id="${d.id}">Retenir</button>`}<button class="btn petit lien" data-action="devis-modifier" data-id="${d.id}">Modifier</button></div>
    </div>`;
  }

  // ---------- Vue Budget ----------
  function vueBudget() {
    const g = R.budgetGlobal(E);
    const lignes = g.postes.filter((x) => x.prevu || x.engage || x.paye).sort((a, b) => type(a.poste.code).rang - type(b.poste.code).rang);
    const max = Math.max(1, ...lignes.map((x) => Math.max(x.prevu, x.engage, x.paye)));
    const w = (v) => `${Math.max(0, (v / max) * 100).toFixed(2)}%`;
    const conso = g.consommation;
    const barres = lignes.map((x) => {
      const paye = Math.min(x.paye, Math.max(x.engage, x.paye));
      const engageNonPaye = Math.max(0, x.engage - x.paye);
      const prevuLibre = Math.max(0, x.prevu - Math.max(x.engage, x.paye));
      const depasse = x.prevu > 0 && x.engage > x.prevu;
      const titre = `${x.poste.nom} : prévu ${eur(x.prevu)}, engagé ${eur(x.engage)}, payé ${eur(x.paye)}`;
      return `<div class="barre-ligne" title="${esc(titre)}">
        <span class="barre-nom">${esc(x.poste.nom)}<small>${esc(nomPiece(x.poste.pieceId))}</small></span>
        <span class="barre-piste" aria-hidden="true">
          ${paye ? `<i class="seg paye" style="width:${w(paye)}"></i>` : ''}${engageNonPaye ? `<i class="seg engage" style="width:${w(engageNonPaye)}"></i>` : ''}${prevuLibre ? `<i class="seg libre" style="width:${w(prevuLibre)}"></i>` : ''}
          ${depasse ? `<i class="repere" style="left:${w(x.prevu)}"></i>` : ''}
        </span>
        <span class="barre-val">${eur(x.engage || x.prevu)}${depasse ? `<small class="alerte">+${eur(x.ecart)} sur le prévu</small>` : x.engage ? `<small>sur ${eur(x.prevu)} prévus</small>` : '<small>prévu, rien d\'engagé</small>'}</span>
      </div>`;
    }).join('');
    const paiements = [...E.paiements].sort((a, b) => b.date.localeCompare(a.date));
    const imprevus = [...E.imprevus].sort((a, b) => b.date.localeCompare(a.date));
    return `
      <div class="vue-tete"><div><h1>Budget</h1><p>Prévu = ton budget par poste. Engagé = devis retenus + imprévus. Payé = acomptes et soldes versés.</p></div>
        <div class="actions"><button class="btn primaire" data-action="paiement-nouveau">Noter un paiement</button><button class="btn" data-action="imprevu-nouveau">Noter un imprévu</button></div></div>
      <div class="tuiles">
        ${tuile('Prévu', eur(g.prevu), `+ ${eur(g.provision)} d'imprévus (${pct(E.reglages.imprevus)})`, 'var(--jaune)')}
        ${tuile('Engagé', eur(g.engage), g.depasse ? `<b class="alerte">Au-delà de l'enveloppe de ${eur(g.enveloppe)}</b>` : `${pluriel(g.aChiffrer, 'poste')} sans devis retenu`, g.depasse ? 'var(--rouge)' : 'var(--bleu)')}
        ${tuile('Payé', eur(g.paye), g.engage ? `${Math.round((g.paye / g.engage) * 100)} % de l'engagé` : 'Rien d\'engagé', 'var(--encre)', true)}
        ${tuile('Reste à payer', eur(g.reste), 'Sur les devis retenus et imprévus', 'var(--rouge)', true)}
      </div>
      <div class="provision ${conso !== null && conso > 100 ? 'depassee' : ''}">
        <div><p class="surtitre">Provision pour imprévus</p><p><b>${eur(g.imprevusReels)}</b> d'imprévus sur une provision de <b>${eur(g.provision)}</b>${conso === null ? '' : ` : ${conso} % consommés`}.</p></div>
        <div class="jauge" role="img" aria-label="${conso === null ? 'Pas de provision' : `${conso} % de la provision consommée`}"><i style="width:${Math.min(100, conso || 0)}%"></i></div>
      </div>
      <section class="graphique budget-graph" aria-labelledby="t-graph">
        <div class="graphique-tete"><h2 id="t-graph">Par poste</h2>
          <div class="legende"><span><i style="background:var(--encre)"></i>Payé</span><span><i style="background:var(--bleu)"></i>Engagé, non payé</span><span><i style="background:var(--surface)"></i>Prévu, pas encore engagé</span><span><i class="repere-legende"></i>Budget prévu dépassé</span></div></div>
        ${barres || '<p class="poste-vide">Indique un budget prévu sur tes postes (onglet Devis, « Modifier le poste ») pour voir la répartition.</p>'}
      </section>
      <h2 class="titre-section">Tableau <span>Valeurs exactes par poste</span></h2>
      <div class="defile"><table class="tableau">
        <thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Engagé</th><th class="nb">Payé</th><th class="nb">Reste</th><th class="nb">Écart</th></tr></thead>
        <tbody>${g.postes.map((x) => `<tr><td><b>${esc(x.poste.nom)}</b><br><small>${esc(nomPiece(x.poste.pieceId))}</small></td><td class="nb">${eur(x.prevu)}</td><td class="nb">${eur(x.engage)}</td><td class="nb">${eur(x.paye)}</td><td class="nb">${eur(x.reste)}</td><td class="nb ${x.ecart > 0 && x.prevu ? 'alerte' : ''}">${x.retenu ? (x.ecart > 0 ? '+' : '') + eur(x.ecart) : '–'}</td></tr>`).join('')}
        ${g.imprevusGeneraux ? `<tr><td><b>Imprévus généraux</b></td><td class="nb">–</td><td class="nb">${eur(g.imprevusGeneraux)}</td><td class="nb">–</td><td class="nb">–</td><td class="nb">–</td></tr>` : ''}
        <tr class="total"><td>Total</td><td class="nb">${eur(g.prevu)}</td><td class="nb">${eur(g.engage)}</td><td class="nb">${eur(g.paye)}</td><td class="nb">${eur(g.reste)}</td><td class="nb ${g.ecartRetenus > 0 ? 'alerte' : ''}">${(g.ecartRetenus > 0 ? '+' : '') + eur(g.ecartRetenus)}</td></tr></tbody>
      </table></div>
      <p class="note-tableau">Écart = engagé − prévu, calculé sur les postes dont un devis est retenu.</p>
      <div class="deux-colonnes">
        <section><h2 class="titre-section">Paiements <span>${pluriel(paiements.length, 'paiement')}</span></h2>
          ${paiements.length ? `<ul class="liste-simple">${paiements.map((x) => `<li><button data-action="paiement-modifier" data-id="${x.id}"><span><b>${esc(x.libelle || 'Paiement')}</b><small>${fmtCourt(x.date)} · ${esc(poste(x.posteId)?.nom || 'Général')}</small></span><b>${eur(x.montant)}</b></button></li>`).join('')}</ul>` : '<p class="poste-vide">Aucun paiement noté. Note chaque acompte et chaque solde à la date du virement.</p>'}</section>
        <section><h2 class="titre-section">Imprévus <span>${pluriel(imprevus.length, 'imprévu')}</span></h2>
          ${imprevus.length ? `<ul class="liste-simple">${imprevus.map((x) => `<li><button data-action="imprevu-modifier" data-id="${x.id}"><span><b>${esc(x.libelle)}</b><small>${fmtCourt(x.date)} · ${esc(poste(x.posteId)?.nom || 'Général')}</small></span><b>${eur(x.montant)}</b></button></li>`).join('')}</ul>` : '<p class="poste-vide">Aucun imprévu pour l\'instant. Un supplément accepté en cours de chantier se note ici (avec un avenant écrit de l\'artisan).</p>'}</section>
      </div>
      <p class="aide avertissement"><b>Argent :</b> outil de suivi personnel. Les montants sont ceux que tu saisis ; le devis signé, les avenants et les factures font foi. Ce n'est pas un conseil financier, fiscal ni juridique.</p>`;
  }

  // ---------- Vue Planning ----------
  const ETAT_INTER = { terminee: ['gris', 'Terminée'], 'en-cours': ['rouge', 'En cours'], 'a-venir': ['bleu', 'À venir'] };
  const TYPE_CHEV = { 'meme-piece': ['rouge', 'Même pièce'], 'meme-artisan': ['rouge', 'Même artisan'], parallele: ['contour', 'En parallèle'] };

  function vuePlanning() {
    const t = auj();
    const l = [...E.interventions].sort((a, b) => a.debut.localeCompare(b.debut) || rangIntervention(a) - rangIntervention(b));
    const tete = `<div class="vue-tete"><div><h1>Planning</h1><p>Interventions par artisan. Les chevauchements et les ordres inhabituels sont signalés : à confirmer avec les artisans concernés.</p></div>
      <div class="actions"><button class="btn primaire" data-action="inter-nouvelle">Nouvelle intervention</button><button class="btn" data-action="modele">Appliquer un modèle</button></div></div>`;
    if (!l.length) return tete + videEtat('Aucune intervention', 'Ajoute les dates annoncées par tes artisans, ou applique un modèle de planning pour partir d\'un enchaînement habituel.', '<button class="btn primaire" data-action="inter-nouvelle">Nouvelle intervention</button><button class="btn" data-action="modele">Appliquer un modèle</button>');
    const chev = R.chevauchements(l, pieceIntervention, rangIntervention);
    const ordre = R.ordreInhabituel(l, rangIntervention, pieceIntervention);
    const inter = (id) => E.interventions.find((x) => x.id === id);
    const alertesDe = new Set([...chev.filter((c) => c.type !== 'parallele').flatMap((c) => [c.a, c.b]), ...ordre.flatMap((o) => [o.avant, o.apres])]);
    const bo = R.bornes(l);
    const pos = (d) => (ecart(bo.debut, d) / bo.jours) * 100;
    // Repères : un par semaine (lundi), ou par mois pour une longue frise.
    const reperes = [];
    const pas = bo.jours > 120 ? 30 : bo.jours > 50 ? 14 : 7;
    let d = bo.debut;
    while (versDate(d).getDay() !== 1) d = ajout(d, 1);
    for (; d <= bo.fin; d = ajout(d, pas)) reperes.push(d);
    const ticks = reperes.map((r) => `<i class="frise-tick" style="left:${pos(r).toFixed(2)}%"></i>`).join('');
    const auj_ = t >= bo.debut && t <= bo.fin ? `<i class="frise-auj" style="left:${pos(t).toFixed(2)}%" title="Aujourd'hui"></i>` : '';
    const lignes = l.map((i) => {
      const e = R.etatIntervention(i, t);
      const a = artisan(i.artisanId);
      const left = pos(i.debut), width = ((ecart(i.debut, i.fin) + 1) / bo.jours) * 100;
      return `<button class="frise-ligne" data-action="inter-modifier" data-id="${i.id}">
        <span class="frise-nom"><b>${esc(nomIntervention(i))}${alertesDe.has(i.id) ? ' <em class="signal" aria-label="Alerte">!</em>' : ''}</b><small>${esc(a?.nom || 'Artisan à choisir')} · ${esc(nomPiece(pieceIntervention(i)))}</small></span>
        <span class="frise-piste">${ticks}${auj_}<i class="frise-barre ${e} ${i.provisoire ? 'provisoire' : ''}" style="left:${left.toFixed(2)}%;width:${Math.max(width, 1.5).toFixed(2)}%"></i></span>
        <span class="frise-dates">${fmt(i.debut)} → ${fmt(i.fin)}<small>${ETAT_INTER[e][1]}${i.provisoire ? ' · à confirmer' : ''}</small></span>
      </button>`;
    }).join('');
    const listeAlertes = [
      ...ordre.map((o) => `<li><span class="etiquette rouge">Ordre</span><span><b>${esc(nomIntervention(inter(o.apres)))}</b> commence avant <b>${esc(nomIntervention(inter(o.avant)))}</b> (${esc(nomPiece(pieceIntervention(inter(o.apres)) ?? pieceIntervention(inter(o.avant))))}) : d'habitude, c'est l'inverse.</span></li>`),
      ...chev.map((c) => `<li><span class="etiquette ${TYPE_CHEV[c.type][0]}">${TYPE_CHEV[c.type][1]}</span><span><b>${esc(nomIntervention(inter(c.a)))}</b> et <b>${esc(nomIntervention(inter(c.b)))}</b> se chevauchent ${pluriel(c.jours, 'jour')}${c.type === 'meme-artisan' ? ' avec le même artisan' : c.type === 'meme-piece' ? ' dans la même zone' : ' (corps de métier différents, à coordonner)'}.</span></li>`),
    ];
    const enCours = l.filter((i) => R.etatIntervention(i, t) === 'en-cours').length;
    const aVenir = l.filter((i) => R.etatIntervention(i, t) === 'a-venir').length;
    return `${tete}
      <div class="tuiles">
        ${tuile('Début', fmt(bo.debut), fmtCourt(bo.debut), 'var(--jaune)')}
        ${tuile('Fin prévue', fmt(bo.fin), `${pluriel(bo.jours, 'jour')} de chantier`, 'var(--bleu)')}
        ${tuile('En cours', String(enCours), `${aVenir} à venir`, 'var(--rouge)', true)}
        ${tuile('Alertes', String(listeAlertes.length), listeAlertes.length ? 'À voir avec les artisans' : 'Aucun chevauchement', 'var(--encre)', true)}
      </div>
      <section class="frise" aria-label="Frise des interventions">
        <div class="legende-planning"><span><i style="background:var(--gris)"></i>Terminée</span><span><i style="background:var(--rouge)"></i>En cours</span><span><i style="background:var(--bleu)"></i>À venir</span><span><i class="hachure"></i>Dates à confirmer</span><span><i style="background:var(--jaune)"></i>Aujourd'hui</span></div>
        <div class="frise-ligne frise-echelle" aria-hidden="true"><span class="frise-nom"></span><span class="frise-piste">${reperes.map((r) => `<em style="left:${pos(r).toFixed(2)}%">${fmt(r)}</em>`).join('')}</span><span class="frise-dates"></span></div>
        ${lignes}
      </section>
      <h2 class="titre-section">Alertes <span>${listeAlertes.length ? 'Ce qui mérite un appel avant le démarrage' : 'Rien à signaler'}</span></h2>
      ${listeAlertes.length ? `<ul class="alertes">${listeAlertes.join('')}</ul>` : '<p class="poste-vide">Aucun chevauchement ni ordre inhabituel.</p>'}`;
  }

  // ---------- Vue Réserves ----------
  function vueReserves() {
    const t = auj();
    const c = R.compteReserves(E.reserves);
    const tete = `<div class="vue-tete"><div><h1>Réserves</h1><p>Les défauts constatés en fin de travaux, poste par poste, jusqu'à leur reprise par l'artisan.</p></div>
      <div class="actions"><button class="btn primaire" data-action="reserve-nouvelle">Nouvelle réserve</button></div></div>`;
    const avecPostes = postesTries().filter((p) => p.reception || E.reserves.some((r) => r.posteId === p.id));
    const blocs = avecPostes.map((p) => {
      const rs = E.reserves.filter((r) => r.posteId === p.id).sort((a, b) => (a.statut === 'levee') - (b.statut === 'levee') || a.constat.localeCompare(b.constat));
      const gpa = R.garantie(p.reception, t);
      const a = artisanRetenu(p);
      return `<article class="poste">
        <header class="poste-tete"><div><p class="surtitre">${esc(nomPiece(p.pieceId))}${a ? ` · ${esc(a.nom)}` : ''}</p><h3>${esc(p.nom)}</h3></div>
          <div class="poste-chiffres">${(() => { const k = R.compteReserves(rs); return k.ouvertes ? `<span class="etiquette rouge">${pluriel(k.ouvertes, 'ouverte')}</span>` : k.total ? '<span class="etiquette gris">Tout levé</span>' : ''; })()}</div></header>
        <p class="reception">${p.reception ? `Réception le <b>${fmtCourt(p.reception)}</b> · garantie de parfait achèvement ${gpa.active ? `jusqu'au <b>${fmtCourt(gpa.fin)}</b> (${pluriel(gpa.restants, 'jour')})` : `terminée le ${fmtCourt(gpa.fin)}`}` : 'Réception non notée.'} <button class="btn petit lien" data-action="reception" data-id="${p.id}">${p.reception ? 'Modifier' : 'Noter la réception'}</button></p>
        ${rs.length ? `<ul class="reserves">${rs.map((r) => `<li class="${r.statut}">
          <span class="etiquette ${r.statut === 'levee' ? 'gris' : 'jaune'}">${r.statut === 'levee' ? 'Levée' : 'Ouverte'}</span>
          <span class="res-texte"><b>${esc(r.description)}</b><small>Constatée le ${fmtCourt(r.constat)}${r.statut === 'levee' && r.leveeLe ? ` · levée le ${fmtCourt(r.leveeLe)}` : ` · depuis ${pluriel(Math.max(0, ecart(r.constat, t)), 'jour')}`}${r.photo ? ` · photo : ${esc(r.photo)}` : ''}</small></span>
          <span class="res-actions">${r.statut === 'levee' ? `<button class="btn petit" data-action="reserve-rouvrir" data-id="${r.id}">Rouvrir</button>` : `<button class="btn petit primaire" data-action="reserve-lever" data-id="${r.id}">Levée</button>`}<button class="btn petit lien" data-action="reserve-modifier" data-id="${r.id}">Modifier</button></span>
        </li>`).join('')}</ul>` : '<p class="poste-vide">Aucune réserve sur ce poste.</p>'}
        <div class="poste-pied"><button class="btn petit" data-action="reserve-nouvelle" data-poste="${p.id}">Ajouter une réserve</button></div>
      </article>`;
    }).join('');
    return `${tete}
      <div class="tuiles trois">
        ${tuile('Ouvertes', String(c.ouvertes), 'À faire reprendre', 'var(--rouge)')}
        ${tuile('Levées', String(c.levees), 'Reprises constatées', 'var(--bleu)', true)}
        ${tuile('Réceptions', String(E.postes.filter((p) => p.reception).length), `sur ${E.postes.length}`, 'var(--jaune)')}
      </div>
      ${blocs ? `<div class="postes">${blocs}</div>` : videEtat('Aucune réserve', 'À la fin de chaque intervention, fais le tour avec l\'artisan et note ici chaque défaut constaté. Les photos restent sur ton téléphone : note leur nom ou leur numéro.', '<button class="btn primaire" data-action="reserve-nouvelle">Nouvelle réserve</button>')}
      <p class="aide">Garantie de parfait achèvement : un an après la réception, pour les désordres notés au procès-verbal de réception et ceux apparus dans l'année. Source : <a href="${B.garanties.url}" target="_blank" rel="noopener">${esc(B.garanties.source)}</a>, vérifiée le ${fmtCourt(B.garanties.verifieLe)}, consultée le ${fmtCourt(B.garanties.consulteLe)}.</p>`;
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const ordre = [...B.postes].filter((p) => p.code !== 'AUT').sort((a, b) => a.rang - b.rang);
    const T = B.tva;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Comparer des devis, enchaîner les corps de métier, TVA et aides publiques : l'essentiel, avec les sources officielles.</p></div></div>
      <div class="guide">
        <section class="bloc-guide" style="--c:var(--rouge)"><h2>Comparer des devis</h2>
          <ol class="pas">
            <li><span>Demande au moins deux devis par poste, sur la même description des travaux.</span></li>
            <li><span>Note ce qui est <b>inclus</b> et <b>non inclus</b> : fourniture ou pose seule, dépose, évacuation, finitions. Un devis moins cher qui exclut la moitié du travail ne l'est pas.</span></li>
            <li><span>Vérifie l'<b>assurance</b> : demande l'attestation d'assurance de l'artisan et garde-la avec le devis.</span></li>
            <li><span>Regarde la <b>TVA</b> : l'outil déduit le taux des montants HT et TTC. « Taux mixte ou à vérifier » ne veut pas dire erreur (un devis peut mélanger plusieurs taux) : demande le détail.</span></li>
            <li><span>Retiens un devis seulement quand il est signé : c'est lui qui compte dans l'« engagé ».</span></li>
          </ol></section>
        <section class="bloc-guide" style="--c:var(--bleu)"><h2>Ordre habituel des travaux</h2>
          <p>Ordre courant d'une rénovation, du plus tôt au plus tard. Les postes de même rang peuvent avancer ensemble. Chaque chantier a ses exceptions : l'outil signale, il n'interdit rien.</p>
          <ol class="ordre">${[...new Set(ordre.map((p) => p.rang))].map((r) => `<li><span>${r}</span>${ordre.filter((p) => p.rang === r).map((p) => esc(p.nom)).join(' · ')}</li>`).join('')}</ol>
          <p class="note">Modèles de planning : ${B.modeles.map((m) => esc(m.nom.toLowerCase())).join(', ')}. Leurs durées sont des points de départ à remplacer par celles annoncées par tes artisans.</p></section>
        <section class="bloc-guide" style="--c:var(--jaune)"><h2>TVA sur les travaux</h2>
          <p>Pour des travaux dans un logement achevé depuis plus de 2 ans et affecté à l'habitation, en France métropolitaine :</p>
          <ul class="puces">
            <li><b>10 %</b> : travaux d'amélioration, de transformation, d'aménagement ou d'entretien ;</li>
            <li><b>5,5 %</b> : travaux de rénovation ou d'amélioration énergétique (isolation thermique, équipements utilisant une énergie renouvelable, certaines ventilations…) ;</li>
            <li><b>20 %</b> (taux normal) : notamment, depuis le 1er mars 2025, la fourniture et l'installation d'une chaudière fonctionnant avec une énergie fossile.</li>
          </ul>
          <p>Taux différents en Corse, en Guadeloupe, en Martinique et à La Réunion. Le taux exact dépend des travaux : c'est à l'artisan de l'appliquer, à toi de vérifier.</p>
          <p class="source">Source : <a href="${T.url}" target="_blank" rel="noopener">${esc(T.source)}</a>, page vérifiée le ${fmtCourt(T.verifieLe)} par l'administration, consultée le ${fmtCourt(T.consulteLe)}. Les taux peuvent changer avec une loi de finances : vérifie la page avant de signer.</p></section>
        <section class="bloc-guide" style="--c:var(--vert)"><h2>Aides publiques à la rénovation</h2>
          <p>Leurs montants dépendent de tes revenus, de ton logement et des travaux, et changent régulièrement : l'outil n'en affiche aucun. Renseigne-toi <b>avant de signer</b> tes devis, sur les sites officiels :</p>
          <ul class="liens">${B.aides.map((a) => `<li><a href="${a.url}" target="_blank" rel="noopener">${esc(a.nom)}</a>${a.verifieLe ? ` <small>page vérifiée le ${fmtCourt(a.verifieLe)}</small>` : ''}</li>`).join('')}</ul>
          <p class="source">Liens consultés le ${fmtCourt(B.aidesConsulteLe)}. Méfie-toi du démarchage qui promet des aides : passe par ces sites.</p></section>
        <section class="bloc-guide" style="--c:var(--encre)"><h2>Fin de travaux</h2>
          <ul class="puces">
            <li>À la fin de chaque intervention, fais le tour avec l'artisan et note chaque défaut dans l'onglet Réserves.</li>
            <li>Note la date de réception du poste : l'outil affiche la fin de la garantie de parfait achèvement (un an après la réception).</li>
            <li>Garde les photos sur ton téléphone ou dans un dossier partagé ; note leur nom dans la réserve.</li>
          </ul>
          <p class="source">Source : <a href="${B.garanties.url}" target="_blank" rel="noopener">${esc(B.garanties.source)}</a>, vérifiée le ${fmtCourt(B.garanties.verifieLe)}.</p></section>
        <section class="bloc-guide" style="--c:var(--gris)"><h2>Limites de l'outil</h2>
          <ul class="puces">
            <li><b>Argent</b> : outil de suivi personnel, pas un conseil financier, fiscal ni juridique. Le devis signé, les avenants et les factures font foi.</li>
            <li><b>Photos</b> : pas stockées dans l'outil (il n'enregistre que du texte).</li>
            <li><b>Prix</b> : aucun prix moyen n'est proposé ; seuls tes devis comptent.</li>
            <li><b>Données</b> : enregistrées en ligne avec ta clé ; exporte une copie depuis les réglages quand tu veux.</li>
          </ul></section>
      </div>`;
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
  const piedEdition = (existe, libelle = 'Ajouter') => (existe
    ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
    : `<button class="btn primaire" value="ok">${libelle}</button><button class="btn" value="annuler">Annuler</button>`);

  // Modifie l'état avec possibilité d'annuler depuis le toast.
  function modifier(message, faire, annulable = true) {
    const avant = structuredClone(E);
    const r = faire();
    if (r === false) return;
    annulation = annulable ? () => { E = avant; } : null;
    sauver(); rendre();
    toast(message, annulable ? { libelle: 'Annuler', faire: annuler } : undefined);
  }

  const optionsPostes = (choisi, vide = '') => `${vide ? `<option value="">${vide}</option>` : ''}${postesTries().map((p) => `<option value="${p.id}" ${p.id === choisi ? 'selected' : ''}>${esc(p.nom)} · ${esc(nomPiece(p.pieceId))}</option>`).join('')}`;
  const optionsArtisans = (choisi, vide = 'À choisir') => `<option value="">${vide}</option>${[...E.artisans].sort((a, b) => a.nom.localeCompare(b.nom)).map((a) => `<option value="${a.id}" ${a.id === choisi ? 'selected' : ''}>${esc(a.nom)}${a.metier ? ` · ${esc(a.metier)}` : ''}</option>`).join('')}<option value="__nouveau">+ Nouvel artisan…</option>`;
  const optionsPieces = (choisi) => `<option value="">Tout le logement</option>${E.pieces.map((x) => `<option value="${x.id}" ${x.id === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}<option value="__nouvelle">+ Nouvelle pièce…</option>`;
  const texte = (f, k) => String(f.get(k) || '').trim();

  function resoudreArtisan(f, metier = '') {
    let id = f.get('artisanId') || null;
    if (id !== '__nouveau') return id;
    const nom = texte(f, 'nouvelArtisan');
    if (!nom) return { erreur: 'Indique le nom du nouvel artisan.' };
    const ex = E.artisans.find((a) => R.plat(a.nom) === R.plat(nom));
    if (ex) return ex.id;
    const a = { id: uid(), nom, metier, contact: '' };
    E.artisans.push(a);
    return a.id;
  }
  function brancherNouveau(d, sel, champ) {
    const s = $(sel, d), c = $(champ, d);
    if (!s || !c) return;
    const maj = () => { c.hidden = !['__nouveau', '__nouvelle'].includes(s.value); if (!c.hidden) c.querySelector('input').focus(); };
    s.addEventListener('change', maj);
  }

  function modalePoste(id) {
    const p = id ? poste(id) : null;
    const nbDevis = p ? E.devis.filter((d) => d.posteId === p.id).length : 0;
    const corps = `
      <div class="grille-2">
        <label class="champ">Type de poste<select name="code" id="m-code">${B.postes.map((x) => `<option value="${x.code}" ${x.code === (p?.code || 'AUT') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Intitulé<input name="nom" required maxlength="80" value="${esc(p?.nom || '')}" placeholder="Ex. : Carrelage de la salle de bains"></label>
      </div>
      <div class="grille-2">
        <label class="champ">Pièce<select name="pieceId" id="m-piece">${optionsPieces(p?.pieceId || filtre.pieceId.replace('__tout', ''))}</select></label>
        <label class="champ">Budget prévu (TTC, €)<input name="budget" inputmode="decimal" value="${valeurMontant(p?.budget || '')}" placeholder="Ex. : 3 500"></label>
      </div>
      <label class="champ" id="m-nouvelle" hidden>Nom de la nouvelle pièce<input name="nouvellePiece" maxlength="40"></label>
      <label class="champ">Notes<textarea name="notes" maxlength="400" placeholder="Ce que tu veux, contraintes, choix de matériaux…">${esc(p?.notes || '')}</textarea></label>
      ${p && nbDevis ? `<p class="aide">${pluriel(nbDevis, 'devis', 'devis')} sur ce poste. Supprimer le poste supprime aussi ses devis, paiements, imprévus, interventions et réserves (annulable quelques secondes).</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le poste' : 'Nouveau poste', corps, piedEdition(!!p), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${p.nom} » et tout ce qui s'y rattache ?`)) return '';
        modifier(`« ${p.nom} » supprimé.`, () => {
          E.postes = E.postes.filter((x) => x.id !== p.id);
          for (const k of ['devis', 'paiements', 'imprevus', 'interventions', 'reserves']) E[k] = E[k].filter((x) => x.posteId !== p.id);
        });
        return;
      }
      const nom = texte(f, 'nom');
      if (!nom) return 'Donne un intitulé au poste.';
      const brut = texte(f, 'budget');
      const budget = brut ? R.montant(brut) : 0;
      if (budget === null) return 'Budget prévu : un montant en euros (ex. : 3 500 ou 3500,50).';
      let pieceId = f.get('pieceId') || null;
      return modifier(p ? 'Poste enregistré.' : `« ${nom} » ajouté.`, () => {
        if (pieceId === '__nouvelle') {
          const n = texte(f, 'nouvellePiece') || 'Nouvelle pièce';
          const ex = E.pieces.find((x) => R.plat(x.nom) === R.plat(n));
          if (ex) pieceId = ex.id; else { const x = { id: uid(), nom: n }; E.pieces.push(x); pieceId = x.id; }
        }
        const champs = { code: f.get('code'), nom, pieceId, budget, notes: texte(f, 'notes') };
        if (p) Object.assign(poste(p.id), champs);
        else E.postes.push({ id: uid(), ...champs, retenuId: null, reception: null });
      });
    });
    const d = modale();
    brancherNouveau(d, '#m-piece', '#m-nouvelle');
    const nomChamp = $('[name=nom]', d);
    $('#m-code', d).addEventListener('change', (e) => { if (!nomChamp.value.trim() || B.postes.some((x) => x.nom === nomChamp.value)) nomChamp.value = type(e.target.value).nom; });
    if (!p && !nomChamp.value) nomChamp.value = type('AUT').nom;
  }

  function modaleDevis(id, posteDefaut) {
    if (!E.postes.length) { modalePoste(); return; }
    const d0 = id ? devisDe(id) : null;
    const posteId = d0?.posteId || posteDefaut || postesTries()[0].id;
    const p = poste(posteId);
    const retenu = d0 && p?.retenuId === d0.id;
    const corps = `
      <label class="champ">Poste<select name="posteId">${optionsPostes(posteId)}</select></label>
      <div class="grille-2">
        <label class="champ">Artisan<select name="artisanId" id="m-art">${optionsArtisans(d0?.artisanId || '')}</select></label>
        <label class="champ">Référence du devis<input name="ref" maxlength="40" value="${esc(d0?.ref || '')}" placeholder="Facultatif"></label>
      </div>
      <label class="champ" id="m-nouvel" hidden>Nom du nouvel artisan<input name="nouvelArtisan" maxlength="80"></label>
      <div class="grille-3">
        <label class="champ">Montant HT (€)<input name="ht" inputmode="decimal" required value="${valeurMontant(d0?.ht)}"></label>
        <label class="champ">Montant TTC (€)<input name="ttc" inputmode="decimal" required value="${valeurMontant(d0?.ttc)}"></label>
        <label class="champ">TVA déduite<output id="m-tva" class="sortie">–</output></label>
      </div>
      <label class="champ">Ce qui est inclus<small>Fournitures, dépose, évacuation, finitions…</small><textarea name="inclus" maxlength="500">${esc(d0?.inclus || '')}</textarea></label>
      <label class="champ">Ce qui n'est pas inclus<input name="exclus" maxlength="300" value="${esc(d0?.exclus || '')}"></label>
      <div class="grille-2">
        <label class="champ">Délai annoncé<input name="delai" maxlength="80" value="${esc(d0?.delai || '')}" placeholder="Ex. : 2 semaines, début en mars"></label>
        <label class="champ">Date du devis<input type="date" name="date" value="${d0?.date || auj()}"></label>
      </div>
      <fieldset class="champ sans-cadre"><legend>Assurance déclarée (attestation fournie)</legend>
        <div class="bascule-ligne">${[['oui', 'Oui', true], ['non', 'Non', false], ['inconnue', 'Je ne sais pas', null]].map(([v, l, x]) => `<label class="choix"><input type="radio" name="assurance" value="${v}" ${(d0 ? d0.assurance === x : x === null) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <fieldset class="champ sans-cadre"><legend>Ta note (accueil, clarté, confiance)</legend>
        <div class="bascule-ligne">${[0, 1, 2, 3, 4, 5].map((n) => `<label class="choix"><input type="radio" name="note" value="${n}" ${(d0?.note || 0) === n ? 'checked' : ''}><span>${n || '–'}</span></label>`).join('')}</div></fieldset>
      ${d0 ? '' : '<label class="case"><input type="checkbox" name="retenir"> Retenir ce devis (signé)</label>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(d0 ? 'Modifier le devis' : 'Nouveau devis', corps, piedEdition(!!d0), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm('Supprimer ce devis ?')) return '';
        modifier('Devis supprimé.', () => {
          E.devis = E.devis.filter((x) => x.id !== d0.id);
          E.postes.forEach((x) => { if (x.retenuId === d0.id) x.retenuId = null; });
        });
        return;
      }
      const ht = R.montant(f.get('ht')), ttc = R.montant(f.get('ttc'));
      if (!ht || !ttc) return 'Indique les montants HT et TTC du devis (ex. : 3 100 et 3 410).';
      if (ttc < ht) return 'Le montant TTC ne peut pas être inférieur au montant HT.';
      const as = { oui: true, non: false }[f.get('assurance')] ?? null;
      const nouveauPoste = f.get('posteId');
      const avant = structuredClone(E);
      const artisanId = resoudreArtisan(f, type(poste(nouveauPoste)?.code).metier);
      if (artisanId && artisanId.erreur) { E = avant; return artisanId.erreur; }
      if (!artisanId) { E = avant; return 'Choisis l\'artisan (ou crée-le).'; }
      const champs = { posteId: nouveauPoste, artisanId, ref: texte(f, 'ref'), ht, ttc, inclus: texte(f, 'inclus'), exclus: texte(f, 'exclus'), delai: texte(f, 'delai'), date: f.get('date') || null, assurance: as, note: Number(f.get('note')) || 0 };
      if (d0) {
        const x = devisDe(d0.id);
        if (x.posteId !== nouveauPoste) E.postes.forEach((q) => { if (q.retenuId === x.id) q.retenuId = null; });
        Object.assign(x, champs);
      } else {
        const n = { id: uid(), ...champs };
        E.devis.push(n);
        if (f.get('retenir')) poste(nouveauPoste).retenuId = n.id;
      }
      annulation = () => { E = avant; };
      sauver(); rendre();
      toast(d0 ? 'Devis enregistré.' : `Devis ajouté${f.get('retenir') ? ' et retenu' : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    brancherNouveau(d, '#m-art', '#m-nouvel');
    const majTva = () => {
      const t = R.tauxImplicite(R.montant($('[name=ht]', d).value), R.montant($('[name=ttc]', d).value));
      const o = $('#m-tva', d);
      o.textContent = t === null ? '–' : `${pct(t)}${R.tauxConnu(t, B.tva.taux) ? '' : ' · à vérifier'}`;
      o.dataset.alerte = t !== null && !R.tauxConnu(t, B.tva.taux) ? 'oui' : '';
    };
    $('[name=ht]', d).addEventListener('input', majTva);
    $('[name=ttc]', d).addEventListener('input', majTva);
    majTva();
    if (retenu) $('.modale-corps', d).insertAdjacentHTML('afterbegin', '<p class="aide">Devis retenu pour ce poste : son montant TTC compte dans l\'engagé.</p>');
  }

  function retenir(id, oui) {
    const d = devisDe(id);
    const p = poste(d?.posteId);
    if (!p) return;
    modifier(oui ? `Devis de ${artisan(d.artisanId)?.nom || 'l\'artisan'} retenu : ${eur(d.ttc)} engagés.` : 'Devis libéré : le poste revient « à comparer ».', () => { p.retenuId = oui ? d.id : null; });
  }

  function modaleMontant(genre, id) {
    const liste = genre === 'paiement' ? E.paiements : E.imprevus;
    const x = id ? liste.find((y) => y.id === id) : null;
    const estPaiement = genre === 'paiement';
    const corps = `
      <label class="champ">Poste<select name="posteId">${optionsPostes(x?.posteId || '', estPaiement ? 'Général (sans poste)' : 'Général (tout le chantier)')}</select></label>
      <label class="champ">${estPaiement ? 'Libellé' : 'Ce qui s\'est passé'}<input name="libelle" maxlength="120" ${estPaiement ? '' : 'required'} value="${esc(x?.libelle || '')}" placeholder="${estPaiement ? 'Ex. : Acompte 30 %' : 'Ex. : Poutre à renforcer découverte à la dépose'}"></label>
      <div class="grille-2">
        <label class="champ">Montant TTC (€)<input name="montant" inputmode="decimal" required value="${valeurMontant(x?.montant)}"></label>
        <label class="champ">Date<input type="date" name="date" value="${x?.date || auj()}" required></label>
      </div>
      ${estPaiement ? '' : '<p class="aide">Un imprévu augmente l\'engagé du poste et consomme la provision pour imprévus. Demande un avenant écrit à l\'artisan.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? (estPaiement ? 'Modifier le paiement' : 'Modifier l\'imprévu') : (estPaiement ? 'Noter un paiement' : 'Noter un imprévu'), corps, piedEdition(!!x), (f, action) => {
      const cle = estPaiement ? 'paiements' : 'imprevus';
      if (action === 'supprimer') { modifier(estPaiement ? 'Paiement supprimé.' : 'Imprévu supprimé.', () => { E[cle] = E[cle].filter((y) => y.id !== x.id); }); return; }
      const montant = R.montant(f.get('montant'));
      if (!montant) return 'Indique un montant en euros.';
      if (!R.estDate(f.get('date'))) return 'Indique la date.';
      const libelle = texte(f, 'libelle');
      if (!estPaiement && !libelle) return 'Décris l\'imprévu en quelques mots.';
      const champs = { posteId: f.get('posteId') || null, libelle, montant, date: f.get('date') };
      modifier(x ? 'Enregistré.' : `${estPaiement ? 'Paiement' : 'Imprévu'} de ${eur(montant)} noté.`, () => {
        if (x) Object.assign(E[cle].find((y) => y.id === x.id), champs); else E[cle].push({ id: uid(), ...champs });
      });
    });
  }

  function modaleIntervention(id) {
    if (!E.postes.length) { modalePoste(); return; }
    const i = id ? E.interventions.find((x) => x.id === id) : null;
    const t = auj();
    const p0 = i ? poste(i.posteId) : postesTries()[0];
    const corps = `
      <label class="champ">Poste<select name="posteId" id="m-poste">${optionsPostes(p0.id)}</select></label>
      <label class="champ">Artisan<small>Celui du devis retenu est proposé.</small><select name="artisanId" id="m-art">${optionsArtisans(i ? i.artisanId : artisanRetenu(p0)?.id || '')}</select></label>
      <label class="champ" id="m-nouvel" hidden>Nom du nouvel artisan<input name="nouvelArtisan" maxlength="80"></label>
      <div class="grille-2">
        <label class="champ">Début<input type="date" name="debut" value="${i?.debut || t}" required></label>
        <label class="champ">Fin<input type="date" name="fin" value="${i?.fin || ajout(t, 2)}" required></label>
      </div>
      <label class="case"><input type="checkbox" name="provisoire" ${i?.provisoire ? 'checked' : ''}> Dates à confirmer avec l'artisan</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i ? 'Modifier l\'intervention' : 'Nouvelle intervention', corps, piedEdition(!!i), (f, action) => {
      if (action === 'supprimer') { modifier('Intervention supprimée.', () => { E.interventions = E.interventions.filter((x) => x.id !== i.id); }); return; }
      const debut = f.get('debut'), fin = f.get('fin');
      if (!R.estDate(debut) || !R.estDate(fin)) return 'Indique les dates de début et de fin.';
      if (fin < debut) return 'La fin doit suivre le début.';
      const avant = structuredClone(E);
      const artisanId = resoudreArtisan(f, type(poste(f.get('posteId'))?.code).metier);
      if (artisanId && artisanId.erreur) { E = avant; return artisanId.erreur; }
      const champs = { posteId: f.get('posteId'), artisanId: artisanId || null, debut, fin, provisoire: !!f.get('provisoire') };
      if (i) Object.assign(E.interventions.find((x) => x.id === i.id), champs); else E.interventions.push({ id: uid(), ...champs });
      annulation = () => { E = avant; };
      sauver(); rendre();
      const n = E.interventions.find((x) => x.posteId === champs.posteId && x.debut === debut);
      const chev = R.chevauchements(E.interventions, pieceIntervention, rangIntervention).filter((c) => c.type !== 'parallele' && (c.a === n?.id || c.b === n?.id)).length;
      toast(`${i ? 'Intervention enregistrée' : 'Intervention ajoutée'}${chev ? ` : ${pluriel(chev, 'chevauchement')} à vérifier` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    brancherNouveau(d, '#m-art', '#m-nouvel');
    if (!i) $('#m-poste', d).addEventListener('change', (e) => { const a = artisanRetenu(poste(e.target.value)); if (a) $('#m-art', d).value = a.id; });
  }

  function modaleModele() {
    const t = auj();
    const corps = `
      <p class="aide">Le modèle ajoute ses pièces (si elles n'existent pas), ses postes et un planning provisoire à partir de la date choisie. Rien n'est supprimé.</p>
      <fieldset class="champ sans-cadre"><legend>Modèle</legend><div class="filieres compact">
        ${B.modeles.map((m, k) => `<label class="filiere modele" style="--c:${['#D9302A', '#1D4E89', '#F5B400'][k % 3]}"><input type="radio" name="modele" value="${m.id}" ${k === 0 ? 'checked' : ''}><b>${esc(m.nom)}</b><span>${pluriel(m.etapes.length, 'poste')} · ${m.etapes.map((e) => type(e.code).nom).slice(0, 4).join(', ')}…</span></label>`).join('')}
      </div></fieldset>
      <label class="champ">Début<input type="date" name="debut" value="${E.chantier.debut && E.chantier.debut > t ? E.chantier.debut : ajout(t, 7)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Appliquer un modèle', corps, '<button class="btn primaire" value="ok">Appliquer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = B.modeles.find((x) => x.id === f.get('modele'));
      if (!m) return 'Choisis un modèle.';
      const debut = R.estDate(f.get('debut')) ? f.get('debut') : t;
      modifier(`Modèle « ${m.nom} » appliqué : ${pluriel(m.etapes.length, 'poste')} ajoutés.`, () => {
        const r = R.appliquerModele(m, debut, B, uid);
        const corresp = {};
        r.pieces.forEach((x) => { const ex = E.pieces.find((y) => R.plat(y.nom) === R.plat(x.nom)); if (ex) corresp[x.id] = ex.id; else E.pieces.push(x); });
        r.postes.forEach((x) => { if (corresp[x.pieceId]) x.pieceId = corresp[x.pieceId]; E.postes.push(x); });
        E.interventions.push(...r.interventions);
      });
    });
  }

  function modaleReserve(id, posteDefaut) {
    if (!E.postes.length) { modalePoste(); return; }
    const r = id ? E.reserves.find((x) => x.id === id) : null;
    const t = auj();
    const corps = `
      <label class="champ">Poste<select name="posteId">${optionsPostes(r?.posteId || posteDefaut || postesTries()[0].id)}</select></label>
      <label class="champ">Défaut constaté<small>Où, quoi, ce qui est attendu.</small><textarea name="description" required maxlength="300" placeholder="Ex. : Joint de douche fissuré côté mur : à refaire">${esc(r?.description || '')}</textarea></label>
      <div class="grille-2">
        <label class="champ">Constaté le<input type="date" name="constat" value="${r?.constat || t}" max="${t}" required></label>
        <label class="champ">Référence photo<small>Les photos ne sont pas stockées ici.</small><input name="photo" maxlength="80" value="${esc(r?.photo || '')}" placeholder="Ex. : IMG_2290"></label>
      </div>
      ${r ? `<fieldset class="champ sans-cadre"><legend>Statut</legend><div class="bascule-ligne"><label class="choix"><input type="radio" name="statut" value="ouverte" ${r.statut !== 'levee' ? 'checked' : ''}><span>Ouverte</span></label><label class="choix"><input type="radio" name="statut" value="levee" ${r.statut === 'levee' ? 'checked' : ''}><span>Levée</span></label></div></fieldset>
        <label class="champ">Levée le<input type="date" name="leveeLe" value="${r.leveeLe || t}" max="${t}"></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Modifier la réserve' : 'Nouvelle réserve', corps, piedEdition(!!r), (f, action) => {
      if (action === 'supprimer') { modifier('Réserve supprimée.', () => { E.reserves = E.reserves.filter((x) => x.id !== r.id); }); return; }
      const description = texte(f, 'description');
      if (!description) return 'Décris le défaut constaté.';
      const constat = f.get('constat');
      if (!R.estDate(constat) || constat > t) return 'La date de constat ne peut pas être dans le futur.';
      const champs = { posteId: f.get('posteId'), description, constat, photo: texte(f, 'photo') };
      if (r) {
        const statut = f.get('statut') === 'levee' ? 'levee' : 'ouverte';
        const leveeLe = statut === 'levee' ? (R.estDate(f.get('leveeLe')) ? f.get('leveeLe') : t) : null;
        if (leveeLe && leveeLe < constat) return 'La levée ne peut pas précéder le constat.';
        Object.assign(champs, { statut, leveeLe });
      }
      modifier(r ? 'Réserve enregistrée.' : 'Réserve ajoutée.', () => {
        if (r) Object.assign(E.reserves.find((x) => x.id === r.id), champs); else E.reserves.push({ id: uid(), ...champs, statut: 'ouverte', leveeLe: null });
      });
    });
  }

  function modaleReception(id) {
    const p = poste(id);
    const t = auj();
    const corps = `
      <p class="aide">${esc(p.nom)} · ${esc(nomPiece(p.pieceId))}. La réception est le moment où tu acceptes les travaux, avec ou sans réserves. La garantie de parfait achèvement court un an à partir de cette date.</p>
      <label class="champ">Date de réception<input type="date" name="reception" value="${p.reception || t}" max="${t}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Réception du poste', corps, `<button class="btn primaire" value="ok">Enregistrer</button>${p.reception ? '<button class="btn danger gauche" value="supprimer">Effacer la date</button>' : '<button class="btn" value="annuler">Annuler</button>'}`, (f, action) => {
      if (action === 'supprimer') { modifier('Date de réception effacée.', () => { poste(id).reception = null; }); return; }
      const d = f.get('reception');
      if (!R.estDate(d) || d > t) return 'Indique une date passée ou aujourd\'hui.';
      modifier(`Réception notée : garantie de parfait achèvement jusqu'au ${fmtCourt(R.unAnApres(d))}.`, () => { poste(id).reception = d; });
    });
  }

  function modaleArtisans() {
    const corps = `
      ${E.artisans.length ? `<ul class="liste-simple">${[...E.artisans].sort((a, b) => a.nom.localeCompare(b.nom)).map((a) => {
        const n = E.devis.filter((d) => d.artisanId === a.id).length;
        return `<li><button type="button" data-action="artisan-modifier" data-id="${a.id}"><span><b>${esc(a.nom)}</b><small>${esc(a.metier || 'Métier non précisé')}${a.contact ? ` · ${esc(a.contact)}` : ''}</small></span><small>${pluriel(n, 'devis', 'devis')}</small></button></li>`;
      }).join('')}</ul>` : '<p class="aide">Aucun artisan pour l\'instant. Tu peux aussi les créer en saisissant un devis.</p>'}`;
    ouvrirModale('Artisans', corps, '<button class="btn primaire" type="button" data-action="artisan-nouveau">Nouvel artisan</button><button class="btn" value="annuler">Fermer</button>');
  }

  function modaleArtisan(id) {
    const a = id ? artisan(id) : null;
    const n = a ? E.devis.filter((d) => d.artisanId === a.id).length + E.interventions.filter((i) => i.artisanId === a.id).length : 0;
    const corps = `
      <label class="champ">Nom de l'entreprise<input name="nom" required maxlength="80" value="${esc(a?.nom || '')}"></label>
      <label class="champ">Métier<input name="metier" maxlength="60" list="dl-metiers" value="${esc(a?.metier || '')}"></label>
      <datalist id="dl-metiers">${[...new Set(B.postes.map((p) => p.metier))].map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
      <label class="champ">Contact<small>Téléphone ou e-mail professionnel de l'entreprise.</small><input name="contact" maxlength="120" value="${esc(a?.contact || '')}"></label>
      ${a && n ? `<p class="aide">Utilisé dans ${pluriel(n, 'devis ou intervention', 'devis ou interventions')}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Modifier l\'artisan' : 'Nouvel artisan', corps, piedEdition(!!a), (f, action) => {
      if (action === 'supprimer') {
        if (n) return 'Cet artisan a des devis ou des interventions : supprime-les ou réattribue-les d\'abord.';
        modifier('Artisan supprimé.', () => { E.artisans = E.artisans.filter((x) => x.id !== a.id); });
        return;
      }
      const nom = texte(f, 'nom');
      if (!nom) return 'Indique le nom de l\'entreprise.';
      const champs = { nom, metier: texte(f, 'metier'), contact: texte(f, 'contact') };
      modifier(a ? 'Artisan enregistré.' : `« ${nom} » ajouté.`, () => { if (a) Object.assign(artisan(a.id), champs); else E.artisans.push({ id: uid(), ...champs }); });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <div class="grille-2">
        <label class="champ">Nom du chantier<input name="nom" required maxlength="80" value="${esc(E.chantier.nom)}"></label>
        <label class="champ">Provision pour imprévus (%)<input type="number" name="imprevus" min="0" max="50" step="1" value="${E.reglages.imprevus}"></label>
      </div>
      <fieldset class="champ sans-cadre"><legend>Pièces</legend>
        <div class="pieces-edit">${E.pieces.map((x) => `<input name="piece-${x.id}" maxlength="40" value="${esc(x.nom)}" aria-label="Nom de la pièce">`).join('')}<input name="piece-nouvelle" maxlength="40" placeholder="+ Ajouter une pièce" aria-label="Nouvelle pièce"></div>
        <small>Vide le nom d'une pièce pour la supprimer (ses postes passent dans « Tout le logement »).</small></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton chantier est enregistré en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = texte(f, 'nom');
      if (!nom) return 'Le chantier a besoin d\'un nom.';
      const imp = Number(f.get('imprevus'));
      if (!Number.isFinite(imp) || imp < 0 || imp > 50) return 'Provision pour imprévus : entre 0 et 50 %.';
      modifier('Réglages enregistrés.', () => {
        E.chantier.nom = nom;
        E.reglages.imprevus = imp;
        const garder = [];
        for (const x of E.pieces) {
          const v = texte(f, `piece-${x.id}`);
          if (v) { x.nom = v; garder.push(x); } else E.postes.forEach((p) => { if (p.pieceId === x.id) p.pieceId = null; });
        }
        E.pieces = garder;
        const nv = texte(f, 'piece-nouvelle');
        if (nv && !E.pieces.some((x) => R.plat(x.nom) === R.plat(nv))) E.pieces.push({ id: uid(), nom: nv });
      });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!d.chantier || !Array.isArray(d.postes) || !Array.isArray(d.devis)) throw new Error();
        if (!confirm(`Remplacer ton chantier actuel par cette copie (« ${d.chantier.nom} », ${pluriel(d.postes.length, 'poste')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, typeMime) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
  function toast(txt, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(txt)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    sauver(); rendre();
  }

  function leverReserve(id, lever) {
    modifier(lever ? 'Réserve levée.' : 'Réserve rouverte.', () => {
      const r = E.reserves.find((x) => x.id === id);
      if (!r) return false;
      r.statut = lever ? 'levee' : 'ouverte';
      r.leveeLe = lever ? auj() : null;
    });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `pilote-travaux-${auj()}.json`, 'application/json'); break;
      case 'fermer': modale().close(); break;
      case 'poste-nouveau': modalePoste(); break;
      case 'poste-modifier': modalePoste(id); break;
      case 'devis-nouveau': modaleDevis(null, el.dataset.poste); break;
      case 'devis-modifier': modaleDevis(id); break;
      case 'devis-retenir': retenir(id, true); break;
      case 'devis-liberer': retenir(id, false); break;
      case 'artisans': modaleArtisans(); break;
      case 'artisan-nouveau': modaleArtisan(); break;
      case 'artisan-modifier': modaleArtisan(id); break;
      case 'paiement-nouveau': modaleMontant('paiement'); break;
      case 'paiement-modifier': modaleMontant('paiement', id); break;
      case 'imprevu-nouveau': modaleMontant('imprevu'); break;
      case 'imprevu-modifier': modaleMontant('imprevu', id); break;
      case 'inter-nouvelle': modaleIntervention(); break;
      case 'inter-modifier': modaleIntervention(id); break;
      case 'modele': modaleModele(); break;
      case 'reserve-nouvelle': modaleReserve(null, el.dataset.poste); break;
      case 'reserve-modifier': modaleReserve(id); break;
      case 'reserve-lever': leverReserve(id, true); break;
      case 'reserve-rouvrir': leverReserve(id, false); break;
      case 'reception': modaleReception(id); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
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
  window.__travaux = { etat: () => E };
  init();
})();
