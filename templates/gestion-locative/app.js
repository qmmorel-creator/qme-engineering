// Gestion locative QME : biens, baux, locataires, loyers mois par mois, quittances, relances, révisions selon
// l'IRL saisi, régularisation des charges, rendement. Données synchronisées par clé de licence ou code d'accès.
// Rien n'est envoyé aux locataires : quittances et relances sont des textes à copier ou à imprimer.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.GST;
  const API = '/api/templates';
  const PRODUIT = 'GST';
  const CLE_CODE = 'qme-gst-code';
  const CLE_CACHE = 'qme-gst-cache';
  const CLE_DEMO = 'qme-gst-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-gst-ecran-accueil';
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
  const { ajout, versDate, euros, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const libMois = (m) => versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const libMoisCourt = (m) => versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const montantSaisi = (c) => R.saisieMontant(c).replace(/,00$/, '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let moisVue = null;
  let anneeVue = null;
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const bien = (id) => E.biens.find((b) => b.id === id);
  const bail = (id) => E.baux.find((b) => b.id === id);
  const locataire = (id) => E.locataires.find((l) => l.id === id);
  const nomBien = (id) => bien(id)?.nom || 'Bien supprimé';
  const nomsLoc = (b) => R.nomsLocataires(E, b).replace(/^le locataire$/, 'Sans locataire');
  const categorie = (id) => B.categories.find((c) => c.id === id) || B.categories.at(-1);
  const compteDe = (id) => R.compte(E, id, auj());
  const bauxActifs = (t = auj()) => E.baux.filter((b) => bien(b.bien) && R.actifLe(b, t));
  const termine = (b, t = auj()) => !!R.finEffective(b) && R.finEffective(b) < t;

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
        toast('Un autre appareil a modifié ta gestion entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (GST-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Trois biens fictifs (adresses imaginaires), quatre baux dont un terminé, dates relatives à aujourd'hui,
  // tous les états : loyers payés, payé en retard, partiel, impayé, révision à faire, indice à saisir,
  // révision interdite (DPE F), révisions appliquées et perdues, dépôt de garantie à restituer en retard,
  // régularisation des charges à faire, crédits, dépenses sur deux années. Indices IRL FICTIFS.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const premier = (n) => R.ajoutMois(`${t.slice(0, 7)}-01`, n);
    e.bailleur = { nom: 'Bailleur Exemple', adresse: '1 rue Imaginaire, 99000 Exempleville' };
    // Indices fictifs, du 1er trimestre d'il y a 5 ans jusqu'au trimestre d'il y a 3 mois.
    const dernier = R.ajoutMois(t, -3);
    const trDe = (d) => `${d.slice(0, 4)}-T${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    const finTr = trDe(dernier);
    const an0 = Number(t.slice(0, 4)) - 5;
    let v = 131.2;
    for (let a = an0; a <= Number(t.slice(0, 4)); a++) for (let q = 1; q <= 4; q++) {
      const tr = `${a}-T${q}`;
      v = Math.round((v + 0.37 + ((a * 7 + q * 3) % 5) * 0.11) * 100) / 100;
      if (tr <= finTr) e.irl.push({ trimestre: tr, valeur: v, note: 'Valeur fictive (démo)' });
    }
    const bi = (x) => { const b = R.normaliserBien({ id: uid(), ...x }); e.biens.push(b); return b.id; };
    const lo = (nom, contact = '') => { const l = R.normaliserLocataire({ id: uid(), nom, contact }); e.locataires.push(l); return l.id; };
    const ba = (x) => { const b = R.normaliserBail({ id: uid(), ...x }, t); e.baux.push(b); return b; };
    const k = 100;
    const A = bi({ nom: 'T2 rue Imaginaire', adresse: '12 rue Imaginaire, 99000 Exempleville', type: 'Appartement', surface: 44, dpe: 'D', dateAchat: premier(-40), prixAchat: 148000 * k, fraisAchat: 11500 * k, travauxAchat: 4000 * k, coproAnnuel: 1600 * k, coproNonRecup: 650 * k, taxeFonciere: 820 * k, assurance: 140 * k, credit: { mensualite: 690 * k, fin: R.ajoutMois(t, 180), capital: 120000 * k } });
    const Bs = bi({ nom: 'Studio meublé place Fictive', adresse: '3 place Fictive, 99100 Démoville', type: 'Studio', surface: 23, dpe: 'E', dateAchat: premier(-30), prixAchat: 89000 * k, fraisAchat: 7200 * k, coproAnnuel: 900 * k, coproNonRecup: 300 * k, taxeFonciere: 510 * k, assurance: 110 * k });
    const C = bi({ nom: 'Maison chemin de l\'Exemple', adresse: '8 chemin de l\'Exemple, 99200 Fictiveville', type: 'Maison', surface: 96, dpe: 'F', dateAchat: premier(-60), prixAchat: 212000 * k, fraisAchat: 15800 * k, travauxAchat: 12000 * k, taxeFonciere: 1350 * k, assurance: 210 * k, autresCharges: 300 * k, credit: { mensualite: 980 * k, fin: R.ajoutMois(t, 216), capital: 190000 * k } });
    const paul = lo('Paul Exemple', 'paul@exemple.invalid');
    const ines = lo('Inès Fictif');
    const sam = lo('Sam Démo');
    const lea = lo('Léa Démo', '06 00 00 00 00');
    const jules = lo('Jules Démo');
    const trSix = (d) => trDe(R.ajoutMois(d, -6));
    // A : location nue depuis 35 mois, révision dans le mois qui vient, deux révisions déjà appliquées.
    const debA = premier(-35);
    const bA = ba({ bien: A, locataires: [paul], type: 'nu', debut: debA, signeLe: ajout(debA, -12), loyerHC: 640 * k, charges: 55 * k, depot: 640 * k, jourEcheance: 1, trimestreIrl: trSix(debA), note: 'Bail type, clause de révision annuelle.' });
    for (const n of [1, 2]) {
      const r = R.revisions(e, bA.id, t)[n - 1];
      const m = R.appliquerRevision(bA, r, ajout(r.date, 3 + n));
      if (m) bA.modifs.push({ id: uid(), ...m });
    }
    // B : meublé depuis 19 mois, révision passée dont l'indice n'est pas encore saisi.
    const debB = premier(-19);
    const bB = ba({ bien: Bs, locataires: [ines], type: 'meuble', debut: debB, loyerHC: 520 * k, charges: 35 * k, depot: 1040 * k, jourEcheance: 5, trimestreIrl: trSix(debB) });
    const manquant = R.trimestreDecale(bB.trimestreIrl, 1);
    e.irl = e.irl.filter((x) => x.trimestre !== manquant);
    // C : ancien bail terminé il y a 75 jours (dépôt pas encore rendu), nouveau bail (DPE F : révision interdite).
    const sortieC = ajout(t, -75);
    const bC1 = ba({ bien: C, locataires: [sam], type: 'nu', debut: premier(-52), signeLe: premier(-53), sortie: sortieC, edlConforme: true, loyerHC: 900 * k, charges: 80 * k, depot: 900 * k, jourEcheance: 1, trimestreIrl: trSix(premier(-52)) });
    const debC = R.ajoutMois(`${sortieC.slice(0, 7)}-01`, 1);
    const bC2 = ba({ bien: C, locataires: [lea, jules], type: 'nu', debut: debC, signeLe: ajout(debC, -9), loyerHC: 950 * k, charges: 90 * k, depot: 950 * k, jourEcheance: 1, trimestreIrl: trSix(debC) });
    // Paiements : chaque échéance réglée avec un petit décalage ; exceptions pour montrer les états.
    const payer = (b, sauf = () => false, decal = () => 2) => {
      for (const d of R.echeances(b, t.slice(0, 7))) {
        const date = ajout(d.date, decal(d));
        const s = sauf(d);
        if (s === true || date > t) continue;
        e.paiements.push(R.normaliserPaiement({ id: uid(), bail: b.id, date, montant: typeof s === 'number' ? s : d.montant, mode: b === bB ? 'cheque' : 'virement' }, t));
      }
    };
    const moisDe = (n) => premier(n).slice(0, 7);
    payer(bA, () => false, (d) => (d.mois === moisDe(-4) ? 18 : 2));
    payer(bB, (d) => (d.mois === moisDe(-1) ? 30000 : false), (d) => (d.mois === moisDe(0) ? 1 : 3));
    payer(bC1);
    payer(bC2, (d) => d.mois === moisDe(0), () => 1);
    e.paiements.find((p) => p.bail === bB.id && p.montant === 30000).note = 'Acompte, le reste promis';
    bB.relances.push({ date: ajout(t, -6), niveau: 0 });
    // Dépenses sur l'année dernière et l'année en cours.
    const anP = Number(t.slice(0, 4)) - 1, anC = anP + 1;
    const dep = (b, date, cat, montant, recup, libelle = '') => { if (date <= t) e.depenses.push(R.normaliserDepense({ id: uid(), bien: b, date, categorie: cat, montant: montant * k, recuperable: recup * k, libelle }, t)); };
    for (const an of [anP, anC]) {
      for (const [mo, i] of [['01', 1], ['04', 2], ['07', 3], ['10', 4]]) {
        dep(A, `${an}-${mo}-10`, 'copro', 400, 180, `Appel de fonds T${i}`);
        dep(Bs, `${an}-${mo}-12`, 'copro', 225, 150, `Appel de fonds T${i}`);
      }
      dep(A, `${an}-10-15`, 'taxeFonciere', 820, 0);
      dep(A, `${an}-10-15`, 'teom', 165, 165, 'Ordures ménagères (avis de taxe foncière)');
      dep(Bs, `${an}-10-15`, 'taxeFonciere', 510, 0);
      dep(Bs, `${an}-10-15`, 'teom', 95, 95);
      dep(C, `${an}-10-15`, 'taxeFonciere', 1350, 0);
      dep(C, `${an}-10-15`, 'teom', 210, 210);
      dep(A, `${an}-02-01`, 'assurance', 140, 0, 'Assurance propriétaire non occupant');
      dep(Bs, `${an}-02-01`, 'assurance', 110, 0);
      dep(C, `${an}-03-01`, 'assurance', 210, 0);
      dep(C, `${an}-06-20`, 'eau', 260, 260, 'Entretien de la chaudière (contrat annuel)');
    }
    dep(A, `${anP}-12-31`, 'interets', 2950, 0, 'Intérêts de l\'année (tableau d\'amortissement)');
    dep(C, `${anP}-12-31`, 'interets', 5480, 0, 'Intérêts de l\'année (tableau d\'amortissement)');
    dep(C, ajout(sortieC, 12), 'travaux', 1480, 0, 'Peinture d\'une chambre entre deux locations');
    dep(Bs, `${anC}-03-18`, 'travaux', 240, 0, 'Remplacement du mitigeur');
    // Régularisation de l'année dernière déjà faite pour le studio (complément payé avec le loyer suivant).
    const rgB = R.regularisation(e, bB.id, anP);
    if (rgB && rgB.solde) bB.reguls.push({ id: uid(), annee: anP, date: `${anC}-03-05`, montant: rgB.solde });
    if (rgB && rgB.solde > 0 && `${anC}-03-08` <= t) e.paiements.push(R.normaliserPaiement({ id: uid(), bail: bB.id, date: `${anC}-03-08`, montant: rgB.solde, mode: 'cheque', note: 'Régularisation des charges' }, t));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Gestion locative · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M20 140 L100 60 L180 140 Z" fill="#1D4E89"/>
          <rect x="40" y="140" width="120" height="140" fill="#F5B400"/>
          <rect x="84" y="210" width="32" height="70" fill="#F0EDE6"/>
          <circle cx="260" cy="90" r="60" fill="#D9302A"/>
          <rect x="210" y="180" width="100" height="100" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="440" cy="150" r="120" fill="#F0EDE6"/>
          <path d="M440 150 L440 30 A120 120 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="420" y="130" width="40" height="40" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion locative</p>
          <h1>Tes loyers, à jour chaque mois.</h1>
          <p>Tes biens, tes baux et tes locataires au même endroit : les retards se calculent, les quittances et les relances se préparent en un geste, la révision du loyer et la régularisation des charges se font sans tableur.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta gestion locative</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta gestion est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma gestion locative</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma gestion locative'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', adresse: '', bienNom: '', bienAdresse: '', bienDpe: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On commence par toi, le bailleur.</h1>
        <p class="intro">Ton nom et ton adresse figurent sur les quittances et les relances que l'outil prépare. Rien n'est envoyé à tes locataires : tu copies ou imprimes toi-même chaque document.</p>
        <div class="form-accueil">
          <label class="champ">Ton nom (ou celui de ta SCI) <small>Tel qu'il doit apparaître sur les quittances.</small><input id="a-nom" value="${esc(a.nom)}" autocomplete="name" maxlength="80"></label>
          <label class="champ">Ton adresse <small>Facultative.</small><input id="a-adresse" value="${esc(a.adresse)}" autocomplete="street-address" maxlength="160"></label>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton premier bien</h1>
        <p class="intro">Un nom court pour le reconnaître et l'adresse du logement (elle figure sur les quittances). Le prix d'achat, le crédit et les charges se complètent ensuite, pour le rendement.</p>
        <div class="form-accueil">
          <label class="champ">Nom du bien<input id="a-bien" value="${esc(a.bienNom)}" maxlength="60" placeholder="Ex. : T2 centre-ville"></label>
          <label class="champ">Adresse du logement<input id="a-bien-adresse" value="${esc(a.bienAdresse)}" maxlength="160"></label>
          <label class="champ">Classe énergétique (DPE) <small>Facultative. F ou G : la révision du loyer est interdite pour les baux signés ou renouvelés depuis le 24/08/2022.</small><select id="a-dpe">${R.DPE.map((d) => `<option value="${d}" ${a.bienDpe === d ? 'selected' : ''}>${d || 'Non renseignée'}</option>`).join('')}</select></label>
        </div>
        <p class="aide" style="margin-top:12px;max-width:720px">Laisse le nom vide pour créer ton bien plus tard, dans l'onglet Biens.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma gestion</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-adresse', 'adresse'); lier('#a-bien', 'bienNom'); lier('#a-bien-adresse', 'bienAdresse');
    $('#a-dpe')?.addEventListener('change', (e) => { accueil.bienDpe = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.reglages = R.normaliserReglages({}, B.reglages);
    E.bailleur = { nom: accueil.nom.trim(), adresse: accueil.adresse.trim() };
    if (accueil.bienNom.trim()) E.biens.push(R.normaliserBien({ id: uid(), nom: accueil.bienNom.trim(), adresse: accueil.bienAdresse.trim(), dpe: accueil.bienDpe }));
    const avecBien = E.biens.length > 0;
    accueil = accueilVide();
    vue = 'biens';
    sauver();
    demarrer();
    toast(avecBien ? 'Ta gestion est prête. Ajoute le bail de ce bien.' : 'Ta gestion est prête. Ajoute ton premier bien.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    loyers: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    revisions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    biens: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 11 12 3l10 8Z" fill="currentColor"/><rect x="5" y="11" width="14" height="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="5" height="9" fill="currentColor"/><rect x="10" y="7" width="5" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['loyers', 'Loyers'], ['revisions', 'Révisions'], ['biens', 'Biens'], ['bilan', 'Charges et bilan']];
  const ONGLETS_TEL = { tableau: 'Accueil', bilan: 'Bilan' };
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la gestion locative : ni un conseil juridique, ni un conseil fiscal, ni un logiciel de comptabilité. Les montants sont calculés à partir de ta saisie et des règles des Réglages ; le bail, la loi du 6 juillet 1989 et les textes en vigueur font foi. Quittances et relances sont des modèles à vérifier.</p>';
  const COULEUR_STATUT = { avenir: 'sable', attente: 'jaune', paye: 'vert', payeRetard: 'vert', partiel: 'rouge', impaye: 'rouge' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;
  const COULEUR_REV = { avenir: 'sable', aFaire: 'jaune', irlManquant: 'rose', appliquee: 'vert', perdue: 'sable', dpe: 'rose', sansClause: 'sable' };
  const etiquetteRev = (s) => `<span class="etiquette ${COULEUR_REV[s]}">${R.LIB_REVISION[s]}</span>`;
  const LIB_PALIER = (p) => (p === null || p === undefined ? '' : `${p + 1}. ${B.relances[p].titre}`);

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/gestion-locative/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion<br>locative</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${estTel() && ONGLETS_TEL[id] ? ONGLETS_TEL[id] : nom}</span></button>`).join('')}</nav>
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
    document.title = `${titres[vue]} · Gestion locative`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, loyers: vueLoyers, revisions: vueRevisions, biens: vueBiens, bilan: vueBilan }[vue]();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 44 34 10l34 34Z" fill="#1D4E89"/><rect x="8" y="44" width="52" height="52" fill="#F5B400"/><circle cx="74" cy="74" r="22" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, bouton = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${bouton ? `<div class="actions">${bouton}</div>` : ''}</div></div>`;
  const BOUTON_BIEN = `<button class="btn primaire" data-action="nouveau-bien">${ICONES.plus}Ajouter un bien</button>`;

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.bailleur.nom ? `${esc(E.bailleur.nom)} · ` : ''}Les loyers du mois, les retards à relancer et ce qui arrive : révisions, dépôts à rendre, fins de bail.</p></div>
        <div class="actions"><button class="btn primaire" data-action="encaisser">${ICONES.plus}Encaisser un loyer</button></div></div>`;
    if (!E.biens.length) return `${titre}${videEtat('Aucun bien pour l\'instant', 'Ajoute ton premier logement, puis son bail (loyer, charges, date d\'entrée) : les loyers dus se calculent ensuite chaque mois.', BOUTON_BIEN)}${AVERTISSEMENT}`;
    if (!E.baux.length) return `${titre}${videEtat('Aucun bail pour l\'instant', 'Crée le bail de ton bien : locataire, loyer hors charges, provisions, dépôt de garantie, trimestre de référence de l\'IRL.', `<button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Créer un bail</button>`)}${AVERTISSEMENT}`;
    const s = R.synthese(E, t);
    const rends = E.biens.map((b) => R.rendement(E, b.id, t)).filter((r) => r && r.loyers && r.prix);
    const brutMoyen = rends.length ? (rends.reduce((a, r) => a + r.loyers, 0) / rends.reduce((a, r) => a + r.prix, 0)) * 100 : null;
    const nbRev = s.revs.length;
    const tuiles = [
      [`Encaissé en ${fmt(`${s.mois}-01`, { month: 'long' })}`, euros(s.encaisseMois, { centimes: false }), `sur ${euros(s.attenduMois, { centimes: false })} attendus`, 'var(--bleu)', 'rond'],
      ['Impayés', euros(s.impaye, { centimes: false }), s.retards.length ? `${pluriel(s.retards.length, 'bail', 'baux')} en retard` : 'aucun retard', 'var(--rouge)', ''],
      ['Révisions', String(nbRev), nbRev ? 'à faire ou indice à saisir' : 'rien à faire', 'var(--jaune)', 'rond'],
      ['Rendement brut', brutMoyen === null ? '–' : R.pct(brutMoyen), `${pluriel(E.biens.length, 'bien')} · avant impôt`, 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const aRelancer = s.retards.map((c) => `<li class="ligne-abs st-impaye">
        <button class="ligne-info" data-action="compte" data-id="${c.bail.id}"><b>${esc(nomsLoc(c.bail))}</b>
          <span class="ligne-detail">${esc(nomBien(c.bail.bien))} · en retard depuis le ${dateCourte(c.plusAncienne.date)} (${pluriel(c.retard, 'jour')})</span>
          <span class="ligne-etiquettes">${c.palier !== null ? `<span class="etiquette ${c.palier === 2 ? 'rouge' : 'rose'}">${esc(LIB_PALIER(c.palier))}</span>` : ''}${c.bail.relances.length ? `<span class="etiquette sable">Relancé le ${dateCourte(c.bail.relances.at(-1).date)}</span>` : ''}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b class="negatif">${euros(c.impaye)}</b><small>impayé</small></span><span class="rang"><button class="btn petit" data-action="encaisser" data-id="${c.bail.id}">Encaisser</button><button class="btn petit primaire" data-action="relance" data-id="${c.bail.id}">Relancer</button></span></div>
      </li>`).join('');
    const duMois = s.lignesMois.map(({ c, d }) => `<li>${pastilleStatut(d.statut)}<button class="lien-ligne" data-action="compte" data-id="${c.bail.id}"><b>${esc(nomBien(c.bail.bien))}</b><span>${esc(nomsLoc(c.bail))} · ${euros(d.paye)} sur ${euros(d.montant)}</span></button>${etiquetteStatut(d.statut)}</li>`).join('');
    const aVenir = [
      ...s.revs.map((r) => ({ date: r.date, html: `<button class="lien-ligne" data-action="vue" data-vue="revisions"><b>Révision · ${esc(nomBien(r.bail.bien))}</b><span>${r.statut === 'irlManquant' ? `Indice du ${R.libelleTrimestre(r.trimestre)} à saisir` : `${euros(r.base)} → ${euros(r.loyer)} hors charges`} · à demander avant le ${dateCourte(r.limite)}</span></button>${etiquetteRev(r.statut)}` })),
      ...s.depots.map((d) => ({ date: d.limite, html: `<button class="lien-ligne" data-action="bail" data-id="${d.bail.id}"><b>Dépôt de garantie · ${esc(nomBien(d.bail.bien))}</b><span>${euros(d.montant)} à rendre à ${esc(nomsLoc(d.bail))} avant le ${dateCourte(d.limite)}${d.penalite ? ` · majoration possible ${euros(d.penalite)}` : ''}</span></button>${d.limite < t ? '<span class="etiquette rouge">En retard</span>' : '<span class="etiquette jaune">À rendre</span>'}` })),
      ...s.finsBail.map((f) => ({ date: f.date, html: `<button class="lien-ligne" data-action="bail" data-id="${f.bail.id}"><b>Fin de bail · ${esc(nomBien(f.bail.bien))}</b><span>${esc(nomsLoc(f.bail))} · le ${dateLongue(f.date)}</span></button><span class="etiquette ciel">Dans ${pluriel(ecart(t, f.date), 'jour')}</span>` })),
      ...s.biensVacants.map((b) => ({ date: '9999', html: `<button class="lien-ligne" data-action="bien" data-id="${b.id}"><b>${esc(b.nom)}</b><span>Aucun bail en cours</span></button><span class="etiquette sable">Vacant</span>` })),
    ].sort((x, y) => x.date.localeCompare(y.date));
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À relancer <span>${pluriel(s.retards.length, 'bail', 'baux')}</span></h2>
          ${s.retards.length ? `<ul class="lignes-abs">${aRelancer}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun retard</h3><p>Un loyer non soldé plus de ' + E.reglages.tolerance + ' jours après son échéance apparaît ici, avec le palier de relance atteint.</p></div></div>'}
          <h2 class="titre-section">Loyers de ${libMois(s.mois)} <span>${euros(s.encaisseMois)} encaissés</span></h2>
          ${duMois ? `<ul class="prochains">${duMois}</ul>` : '<p class="aide">Aucun loyer dû ce mois-ci.</p>'}
        </section>
        <section>
          <h2 class="titre-section">À venir</h2>
          ${aVenir.length ? `<ul class="prochains">${aVenir.map((x) => `<li>${x.date === '9999' ? '<span class="date-pastille" aria-hidden="true"><b>–</b></span>' : `<span class="date-pastille ${x.date < t ? 'alerte' : ''}" aria-hidden="true"><b>${versDate(x.date).getDate()}</b>${fmt(x.date, { month: 'short' }).replace('.', '')}</span>`}${x.html}</li>`).join('')}</ul>` : '<p class="aide">Rien à prévoir dans les prochains mois.</p>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }
  const pastilleStatut = (st) => `<span class="date-pastille ${['impaye', 'partiel'].includes(st) ? 'alerte' : ''}" aria-hidden="true"><b>${{ paye: '✓', payeRetard: '✓', partiel: '½', impaye: '!', attente: '…', avenir: '·' }[st]}</b></span>`;

  // ---------- Loyers ----------
  function vueLoyers() {
    const t = auj();
    if (!moisVue) moisVue = t.slice(0, 7);
    const titre = `<div class="vue-tete"><div><h1>Loyers</h1><p>Chaque mois, ce qui est dû par bail (loyer hors charges et provisions) et ce qui est payé. Les paiements soldent les échéances les plus anciennes d'abord.</p></div>
      <div class="actions"><button class="btn primaire" data-action="encaisser">${ICONES.plus}Encaisser un loyer</button></div></div>`;
    if (!E.baux.length) return `${titre}${videEtat('Aucun bail', 'Crée un bail dans l\'onglet Biens : ses loyers apparaîtront ici mois par mois.', E.biens.length ? `<button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Créer un bail</button>` : BOUTON_BIEN)}${AVERTISSEMENT}`;
    const lignes = E.baux.filter((b) => bien(b.bien)).map((b) => ({ b, c: R.compte(E, b.id, t, { jusqua: moisVue > t.slice(0, 7) ? moisVue : undefined }) })).map((x) => ({ ...x, d: R.ligneDuMois(x.c, moisVue) })).filter((x) => x.d);
    const du = lignes.reduce((s, x) => s + x.d.montant, 0), paye = lignes.reduce((s, x) => s + x.d.paye, 0);
    const pays = E.paiements.filter((p) => p.date.startsWith(moisVue)).sort((a, b) => a.date.localeCompare(b.date));
    const html = lignes.map(({ b, c, d }) => {
      const pc = d.montant ? Math.min(100, Math.round((d.paye / d.montant) * 100)) : 0;
      return `<li class="ligne-abs st-${d.statut}">
        <button class="ligne-info" data-action="compte" data-id="${b.id}"><b>${esc(nomBien(b.bien))} <span class="numero">${esc(nomsLoc(b))}</span></b>
          <span class="ligne-detail">Échéance le ${dateCourte(d.date)} · loyer ${euros(d.loyer)} + ${b.modeCharges === 'forfait' ? 'forfait' : 'provisions'} ${euros(d.charges)}${d.prorata < 1 ? ' · au prorata' : ''}${d.soldeLe ? ` · soldé le ${dateCourte(d.soldeLe)}` : ''}</span>
          <span class="barre-paiement ${pc === 100 ? 'complet' : ''}" aria-hidden="true"><i style="width:${pc}%"></i></span>
          <span class="ligne-etiquettes">${etiquetteStatut(d.statut)}${c.impaye > 0 && d.statut !== 'impaye' && d.statut !== 'partiel' ? `<span class="etiquette rose">${euros(c.impaye)} impayés avant</span>` : ''}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${euros(d.paye)}</b><small>sur ${euros(d.montant)}</small></span>
          <span class="rang">${d.paye > 0 ? `<button class="btn petit" data-action="quittance" data-id="${b.id}" data-mois="${moisVue}">${d.reste ? 'Reçu' : 'Quittance'}</button>` : ''}${c.impaye > 0 ? `<button class="btn petit" data-action="relance" data-id="${b.id}">Relancer</button>` : ''}${d.reste > 0 && !termine(b) ? `<button class="btn petit primaire" data-action="encaisser" data-id="${b.id}">Encaisser</button>` : ''}</span></div>
      </li>`;
    }).join('');
    return `${titre}
      <div class="mois-outils">
        <div class="rang"><button class="btn petit" data-action="mois" data-pas="-1" aria-label="Mois précédent">‹</button><h2 class="mois-titre">${libMois(moisVue)}</h2><button class="btn petit" data-action="mois" data-pas="1" aria-label="Mois suivant">›</button>${moisVue !== t.slice(0, 7) ? '<button class="btn petit" data-action="mois" data-pas="0">Ce mois-ci</button>' : ''}</div>
        <p class="montant-mini">${euros(paye)} payés sur ${euros(du)} dus</p>
      </div>
      ${lignes.length ? `<ul class="lignes-abs">${html}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun loyer ce mois-là</h3><p>Aucun bail n\'était en cours.</p></div></div>'}
      <h2 class="titre-section">Paiements reçus en ${libMois(moisVue)} <span>${pluriel(pays.length, 'paiement')}</span></h2>
      ${pays.length ? `<ul class="mini-liste">${pays.map((p) => `<li><span><b>${euros(p.montant)}</b> · ${dateCourte(p.date)} · ${esc(nomBien(bail(p.bail)?.bien))} · ${esc(bail(p.bail) ? nomsLoc(bail(p.bail)) : 'Bail supprimé')} · ${esc((B.modesPaiement.find(([k]) => k === p.mode) || ['', p.mode])[1])}${p.note ? ` · ${esc(p.note)}` : ''}</span><button type="button" class="btn-suppr" data-action="suppr-paiement" data-id="${p.id}" aria-label="Supprimer ce paiement">×</button></li>`).join('')}</ul>` : '<p class="aide">Aucun paiement saisi ce mois-ci.</p>'}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv">Exporter les échéances en CSV</button></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Révisions ----------
  function vueRevisions() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Révisions du loyer</h1><p>Une révision par an, à la date anniversaire du bail : loyer × IRL du trimestre de référence ÷ IRL du même trimestre de l'année précédente. Elle n'est pas automatique : tu la demandes au locataire, sans effet rétroactif.</p></div>
      <div class="actions"><button class="btn primaire" data-action="irl">${ICONES.plus}Saisir un indice</button></div></div>`;
    const baux = E.baux.filter((b) => bien(b.bien));
    const manquants = [...new Set(baux.filter((b) => !termine(b)).flatMap((b) => R.revisions(E, b.id, t).filter((r) => r.statut === 'irlManquant').flatMap((r) => [r.trimestre, r.trimestreAncien]).filter((tr) => tr && R.valeurIrl(E.irl, tr) === null)))].sort();
    const blocBail = (b) => {
      const revs = R.revisions(E, b.id, t);
      const lignes = revs.slice(-3).reverse().map((r) => `<li class="ligne-abs revision-ligne ${r.statut === 'aFaire' ? 'st-attente' : r.statut === 'irlManquant' ? 'st-partiel' : ''}">
        <div class="ligne-info"><b>${dateLongue(r.date)} ${etiquetteRev(r.statut)}</b>
          <span class="ligne-detail">${r.trimestre ? `IRL ${R.libelleTrimestre(r.trimestre)} : <strong>${R.indice(r.nouveau)}</strong> · ${R.libelleTrimestre(r.trimestreAncien)} : <strong>${R.indice(r.ancien)}</strong>` : 'Trimestre de référence non renseigné dans le bail'}</span>
          <span class="ligne-detail">${r.statut === 'appliquee' ? `Appliquée le ${dateCourte(r.appliqueeLe)} : ${euros(r.base)} → <strong>${euros(r.loyer)}</strong>` : r.loyer !== null && !['sansClause', 'dpe'].includes(r.statut) ? `${euros(r.base)} → <strong>${euros(r.loyer)}</strong> hors charges (${r.hausse >= 0 ? '+' : ''}${euros(r.hausse)} par mois)` : `Loyer en vigueur : ${euros(r.base)}`}${['aFaire', 'irlManquant'].includes(r.statut) ? ` · à demander au plus tard le ${dateLongue(r.limite)}` : ''}${r.statut === 'perdue' ? ' · non rattrapable (pas d\'effet rétroactif)' : ''}${r.statut === 'dpe' ? ' · logement classé F ou G' : ''}</span></div>
        <div class="ligne-droite">${r.statut === 'aFaire' ? `<button class="btn petit primaire" data-action="appliquer-revision" data-id="${b.id}" data-date="${r.date}">Appliquer</button>` : r.statut === 'irlManquant' ? `<button class="btn petit" data-action="irl" data-trimestre="${R.valeurIrl(E.irl, r.trimestre) === null ? r.trimestre : r.trimestreAncien}">Saisir l'indice</button>` : r.statut === 'appliquee' ? `<button class="btn petit" data-action="annuler-revision" data-id="${b.id}" data-modif="${r.modif}">Retirer</button>` : ''}</div>
      </li>`).join('');
      return `<section class="groupe-cat"><h2 class="titre-cat"><button class="lien-ligne" data-action="bail" data-id="${b.id}"><b>${esc(nomBien(b.bien))}</b></button> <span>${esc(nomsLoc(b))} · ${R.LIB_TYPE[b.type].toLowerCase()} depuis le ${fmt(b.debut)} · trimestre de référence : ${b.trimestreIrl ? R.libelleTrimestre(b.trimestreIrl).replace(/ \d{4}$/, '') : 'non renseigné'} · loyer actuel ${euros(R.loyerA(b, t).loyerHC)}</span></h2>
        ${revs.length ? `<ul class="lignes-abs">${lignes}</ul>` : `<p class="aide">Première révision le ${dateLongue(R.ajoutMois(b.debut, 12))}.</p>`}</section>`;
    };
    const enCours = baux.filter((b) => !termine(b));
    const finis = baux.filter((b) => termine(b));
    const irl = [...E.irl].reverse();
    const ligneIrl = (x) => `<li title="${esc(x.note)}"><span>${R.libelleTrimestre(x.trimestre).replace('trimestre', 'trim.')}${x.note ? ' *' : ''}</span><b>${R.indice(x.valeur)}</b><button type="button" class="btn-suppr" data-action="irl" data-trimestre="${x.trimestre}" aria-label="Modifier l'indice du ${R.libelleTrimestre(x.trimestre)}">✎</button></li>`;
    return `${titre}
      ${manquants.length ? `<p class="alerte-texte">Indice${manquants.length > 1 ? 's' : ''} à saisir : ${manquants.map((tr) => `<button class="btn petit" data-action="irl" data-trimestre="${tr}" style="margin:4px">${R.libelleTrimestre(tr)}</button>`).join('')}</p>` : ''}
      ${enCours.length ? enCours.map(blocBail).join('') : videEtat('Aucun bail en cours', 'Les révisions apparaissent ici dès qu\'un bail avec clause de révision est créé.', E.biens.length ? `<button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Créer un bail</button>` : BOUTON_BIEN)}
      ${finis.length ? `<details class="plus-tard"><summary>Baux terminés (${finis.length})</summary>${finis.map(blocBail).join('')}</details>` : ''}
      <h2 class="titre-section">Indices de référence des loyers saisis <span>${pluriel(E.irl.length, 'trimestre')}</span></h2>
      <p class="aide">Aucun indice n'est fourni avec l'outil : il change chaque trimestre. L'IRL est publié par l'Insee (rubrique « Indice de référence des loyers ») ; recopie la valeur exacte de chaque trimestre dont tes baux ont besoin.</p>
      ${irl.length ? `<ul class="irl-liste" style="margin-top:10px">${irl.slice(0, 8).map(ligneIrl).join('')}</ul>${irl.length > 8 ? `<details class="champs-aide"><summary>Trimestres plus anciens (${irl.length - 8})</summary><ul class="irl-liste">${irl.slice(8).map(ligneIrl).join('')}</ul></details>` : ''}${irl.some((x) => x.note) ? '<p class="mention" style="margin-top:6px">* note saisie avec l\'indice (survole ou ouvre l\'indice pour la lire).</p>' : ''}` : ''}
      <div class="rgpd"><h2>Ce que l'outil ne fait pas</h2><p>Il ne vérifie ni ta clause de révision, ni l'encadrement des loyers de ta commune, ni les règles des baux particuliers (loi de 1948, logement conventionné, bail mobilité). Règles relevées le ${dateLongue(E.reglages.verifieLe || B.version)} ; délai d'un an et date du gel des logements F et G modifiables dans les Réglages.</p></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Biens et locataires ----------
  function vueBiens() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Biens et locataires</h1><p>Tes logements, leur bail en cours, leur rendement avant impôt et tes locataires.</p></div>
      <div class="actions"><button class="btn" data-action="nouveau-bien">${ICONES.plus}Bien</button><button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Bail</button></div></div>`;
    if (!E.biens.length) return `${titre}${videEtat('Aucun bien', 'Le minimum : un nom et l\'adresse. Prix d\'achat, frais, crédit, charges de copropriété et taxe foncière servent au rendement.', BOUTON_BIEN)}${AVERTISSEMENT}`;
    const carte = (bi) => {
      const r = R.rendement(E, bi.id, t);
      const baux = E.baux.filter((b) => b.bien === bi.id).sort((x, y) => y.debut.localeCompare(x.debut));
      const actif = baux.find((b) => R.actifLe(b, t));
      const futur = baux.find((b) => b.debut > t);
      const ancien = baux.filter((b) => b !== actif && b !== futur);
      const resume = (b) => {
        const c = compteDe(b.id);
        const d = R.depot(E, b);
        return `<div class="bail-resume"><button class="lien-ligne" data-action="bail" data-id="${b.id}"><b>${esc(nomsLoc(b))}</b><span>${R.LIB_TYPE[b.type]} · ${b.debut > t ? 'à partir du' : 'depuis le'} ${fmt(b.debut)}${b.fin ? ` · fin prévue le ${fmt(b.fin)}` : ''} · ${euros(R.loyerA(b, t).loyerHC)} + ${euros(R.loyerA(b, t).charges)} · dépôt ${euros(b.depot)}</span></button>
          <span class="ligne-etiquettes">${c.impaye ? `<span class="etiquette rouge">${euros(c.impaye)} impayés</span>` : '<span class="etiquette vert">À jour</span>'}${d.depasse ? '<span class="etiquette rose">Dépôt au-delà du plafond</span>' : ''}</span></div>`;
      };
      return `<article class="carte-bien">
        <h3><button class="lien-ligne" data-action="bien" data-id="${bi.id}"><b>${esc(bi.nom)}</b></button><button class="btn petit" data-action="bien" data-id="${bi.id}">Modifier</button></h3>
        <p class="adresse">${esc(bi.adresse || 'Adresse non renseignée')}${bi.type ? ` · ${esc(bi.type)}` : ''}${bi.surface ? ` · ${bi.surface} m²` : ''}</p>
        <div class="ligne-etiquettes">${bi.dpe ? `<span class="etiquette ${['F', 'G'].includes(bi.dpe) ? 'rose' : 'sable'}">DPE ${bi.dpe}</span>` : ''}${actif ? '<span class="etiquette ciel">Loué</span>' : '<span class="etiquette sable">Vacant</span>'}${bi.credit ? '<span class="etiquette sable">Crédit en cours</span>' : ''}</div>
        <div class="chiffres"><div><small>Brut</small><b>${R.pct(r.brut)}</b></div><div><small>Net de charges</small><b>${R.pct(r.net)}</b></div><div><small>${r.mensuel < 0 ? 'Effort mensuel' : 'Reste par mois'}</small><b class="${r.mensuel < 0 ? 'negatif' : ''}">${r.loyers ? euros(r.mensuel, { centimes: false }) : '–'}</b></div></div>
        ${actif ? resume(actif) : `<div class="bail-resume"><p class="mention">Aucun bail en cours.</p><div class="rang"><button class="btn petit primaire" data-action="nouveau-bail" data-bien="${bi.id}">${ICONES.plus}Créer un bail</button></div></div>`}
        ${futur ? resume(futur) : ''}
        ${ancien.length ? `<details class="champs-aide"><summary>Baux précédents (${ancien.length})</summary><ul class="mini-liste">${ancien.map((b) => { const d = R.retardRestitution(E, b, t); return `<li><span><button class="lien-ligne" data-action="bail" data-id="${b.id}"><b>${esc(nomsLoc(b))}</b><span>${fmt(b.debut)} → ${fmt(R.finEffective(b))}${b.depot ? ` · dépôt ${b.restitution ? `rendu le ${fmt(b.restitution.date)}` : `à rendre avant le ${fmt(d.limite)}`}` : ''}</span></button></span>${b.depot && !b.restitution ? `<span class="etiquette ${d.limite && d.limite < t ? 'rouge' : 'jaune'}">Dépôt</span>` : ''}</li>`; }).join('')}</ul></details>` : ''}
      </article>`;
    };
    const locs = [...E.locataires].sort((a, b) => Number(a.efface) - Number(b.efface) || a.nom.localeCompare(b.nom));
    return `${titre}
      <div class="cartes-biens">${E.biens.map(carte).join('')}</div>
      <p class="mention" style="margin-top:10px">Rendement brut : loyers hors charges sur 12 mois ÷ prix de revient (prix, frais et travaux d'acquisition). Net : après charges non récupérables, taxe foncière et assurance. « Reste par mois » déduit aussi les mensualités du crédit. Avant impôt, sans prélèvements sociaux.</p>
      <h2 class="titre-section">Locataires <span>${pluriel(E.locataires.length, 'locataire')}</span></h2>
      ${locs.length ? `<ul class="lignes-abs">${locs.map((l) => { const bx = E.baux.filter((b) => b.locataires.includes(l.id)); const enCours = bx.find((b) => R.actifLe(b, t)); return `<li class="ligne-abs ${l.efface ? 'st-vacant' : ''}"><button class="ligne-info" data-action="locataire" data-id="${l.id}"><b>${esc(l.nom)}</b><span class="ligne-detail">${l.contact ? `${esc(l.contact)} · ` : ''}${bx.length ? bx.map((b) => esc(nomBien(b.bien))).join(', ') : 'Aucun bail'}</span><span class="ligne-etiquettes">${l.efface ? '<span class="etiquette sable">Données effacées</span>' : ''}${enCours ? '<span class="etiquette ciel">Bail en cours</span>' : ''}</span></button></li>`; }).join('')}</ul>` : '<p class="aide">Les locataires se créent avec leur bail.</p>'}
      <div class="rgpd"><h2>Données personnelles de tes locataires</h2><p>Garde le minimum : un nom et, si tu le souhaites, un moyen de contact. <b>Aucune pièce justificative n'est stockée ici</b> (pièce d'identité, avis d'imposition, bulletins de salaire, RIB) : conserve-les à part, seulement le temps nécessaire, et ne demande que les documents autorisés par la loi. Tes locataires doivent savoir que leurs données sont traitées pour la gestion du bail. Ouvre un locataire pour <b>exporter ses données</b> (droit d'accès), les <b>effacer</b> (le nom est remplacé, les montants restent pour ta comptabilité) ou le <b>supprimer</b>. Les durées de conservation dépendent de tes obligations (comptables, fiscales, contentieux) : à vérifier.</p></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Charges et bilan ----------
  function vueBilan() {
    const t = auj();
    if (!anneeVue) anneeVue = Number(t.slice(0, 4));
    const an = anneeVue;
    const titre = `<div class="vue-tete"><div><h1>Charges et bilan</h1><p>Tes dépenses par bien, la régularisation annuelle des charges et le récapitulatif de l'année pour préparer ta déclaration.</p></div>
      <div class="actions"><button class="btn primaire" data-action="depense">${ICONES.plus}Ajouter une dépense</button></div></div>`;
    if (!E.biens.length) return `${titre}${videEtat('Aucun bien', 'Ajoute un bien pour saisir ses dépenses.', BOUTON_BIEN)}${AVERTISSEMENT}`;
    const deps = E.depenses.filter((d) => d.date.startsWith(`${an}-`)).sort((a, b) => b.date.localeCompare(a.date));
    const rec = R.recapAnnuel(E, an, t);
    const enCoursAn = an >= Number(t.slice(0, 4));
    const regs = E.baux.filter((b) => bien(b.bien) && R.joursOccupes(b, an) > 0).map((b) => ({ b, rg: R.regularisation(E, b.id, an) }));
    const ligneReg = ({ b, rg }) => `<li class="ligne-abs ${rg.forfait ? 'st-vacant' : rg.appliquee ? 'st-paye' : rg.solde ? 'st-attente' : ''}">
      <div class="ligne-info"><b>${esc(nomBien(b.bien))} <span class="numero">${esc(nomsLoc(b))}</span></b>
        <span class="ligne-detail">${rg.forfait ? 'Forfait de charges : pas de régularisation.' : `Provisions appelées ${euros(rg.provisions)} · charges récupérables ${euros(rg.reel)}${rg.part < 0.999 ? ` (${Math.round(rg.part * 100)} % de ${euros(rg.reelBien)}, ${rg.jours} jours occupés)` : ''}`}</span>
        ${rg.forfait ? '' : `<span class="ligne-etiquettes">${rg.appliquee ? `<span class="etiquette vert">Faite le ${dateCourte(rg.appliquee.date)} : ${euros(rg.appliquee.montant)}</span>` : rg.solde > 0 ? `<span class="etiquette jaune">Complément à demander</span>` : rg.solde < 0 ? '<span class="etiquette ciel">Trop-perçu à rembourser</span>' : '<span class="etiquette sable">Équilibrée</span>'}${!rg.depenses.length ? '<span class="etiquette rose">Aucune dépense récupérable saisie</span>' : ''}${enCoursAn && !rg.appliquee ? '<span class="etiquette sable">Année en cours : provisoire</span>' : ''}</span>`}</div>
      <div class="ligne-droite">${rg.forfait ? '' : `<span class="ligne-cout"><b class="${rg.solde > 0 ? '' : 'positif'}">${rg.solde > 0 ? '+' : ''}${euros(rg.solde)}</b><small>${rg.solde >= 0 ? 'dû par le locataire' : 'à rembourser'}</small></span>${!rg.appliquee && rg.depenses.length && !enCoursAn ? `<button class="btn petit primaire" data-action="regul" data-id="${b.id}">Régulariser</button>` : rg.appliquee ? `<button class="btn petit" data-action="regul" data-id="${b.id}">Voir</button>` : ''}`}</div>
    </li>`;
    const catsVues = B.categories.filter((c) => rec.parBien.some((x) => x.cats[c.id]));
    return `${titre}
      <div class="mois-outils">
        <div class="rang"><button class="btn petit" data-action="annee" data-pas="-1" aria-label="Année précédente">‹</button><h2 class="mois-titre">${an}</h2><button class="btn petit" data-action="annee" data-pas="1" aria-label="Année suivante">›</button></div>
        <p class="montant-mini">${pluriel(deps.length, 'dépense')} · ${euros(rec.depenses)} dont ${euros(rec.recuperable)} récupérables</p>
      </div>
      <div class="tuiles">
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Loyers encaissés</p><b>${euros(rec.loyers, { centimes: false })}</b><span>hors charges, en ${an}</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Charges encaissées</p><b>${euros(rec.charges, { centimes: false })}</b><span>provisions et régularisations</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Dépenses payées</p><b>${euros(rec.depenses, { centimes: false })}</b><span>toutes catégories</span></div>
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Solde de l'année</p><b class="${rec.encaisse - rec.depenses < 0 ? 'negatif' : ''}">${euros(rec.encaisse - rec.depenses, { centimes: false })}</b><span>avant impôt et hors capital</span></div>
      </div>
      <h2 class="titre-section">Régularisation des charges ${an} <span>provisions comparées au réel récupérable</span></h2>
      ${regs.length ? `<ul class="lignes-abs">${regs.map(ligneReg).join('')}</ul>` : '<p class="aide">Aucun bail cette année-là.</p>'}
      <h2 class="titre-section">Récapitulatif ${an} <span>pour préparer ta déclaration</span></h2>
      <div class="defile"><table class="tableau recap"><thead><tr><th>${an}</th>${rec.parBien.map((x) => `<th class="nb">${esc(x.bien.nom)}</th>`).join('')}${rec.parBien.length > 1 ? '<th class="nb">Total</th>' : ''}</tr></thead>
        <tbody>${[['Loyers encaissés (hors charges)', (x) => x.loyers, rec.loyers], ['Charges encaissées', (x) => x.charges, rec.charges], ...catsVues.map((c) => [`${c.nom}`, (x) => x.cats[c.id]?.total || 0, rec.parBien.reduce((s2, x) => s2 + (x.cats[c.id]?.total || 0), 0), true])].map(([lib, f, tot, dep]) => `<tr${dep ? ' class="dep"' : ''}><td>${esc(lib)}</td>${rec.parBien.map((x) => `<td class="nb">${f(x) ? euros(f(x)) : '–'}</td>`).join('')}${rec.parBien.length > 1 ? `<td class="nb"><b>${euros(tot)}</b></td>` : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td>Total des dépenses</td>${rec.parBien.map((x) => `<td class="nb">${euros(x.depenses)}</td>`).join('')}${rec.parBien.length > 1 ? `<td class="nb">${euros(rec.depenses)}</td>` : ''}</tr></tfoot></table></div>
      <div class="bloc-fiscal"><b>Pas un calcul d'impôt.</b> ${esc(B.fiscal)} Les montants viennent de ta saisie (paiements reçus et dépenses datés de ${an}).</div>
      <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="imprimer-recap">Imprimer le récapitulatif</button><button class="btn petit" data-action="csv-depenses">Exporter les dépenses en CSV</button></div>
      <h2 class="titre-section">Dépenses ${an} <span>${euros(rec.depenses)}</span></h2>
      ${deps.length ? `<ul class="mini-liste">${deps.map((d) => `<li><span><button class="lien-ligne" data-action="depense" data-id="${d.id}"><b>${euros(d.montant)} · ${esc(categorie(d.categorie).nom)}</b><span>${fmt(d.date)} · ${esc(nomBien(d.bien))}${d.libelle ? ` · ${esc(d.libelle)}` : ''}${d.recuperable ? ` · dont ${euros(d.recuperable)} récupérables` : ''}</span></button></span><button type="button" class="btn-suppr" data-action="suppr-depense" data-id="${d.id}" aria-label="Supprimer cette dépense">×</button></li>`).join('')}</ul>` : `<p class="aide">Aucune dépense saisie en ${an}. Charges de copropriété, taxe foncière, assurance, travaux : saisis-les avec leur part récupérable sur le locataire.</p>`}
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
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const champMontant = (nom, lib, val, aide = '', extra = '') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" value="${val === null || val === undefined ? '' : montantSaisi(val)}" ${extra}></label>`;
  const optionsTrimestre = (val) => {
    const an = Number(auj().slice(0, 4));
    const l = [];
    for (let a = an + 1; a >= an - 25; a--) for (let q = 4; q >= 1; q--) l.push(`${a}-T${q}`);
    return `<option value="">Non renseigné</option>${l.map((tr) => `<option value="${tr}" ${tr === val ? 'selected' : ''}>${R.libelleTrimestre(tr)}</option>`).join('')}`;
  };

  // Bien : identité, achat, charges annuelles, crédit.
  function modaleBien(id) {
    const bi = id ? bien(id) : null;
    const v = bi || R.normaliserBien({ nom: '' });
    const n = bi ? E.baux.filter((b) => b.bien === bi.id).length : 0;
    const corps = `
      <div class="rang-champs"><label class="champ">Nom du bien<input name="nom" maxlength="60" required value="${esc(bi ? v.nom : '')}" placeholder="Ex. : T2 centre-ville"></label><label class="champ">Type <small>Facultatif.</small><input name="type" maxlength="40" value="${esc(v.type)}" placeholder="Appartement, studio, maison"></label></div>
      <label class="champ">Adresse du logement <small>Elle figure sur les quittances.</small><input name="adresse" maxlength="160" value="${esc(v.adresse)}"></label>
      <div class="rang-champs"><label class="champ">Surface (m²)<input name="surface" inputmode="numeric" value="${v.surface || ''}"></label><label class="champ">Classe DPE<select name="dpe">${R.DPE.map((d) => `<option value="${d}" ${v.dpe === d ? 'selected' : ''}>${d || 'Non renseignée'}</option>`).join('')}</select></label></div>
      <fieldset class="champ cadre-champs"><legend>Achat <small>Pour le rendement : prix de revient = prix + frais + travaux d'acquisition.</small></legend>
        <div class="rang-champs">${champMontant('prixAchat', 'Prix d\'achat', v.prixAchat)}${champMontant('fraisAchat', 'Frais (notaire, agence)', v.fraisAchat)}${champMontant('travauxAchat', 'Travaux d\'acquisition', v.travauxAchat)}</div>
        <label class="champ">Date d'achat <small>Facultative.</small><input type="date" name="dateAchat" value="${v.dateAchat || ''}"></label></fieldset>
      <fieldset class="champ cadre-champs"><legend>Charges annuelles prévues <small>Estimations pour le rendement ; les dépenses réelles se saisissent dans « Charges et bilan ».</small></legend>
        <div class="rang-champs">${champMontant('coproAnnuel', 'Charges de copropriété', v.coproAnnuel)}${champMontant('coproNonRecup', 'Dont non récupérables', v.coproNonRecup)}</div>
        <div class="rang-champs">${champMontant('taxeFonciere', 'Taxe foncière', v.taxeFonciere, 'Hors ordures ménagères.')}${champMontant('assurance', 'Assurance du bailleur', v.assurance)}${champMontant('autresCharges', 'Autres (gestion, entretien)', v.autresCharges)}</div></fieldset>
      <fieldset class="champ cadre-champs"><legend>Crédit <small>Facultatif. Mensualité assurance comprise, pour l'effort mensuel.</small></legend>
        <div class="rang-champs">${champMontant('mensualite', 'Mensualité', v.credit?.mensualite)}<label class="champ">Dernière échéance<input type="date" name="finCredit" value="${v.credit?.fin || ''}"></label></div></fieldset>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${bi && n ? `<p class="mention">${pluriel(n, 'bail', 'baux')} sur ce bien : supprime-les d'abord pour supprimer le bien.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(bi ? esc(bi.nom) : 'Nouveau bien', corps, `<button class="btn primaire" value="ok">${bi ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${bi && !n ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}${bi ? `<button class="btn gauche" type="button" data-action="nouveau-bail" data-bien="${bi.id}">${ICONES.plus}Bail</button>` : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le bien « ${bi.nom} » et ses dépenses ?`)) { garderOuverte(); return; }
        retenir(); E.biens = E.biens.filter((x) => x.id !== bi.id); E.depenses = E.depenses.filter((d) => d.bien !== bi.id);
        sauver(); rendre(); toast('Bien supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au bien.';
      const m = {};
      for (const k of ['prixAchat', 'fraisAchat', 'travauxAchat', 'coproAnnuel', 'coproNonRecup', 'taxeFonciere', 'assurance', 'autresCharges', 'mensualite']) {
        const s = String(fd.get(k) || '').trim();
        m[k] = s ? R.lireMontant(s) : 0;
        if (m[k] === null) return 'Un montant est illisible : écris par exemple 1250 ou 1 250,50.';
      }
      if (m.coproNonRecup > m.coproAnnuel && m.coproAnnuel) return 'La part non récupérable dépasse les charges de copropriété.';
      const surface = String(fd.get('surface') || '').trim();
      if (surface && R.lireEntier(surface, 1, 10000) === null) return 'Surface : un nombre entier de m².';
      retenir();
      const d = R.normaliserBien({ ...(bi || {}), id: bi?.id || uid(), nom, type: String(fd.get('type') || '').trim(), adresse: String(fd.get('adresse') || '').trim(), surface: surface ? Number(surface) : 0, dpe: fd.get('dpe'), dateAchat: fd.get('dateAchat') || null, ...m, credit: m.mensualite ? { mensualite: m.mensualite, fin: fd.get('finCredit') || null } : null, note: String(fd.get('note') || '').trim() });
      if (bi) Object.assign(bi, d); else E.biens.push(d);
      sauver(); rendre();
      toast(bi ? 'Bien enregistré.' : `${nom} ajouté. Crée son bail.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Bail : bien, locataires, conditions financières, révision, fin, dépôt.
  function modaleBail(id, { bienId = '' } = {}) {
    const t = auj();
    const b = id ? bail(id) : null;
    if (id && !b) return;
    if (!E.biens.length) { toast('Ajoute d\'abord un bien.'); modaleBien(null); return; }
    const v = b || R.normaliserBail({ bien: bienId || E.biens[0].id, debut: R.ajoutMois(`${t.slice(0, 7)}-01`, 1), jourEcheance: 1, trimestreIrl: null }, t);
    const reg = E.reglages;
    const locs = E.locataires.filter((l) => !l.efface || v.locataires.includes(l.id));
    const corps = `
      <div class="rang-champs">
        <label class="champ">Bien<select name="bien">${E.biens.map((x) => `<option value="${x.id}" ${x.id === v.bien ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <fieldset class="champ"><legend>Type de bail</legend><div class="choix-statut deux">${R.TYPES_BAIL.map((k) => `<label><input type="radio" name="type" value="${k}" ${v.type === k ? 'checked' : ''}><span>${k === 'nu' ? 'Nue' : 'Meublée'}</span></label>`).join('')}</div></fieldset>
      </div>
      <fieldset class="champ cadre-champs"><legend>Locataires <small>Le nom suffit. Coche les locataires existants ou ajoute-en un.</small></legend>
        ${locs.length ? `<div class="cases-locataires">${locs.map((l) => `<label class="case"><input type="checkbox" name="loc" value="${l.id}" ${v.locataires.includes(l.id) ? 'checked' : ''}> ${esc(l.nom)}</label>`).join('')}</div>` : ''}
        <div class="rang-champs"><label class="champ">Nouveau locataire <small>Nom et prénom.</small><input name="nouveauNom" maxlength="80" autocomplete="off"></label><label class="champ">Contact <small>Facultatif (e-mail ou téléphone).</small><input name="nouveauContact" maxlength="120" autocomplete="off"></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ">Date d'effet (entrée)<input type="date" name="debut" required value="${v.debut}"></label>
        <label class="champ">Signé ou renouvelé le <small>Facultatif, pour la règle DPE.</small><input type="date" name="signeLe" value="${v.signeLe || ''}"></label>
        <label class="champ">Fin prévue <small>Facultative.</small><input type="date" name="fin" value="${v.fin || ''}"></label>
      </div>
      <div class="rang-champs">
        ${champMontant('loyerHC', 'Loyer mensuel hors charges', b ? v.loyerHC : null, '', 'required')}
        ${champMontant('charges', 'Charges mensuelles', b ? v.charges : null)}
        <label class="champ">Jour d'échéance<input name="jourEcheance" type="number" min="1" max="28" value="${v.jourEcheance}"></label>
      </div>
      <fieldset class="champ"><legend>Charges <small>Location nue : provisions, régularisées chaque année. En meublé, le bail peut prévoir un forfait, qui ne se régularise pas.</small></legend><div class="choix-statut deux"><label><input type="radio" name="modeCharges" value="provisions" ${v.modeCharges !== 'forfait' ? 'checked' : ''}><span>Provisions</span></label><label><input type="radio" name="modeCharges" value="forfait" ${v.modeCharges === 'forfait' ? 'checked' : ''}><span>Forfait</span></label></div></fieldset>
      <div class="rang-champs">
        ${champMontant('depot', 'Dépôt de garantie', b ? v.depot : null, `Au plus ${reg.depotMoisNu} mois de loyer HC en nu, ${reg.depotMoisMeuble} en meublé.`)}
        <label class="champ">Trimestre de référence de l'IRL <small>Celui du bail ; à défaut, le dernier publié à la signature.</small><select name="trimestreIrl">${optionsTrimestre(v.trimestreIrl)}</select></label>
      </div>
      <label class="case"><input type="checkbox" name="clauseRevision" ${v.clauseRevision ? 'checked' : ''}> Le bail prévoit une clause de révision annuelle</label>
      <div id="apercu-bail" class="apercu" aria-live="polite"></div>
      ${b ? `<fieldset class="champ cadre-champs"><legend>Départ du locataire <small>Date de remise des clés : arrête les loyers (au prorata) et fixe le délai de restitution du dépôt.</small></legend>
        <div class="rang-champs"><label class="champ">Clés rendues le<input type="date" name="sortie" value="${v.sortie || ''}"></label>
        <fieldset class="champ"><legend>État des lieux de sortie</legend><div class="choix-statut deux"><label><input type="radio" name="edl" value="oui" ${v.edlConforme !== false ? 'checked' : ''}><span>Conforme</span></label><label><input type="radio" name="edl" value="non" ${v.edlConforme === false ? 'checked' : ''}><span>Différent</span></label></div></fieldset></div>
        <div class="rang-champs"><label class="champ">Dépôt rendu le<input type="date" name="restitutionDate" value="${v.restitution?.date || ''}"></label>${champMontant('restitutionMontant', 'Montant rendu', v.restitution?.montant)}</div>
        <label class="champ">Retenues <small>Motif et justificatifs gardés à part.</small><input name="retenue" maxlength="200" value="${esc(v.restitution?.retenue || '')}"></label></fieldset>` : ''}
      <label class="champ">Note <small>Facultative. Rien de sensible sur le locataire.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${b ? 'Enregistrer' : 'Créer le bail'}</button><button class="btn" value="annuler">Annuler</button>${b ? `<button class="btn danger gauche" value="supprimer">Supprimer</button><button class="btn gauche" type="button" data-action="compte" data-id="${b.id}">Compte</button>` : ''}`;
    ouvrirModale(b ? `Bail · ${esc(nomBien(b.bien))}` : 'Nouveau bail', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const np = E.paiements.filter((p) => p.bail === b.id).length;
        if (!confirm(`Supprimer ce bail${np ? ` et ses ${pluriel(np, 'paiement')}` : ''} ? Pour un locataire parti, indique plutôt la date de remise des clés : l'historique reste.`)) { garderOuverte(); return; }
        retenir(); E.baux = E.baux.filter((x) => x.id !== b.id); E.paiements = E.paiements.filter((p) => p.bail !== b.id);
        sauver(); rendre(); toast('Bail supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const brut = lireBail(fd, b);
      if (typeof brut === 'string') return brut;
      retenir();
      if (brut.nouveau) E.locataires.push(brut.nouveau);
      if (b) Object.assign(b, brut.bail); else E.baux.push(brut.bail);
      sauver(); rendre();
      toast(b ? 'Bail enregistré.' : `Bail créé : ${euros(brut.bail.loyerHC + brut.bail.charges)} par mois à partir du ${dateCourte(brut.bail.debut)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majApercu = () => {
      const fd = new FormData(d.querySelector('form'));
      const z = d.querySelector('#apercu-bail');
      const loyer = R.lireMontant(fd.get('loyerHC') || ''), dep = R.lireMontant(fd.get('depot') || '0');
      const type = fd.get('type');
      const mois = type === 'meuble' ? reg.depotMoisMeuble : reg.depotMoisNu;
      const bi = bien(fd.get('bien'));
      let html = '';
      if (loyer && dep !== null && dep > loyer * mois) html += `<p class="cd-alerte">Dépôt de garantie au-delà de ${pluriel(mois, 'mois', 'mois')} de loyer hors charges (${euros(loyer * mois)}) : le plafond légal d'une location ${type === 'meuble' ? 'meublée' : 'nue'} (réglage modifiable, à vérifier).</p>`;
      if (['F', 'G'].includes(bi?.dpe) && fd.get('clauseRevision')) html += `<p class="cd-alerte">Logement classé ${bi.dpe} : la révision est interdite pour un bail signé ou renouvelé depuis le ${dateLongue(reg.dateGelDpe)} (métropole).</p>`;
      if (fd.get('modeCharges') === 'forfait' && type === 'nu') html += '<p>Forfait de charges en location nue : en principe, les charges y sont des provisions régularisées chaque année. À vérifier selon ton bail.</p>';
      if (fd.get('clauseRevision') && !fd.get('trimestreIrl')) html += '<p>Indique le trimestre de référence de l\'IRL pour calculer les révisions.</p>';
      z.innerHTML = html;
    };
    d.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', majApercu));
    majApercu();
  }

  function lireBail(fd, b) {
    const t = auj();
    const debut = fd.get('debut'), fin = fd.get('fin'), sortie = fd.get('sortie'), signe = fd.get('signeLe');
    if (!bien(fd.get('bien'))) return 'Choisis un bien.';
    if (!R.estDate(debut)) return 'Indique la date d\'effet du bail.';
    if (fin && (!R.estDate(fin) || fin < debut)) return 'La fin prévue doit suivre la date d\'effet.';
    if (sortie && (!R.estDate(sortie) || sortie < debut)) return 'La remise des clés doit suivre la date d\'effet.';
    if (signe && !R.estDate(signe)) return 'Date de signature illisible.';
    const loyer = R.lireMontant(fd.get('loyerHC') || '');
    if (!loyer) return 'Indique le loyer mensuel hors charges (par exemple 650).';
    const charges = String(fd.get('charges') || '').trim() ? R.lireMontant(fd.get('charges')) : 0;
    const depot = String(fd.get('depot') || '').trim() ? R.lireMontant(fd.get('depot')) : 0;
    if (charges === null || depot === null) return 'Charges ou dépôt illisible : écris par exemple 45 ou 45,50.';
    const jour = R.lireEntier(fd.get('jourEcheance'), 1, 28);
    if (jour === null) return 'Jour d\'échéance : entre 1 et 28.';
    let locs = fd.getAll('loc');
    const nouveauNom = String(fd.get('nouveauNom') || '').trim();
    let nouveau = null;
    if (nouveauNom) { nouveau = R.normaliserLocataire({ id: uid(), nom: nouveauNom, contact: String(fd.get('nouveauContact') || '').trim() }); locs = [...locs, nouveau.id]; }
    if (!locs.length) return 'Indique au moins un locataire.';
    const autres = E.baux.filter((x) => x.id !== b?.id && x.bien === fd.get('bien'));
    const finNouv = sortie || fin || '9999-12-31';
    const chevauche = autres.find((x) => x.debut <= finNouv && (R.finEffective(x) || '9999-12-31') >= debut);
    if (chevauche) return `Ce bien a déjà un bail sur cette période (${nomsLoc(chevauche)}, depuis le ${dateCourte(chevauche.debut)}). Indique d'abord la remise des clés du bail précédent.`;
    let restitution = b?.restitution || null;
    if (b) {
      const rd = fd.get('restitutionDate');
      if (rd && !R.estDate(rd)) return 'Date de restitution illisible.';
      const rm = String(fd.get('restitutionMontant') || '').trim() ? R.lireMontant(fd.get('restitutionMontant')) : 0;
      if (rm === null) return 'Montant rendu illisible.';
      if (rd && rm > depot) return 'Le montant rendu dépasse le dépôt de garantie.';
      restitution = rd ? { date: rd, montant: rm, retenue: String(fd.get('retenue') || '').trim() } : null;
    }
    const bailNorm = R.normaliserBail({
      ...(b || {}), id: b?.id || uid(), bien: fd.get('bien'), locataires: locs, type: fd.get('type'), debut, signeLe: signe || null, fin: fin || null, sortie: sortie || null,
      loyerHC: loyer, charges, modeCharges: fd.get('modeCharges'), depot, jourEcheance: jour, clauseRevision: !!fd.get('clauseRevision'), trimestreIrl: fd.get('trimestreIrl') || null,
      edlConforme: b ? fd.get('edl') !== 'non' : null, restitution, note: String(fd.get('note') || '').trim(),
    }, t);
    return { bail: bailNorm, nouveau };
  }

  // Encaissement d'un paiement.
  function modalePaiement(bailId) {
    const t = auj();
    const ouverts = E.baux.filter((b) => bien(b.bien) && (!termine(b) || compteDe(b.id).reste > 0));
    if (!ouverts.length) { toast('Crée d\'abord un bail.'); return; }
    const choisi = bailId && bail(bailId) ? bailId : (ouverts.find((b) => compteDe(b.id).reste > 0) || ouverts[0]).id;
    const proposer = (id) => { const c = compteDe(id); if (c.reste > 0) return c.reste; const d = c.lignes.find((x) => x.reste > 0); return d ? d.reste : 0; };
    const corps = `
      <label class="champ">Bail<select name="bail">${ouverts.map((b) => `<option value="${b.id}" ${b.id === choisi ? 'selected' : ''}>${esc(nomBien(b.bien))} · ${esc(nomsLoc(b))}</option>`).join('')}</select></label>
      <div class="rang-champs">${champMontant('montant', 'Montant reçu', proposer(choisi), '', 'required')}<label class="champ">Reçu le<input type="date" name="date" required value="${t}"></label></div>
      <label class="champ">Mode<select name="mode">${B.modesPaiement.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="120"></label>
      <div id="apercu-paiement" class="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Encaisser un loyer', corps, '<button class="btn primaire" value="ok">Encaisser</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.lireMontant(fd.get('montant'));
      if (!m) return 'Montant illisible : écris par exemple 650 ou 650,50.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date du paiement.';
      retenir();
      const p = R.normaliserPaiement({ id: uid(), bail: fd.get('bail'), date: fd.get('date'), montant: m, mode: fd.get('mode'), note: String(fd.get('note') || '').trim() }, t);
      E.paiements.push(p);
      sauver(); rendre();
      toast(`${euros(m)} encaissés pour ${nomsLoc(bail(p.bail))}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const fd = new FormData(d.querySelector('form'));
      const c = compteDe(fd.get('bail'));
      const m = R.lireMontant(fd.get('montant') || '') || 0;
      const prochaine = c.lignes.find((x) => x.reste > 0);
      d.querySelector('#apercu-paiement').innerHTML = `<p>Reste dû à ce jour : <b>${euros(c.reste)}</b>${c.reste > 0 ? ` (depuis le ${dateCourte(c.lignes.find((x) => x.reste > 0 && x.date <= t)?.date || t)})` : ''}. ${prochaine ? `Ce paiement solde d'abord l'échéance du ${dateCourte(prochaine.date)} (${euros(prochaine.reste)}).` : ''}${m > c.reste && c.reste > 0 ? ` L'excédent de ${euros(m - c.reste)} part sur les échéances suivantes.` : ''}</p>`;
    };
    d.querySelector('[name=bail]').addEventListener('change', (e) => { d.querySelector('[name=montant]').value = montantSaisi(proposer(e.target.value)); maj(); });
    d.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', maj));
    maj();
  }

  // Compte d'un bail : échéancier, paiements, régularisations.
  function modaleCompte(id) {
    const b = bail(id);
    if (!b) return;
    const t = auj();
    const c = compteDe(id);
    const lignes = [...c.lignes].reverse().slice(0, 36);
    const pays = E.paiements.filter((p) => p.bail === id).sort((x, y) => y.date.localeCompare(x.date));
    const d = R.retardRestitution(E, b, t);
    const corps = `
      <p class="ligne-somme"><span>Dû à ce jour</span><b>${euros(c.du)}</b></p>
      <p class="ligne-somme"><span>Payé</span><b>${euros(c.paye)}</b></p>
      <p class="ligne-somme total"><span>Reste dû</span><b class="${c.reste ? 'negatif' : ''}">${euros(c.reste)}</b></p>
      ${c.avance ? `<p class="mention">Avance : ${euros(c.avance)} payés au-delà des échéances connues.</p>` : ''}
      ${b.sortie && b.depot ? `<p class="${!b.restitution && d.limite < t ? 'alerte-texte' : 'mention'}">Dépôt de garantie ${euros(b.depot)} : ${b.restitution ? `rendu le ${dateLongue(b.restitution.date)} (${euros(b.restitution.montant)})` : `à rendre avant le ${dateLongue(d.limite)} (état des lieux ${b.edlConforme === false ? 'différent : 2 mois' : 'conforme : 1 mois'})${d.retardMois ? `. En retard : majoration de ${E.reglages.penaliteRetardPct} % du loyer par mois commencé, soit ${euros(d.penalite)} à ce jour (si le locataire t'a mis en demeure ; à vérifier)` : ''}`}.</p>` : ''}
      <div class="rang"><button type="button" class="btn petit primaire" data-action="encaisser" data-id="${b.id}">${ICONES.plus}Encaisser</button>${c.impaye ? `<button type="button" class="btn petit" data-action="relance" data-id="${b.id}">Préparer une relance</button>` : ''}<button type="button" class="btn petit" data-action="bail" data-id="${b.id}">Modifier le bail</button></div>
      <section class="bloc-detail"><h3>Échéancier <span>${pluriel(c.lignes.length, 'échéance')}</span></h3>
        <div class="defile"><table class="tableau petit echeancier"><thead><tr><th>Échéance</th><th class="nb">Dû</th><th class="nb">Payé</th><th>Statut</th><th></th></tr></thead><tbody>${lignes.map((x) => `<tr class="st-${x.statut}"><td>${x.type === 'regul' ? `Régul. charges ${x.annee || ''}` : libMoisCourt(x.mois)}<br><small class="mention">${dateCourte(x.date)}</small></td><td class="nb">${euros(x.montant)}</td><td class="nb">${euros(x.paye)}</td><td>${etiquetteStatut(x.statut)}</td><td>${x.type === 'loyer' && x.paye > 0 ? `<button type="button" class="btn petit" data-action="quittance" data-id="${b.id}" data-mois="${x.mois}">${x.reste ? 'Reçu' : 'Quittance'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        ${c.lignes.length > 36 ? '<p class="mention">Les 36 dernières échéances sont affichées ; l\'export CSV les contient toutes.</p>' : ''}</section>
      <section class="bloc-detail"><h3>Paiements <span>${pluriel(pays.length, 'paiement')}</span></h3>
        ${pays.length ? `<ul class="mini-liste">${pays.slice(0, 24).map((p) => `<li><span>${fmt(p.date)} · <b>${euros(p.montant)}</b>${p.note ? ` · ${esc(p.note)}` : ''}</span><button type="button" class="btn-suppr" data-action="suppr-paiement" data-id="${p.id}" data-garder="1" aria-label="Supprimer ce paiement">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucun paiement saisi.</p>'}
        ${b.relances.length ? `<p class="mention">Relances notées : ${b.relances.map((r) => `${dateCourte(r.date)} (${B.relances[r.niveau].titre.toLowerCase()})`).join(', ')}.</p>` : ''}</section>`;
    ouvrirModale(`${esc(nomBien(b.bien))} · ${esc(nomsLoc(b))}`, corps, '<button class="btn primaire" value="ok">Fermer</button>');
  }

  // Quittance ou reçu d'un mois : texte à copier ou à imprimer.
  function modaleQuittance(id, mois) {
    const b = bail(id);
    if (!b) return;
    const t = auj();
    const c = R.compte(E, id, t, { jusqua: mois > t.slice(0, 7) ? mois : undefined });
    const payes = c.lignes.filter((x) => x.type === 'loyer' && x.paye > 0).reverse();
    if (!payes.length) { toast('Aucun paiement reçu pour ce bail : rien à quittancer.'); return; }
    let m = payes.some((x) => x.mois === mois) ? mois : payes[0].mois;
    const corps = () => {
      const q = R.quittance(E, id, m, t);
      return `<label class="champ">Mois<select id="q-mois">${payes.map((x) => `<option value="${x.mois}" ${x.mois === m ? 'selected' : ''}>${libMois(x.mois)}${x.reste ? ' (partiel : reçu)' : ''}</option>`).join('')}</select></label>
        ${!E.bailleur.nom ? '<p class="alerte-texte">Ton nom n\'est pas renseigné : ajoute-le dans les Réglages pour qu\'il figure sur le document.</p>' : ''}
        <pre class="texte-copie" id="q-texte">${esc(R.texteQuittance(q))}</pre>
        <p class="modele-a-verifier"><b>Modèle à vérifier</b>, pas un document juridique certifié. ${q.type === 'recu' ? 'Paiement partiel : un reçu, pas une quittance (art. 21 de la loi du 6 juillet 1989).' : 'La quittance se remet gratuitement au locataire qui la demande ; par voie électronique avec son accord exprès.'} Rien n'est envoyé : copie le texte ou imprime-le.</p>`;
    };
    ouvrirModale(`Quittance · ${esc(nomsLoc(b))}`, corps(), '<button class="btn primaire" type="button" data-action="copier" data-cible="q-texte">Copier le texte</button><button class="btn" type="button" data-action="imprimer" data-cible="q-texte">Imprimer</button><button class="btn" value="annuler">Fermer</button>');
    const brancher = () => $('#q-mois').addEventListener('change', (e) => { m = e.target.value; $('.modale-corps').innerHTML = corps(); brancher(); });
    brancher();
  }

  // Relance par palier : texte à copier ; la relance peut être notée comme faite.
  function modaleRelance(id) {
    const b = bail(id);
    if (!b) return;
    const t = auj();
    const c = compteDe(id);
    if (!c.impaye) { toast('Aucun loyer en retard pour ce bail.'); return; }
    let niveau = c.palier ?? 0;
    const corps = () => {
      const r = R.texteRelance(E, id, niveau, B.relances, t);
      return `<p class="ligne-somme"><span>Impayé</span><b class="negatif">${euros(c.impaye)}</b></p>
        <p class="ligne-somme"><span>Retard depuis l'échéance du ${dateCourte(c.plusAncienne.date)}</span><b>${pluriel(c.retard, 'jour')}</b></p>
        <fieldset class="champ"><legend>Palier <small>Proposé selon le retard (réglages : ${E.reglages.paliers.map((j) => `${j} j`).join(', ')}).</small></legend><div class="choix-statut trois">${B.relances.map((x, i) => `<label><input type="radio" name="niveau" value="${i}" ${i === niveau ? 'checked' : ''}><span>${i + 1}. ${esc(x.titre)}</span></label>`).join('')}</div></fieldset>
        <label class="champ">Objet<input id="r-objet" value="${esc(r.objet)}" readonly></label>
        <pre class="texte-copie" id="r-texte">${esc(r.texte)}</pre>
        ${r.note ? `<p class="alerte-texte">${esc(r.note)}</p>` : ''}
        <p class="modele-a-verifier"><b>Modèle à vérifier</b>, pas un document juridique certifié. Rien n'est envoyé : copie le texte dans ton message ou ton courrier.</p>
        ${b.relances.length ? `<p class="mention">Déjà noté : ${b.relances.map((x) => `${dateCourte(x.date)} (${B.relances[x.niveau].titre.toLowerCase()})`).join(', ')}.</p>` : ''}`;
    };
    ouvrirModale(`Relance · ${esc(nomsLoc(b))}`, corps(), '<button class="btn primaire" value="noter">Noter comme envoyée</button><button class="btn" type="button" data-action="copier" data-cible="r-texte">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (fd, action) => {
      if (action !== 'noter') return;
      retenir();
      b.relances.push({ date: t, niveau });
      sauver(); rendre();
      toast(`${B.relances[niveau].titre} notée au ${dateCourte(t)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const brancher = () => document.querySelectorAll('[name=niveau]').forEach((el) => el.addEventListener('change', () => { niveau = Number(el.value); $('.modale-corps').innerHTML = corps(); brancher(); }));
    brancher();
  }

  // Appliquer une révision : date de la demande, nouveau loyer, courrier à copier.
  function modaleRevision(id, date) {
    const b = bail(id);
    const t = auj();
    const r = R.revisions(E, id, t).find((x) => x.date === date);
    if (!b || !r || r.loyer === null) return;
    const courrier = (dem) => `Objet : révision annuelle du loyer\n\nMadame, Monsieur ${R.nomsLocataires(E, b)},\n\nConformément à la clause de révision de votre bail pour le logement situé ${bien(b.bien)?.adresse || nomBien(b.bien)}, le loyer hors charges est révisé à sa date anniversaire selon l'indice de référence des loyers (IRL) publié par l'Insee :\n\n${euros(r.base)} × ${R.indice(r.nouveau)} (IRL du ${R.libelleTrimestre(r.trimestre)}) ÷ ${R.indice(r.ancien)} (IRL du ${R.libelleTrimestre(r.trimestreAncien)}) = ${euros(r.loyer)}\n\nÀ compter du ${R.dateTexte(dem > r.date ? dem : r.date)}, le loyer mensuel hors charges sera de ${euros(r.loyer)}, charges inchangées.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n${E.bailleur.nom || '[ton nom]'}`;
    const corps = (dem) => `
      <p class="ligne-somme"><span>Loyer actuel hors charges</span><b>${euros(r.base)}</b></p>
      <p class="ligne-somme"><span>× IRL du ${R.libelleTrimestre(r.trimestre)} ÷ IRL du ${R.libelleTrimestre(r.trimestreAncien)}</span><b>${R.indice(r.nouveau)} ÷ ${R.indice(r.ancien)}</b></p>
      <p class="ligne-somme total"><span>Nouveau loyer hors charges</span><b>${euros(r.loyer)}</b></p>
      <label class="champ">Date de ta demande au locataire <small>La révision prend effet à cette date, jamais avant la date anniversaire (${dateCourte(r.date)}), au plus tard le ${dateCourte(r.limite)}. Pas d'effet rétroactif.</small><input type="date" name="demande" value="${dem}" min="${R.ajoutMois(r.date, -3)}" max="${r.limite}"></label>
      <pre class="texte-copie" id="rev-texte">${esc(courrier(dem > r.date ? dem : r.date))}</pre>
      <p class="modele-a-verifier"><b>Modèle à vérifier</b>. Envoi conseillé en recommandé avec accusé de réception, par toi-même. Vérifie la clause de ton bail et la valeur des indices.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Révision · ${esc(nomBien(b.bien))}`, corps(t), '<button class="btn primaire" value="ok">Appliquer la révision</button><button class="btn" type="button" data-action="copier" data-cible="rev-texte">Copier le courrier</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.appliquerRevision(b, r, fd.get('demande'));
      if (!m) return `La demande doit être faite au plus tard le ${dateLongue(r.limite)}.`;
      retenir();
      b.modifs.push({ id: uid(), ...m });
      sauver(); rendre();
      toast(`Loyer révisé : ${euros(r.loyer)} hors charges à partir du ${dateCourte(m.date)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const champ = $('[name=demande]');
    champ.addEventListener('change', () => { if (R.estDate(champ.value)) $('#rev-texte').textContent = courrier(champ.value > r.date ? champ.value : r.date); });
  }

  // Saisie ou modification d'un indice IRL.
  function modaleIrl(trimestre = '') {
    const ex = trimestre ? E.irl.find((x) => x.trimestre === trimestre) : null;
    const corps = `
      <p class="aide">Recopie la valeur publiée par l'Insee pour ce trimestre (indice de référence des loyers). Aucun indice n'est fourni avec l'outil : il change chaque trimestre et serait vite périmé.</p>
      <div class="rang-champs"><label class="champ">Trimestre<select name="trimestre">${optionsTrimestre(trimestre).replace('<option value="">Non renseigné</option>', '')}</select></label><label class="champ">Valeur de l'indice<input name="valeur" inputmode="decimal" required value="${ex ? String(ex.valeur).replace('.', ',') : ''}" placeholder="Ex. : 145,47"></label></div>
      <label class="champ">Note <small>Facultative (date de publication, source).</small><input name="note" maxlength="80" value="${esc(ex?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(ex ? 'Modifier un indice' : 'Saisir un indice IRL', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${ex ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') { retenir(); E.irl = E.irl.filter((x) => x.trimestre !== ex.trimestre); sauver(); rendre(); toast('Indice supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const tr = fd.get('trimestre');
      const val = R.lireIndice(fd.get('valeur'));
      if (!R.estTrimestre(tr)) return 'Choisis un trimestre.';
      if (val === null) return 'Valeur illisible : écris par exemple 145,47 (jusqu\'à 3 décimales).';
      retenir();
      E.irl = E.irl.filter((x) => x.trimestre !== tr && x.trimestre !== ex?.trimestre);
      E.irl.push({ trimestre: tr, valeur: val, note: String(fd.get('note') || '').trim() });
      E.irl.sort((a, b) => a.trimestre.localeCompare(b.trimestre));
      sauver(); rendre();
      toast(`IRL du ${R.libelleTrimestre(tr)} : ${R.indice(val)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Dépense d'un bien.
  function modaleDepense(id) {
    const t = auj();
    const dp = id ? E.depenses.find((x) => x.id === id) : null;
    const v = dp || { bien: E.biens[0]?.id, date: anneeVue && String(anneeVue) !== t.slice(0, 4) ? `${anneeVue}-12-31` : t, categorie: 'copro', libelle: '', montant: null, recuperable: null };
    const corps = `
      <div class="rang-champs"><label class="champ">Bien<select name="bien">${E.biens.map((x) => `<option value="${x.id}" ${x.id === v.bien ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label><label class="champ">Payée le<input type="date" name="date" required value="${v.date}"></label></div>
      <label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <p class="mention" id="aide-cat"></p>
      <div class="rang-champs">${champMontant('montant', 'Montant payé', v.montant, '', 'required')}${champMontant('recuperable', 'Dont récupérable sur le locataire', v.recuperable, 'Sert à la régularisation des charges.')}</div>
      <label class="champ">Libellé <small>Facultatif.</small><input name="libelle" maxlength="120" value="${esc(v.libelle)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(dp ? 'Modifier la dépense' : 'Nouvelle dépense', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${dp ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') { supprimerDepense(dp.id); return; }
      if (!bien(fd.get('bien'))) return 'Choisis un bien.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date du paiement.';
      const m = R.lireMontant(fd.get('montant'));
      if (!m) return 'Montant illisible : écris par exemple 420 ou 420,50.';
      const rs = String(fd.get('recuperable') || '').trim();
      const rc = rs ? R.lireMontant(rs) : 0;
      if (rc === null || rc > m) return 'La part récupérable doit être un montant inférieur ou égal au total.';
      retenir();
      const d = R.normaliserDepense({ id: dp?.id || uid(), bien: fd.get('bien'), date: fd.get('date'), categorie: fd.get('categorie'), libelle: String(fd.get('libelle') || '').trim(), montant: m, recuperable: rc }, t);
      if (dp) Object.assign(dp, d); else E.depenses.push(d);
      anneeVue = Number(d.date.slice(0, 4));
      sauver(); rendre();
      toast(`${categorie(d.categorie).nom} : ${euros(m)} enregistrés.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majCat = (auto) => {
      const c = categorie(d.querySelector('[name=categorie]').value);
      d.querySelector('#aide-cat').textContent = c.aide || '';
      if (!auto) return;
      const m = R.lireMontant(d.querySelector('[name=montant]').value || '');
      if (c.recup === 1 && m) d.querySelector('[name=recuperable]').value = montantSaisi(m);
      if (c.recup === 0) d.querySelector('[name=recuperable]').value = '';
    };
    d.querySelector('[name=categorie]').addEventListener('change', () => majCat(true));
    d.querySelector('[name=montant]').addEventListener('change', () => { if (categorie(d.querySelector('[name=categorie]').value).recup === 1) majCat(true); });
    majCat(false);
  }
  function supprimerDepense(id) {
    const dp = E.depenses.find((x) => x.id === id);
    if (!dp) return;
    retenir();
    E.depenses = E.depenses.filter((x) => x.id !== id);
    sauver(); rendre();
    toast('Dépense supprimée.', { libelle: 'Annuler', faire: annuler });
  }

  // Régularisation annuelle des charges : décompte à copier, montant appliqué au compte du bail.
  function modaleRegul(id) {
    const b = bail(id);
    if (!b) return;
    const t = auj();
    const rg = R.regularisation(E, id, anneeVue);
    const prop = R.provisionProposee(rg);
    const decompte = `Régularisation des charges ${rg.annee}\nLogement : ${bien(b.bien)?.adresse || nomBien(b.bien)}\nLocataire : ${R.nomsLocataires(E, b)}\nPériode d'occupation : ${rg.jours} jours en ${rg.annee}\n\nCharges récupérables par nature :\n${B.categories.map((c) => { const s = rg.depenses.filter((d) => d.categorie === c.id).reduce((a, d) => a + d.recuperable, 0); return s ? `- ${c.nom} : ${euros(Math.round(s * rg.part))}` : ''; }).filter(Boolean).join('\n')}\n\nTotal des charges récupérables : ${euros(rg.reel)}\nProvisions versées pour la période : ${euros(rg.provisions)}\n${rg.solde >= 0 ? `Complément à régler : ${euros(rg.solde)}` : `Trop-perçu à vous rembourser : ${euros(-rg.solde)}`}\n\nLes justificatifs sont tenus à votre disposition.\n\n${E.bailleur.nom || '[ton nom]'}`;
    if (rg.appliquee) {
      ouvrirModale(`Régularisation ${rg.annee}`, `<p class="ligne-somme total"><span>Appliquée le ${dateLongue(rg.appliquee.date)}</span><b>${euros(rg.appliquee.montant)}</b></p><pre class="texte-copie" id="rg-texte">${esc(decompte)}</pre><p class="mention">La retirer l'enlève du compte du bail.</p>`, '<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="copier" data-cible="rg-texte">Copier le décompte</button><button class="btn danger gauche" value="retirer">Retirer</button>', (fd, action) => {
        if (action !== 'retirer') return;
        retenir(); b.reguls = b.reguls.filter((r) => r.id !== rg.appliquee.id); sauver(); rendre(); toast('Régularisation retirée.', { libelle: 'Annuler', faire: annuler });
      });
      return;
    }
    const corps = `
      <p class="ligne-somme"><span>Provisions appelées en ${rg.annee}</span><b>${euros(rg.provisions)}</b></p>
      <p class="ligne-somme"><span>Charges récupérables réelles${rg.part < 0.999 ? ` (${rg.jours} jours d'occupation)` : ''}</span><b>${euros(rg.reel)}</b></p>
      <p class="ligne-somme total"><span>${rg.solde >= 0 ? 'Complément dû par le locataire' : 'À rembourser au locataire'}</span><b>${euros(Math.abs(rg.solde))}</b></p>
      <div class="rang-champs"><label class="champ">Date de la régularisation<input type="date" name="date" value="${t}"></label>${champMontant('montant', 'Montant (négatif : remboursement)', rg.solde, '', 'required')}</div>
      ${prop !== null && !termine(b) ? `<label class="case"><input type="checkbox" name="ajuster" ${prop !== R.loyerA(b, t).charges ? 'checked' : ''}> Passer la provision mensuelle à ${euros(prop)} (actuellement ${euros(R.loyerA(b, t).charges)})</label>` : ''}
      <pre class="texte-copie" id="rg-texte">${esc(decompte)}</pre>
      <p class="modele-a-verifier"><b>Modèle à vérifier</b>. Le décompte par nature de charges se communique au locataire un mois avant la régularisation ; les justificatifs restent à sa disposition six mois. Régularisation tardive : le locataire peut demander à payer en douze mois.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Régularisation ${rg.annee} · ${esc(nomBien(b.bien))}`, corps, '<button class="btn primaire" value="ok">Appliquer au compte</button><button class="btn" type="button" data-action="copier" data-cible="rg-texte">Copier le décompte</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.lireMontant(fd.get('montant'), { negatif: true });
      if (m === null) return 'Montant illisible.';
      if (!R.estDate(fd.get('date'))) return 'Indique une date.';
      retenir();
      if (m) b.reguls.push({ id: uid(), annee: rg.annee, date: fd.get('date'), montant: m });
      if (fd.get('ajuster')) b.modifs.push({ id: uid(), date: fd.get('date'), loyerHC: null, charges: prop, motif: 'regularisation', revisionDe: null, trimestre: null, ancien: null, nouveau: null });
      sauver(); rendre();
      toast(m ? `Régularisation ${rg.annee} : ${m > 0 ? `${euros(m)} ajoutés au compte` : `${euros(-m)} remboursés au compte`}.` : 'Provision ajustée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Fiche d'un locataire : nom, contact, données personnelles.
  function modaleLocataire(id) {
    const l = locataire(id);
    if (!l) return;
    const bx = E.baux.filter((b) => b.locataires.includes(id));
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="80" required value="${esc(l.nom)}"></label>
      <label class="champ">Contact <small>Facultatif. Rien n'est envoyé depuis l'outil.</small><input name="contact" maxlength="120" value="${esc(l.contact)}"></label>
      ${bx.length ? `<section class="bloc-detail"><h3>Baux</h3><ul class="mini-liste">${bx.map((b) => { const c = compteDe(b.id); return `<li><span><button type="button" class="lien-ligne" data-action="compte" data-id="${b.id}"><b>${esc(nomBien(b.bien))}</b><span>${fmt(b.debut)}${R.finEffective(b) ? ` → ${fmt(R.finEffective(b))}` : ' · en cours'}</span></button></span><b class="${c.reste ? 'negatif' : ''}">${c.reste ? `${euros(c.reste)} dus` : 'À jour'}</b></li>`; }).join('')}</ul></section>` : ''}
      <div class="groupe"><h3>Données personnelles</h3><p class="aide">« Exporter » télécharge sa fiche, ses baux, ses échéances et ses paiements (droit d'accès). « Effacer » remplace son nom, vide son contact et les notes ; les montants restent pour ta comptabilité. « Supprimer » le retire de ses baux.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter-locataire" data-id="${l.id}">Exporter ses données</button><button class="btn petit" type="button" data-action="effacer-locataire" data-id="${l.id}" ${l.efface ? 'disabled' : ''}>Effacer les données</button><button class="btn petit danger" type="button" data-action="supprimer-locataire" data-id="${l.id}">Supprimer</button></div></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(l.nom), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      retenir();
      Object.assign(l, { nom, contact: String(fd.get('contact') || '').trim(), efface: l.efface && nom === l.nom });
      sauver(); rendre(); toast('Locataire enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Bailleur</h3><p class="aide">Ton nom et ton adresse figurent sur les quittances, les relances et les décomptes.</p>
        <label class="champ">Nom (ou SCI)<input name="nom" maxlength="80" value="${esc(E.bailleur.nom)}"></label>
        <label class="champ">Adresse<input name="adresse" maxlength="160" value="${esc(E.bailleur.adresse)}"></label></div>
      <div class="groupe"><h3>Retards et relances</h3>
        <div class="rang-champs"><label class="champ">Tolérance (jours)<small>Après l'échéance, avant « en retard ».</small><input name="tolerance" type="number" min="0" max="60" value="${r.tolerance}"></label>
        ${r.paliers.map((j, i) => `<label class="champ">Palier ${i + 1} (jours)<small>${esc(B.relances[i].titre)}</small><input name="palier${i}" type="number" min="1" max="365" value="${j}"></label>`).join('')}</div></div>
      <div class="groupe"><h3>Règles légales <span class="etiquette jaune">Paramètres datés</span></h3>
        <p class="aide">${esc(B.sourceRegles)}</p>
        <div class="rang-champs"><label class="champ">Dépôt au plus, nue (mois)<input name="depotMoisNu" type="number" min="0" max="6" value="${r.depotMoisNu}"></label><label class="champ">Dépôt au plus, meublé (mois)<input name="depotMoisMeuble" type="number" min="0" max="6" value="${r.depotMoisMeuble}"></label></div>
        <div class="rang-champs"><label class="champ">Restitution, état des lieux conforme (mois)<input name="restitutionConforme" type="number" min="0" max="12" value="${r.restitutionConforme}"></label><label class="champ">Sinon (mois)<input name="restitutionNonConforme" type="number" min="0" max="12" value="${r.restitutionNonConforme}"></label><label class="champ">Majoration par mois de retard (%)<input name="penaliteRetardPct" type="number" min="0" max="100" value="${r.penaliteRetardPct}"></label></div>
        <div class="rang-champs"><label class="champ">Délai pour demander une révision (mois)<input name="limiteRevisionMois" type="number" min="1" max="60" value="${r.limiteRevisionMois}"></label><label class="champ">Gel des loyers F et G depuis le<input type="date" name="dateGelDpe" value="${r.dateGelDpe}"></label></div>
        <label class="champ">Règles vérifiées le<input type="date" name="verifieLe" value="${r.verifieLe || ''}"></label>
        <details class="champs-aide"><summary>Repères et sources</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([l, u]) => `<li>${esc(l)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les échéances (loyers, charges, payé, statut) et toutes les dépenses en tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Échéances en CSV</button><button class="btn petit" type="button" data-action="csv-depenses">Dépenses en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ta gestion est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Tu es responsable des données de tes locataires : garde le minimum, aucune pièce justificative ici, et efface ou supprime un locataire depuis sa fiche quand rien ne t'oblige à conserver ses données.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Règles, modèles et catégories rédigés pour QME (version ${B.version}). Aucun indice IRL intégré, aucun e-mail envoyé, aucune banque ni aucun logiciel connecté. ${esc(B.fiscal)}</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const paliers = [0, 1, 2].map((i) => R.lireEntier(fd.get(`palier${i}`), 1, 365));
      if (paliers.some((x) => x === null) || !(paliers[0] < paliers[1] && paliers[1] < paliers[2])) return 'Les paliers doivent être croissants, entre 1 et 365 jours.';
      const ent = (k, a, z) => R.lireEntier(fd.get(k), a, z);
      const vals = { tolerance: ent('tolerance', 0, 60), depotMoisNu: ent('depotMoisNu', 0, 6), depotMoisMeuble: ent('depotMoisMeuble', 0, 6), restitutionConforme: ent('restitutionConforme', 0, 12), restitutionNonConforme: ent('restitutionNonConforme', 0, 12), penaliteRetardPct: ent('penaliteRetardPct', 0, 100), limiteRevisionMois: ent('limiteRevisionMois', 1, 60) };
      if (Object.values(vals).some((x) => x === null)) return 'Une valeur est hors limites.';
      if (!R.estDate(fd.get('dateGelDpe'))) return 'Date du gel des loyers F et G illisible.';
      E.bailleur = { nom: String(fd.get('nom') || '').trim(), adresse: String(fd.get('adresse') || '').trim() };
      E.reglages = R.normaliserReglages({ ...r, ...vals, paliers, dateGelDpe: fd.get('dateGelDpe'), verifieLe: R.estDate(fd.get('verifieLe')) ? fd.get('verifieLe') : r.verifieLe }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.biens) || !Array.isArray(donnees.baux)) throw new Error();
        if (!confirm(`Remplacer ta gestion actuelle par cette copie (${pluriel(donnees.biens.length, 'bien')}, ${pluriel(donnees.baux.length, 'bail', 'baux')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de la gestion locative.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `gestion-locative-${auj()}.json`);
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function exporterLocataire(id) {
    const d = R.donneesLocataire(E, id, auj());
    if (d) telecharger(JSON.stringify(d, null, 2), 'application/json', `donnees-${slug(locataire(id)?.nom || '') || 'locataire'}-${auj()}.json`);
  }
  function effacerLocataire(id) {
    const l = locataire(id);
    if (!l || !confirm(`Effacer les données personnelles de ${l.nom} ? Son nom est remplacé, son contact et les notes vidés. Les montants et les dates restent pour ta comptabilité.`)) return;
    retenir();
    E = R.effacerLocataire(E, id, E.locataires.filter((x) => x.efface).length + 1);
    sauver(); rendre(); modale().close();
    toast('Données personnelles effacées.', { libelle: 'Annuler', faire: annuler });
  }
  function supprimerLocataire(id) {
    const l = locataire(id);
    if (!l) return;
    const n = E.baux.filter((b) => b.locataires.includes(id)).length;
    if (!confirm(`Supprimer ${l.nom}${n ? ` ? Il sera retiré de ${pluriel(n, 'bail', 'baux')} (les montants restent)` : ' ?'} Pense à garder ailleurs ce que tes obligations imposent.`)) return;
    retenir();
    E = R.supprimerLocataire(E, id);
    sauver(); rendre(); modale().close();
    toast(`${l.nom} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Copier, imprimer ----------
  async function copier(texte) {
    try { await navigator.clipboard.writeText(texte); toast('Texte copié : colle-le dans ton message ou ton courrier.'); return; } catch { /* repli ci-dessous */ }
    const z = document.createElement('textarea');
    z.value = texte; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
    (modale().open ? modale() : document.body).appendChild(z);
    z.select();
    try { document.execCommand('copy'); toast('Texte copié.'); } catch { toast('Copie impossible : sélectionne le texte à la main.'); }
    z.remove();
  }
  function imprimer(texte) {
    let z = $('#zone-impression');
    if (!z) { z = document.createElement('div'); z.id = 'zone-impression'; document.body.appendChild(z); }
    z.textContent = texte;
    document.body.classList.add('impression');
    const fin = () => { document.body.classList.remove('impression'); z.textContent = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
    setTimeout(fin, 1500);
  }
  function texteRecap() {
    const an = anneeVue;
    const rec = R.recapAnnuel(E, an, auj());
    const l = [`RÉCAPITULATIF ${an} · GESTION LOCATIVE`, E.bailleur.nom ? `Bailleur : ${E.bailleur.nom}` : '', ''];
    for (const x of rec.parBien) {
      l.push(`${x.bien.nom}${x.bien.adresse ? ` (${x.bien.adresse})` : ''}`, `  Loyers encaissés (hors charges) : ${euros(x.loyers)}`, `  Charges encaissées : ${euros(x.charges)}`);
      for (const c of B.categories) if (x.cats[c.id]) l.push(`  ${c.nom} : ${euros(x.cats[c.id].total)}${x.cats[c.id].recuperable ? ` (dont ${euros(x.cats[c.id].recuperable)} récupérables)` : ''}`);
      l.push(`  Total des dépenses : ${euros(x.depenses)}`, '');
    }
    l.push(`TOTAL : loyers ${euros(rec.loyers)} · charges encaissées ${euros(rec.charges)} · dépenses ${euros(rec.depenses)}`, '', B.fiscal, `Édité le ${R.dateTexte(auj())} à partir de ta saisie.`);
    return l.filter((x, i) => x || i > 1).join('\n');
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
  const fermerSiOuverte = () => { if (modale().open) modale().close(); };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermerSiOuverte(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermerSiOuverte(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': telecharger(R.versCsv(E, auj()), 'text/csv;charset=utf-8', `echeances-loyers-${auj()}.csv`); break;
      case 'csv-depenses': telecharger(R.depensesCsv(E, B.categories), 'text/csv;charset=utf-8', `depenses-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-bien': fermerSiOuverte(); modaleBien(null); break;
      case 'bien': modaleBien(id); break;
      case 'nouveau-bail': fermerSiOuverte(); modaleBail(null, { bienId: el.dataset.bien }); break;
      case 'bail': fermerSiOuverte(); modaleBail(id); break;
      case 'locataire': modaleLocataire(id); break;
      case 'compte': fermerSiOuverte(); modaleCompte(id); break;
      case 'encaisser': fermerSiOuverte(); modalePaiement(id); break;
      case 'quittance': fermerSiOuverte(); modaleQuittance(id, el.dataset.mois || auj().slice(0, 7)); break;
      case 'relance': fermerSiOuverte(); modaleRelance(id); break;
      case 'appliquer-revision': modaleRevision(id, el.dataset.date); break;
      case 'annuler-revision': { const b = bail(id); if (!b || !confirm('Retirer cette révision ? Le loyer précédent s\'applique de nouveau.')) break; retenir(); b.modifs = b.modifs.filter((m) => m.id !== el.dataset.modif); sauver(); rendre(); toast('Révision retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'irl': fermerSiOuverte(); modaleIrl(el.dataset.trimestre || ''); break;
      case 'depense': modaleDepense(id); break;
      case 'suppr-depense': supprimerDepense(id); break;
      case 'regul': modaleRegul(id); break;
      case 'suppr-paiement': {
        const p = E.paiements.find((x) => x.id === id);
        if (!p || !confirm(`Supprimer le paiement de ${euros(p.montant)} du ${dateCourte(p.date)} ?`)) break;
        retenir(); E.paiements = E.paiements.filter((x) => x.id !== id); sauver(); rendre();
        if (el.dataset.garder) modaleCompte(p.bail);
        toast('Paiement supprimé.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'exporter-locataire': exporterLocataire(id); break;
      case 'effacer-locataire': effacerLocataire(id); break;
      case 'supprimer-locataire': supprimerLocataire(id); break;
      case 'copier': { const c = document.getElementById(el.dataset.cible); if (c) copier(c.textContent); break; }
      case 'imprimer': { const c = document.getElementById(el.dataset.cible); if (c) imprimer(c.textContent); break; }
      case 'imprimer-recap': imprimer(texteRecap()); break;
      case 'mois': { const p = Number(el.dataset.pas); moisVue = p ? R.moisSuivant(moisVue || auj().slice(0, 7), p) : auj().slice(0, 7); rendre(); break; }
      case 'annee': anneeVue = (anneeVue || Number(auj().slice(0, 4))) + Number(el.dataset.pas); rendre(); break;
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
  window.__gestionLocative = { etat: () => E, regles: R };
  init();
})();
