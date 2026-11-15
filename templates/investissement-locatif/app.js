// Rentabilité d'un investissement locatif QME : plusieurs biens étudiés côte à côte, coût total d'acquisition,
// loyers et vacance, charges, crédit, rendement brut et net, cash-flow avant impôt, effort d'épargne, prix maximal
// pour un rendement visé, sensibilité et fiche d'analyse imprimable. Données synchronisées par clé de licence ou
// code d'accès. Simulation avant impôt : ne remplace pas un conseil en investissement ni un conseil fiscal.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RNT;
  const API = '/api/templates';
  const PRODUIT = 'RNT';
  const CLE_CODE = 'qme-rnt-code';
  const CLE_CACHE = 'qme-rnt-cache';
  const CLE_DEMO = 'qme-rnt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rnt-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const eur = (c) => R.euros(c, { centimes: false });
  const eurS = (c) => R.euros(c, { centimes: false, signe: true });
  const eurC = (c) => R.euros(c);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const couleur = (b) => R.COULEURS[b.couleur] || R.COULEURS[0];
  // Graphiques (palette validée par le script du skill dataviz) : hausse en bleu, baisse en brique, résultat en encre.
  const TEINTES = { hausse: '#2F6DB5', baisse: '#C2502F', resultat: '#514C44' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'comparatif';
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => { const e = R.normaliser(d, B); e.tutorielVu = Boolean(e.tutorielVu); return e; };
  const bien = (id) => E.biens.find((b) => b.id === id);
  const actif = () => bien(E.actif) || E.biens[0];

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
        toast('Un autre appareil a modifié ton étude entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (RNT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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

  const estPret = (e) => !!(e && e.biens && e.biens.length);
  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      if (estPret(E)) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (estPret(E)) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && estPret(normaliser(d)) ? normaliser(d) : donneesDemo();
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
  // Quatre biens fictifs étudiés par un particulier : cash-flow négatif (T2 à crédit), presque à l'équilibre
  // (colocation), positif (saisonnier payé comptant) et un studio à compléter. Prix, loyers, charges et taux
  // sont inventés : ce ne sont ni des prix du marché ni des loyers de référence.
  function donneesDemo() {
    const d = {
      biens: [
        { nom: 'T2 centre-ville', location: 'nu', etat: 'ancien', surface: 42, prix: 13500000, notaireMode: 'estime', notairePct: B.notaire.ancien, travaux: 600000,
          lots: [{ libelle: 'Logement', loyer: 64000 }], vacance: 1, taxeFonciere: 95000, copro: 54000, pno: 14000, gestionPct: 0, entretien: 40000,
          financement: { mode: 'credit', apport: 1500000, taux: 3.6, dureeMois: 240, tauxAssurance: 0.3, assuranceMode: 'initial', quotite: 100 },
          note: 'Exemple fictif : 2e étage sans ascenseur, copropriété de 12 lots.', verifs: { loyer: true, copro: true } },
        { nom: 'Maison en colocation', location: 'colocation', etat: 'ancien', surface: 105, prix: 21000000, notaireMode: 'estime', notairePct: B.notaire.ancien, travaux: 2800000, mobilier: 900000, fraisBancaires: 250000,
          lots: [{ libelle: 'Chambre 1', loyer: 43000 }, { libelle: 'Chambre 2', loyer: 43000 }, { libelle: 'Chambre 3', loyer: 45000 }, { libelle: 'Chambre 4', loyer: 47000 }], vacance: 1,
          taxeFonciere: 165000, copro: 0, pno: 28000, gli: 0, gestionPct: 0, entretien: 120000, exploitation: 240000,
          financement: { mode: 'credit', apport: 4000000, taux: 3.4, dureeMois: 300, tauxAssurance: 0.32, assuranceMode: 'crd', quotite: 100 },
          verifs: { loyer: true, travaux: true } },
        { nom: 'Appartement de vacances', location: 'saisonnier', etat: 'ancien', surface: 35, prix: 16000000, notaireMode: 'saisi', notaireMontant: 1210000, mobilier: 700000,
          prixNuit: 9500, nuits: 140, taxeFonciere: 110000, copro: 90000, pno: 18000, gestionPct: 20, entretien: 50000, exploitation: 180000,
          financement: { mode: 'comptant' }, note: 'Exemple fictif : conciergerie à 20 % des loyers, ménage compris dans les charges.', verifs: { saisonnier: true } },
        { nom: 'Studio meublé près du campus', location: 'meuble', etat: 'ancien', surface: 22, prix: 7800000, notaireMode: 'saisi', notaireMontant: 690000, travaux: 350000, mobilier: 450000,
          lots: [{ libelle: 'Logement', loyer: 52000 }], vacance: 1.5, taxeFonciere: null, copro: 48000, pno: 11000, entretien: 30000, exploitation: 36000,
          financement: { mode: 'credit', apport: 2000000, taux: null, dureeMois: 180, tauxAssurance: 0.3 }, note: 'En attente de la taxe foncière et de l\'offre de prêt.' },
      ],
      cible: { taux: 5, type: 'net' },
    };
    return normaliser(d);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const NOM = 'Rentabilité d\'un investissement locatif';

  function ecranConnexion(message = '') {
    document.title = `${NOM} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M20 160 L110 80 L200 160 Z" fill="#1D4E89"/>
          <rect x="40" y="160" width="140" height="120" fill="#1D4E89"/>
          <rect x="95" y="210" width="30" height="70" fill="#F5B400"/>
          <rect x="230" y="200" width="50" height="80" fill="#F5B400"/>
          <rect x="300" y="140" width="50" height="140" fill="#F5B400"/>
          <path d="M370 280 L370 160 A120 120 0 0 1 490 280 Z" fill="#D9302A"/>
          <circle cx="480" cy="80" r="60" fill="#F0EDE6"/>
          <path d="M480 80 L480 20 A60 60 0 0 1 540 80 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">${NOM}</p>
          <h1>Ce bien, rentable ou pas ?</h1>
          <p>Coût total, loyers, charges et crédit : rendement brut et net, cash-flow avant impôt et effort d'épargne, plusieurs biens côte à côte, avant de faire une offre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton étude</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton étude est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon étude</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon étude'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ nom: '', location: 'nu', prix: '', loyer: '', prixNuit: '', nuits: '', taxe: '', mode: 'credit', apport: '' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const sais = a.location === 'saisonnier';
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Quel bien étudies-tu ?</h1>
      <p class="intro">Quelques chiffres pour un premier résultat : tu compléteras ensuite les frais, les charges et le crédit, puis tu pourras ajouter d'autres biens pour les comparer. Aucun prix au m², loyer de référence ni taux du marché n'est intégré : tout vient de ta saisie.</p>
      <form id="form-accueil" class="form-accueil" novalidate>
        <div class="rang-champs">
          <label class="champ">Nom du bien <small>Pour le reconnaître : « T2 rue des Lilas », « Studio n° 2 ».</small><input name="nom" maxlength="60" value="${esc(a.nom)}" placeholder="Ex. : T2 centre-ville"></label>
          <label class="champ">Type de location<select name="location">${Object.entries(B.locations).map(([k, l]) => `<option value="${k}" ${a.location === k ? 'selected' : ''}>${esc(l.nom)}</option>`).join('')}</select></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Prix d'achat (€) <small>Net vendeur.</small><input name="prix" inputmode="decimal" value="${esc(a.prix)}" placeholder="Ex. : 135 000"></label>
          <label class="champ" data-mode="mois" ${sais ? 'hidden' : ''}>Loyer mensuel hors charges (€) <small>Total de tous les lots ou chambres.</small><input name="loyer" inputmode="decimal" value="${esc(a.loyer)}" placeholder="Ex. : 640"></label>
        </div>
        <div class="rang-champs" data-mode="nuit" ${sais ? '' : 'hidden'}>
          <label class="champ">Prix moyen d'une nuit (€)<input name="prixNuit" inputmode="decimal" value="${esc(a.prixNuit)}" placeholder="Ex. : 95"></label>
          <label class="champ">Nuits louées par an <small>Ton estimation, saisons comprises.</small><input name="nuits" inputmode="numeric" value="${esc(a.nuits)}" placeholder="Ex. : 140"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Taxe foncière (€ par an) <small>Dernier avis d'imposition du vendeur ; vide si inconnue.</small><input name="taxe" inputmode="decimal" value="${esc(a.taxe)}" placeholder="Ex. : 950"></label>
          <label class="champ">Apport (€) <small>Si tu achètes à crédit.</small><input name="apport" inputmode="decimal" value="${esc(a.apport)}" placeholder="Ex. : 15 000"></label>
        </div>
        <fieldset class="champ"><legend>Financement</legend><div class="choix-statut deux">${[['credit', 'À crédit'], ['comptant', 'Comptant']].map(([k, l]) => `<label><input type="radio" name="mode" value="${k}" ${a.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <p class="erreur" role="alert">${esc(erreur)}</p>
      </form>
      <ol class="conseils" style="margin-top:28px">${B.reperes.slice(0, 3).map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Créer mon étude</button></div>
    </div>`;
    const f = $('#form-accueil');
    f.addEventListener('input', () => {
      const fd = new FormData(f);
      for (const k of Object.keys(accueilVide())) a[k] = String(fd.get(k) ?? a[k] ?? '');
      f.querySelector('[data-mode="mois"]').hidden = a.location === 'saisonnier';
      f.querySelector('[data-mode="nuit"]').hidden = a.location !== 'saisonnier';
    });
    f.addEventListener('submit', (e) => { e.preventDefault(); terminerAccueil(); });
  }

  function terminerAccueil() {
    const a = accueil;
    const lire = (v, lib, oblig = false) => { const s = String(v || '').trim(); if (!s) { if (oblig) throw new Error(`Indique ${lib}.`); return null; } const m = R.lireMontant(s); if (m === null) throw new Error(`${lib[0].toUpperCase()}${lib.slice(1)} illisible : écris par exemple 1 250.`); return m; };
    try {
      const prix = lire(a.prix, 'le prix d\'achat', true);
      const sais = a.location === 'saisonnier';
      const loyer = sais ? 0 : lire(a.loyer, 'le loyer mensuel', true);
      const prixNuit = sais ? lire(a.prixNuit, 'le prix d\'une nuit', true) : 0;
      const nuits = sais ? R.lireEntier(a.nuits, 0, 366) : 0;
      if (sais && nuits === null) throw new Error('Nuits louées par an : de 0 à 366.');
      const taxe = lire(a.taxe, 'la taxe foncière');
      const apport = lire(a.apport, 'l\'apport') ?? 0;
      const vu = Boolean(E?.tutorielVu); // « Recommencer à zéro » ne fait pas revenir le guide
      E = normaliser({
        tutorielVu: vu,
        biens: [{ nom: a.nom.trim() || 'Mon premier bien', location: a.location, prix, notaireMode: 'estime', notairePct: B.notaire.ancien, lots: [{ libelle: a.location === 'colocation' ? 'Toutes les chambres' : 'Logement', loyer }], prixNuit, nuits, taxeFonciere: taxe, financement: { mode: a.mode, apport, dureeMois: 240 } }],
      });
    } catch (x) { return ecranAccueil(x.message); }
    accueil = accueilVide();
    vue = 'analyse';
    sauver();
    demarrer();
    toast('Ton étude est prête. Complète les frais, les charges et le crédit (Modifier le bien).');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    comparatif: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="8" height="4" fill="currentColor"/></svg>',
    analyse: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    sensibilite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    fiche: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['comparatif', 'Comparatif'], ['analyse', 'Analyse'], ['sensibilite', 'Sensibilité'], ['fiche', 'Fiche']];
  const AVERTISSEMENT = '<p class="mention avertissement">Simulation avant impôt, à partir de ta saisie : elle ne remplace pas un conseil en investissement ni un conseil fiscal. Aucun prix au m², loyer de référence ni taux du marché n\'est intégré ; les loyers, charges et conditions de crédit sont ceux que tu saisis, et l\'offre de prêt écrite fait foi.</p>';
  const FISCALITE = () => `<div class="encadre-fiscal" id="fiscalite"><h2>Hors calcul : l'impôt sur les loyers</h2><p>${esc(B.fiscalite)}</p></div>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const pastille = (b) => `<i class="pastille-sc" style="--c:${couleur(b)}" aria-hidden="true"></i>`;
  const locNom = (b) => B.locations[b.location].nom;
  const classeSigne = (c) => (c < 0 ? 'depasse' : 'positif');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Investissement<br>locatif</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
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
    if (!bien(E.actif)) E.actif = E.biens[0]?.id ?? null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Investissement locatif`;
    $('#vue').className = `vue vue-${vue}`;
    graphes.clear();
    $('#vue').innerHTML = { comparatif: vueComparatif, analyse: vueAnalyse, sensibilite: vueSensibilite, fiche: vueFiche }[vue]();
    brancherGraphiques();
    brancherCible();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur du bien affiché (Analyse, Sensibilité, Fiche).
  const choixBien = () => `<div class="projets" role="group" aria-label="Bien affiché">${E.biens.map((y) => `<button class="filtre" data-action="choisir-bien" data-id="${y.id}" aria-pressed="${y.id === actif().id}">${pastille(y)} ${esc(y.nom)}</button>`).join('')}${E.biens.length < R.MAX_BIENS ? `<button class="filtre ajout" data-action="bien-nouveau">${ICONES.plus}Ajouter un bien</button>` : ''}</div>`;
  const aCompleter = (b, x) => `<div class="a-completer"><b>${esc(b.nom)} : à compléter</b><span>Manque ${esc(x.manque.join(', '))}. Rien n'est calculé tant que ces chiffres manquent : aucun montant n'est inventé à ta place.</span><div><button class="btn petit primaire" data-action="bien" data-id="${b.id}">Compléter</button></div></div>`;

  // ---------- Comparatif ----------
  function vueComparatif() {
    const c = R.comparer(E.biens);
    const tete = `<div class="vue-tete"><div><h1>Biens étudiés</h1><p>Jusqu'à ${R.MAX_BIENS} biens côte à côte : coût total, rendement brut et net, cash-flow mensuel avant impôt. ${pluriel(E.biens.length, 'bien')} à l'étude.</p></div>
      <div class="actions"><button class="btn" data-action="csv">Exporter en CSV</button><button class="btn primaire" data-action="bien-nouveau" ${E.biens.length >= R.MAX_BIENS ? 'disabled' : ''}>${ICONES.plus}Ajouter un bien</button></div></div>`;
    const incomplets = c.incomplets.length ? `<div class="a-completer"><b>${pluriel(c.incomplets.length, 'bien')} à compléter</b>${c.incomplets.map((x) => { const b = bien(x.id); return `<button class="lien-ligne" data-action="bien" data-id="${b.id}">${pastille(b)}<span><b>${esc(b.nom)}</b> : manque ${esc(x.manque.join(', '))}</span></button>`; }).join('')}</div>` : '';
    if (!c.complets.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bien complet</h3><p>Prix, loyer, taxe foncière et conditions du crédit : il faut ces chiffres pour calculer un rendement.</p><div class="actions"><button class="btn primaire" data-action="bien" data-id="${E.biens[0]?.id || ''}">Compléter un bien</button></div></div></div>${incomplets}${FISCALITE()}${AVERTISSEMENT}`;
    const mn = c.meilleurNet, bn = bien(mn.id), mc = c.meilleurCash, bc = bien(mc.id);
    const verdict = `<div class="verdict">${pastille(bn)}<div><p class="surtitre">Meilleur rendement net de charges${c.complets.length > 1 ? ` sur ${c.complets.length} biens complets` : ''}</p>
      <h2>${esc(bn.nom)}&nbsp;: <span class="nowrap">${esc(R.pct(mn.rendementNet))}</span></h2>
      <p>Rendement brut ${esc(R.pct(mn.rendementBrut))}, cash-flow de <b>${eurS(mn.cashflowMensuel)}</b> par mois avant impôt.${mc.id !== mn.id ? ` Meilleur cash-flow : <b>${esc(bc.nom)}</b> (${eurS(mc.cashflowMensuel)} par mois), qui dépend aussi de son financement.` : ''}</p></div></div>`;
    const tuiles = E.biens.map((b) => {
      const x = c.tous.find((y) => y.id === b.id);
      if (!x.complet) return `<button class="tuile-sc incomplete" data-action="ouvrir-analyse" data-id="${b.id}" style="--c:${couleur(b)}"><span class="tuile-tete">${pastille(b)}<b>${esc(b.nom)}</b></span><span class="tuile-val">À compléter</span><span class="tuile-detail">Manque ${esc(x.manque.join(', '))}</span></button>`;
      return `<button class="tuile-sc ${x.rangNet === 1 ? 'premier' : ''}" data-action="ouvrir-analyse" data-id="${b.id}" style="--c:${couleur(b)}"><span class="tuile-tete">${pastille(b)}<b>${esc(b.nom)}</b></span>
        <span class="tuile-val">${esc(R.pct(x.rendementNet))} <small>net</small></span>
        <span class="tuile-detail">${esc(B.locations[b.location].court)} · ${eur(x.coutTotal)} au total · brut ${esc(R.pct(x.rendementBrut))}</span>
        <span class="tuile-rang"><span class="etiquette ${x.cashflowMensuel >= 0 ? 'vert' : 'rose'}">${eurS(x.cashflowMensuel)} / mois</span>${x.rangNet === 1 && c.complets.length > 1 ? '<span class="etiquette ciel">Meilleur net</span>' : ''}</span></button>`;
    }).join('');
    return `${tete}${verdict}<div class="tuiles-sc">${tuiles}</div>${incomplets}
      <h2 class="titre-section">Cash-flow mensuel avant impôt <span>Ce qui reste, ou ce qu'il faut ajouter, chaque mois</span></h2>
      ${graphiqueSigne('g-cash', c.complets.map((x) => ({ nom: bien(x.id).nom, valeur: x.cashflowMensuel, couleur: couleur(bien(x.id)), detail: [['Loyers encaissés', Math.round(x.revenus.encaisse / 12)], ['Charges', -Math.round(x.charges.total / 12)], ['Crédit', -x.credit.mensuelTotal]] })), 'Cash-flow mensuel avant impôt de chaque bien complet', 'À droite de zéro, le bien paie ses charges et son crédit ; à gauche, la différence est ton effort d\'épargne. Avant impôt.')}
      <h2 class="titre-section">Côte à côte <span>Tous les chiffres des biens</span></h2>
      ${tableauCote(c)}
      ${blocCible()}
      ${FISCALITE()}
      ${AVERTISSEMENT}`;
  }

  function tableauCote(c) {
    const cols = E.biens.map((b) => ({ b, x: c.tous.find((y) => y.id === b.id) }));
    const L = [
      ['Type de location', (x, b) => esc(B.locations[b.location].court), true],
      ['Prix d\'achat', (x, b) => eur(b.prix), true],
      ['Coût total d\'acquisition', (x) => `<b>${eur(x.coutTotal)}</b>`, true],
      ['Loyers par an (théoriques)', (x) => eur(x.revenus.theorique), true],
      ['Vacance', (x, b) => (b.location === 'saisonnier' ? `${b.nuits} nuits louées` : esc(R.moisTexte(b.vacance))), true],
      ['Loyers encaissés par an', (x) => eur(x.revenus.encaisse), true],
      ['Charges par an', (x) => eur(x.charges.total), true],
      ['Mensualité assurance comprise', (x, b) => (b.financement.mode === 'credit' ? eurC(x.credit.mensuelTotal) : 'comptant'), true],
      ['Rendement brut', (x) => esc(R.pct(x.rendementBrut))],
      ['Rendement net de charges', (x) => `<b>${esc(R.pct(x.rendementNet))}</b>`],
    ];
    const cell = (f, x, b, toujours) => (x.complet || toujours ? `<td class="nb">${f(x, b)}</td>` : '<td class="nb discret">–</td>');
    return `<div class="defile cote"><table class="tableau"><caption class="sr-only">Chiffres de chaque bien étudié, rendements et cash-flow avant impôt</caption>
      <thead><tr><th scope="col">Poste</th>${cols.map(({ b }) => `<th scope="col" class="nb"><span class="th-sc">${pastille(b)}${esc(b.nom)}</span></th>`).join('')}</tr></thead>
      <tbody>${L.map(([lib, f, t]) => `<tr><th scope="row">${lib}</th>${cols.map(({ b, x }) => cell(f, x, b, t)).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Cash-flow mensuel avant impôt</th>${cols.map(({ x }) => `<td class="nb ${x.complet ? classeSigne(x.cashflowMensuel) : ''}">${x.complet ? eurS(x.cashflowMensuel) : 'à compléter'}</td>`).join('')}</tr>
      <tr><th scope="row">Effort d'épargne mensuel</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? eur(x.effortMensuel) : ''}</td>`).join('')}</tr></tfoot></table></div>`;
  }

  // Rendement visé et prix maximal de chaque bien.
  function blocCible() {
    const ci = E.cible;
    const lignes = E.biens.map((b) => ({ b, p: R.prixMax(b, ci.taux, ci.type) }));
    const table = ci.taux > 0 ? `<div class="defile"><table class="tableau"><caption class="sr-only">Prix maximal de chaque bien pour atteindre le rendement visé</caption><thead><tr><th scope="col">Bien</th><th scope="col" class="nb">Prix demandé</th><th scope="col" class="nb">Rendement actuel</th><th scope="col" class="nb">Prix maximal</th><th scope="col" class="nb">Écart</th></tr></thead>
      <tbody>${lignes.map(({ b, p }) => `<tr><th scope="row"><span class="th-sc">${pastille(b)}${esc(b.nom)}</span></th>${p ? `<td class="nb">${eur(b.prix)}</td><td class="nb">${esc(R.pct(p.actuel))}</td><td class="nb"><b>${p.impossible ? 'inatteignable' : eur(p.prix)}</b></td><td class="nb ${p.ecart < 0 ? 'depasse' : 'positif'}">${p.impossible ? '' : eurS(p.ecart)}</td>` : '<td class="nb discret" colspan="4">à compléter</td>'}</tr>`).join('')}</tbody></table></div>
      <p class="mention">Prix au-delà duquel le rendement ${ci.type === 'brut' ? 'brut' : 'net de charges'} visé n'est plus atteint, avec les mêmes loyers et les mêmes charges. ${ci.type === 'net' ? 'Frais de notaire et d\'agence suivent le prix ; travaux, mobilier et frais bancaires restent fixes. ' : ''}Un écart négatif est la baisse de prix à obtenir.</p>` : '<p class="aide">Indique le rendement que tu vises pour voir, bien par bien, le prix maximal à proposer.</p>';
    return `<h2 class="titre-section" id="cible">Prix maximal <span>Pour atteindre le rendement que tu vises</span></h2>
      <form class="form-cible" id="form-cible" novalidate>
        <label class="champ">Rendement visé (%)<input name="taux" inputmode="decimal" value="${esc(R.saisieTaux(ci.taux))}" placeholder="Ex. : 5"></label>
        <fieldset class="champ"><legend>Calculé sur le rendement</legend><div class="choix-statut deux">${[['net', 'Net de charges'], ['brut', 'Brut']].map(([k, l]) => `<label><input type="radio" name="type" value="${k}" ${ci.type === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <p class="erreur" role="alert"></p>
      </form>
      <div id="resultat-cible" aria-live="polite">${table}</div>`;
  }
  function brancherCible() {
    const f = $('#form-cible');
    if (!f) return;
    let attente = null;
    f.addEventListener('submit', (e) => e.preventDefault());
    f.addEventListener('input', () => {
      const fd = new FormData(f);
      const s = String(fd.get('taux') || '').trim();
      const t = s ? R.lireTaux(s) : null;
      if (s && (t === null || t <= 0)) { f.querySelector('.erreur').textContent = 'Rendement visé illisible : écris par exemple 5 ou 6,5.'; return; }
      f.querySelector('.erreur').textContent = '';
      E.cible = { taux: t, type: fd.get('type') === 'brut' ? 'brut' : 'net' };
      const tmp = document.createElement('div');
      tmp.innerHTML = vue === 'comparatif' ? blocCible() : blocPrixMax(actif());
      $('#resultat-cible').innerHTML = tmp.querySelector('#resultat-cible').innerHTML;
      clearTimeout(attente);
      attente = setTimeout(sauver, 400);
    });
  }

  // ---------- Analyse d'un bien ----------
  function vueAnalyse() {
    const b = actif();
    const x = R.analyser(b);
    const tete = `<div class="vue-tete"><div><h1>${esc(b.nom)}</h1><p>${esc(locNom(b))}, ${esc(B.etats[b.etat].toLowerCase())}${b.surface ? `, ${String(b.surface).replace('.', ',')} m²` : ''}. ${b.financement.mode === 'credit' ? 'Acheté à crédit.' : 'Acheté comptant.'}${b.note ? ` ${esc(b.note)}` : ''}</p></div>
      <div class="actions"><button class="btn" data-action="vue" data-vue="fiche">Fiche d'analyse</button><button class="btn primaire" data-action="bien" data-id="${b.id}">Modifier le bien</button></div></div>`;
    if (!x.complet) return `${choixBien()}${tete}${aCompleter(b, x)}${detailCalcul(b, x)}${FISCALITE()}${AVERTISSEMENT}`;
    const al = R.alertes(b, x);
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Rendement brut</p><b>${esc(R.pct(x.rendementBrut))}</b><span>loyers ÷ prix d'achat</span></div>
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Rendement net</p><b>${esc(R.pct(x.rendementNet))}</b><span>de charges, sur le coût total</span></div>
      <div class="tuile" style="--c:#E58C74"><p class="surtitre">Cash-flow mensuel</p><b class="${classeSigne(x.cashflowMensuel)}">${eurS(x.cashflowMensuel)}</b><span>avant impôt</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Effort d'épargne</p><b>${x.effortMensuel ? eur(x.effortMensuel) : 'aucun'}</b><span>${x.effortMensuel ? 'à ajouter chaque mois' : 'le bien se paie seul'}</span></div>
    </div>`;
    return `${choixBien()}${tete}${tuiles}
      ${al.map((a) => `<p class="alerte-sc ${a.niveau === 'alerte' ? 'alerte' : ''}">${esc(a.texte)}</p>`).join('')}
      <h2 class="titre-section">Du loyer au cash-flow <span>Par mois, avant impôt</span></h2>
      ${graphiqueCascade(b, x)}
      ${detailCalcul(b, x)}
      ${blocPrixMax(b)}
      <h2 class="titre-section">À vérifier avant d'acheter <span>Coche ce qui est vérifié pour ce bien</span></h2>
      <ul class="questions">${B.verifications.filter(([id]) => id !== 'saisonnier' || b.location === 'saisonnier').map(([id, q, pourquoi]) => `<li><label class="case-q"><input type="checkbox" data-action="verif" data-id="${id}" ${b.verifs[id] ? 'checked' : ''}><span><b>${esc(q)}</b><small>${esc(pourquoi)}</small></span></label></li>`).join('')}</ul>
      <h2 class="titre-section">Repères <span>Comment tout est compté</span></h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      ${FISCALITE()}
      ${AVERTISSEMENT}`;
  }

  // Détail : acquisition, loyers et charges, financement.
  function detailCalcul(b, x) {
    const a = x.acquisition, r = x.revenus, ch = x.charges, cr = x.credit;
    const somme = (l, v, cl = '') => `<p class="ligne-somme ${cl}"><span>${esc(l)}</span><b>${v}</b></p>`;
    const acq = a.postes.filter(([k, , v]) => v > 0 || k === 'prix' || k === 'notaire').map(([, l, v]) => somme(l, eur(v))).join('') + somme('Coût total d\'acquisition', eur(a.total), 'total');
    const rev = (b.location === 'saisonnier'
      ? somme(`${b.nuits} nuits à ${eurC(b.prixNuit)}`, eur(r.theorique))
      : b.lots.map((l) => somme(`${l.libelle} : ${eur(l.loyer)} × 12`, eur(l.loyer * 12))).join('') + (r.vacance ? somme(`− Vacance (${R.moisTexte(b.vacance)} par an)`, eur(-r.vacance)) : ''))
      + somme('Loyers encaissés', eur(r.encaisse), 'total')
      + ch.postes.filter(([k, , v]) => v > 0 || k === 'taxeFonciere').map(([k, l, v]) => somme(`− ${l}`, k === 'taxeFonciere' && b.taxeFonciere === null ? 'à saisir' : eur(v))).join('')
      + (x.complet ? somme('Revenu net de charges', eur(x.netAnnuel), 'total') : '');
    const fin = cr.mode === 'comptant'
      ? somme('Payé comptant', eur(a.total)) + somme('Mensualité', 'aucune')
      : somme('Apport', eur(cr.apport)) + somme(`Montant emprunté${b.financement.montant === null ? ' (coût total − apport)' : ''}`, eur(cr.montant))
        + somme(`Taux ${R.pct(b.financement.taux)} sur ${R.duree(b.financement.dureeMois)}`, cr.mensualite ? `${eurC(cr.mensualite)} / mois` : 'à compléter')
        + somme(`Assurance ${b.financement.tauxAssurance === null ? '' : R.pct(b.financement.tauxAssurance)} sur ${b.financement.assuranceMode === 'crd' ? 'capital restant dû (moyenne an 1)' : 'capital initial'}`, `${eurC(cr.assurance)} / mois`)
        + somme('Mensualité assurance comprise', `${eurC(cr.mensuelTotal)}`, 'total')
        + (cr.mensualite ? somme('Dont capital remboursé la 1re année', eur(cr.capitalAn1)) + somme('Intérêts de la 1re année', eur(cr.interetsAn1)) : '');
    const res = x.complet ? `<div class="bloc-detail carte-calcul">
        ${somme('Revenu net de charges, par mois', eurC(Math.round(x.netAnnuel / 12)))}
        ${somme('− Crédit, assurance comprise', eurC(cr.mensuelTotal))}
        ${somme('Cash-flow mensuel avant impôt', `<span class="${classeSigne(x.cashflowMensuel)}">${eurS(x.cashflowMensuel)}</span>`, 'total')}
        ${cr.mode === 'credit' && cr.capitalAn1 ? somme('dont épargne par le capital remboursé', `${eur(Math.round(cr.capitalAn1 / 12))} / mois`) : ''}
        ${x.rendementApport !== null && cr.mode === 'credit' ? somme('Cash-flow annuel ÷ apport', esc(R.pct(x.rendementApport, 1))) : ''}
        ${x.prixM2 ? somme('Prix d\'achat au m² (ta saisie)', eur(x.prixM2)) : ''}
        ${x.loyerM2 ? somme('Loyer mensuel au m²', eurC(x.loyerM2)) : ''}
      </div>` : '';
    return `<div class="colonnes-apercu trois">
        <section><h2 class="titre-section">Acquisition <span>Coût total</span></h2><div class="bloc-detail carte-calcul">${acq}</div></section>
        <section><h2 class="titre-section">Loyers et charges <span>Par an</span></h2><div class="bloc-detail carte-calcul">${rev}</div></section>
        <section><h2 class="titre-section">Financement <span>${cr.mode === 'credit' ? 'Crédit saisi' : 'Comptant'}</span></h2><div class="bloc-detail carte-calcul">${fin}</div>${res}</section>
      </div>
      ${b.notaireMode === 'estime' ? `<p class="mention hors-calcul">Frais de notaire estimés à ${esc(R.pct(b.notairePct || 0, 1))} du prix : ${esc(B.notaire.texte)}</p>` : ''}`;
  }

  function blocPrixMax(b) {
    const ci = E.cible;
    const p = R.prixMax(b, ci.taux, ci.type);
    const res = !(ci.taux > 0) ? '<p class="aide">Indique le rendement que tu vises.</p>'
      : !p ? '<p class="aide">Complète le bien pour calculer le prix maximal.</p>'
      : p.impossible ? `<p class="alerte-sc alerte">Rendement ${ci.type === 'brut' ? 'brut' : 'net'} de ${esc(R.pct(ci.taux))} inatteignable avec ces loyers et ces charges, quel que soit le prix.</p>`
      : `<div class="resume-facture quatre">
          <div><span>Prix demandé</span><b>${eur(b.prix)}</b><small>rendement ${ci.type === 'brut' ? 'brut' : 'net'} ${esc(R.pct(p.actuel))}</small></div>
          <div><span>Prix maximal</span><b>${eur(p.prix)}</b><small>pour ${esc(R.pct(ci.taux))} ${ci.type === 'brut' ? 'brut' : 'net de charges'}</small></div>
          <div><span>${p.ecart < 0 ? 'Baisse à obtenir' : 'Marge'}</span><b class="${p.ecart < 0 ? 'depasse' : 'positif'}">${eur(Math.abs(p.ecart))}</b><small>${esc(R.pct(b.prix ? (Math.abs(p.ecart) / b.prix) * 100 : 0, 1))} du prix</small></div>
          <div><span>Objectif</span><b>${p.atteint ? 'atteint' : 'pas atteint'}</b><small>au prix demandé</small></div>
        </div>`;
    return `<h2 class="titre-section" id="cible">Prix maximal <span>Pour le rendement que tu vises</span></h2>
      <form class="form-cible" id="form-cible" novalidate>
        <label class="champ">Rendement visé (%)<input name="taux" inputmode="decimal" value="${esc(R.saisieTaux(ci.taux))}" placeholder="Ex. : 5"></label>
        <fieldset class="champ"><legend>Calculé sur le rendement</legend><div class="choix-statut deux">${[['net', 'Net de charges'], ['brut', 'Brut']].map(([k, l]) => `<label><input type="radio" name="type" value="${k}" ${ci.type === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <p class="erreur" role="alert"></p>
      </form>
      <div id="resultat-cible" aria-live="polite">${res}</div>`;
  }

  // ---------- Sensibilité ----------
  function vueSensibilite() {
    const b = actif();
    const x = R.analyser(b);
    const tete = `<div class="vue-tete"><div><h1>Sensibilité</h1><p>Que devient « ${esc(b.nom)} » si le loyer baisse, si le logement reste vide un mois de plus ou si le taux du crédit monte ? Chaque scénario change une seule hypothèse ; le dernier les cumule.</p></div>
      <div class="actions"><button class="btn primaire" data-action="bien" data-id="${b.id}">Modifier le bien</button></div></div>`;
    if (!x.complet) return `${choixBien()}${tete}${aCompleter(b, x)}${AVERTISSEMENT}`;
    const s = R.sensibilite(b);
    const table = `<div class="defile"><table class="tableau"><caption class="sr-only">Rendement net et cash-flow de ${esc(b.nom)} selon chaque scénario</caption><thead><tr><th scope="col">Scénario</th><th scope="col" class="nb">Rendement net</th><th scope="col" class="nb">Cash-flow mensuel</th><th scope="col" class="nb">Écart par mois</th><th scope="col" class="nb">Effort d'épargne</th></tr></thead>
      <tbody>${s.map((y) => `<tr class="${y.id === 'base' ? 'actif' : ''}"><th scope="row">${esc(y.nom)}</th><td class="nb">${esc(R.pct(y.rendementNet))}</td><td class="nb ${classeSigne(y.cashflowMensuel)}">${eurS(y.cashflowMensuel)}</td><td class="nb">${y.id === 'base' ? '' : eurS(y.ecartCashflow)}</td><td class="nb">${y.effortMensuel ? eur(y.effortMensuel) : 'aucun'}</td></tr>`).join('')}</tbody></table></div>`;
    const pire = s[s.length - 1];
    const resume = pire.cashflowMensuel < 0 && x.cashflowMensuel >= 0
      ? `<p class="alerte-sc alerte">Positif avec tes hypothèses, ce bien devient négatif si tout se dégrade à la fois : ${eurS(pire.cashflowMensuel)} par mois.</p>`
      : `<p class="alerte-sc">Dans le pire des scénarios, l'effort d'épargne serait de ${pire.effortMensuel ? `${eur(pire.effortMensuel)} par mois` : 'zéro : le bien reste autofinancé'}.</p>`;
    const autres = E.biens.filter((y) => y.id !== b.id && R.analyser(y).complet);
    const tousLes = autres.length ? `<h2 class="titre-section">Tous les biens face aux mêmes chocs <span>Cash-flow mensuel avant impôt</span></h2>
      <div class="defile cote"><table class="tableau"><caption class="sr-only">Cash-flow mensuel de chaque bien selon chaque scénario</caption><thead><tr><th scope="col">Scénario</th>${[b, ...autres].map((y) => `<th scope="col" class="nb"><span class="th-sc">${pastille(y)}${esc(y.nom)}</span></th>`).join('')}</tr></thead>
      <tbody>${R.SCENARIOS.map((sc) => `<tr><th scope="row">${esc(sc.nom)}</th>${[b, ...autres].map((y) => { const z = R.sensibilite(y).find((v) => v.id === sc.id); return `<td class="nb ${z ? classeSigne(z.cashflowMensuel) : 'discret'}">${z ? eurS(z.cashflowMensuel) : 'comptant'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    return `${choixBien()}${tete}${resume}
      ${graphiqueSigne('g-sens', s.map((y) => ({ nom: y.nom, valeur: y.cashflowMensuel, couleur: y.cashflowMensuel >= 0 ? TEINTES.hausse : TEINTES.baisse, detail: [['Rendement net', null, R.pct(y.rendementNet)], ['Écart avec tes hypothèses', y.ecartCashflow]] })), `Cash-flow mensuel de ${b.nom} selon chaque scénario`, 'Bleu : le bien se paie seul ; brique : effort d\'épargne. Avant impôt.', true)}
      ${table}
      <p class="mention">${b.location === 'saisonnier' ? '« Vacance + 1 mois » retire 30 nuits louées. ' : ''}« Loyer − 10 % » baisse tous les loyers ; les frais de gestion en pourcentage baissent avec eux. ${b.financement.mode === 'credit' ? '« Taux + 1 point » recalcule la mensualité au taux saisi plus un point, assurance inchangée.' : 'Bien payé comptant : pas de scénario de taux.'}</p>
      ${tousLes}
      ${AVERTISSEMENT}`;
  }

  // ---------- Fiche d'analyse imprimable ----------
  function vueFiche() {
    const b = actif();
    const x = R.analyser(b);
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const tete = `<div class="vue-tete"><div><h1>Fiche d'analyse</h1><p>Une page à imprimer ou à enregistrer en PDF, pour un rendez-vous avec la banque, un associé ou ton conseiller.</p></div>
      <div class="actions"><button class="btn" data-action="csv">Comparatif en CSV</button><button class="btn primaire" data-action="imprimer">Imprimer ou PDF</button></div></div>`;
    const s = x.complet ? R.sensibilite(b) : null;
    const p = x.complet ? R.prixMax(b, E.cible.taux, E.cible.type) : null;
    const ligne = (l, v) => `<tr><th scope="row">${esc(l)}</th><td class="nb">${v}</td></tr>`;
    const tableau = (titre, lignes) => `<section class="fiche-bloc"><h3>${titre}</h3><table class="tableau fiche-table"><tbody>${lignes.join('')}</tbody></table></section>`;
    const a = x.acquisition, r = x.revenus, ch = x.charges, cr = x.credit;
    return `${choixBien()}${tete}
      <article class="fiche">
        <header class="fiche-tete"><div><p class="surtitre">Fiche d'analyse · ${esc(locNom(b))}</p><h2>${esc(b.nom)}</h2><p>${esc(B.etats[b.etat])}${b.surface ? ` · ${String(b.surface).replace('.', ',')} m²` : ''} · ${b.financement.mode === 'credit' ? 'à crédit' : 'comptant'} · établie le ${date}</p></div><span class="marque">${MARQUE}</span></header>
        ${x.complet ? `<div class="fiche-chiffres">
          <div><span>Rendement brut</span><b>${esc(R.pct(x.rendementBrut))}</b></div>
          <div><span>Rendement net de charges</span><b>${esc(R.pct(x.rendementNet))}</b></div>
          <div><span>Cash-flow mensuel avant impôt</span><b class="${classeSigne(x.cashflowMensuel)}">${eurS(x.cashflowMensuel)}</b></div>
          <div><span>Effort d'épargne</span><b>${x.effortMensuel ? `${eur(x.effortMensuel)} / mois` : 'aucun'}</b></div>
        </div>` : aCompleter(b, x)}
        <div class="fiche-grille">
          ${tableau('Acquisition', [...a.postes.filter(([k, , v]) => v > 0 || k === 'prix' || k === 'notaire').map(([, l, v]) => ligne(l, eur(v))), `<tr class="total"><th scope="row">Coût total</th><td class="nb">${eur(a.total)}</td></tr>`])}
          ${tableau('Loyers par an', [
            ...(b.location === 'saisonnier' ? [ligne(`${b.nuits} nuits à ${eurC(b.prixNuit)}`, eur(r.theorique))] : [...b.lots.map((l) => ligne(`${l.libelle} (${eur(l.loyer)} / mois)`, eur(l.loyer * 12))), ligne(`Vacance (${R.moisTexte(b.vacance)})`, eur(-r.vacance))]),
            `<tr class="total"><th scope="row">Loyers encaissés</th><td class="nb">${eur(r.encaisse)}</td></tr>`])}
          ${tableau('Charges par an', [...ch.postes.filter(([k, , v]) => v > 0 || k === 'taxeFonciere').map(([k, l, v]) => ligne(l, k === 'taxeFonciere' && b.taxeFonciere === null ? 'à saisir' : eur(v))), `<tr class="total"><th scope="row">Total des charges</th><td class="nb">${eur(ch.total)}</td></tr>`])}
          ${tableau('Financement', cr.mode === 'comptant' ? [ligne('Payé comptant', eur(a.total))] : [
            ligne('Apport', eur(cr.apport)), ligne('Montant emprunté', eur(cr.montant)),
            ligne('Taux et durée', `${esc(R.pct(b.financement.taux))} · ${esc(R.duree(b.financement.dureeMois))}`),
            ligne('Mensualité hors assurance', eurC(cr.mensualite)), ligne('Assurance', `${eurC(cr.assurance)} / mois`),
            `<tr class="total"><th scope="row">Mensualité totale</th><td class="nb">${eurC(cr.mensuelTotal)}</td></tr>`])}
        </div>
        ${s ? `<section class="fiche-bloc"><h3>Sensibilité</h3><div class="defile"><table class="tableau fiche-table"><thead><tr><th scope="col">Scénario</th><th scope="col" class="nb">Rendement net</th><th scope="col" class="nb">Cash-flow mensuel</th></tr></thead><tbody>${s.map((y) => `<tr><th scope="row">${esc(y.nom)}</th><td class="nb">${esc(R.pct(y.rendementNet))}</td><td class="nb">${eurS(y.cashflowMensuel)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
        ${p ? `<p class="fiche-note"><b>Prix maximal</b> pour un rendement ${E.cible.type === 'brut' ? 'brut' : 'net de charges'} de ${esc(R.pct(E.cible.taux))} : ${p.impossible ? 'inatteignable avec ces loyers et ces charges' : `${eur(p.prix)} (${p.ecart < 0 ? `baisse de ${eur(-p.ecart)} à obtenir` : `marge de ${eur(p.ecart)}`})`}.</p>` : ''}
        ${b.notaireMode === 'estime' ? `<p class="fiche-note">Frais de notaire estimés à ${esc(R.pct(b.notairePct || 0, 1))} du prix : hypothèse, à remplacer par le montant du notaire.</p>` : ''}
        ${b.note ? `<p class="fiche-note"><b>Note</b> : ${esc(b.note)}</p>` : ''}
        <p class="fiche-note"><b>Hors calcul</b> : ${esc(B.fiscalite)}</p>
        ${AVERTISSEMENT}
      </article>`;
  }

  // ---------- Graphiques ----------
  const graphes = new Map();
  function pasRond(etendue, nb = 4) {
    const brut = etendue / nb;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const largeurGraphe = () => Math.round(Math.min(1148, Math.max(300, document.documentElement.clientWidth - (estTel() ? 44 : 100))));
  const cleCarre = (c) => `<i class="cle-carre" style="--c:${c}"></i>`;

  // Barres horizontales signées autour de zéro (cash-flow par bien ou par scénario).
  function graphiqueSigne(id, items, titre, note, legendeSigne = false) {
    const L = largeurGraphe();
    const petit = L < 560;
    const gN = petit ? 0 : 210, d = petit ? 76 : 96, hBar = 22, pasY = petit ? 58 : 44, h0 = 10;
    const H = h0 + items.length * pasY + 26;
    const min = Math.min(0, ...items.map((x) => x.valeur)), max = Math.max(0, ...items.map((x) => x.valeur));
    const pas = pasRond(Math.max(1, max - min));
    const bas = Math.floor(min / pas) * pas, haut = Math.ceil(max / pas) * pas || (bas === 0 ? pas : 0);
    const gauche = gN + (min < 0 ? d : 8);
    const xs = (v) => gauche + ((L - gauche - d) * (v - bas)) / (haut - bas);
    const grilles = [];
    for (let v = bas; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${xs(v)}" x2="${xs(v)}" y1="${h0 - 4}" y2="${H - 22}"/><text class="axe" x="${xs(v)}" y="${H - 6}" text-anchor="middle">${eur(v)}</text>`);
    const barres = items.map((x, i) => {
      const yb = h0 + i * pasY + (petit ? 20 : 0);
      const x0 = Math.min(xs(0), xs(x.valeur)), x1 = Math.max(xs(0), xs(x.valeur));
      const nom = petit ? `<text class="valeur" x="0" y="${yb - 6}">${esc(x.nom)}</text>` : `<text class="valeur" x="${gN - 4}" y="${yb + 15}" text-anchor="end">${esc(x.nom.length > 28 ? `${x.nom.slice(0, 27)}…` : x.nom)}</text>`;
      const neg = x.valeur < 0;
      const etiq = `<text class="valeur" x="${neg ? x0 - 6 : x1 + 6}" y="${yb + 15}" text-anchor="${neg ? 'end' : 'start'}">${eurS(x.valeur)}</text>`;
      return `<g class="barre-offre" data-i="${i}">${nom}<rect x="${x0.toFixed(1)}" y="${yb}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${hBar}" rx="4" fill="${x.couleur}"/>${etiq}<rect class="zone" x="0" y="${yb - (petit ? 20 : 10)}" width="${L}" height="${pasY}" fill="transparent"/></g>`;
    }).join('');
    graphes.set(id, { items: items.map((x) => ({ titre: x.nom, lignes: [[x.couleur, eurS(x.valeur), 'Cash-flow mensuel'], ...x.detail.map(([l, v, t]) => [null, t ?? eurS(v), l])] })), sens: 'vertical' });
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">${esc(titre)}</caption><thead><tr><th scope="col">${legendeSigne ? 'Scénario' : 'Bien'}</th><th scope="col" class="nb">Cash-flow mensuel</th>${items[0]?.detail.map(([l]) => `<th scope="col" class="nb">${esc(l)}</th>`).join('') || ''}</tr></thead><tbody>${items.map((x) => `<tr><th scope="row">${esc(x.nom)}</th><td class="nb">${eurS(x.valeur)}</td>${x.detail.map(([, v, t]) => `<td class="nb">${t ?? eurS(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    const legende = legendeSigne
      ? `<div class="legende"><span>${cleCarre(TEINTES.hausse)}Le bien se paie seul</span><span>${cleCarre(TEINTES.baisse)}Effort d'épargne</span></div>`
      : (items.length > 1 ? `<div class="legende">${items.map((x) => `<span>${cleCarre(x.couleur)}${esc(x.nom)}</span>`).join('')}</div>` : '');
    return `<figure class="graphique" id="${id}" tabindex="0" aria-label="${esc(titre)} : flèches haut et bas pour lire chaque barre">
      ${legende}
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(titre)} ; détail dans le tableau">${grilles.join('')}${barres}</svg>
      <div class="infobulle" hidden></div>
      ${note ? `<figcaption class="note">${esc(note)}</figcaption>` : ''}
      ${table}
    </figure>`;
  }

  // Cascade mensuelle : loyers théoriques, vacance, charges, crédit, cash-flow.
  function graphiqueCascade(b, x) {
    const L = largeurGraphe();
    const petit = L < 560;
    const r = x.revenus;
    const etapes = [
      { nom: 'Loyers', long: 'Loyers théoriques', v: Math.round(r.theorique / 12), type: 'hausse' },
      ...(r.vacance ? [{ nom: 'Vacance', long: `Vacance (${R.moisTexte(b.vacance)} par an)`, v: -Math.round(r.vacance / 12), type: 'baisse' }] : []),
      { nom: 'Charges', long: 'Charges du propriétaire', v: -Math.round(x.charges.total / 12), type: 'baisse' },
      ...(x.credit.mensuelTotal ? [{ nom: 'Crédit', long: 'Crédit, assurance comprise', v: -x.credit.mensuelTotal, type: 'baisse' }] : []),
    ];
    let acc = 0;
    for (const e of etapes) { e.de = acc; acc += e.v; e.a = acc; }
    etapes.push({ nom: 'Cash-flow', long: 'Cash-flow mensuel avant impôt', v: x.cashflowMensuel, de: 0, a: x.cashflowMensuel, type: 'resultat' });
    const H = petit ? 250 : 300, g = petit ? 54 : 70, d = 12, h = 22, bb = 30;
    const min = Math.min(0, ...etapes.map((e) => Math.min(e.de, e.a))), max = Math.max(1, ...etapes.map((e) => Math.max(e.de, e.a)));
    const pas = pasRond(max - min);
    const bas = Math.floor(min / pas) * pas, haut = Math.ceil(max / pas) * pas;
    const hz = H - h - bb;
    const y = (v) => h + hz - ((v - bas) / (haut - bas)) * hz;
    const N = etapes.length, slot = (L - g - d) / N, lb = Math.min(petit ? 44 : 90, slot * 0.6);
    const grilles = [];
    for (let v = bas; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${eur(v)}</text>`);
    const cols = etapes.map((e, i) => {
      const cx = g + slot * i + (slot - lb) / 2;
      const y0 = y(Math.max(e.de, e.a)), y1 = y(Math.min(e.de, e.a));
      const lien = i < N - 1 ? `<line class="lien-cascade" x1="${(cx + lb).toFixed(1)}" x2="${(cx + slot).toFixed(1)}" y1="${y(e.a).toFixed(1)}" y2="${y(e.a).toFixed(1)}"/>` : '';
      const valY = e.v >= 0 ? y0 - 6 : y1 + 15;
      return `<g class="barre-offre" data-i="${i}"><rect x="${cx.toFixed(1)}" y="${y0.toFixed(1)}" width="${lb.toFixed(1)}" height="${Math.max(2, y1 - y0).toFixed(1)}" rx="4" fill="${TEINTES[e.type]}"/>${lien}<text class="valeur" x="${(cx + lb / 2).toFixed(1)}" y="${valY.toFixed(1)}" text-anchor="middle">${eurS(e.v)}</text><text class="axe" x="${(cx + lb / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(e.nom)}</text><rect class="zone" x="${(g + slot * i).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H - bb}" fill="transparent"/></g>`;
    }).join('');
    graphes.set('g-cascade', { items: etapes.map((e) => ({ titre: e.long, lignes: [[TEINTES[e.type], eurS(e.v), 'par mois'], ...(e.type === 'resultat' ? [] : [[null, eurS(e.a), 'cumul après cette étape']])] })), sens: 'horizontal' });
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">Du loyer au cash-flow, par mois</caption><thead><tr><th scope="col">Étape</th><th scope="col" class="nb">Montant par mois</th><th scope="col" class="nb">Cumul</th></tr></thead><tbody>${etapes.map((e) => `<tr><th scope="row">${esc(e.long)}</th><td class="nb">${eurS(e.v)}</td><td class="nb">${eurS(e.a)}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<figure class="graphique" id="g-cascade" tabindex="0" aria-label="Du loyer au cash-flow mensuel de ${esc(b.nom)} : flèches gauche et droite pour lire chaque étape">
      <div class="legende"><span>${cleCarre(TEINTES.hausse)}Loyers</span><span>${cleCarre(TEINTES.baisse)}Ce qui en est retiré</span><span>${cleCarre(TEINTES.resultat)}Cash-flow avant impôt</span></div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Du loyer au cash-flow mensuel de ${esc(b.nom)} ; détail dans le tableau">${grilles.join('')}${cols}</svg>
      <div class="infobulle" hidden></div>
      <figcaption class="note">Chaque mois, en moyenne sur l'année : les loyers, moins la vacance, les charges et le crédit. Ce qui reste est le cash-flow avant impôt.</figcaption>
      ${table}
    </figure>`;
  }

  function brancherGraphiques() {
    for (const [id, G] of graphes) {
      const fig = document.getElementById(id);
      if (!fig) continue;
      const svg = fig.querySelector('svg[role=img]');
      const bulle = fig.querySelector('.infobulle');
      let courant = -1;
      const placer = (px, py) => {
        const rs = svg.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let gx = px - rf.left + 14;
        if (gx + bulle.offsetWidth > rf.width - 8) gx = px - rf.left - bulle.offsetWidth - 14;
        bulle.style.left = `${Math.max(8, gx)}px`;
        bulle.style.top = `${Math.max(8, Math.min(rs.bottom - rf.top - bulle.offsetHeight, py - rf.top - 20))}px`;
      };
      const ligne = (col, val, nom) => { const l = document.createElement('div'); l.className = 'ligne-bulle'; if (col) { const k = document.createElement('i'); k.style.background = col; l.appendChild(k); } const v = document.createElement('strong'); v.textContent = val; l.appendChild(v); const n = document.createElement('span'); n.textContent = nom; l.appendChild(n); bulle.appendChild(l); };
      const cacher = () => { bulle.hidden = true; courant = -1; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      const montrer = (i, ev) => {
        i = Math.max(0, Math.min(G.items.length - 1, i)); courant = i;
        const it = G.items[i];
        fig.querySelectorAll('.barre-offre').forEach((el) => el.classList.toggle('survol', Number(el.dataset.i) === i));
        bulle.textContent = '';
        const t = document.createElement('b'); t.textContent = it.titre; bulle.appendChild(t);
        for (const [c, v, n] of it.lignes) ligne(c, v, n);
        bulle.hidden = false;
        const z = fig.querySelector(`.barre-offre[data-i="${i}"] .zone`).getBoundingClientRect();
        placer(ev?.clientX ?? (z.left + z.width / 2), ev?.clientY ?? (z.top + z.height / 2));
      };
      fig.querySelectorAll('.barre-offre').forEach((el) => { el.addEventListener('pointermove', (e) => montrer(Number(el.dataset.i), e)); el.addEventListener('pointerdown', (e) => montrer(Number(el.dataset.i), e)); });
      const [avant, apres] = G.sens === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
      fig.addEventListener('keydown', (e) => {
        if (e.key === avant || e.key === apres) { e.preventDefault(); montrer(courant < 0 ? 0 : courant + (e.key === apres ? 1 : -1)); }
        if (e.key === 'Escape') cacher();
      });
      fig.addEventListener('pointerleave', cacher);
      fig.addEventListener('blur', cacher);
    }
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
  const champE = (nom, lib, v, aide = '', ph = '0') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" value="${esc(R.saisieMontant(v))}" placeholder="${esc(ph)}"></label>`;
  const champT = (nom, lib, v, aide = '', ph = '') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" value="${esc(R.saisieTaux(v))}" placeholder="${esc(ph)}"></label>`;
  const aidePoste = (liste, k) => (liste.find((p) => p[0] === k) || [])[2] || '';
  const montantDe = (fd, nom, lib) => { const v = String(fd.get(nom) ?? '').trim(); if (!v) return 0; const m = R.lireMontant(v); if (m === null) throw new Error(`${lib} illisible : écris par exemple 1 250 ou 299,90.`); return m; };
  const montantOuNull = (fd, nom, lib) => (String(fd.get(nom) ?? '').trim() ? montantDe(fd, nom, lib) : null);
  const tauxDe = (fd, nom, lib, vide = null) => { const v = String(fd.get(nom) ?? '').trim(); if (!v) return vide; const t = R.lireTaux(v); if (t === null) throw new Error(`${lib} illisible : écris par exemple 3,45.`); return t; };

  function corpsBien(b) {
    const f = b.financement;
    const A = (k) => aidePoste(B.postesAcquisition, k);
    const C = (k) => aidePoste(B.postesCharges, k);
    const sais = b.location === 'saisonnier';
    const lots = [...b.lots];
    while (lots.length < R.MAX_LOTS) lots.push({ libelle: '', loyer: null, vide: true });
    const visibles = Math.max(1, b.lots.length);
    return `
      <fieldset class="champ cadre-champs"><legend>Le bien</legend>
        <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="60" value="${esc(b.nom)}" required></label>
          <label class="champ">Type de location<select name="location">${Object.entries(B.locations).map(([k, l]) => `<option value="${k}" ${b.location === k ? 'selected' : ''}>${esc(l.nom)}</option>`).join('')}</select></label></div>
        <div class="rang-champs"><label class="champ">État<select name="etat">${Object.entries(B.etats).map(([k, l]) => `<option value="${k}" ${b.etat === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label class="champ">Surface (m²) <small>Facultative.</small><input name="surface" inputmode="decimal" value="${b.surface ? String(b.surface).replace('.', ',') : ''}" placeholder="Ex. : 42"></label></div>
        <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(b.note)}"></label>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Acquisition</legend>
        <div class="rang-champs">${champE('prix', 'Prix d\'achat (€)', b.prix || null, A('prix'))}${champE('fraisAgence', 'Frais d\'agence (€)', b.fraisAgence, A('fraisAgence'))}</div>
        <div class="choix-statut deux">${[['estime', 'Notaire estimé (hypothèse)'], ['saisi', 'Montant du notaire']].map(([k, l]) => `<label><input type="radio" name="notaireMode" value="${k}" ${b.notaireMode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div class="rang-champs">${champT('notairePct', 'Frais de notaire (% du prix)', b.notairePct, `Hypothèse proposée : ${B.notaire.ancien} % ancien, ${B.notaire.neuf} % neuf.`)}${champE('notaireMontant', 'Montant du notaire (€)', b.notaireMontant || null)}</div>
        <p class="mention">${esc(B.notaire.texte)}</p>
        <div class="rang-champs">${champE('travaux', 'Travaux (€)', b.travaux, A('travaux'))}${champE('mobilier', 'Mobilier et équipement (€)', b.mobilier, A('mobilier'))}</div>
        <div class="rang-champs">${champE('fraisBancaires', 'Frais bancaires (€)', b.fraisBancaires, A('fraisBancaires'))}${champE('autresFrais', 'Autres frais (€)', b.autresFrais, A('autresFrais'))}</div>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Loyers <small data-loc-aide>${esc(B.locations[b.location].aide)}</small></legend>
        <div data-loyers="mois" ${sais ? 'hidden' : ''}>
          ${lots.map((l, i) => `<div class="rang-champs" data-lot="${i}" ${i < visibles ? '' : 'hidden'}><label class="champ">${i === 0 ? 'Lot ou chambre' : `Lot ${i + 1}`}<input name="lnom${i}" maxlength="40" value="${esc(l.libelle)}" placeholder="${b.location === 'colocation' ? `Chambre ${i + 1}` : 'Logement'}"></label>${champE(`lloyer${i}`, 'Loyer mensuel hors charges (€)', l.loyer || null, '', 'Ex. : 640')}</div>`).join('')}
          <div class="rang"><button class="btn petit" type="button" data-action="lot-ajout">${ICONES.plus}Ajouter un lot ou une chambre</button></div>
          <label class="champ">Vacance locative (mois par an) <small>Mois sans loyer en moyenne : entre deux locataires, travaux. Ex. : 1 ou 0,5.</small><input name="vacance" inputmode="decimal" value="${String(b.vacance).replace('.', ',')}"></label>
        </div>
        <div class="rang-champs" data-loyers="nuit" ${sais ? '' : 'hidden'}>${champE('prixNuit', 'Prix moyen d\'une nuit (€)', b.prixNuit || null, 'Hors taxe de séjour.')}<label class="champ">Nuits louées par an <small>Ton estimation, saisons comprises : elle tient lieu de vacance.</small><input name="nuits" inputmode="numeric" value="${b.nuits || ''}" placeholder="Ex. : 140"></label></div>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Charges du propriétaire <small>Par an, sauf la gestion en %.</small></legend>
        <div class="rang-champs">${champE('taxeFonciere', 'Taxe foncière (€)', b.taxeFonciere, C('taxeFonciere'), 'à saisir')}${champE('copro', 'Copropriété non récupérable (€)', b.copro, C('copro'))}</div>
        <div class="rang-champs">${champE('pno', 'Assurance propriétaire non occupant (€)', b.pno, C('pno'))}${champE('gli', 'Assurance loyers impayés (€)', b.gli, C('gli'))}</div>
        <div class="rang-champs">${champT('gestionPct', 'Gestion ou conciergerie (% des loyers)', b.gestionPct, C('gestion'), '0')}${champE('entretien', 'Entretien (€)', b.entretien, C('entretien'))}</div>
        <div class="rang-champs">${champE('exploitation', 'Énergie, internet, ménage (€)', b.exploitation, C('exploitation'))}${champE('autresCharges', 'Autres charges (€)', b.autresCharges, C('autresCharges'))}</div>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Financement <small>Conditions d'une simulation ou d'une offre de ta banque : aucun taux du marché n'est intégré.</small></legend>
        <div class="choix-statut deux">${[['credit', 'À crédit'], ['comptant', 'Comptant']].map(([k, l]) => `<label><input type="radio" name="mode" value="${k}" ${f.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div data-credit ${f.mode === 'credit' ? '' : 'hidden'}>
          <div class="rang-champs">${champE('apport', 'Apport (€)', f.apport)}${champE('montant', 'Montant emprunté (€)', f.montant, 'Vide : coût total − apport.', 'calculé')}</div>
          <div class="rang-champs">${champT('taux', 'Taux nominal (%)', f.taux, 'Hors assurance.', 'Ex. : 3,6')}<label class="champ">Durée (ans)<input name="ans" inputmode="numeric" value="${f.dureeMois ? Math.round(f.dureeMois / 12) : ''}" placeholder="Ex. : 20"></label></div>
          <div class="rang-champs">${champT('tauxAssurance', 'Taux d\'assurance annuel (%)', f.tauxAssurance, '0 si aucune.', 'Ex. : 0,30')}<label class="champ">Quotité totale (%)<input name="quotite" inputmode="numeric" value="${f.quotite}"></label></div>
          <div class="choix-statut deux">${[['initial', 'Assurance sur le capital initial'], ['crd', 'Sur le capital restant dû']].map(([k, l]) => `<label><input type="radio" name="assuranceMode" value="${k}" ${f.assuranceMode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        </div>
      </fieldset>
      <p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>`;
  }

  function lireBien(fd, base) {
    try {
      const lots = [];
      for (let i = 0; i < R.MAX_LOTS; i++) { const m = montantDe(fd, `lloyer${i}`, 'Loyer'); const n = String(fd.get(`lnom${i}`) || '').trim(); if (m > 0) lots.push({ libelle: n || (fd.get('location') === 'colocation' ? `Chambre ${lots.length + 1}` : 'Logement'), loyer: m }); }
      const vac = String(fd.get('vacance') || '').trim() ? R.lireMois(fd.get('vacance')) : 0;
      if (vac === null) throw new Error('Vacance : de 0 à 12 mois par an, au demi-mois près (ex. : 1,5).');
      const nuitsS = String(fd.get('nuits') || '').trim();
      const nuits = nuitsS ? R.lireEntier(nuitsS, 0, 366) : 0;
      if (nuits === null) throw new Error('Nuits louées par an : de 0 à 366.');
      const surfS = String(fd.get('surface') || '').trim().replace(',', '.');
      const surface = surfS ? Number(surfS) : null;
      if (surfS && !(surface > 0)) throw new Error('Surface illisible : écris par exemple 42 ou 42,5.');
      const ans = String(fd.get('ans') || '').trim();
      const duree = ans ? R.lireEntier(ans, 1, R.DUREE_MAX_ANS) : 0;
      if (duree === null) throw new Error(`Durée : de 1 à ${R.DUREE_MAX_ANS} ans.`);
      const quotite = String(fd.get('quotite') || '').trim() ? R.lireEntier(fd.get('quotite'), 0, 200) : 100;
      if (quotite === null) throw new Error('Quotité : de 0 à 200 %.');
      const notaireMode = fd.get('notaireMode') === 'saisi' ? 'saisi' : 'estime';
      const notairePct = tauxDe(fd, 'notairePct', 'Frais de notaire');
      if (notaireMode === 'estime' && notairePct === null) throw new Error('Indique le pourcentage estimé des frais de notaire, par exemple 8, ou choisis « Montant du notaire ».');
      const b = {
        ...base, nom: String(fd.get('nom') || '').trim() || base.nom, location: fd.get('location'), etat: fd.get('etat'), surface, note: String(fd.get('note') || '').trim(),
        prix: montantDe(fd, 'prix', 'Prix'), fraisAgence: montantDe(fd, 'fraisAgence', 'Frais d\'agence'), notaireMode, notairePct, notaireMontant: montantDe(fd, 'notaireMontant', 'Montant du notaire'),
        travaux: montantDe(fd, 'travaux', 'Travaux'), mobilier: montantDe(fd, 'mobilier', 'Mobilier'), fraisBancaires: montantDe(fd, 'fraisBancaires', 'Frais bancaires'), autresFrais: montantDe(fd, 'autresFrais', 'Autres frais'),
        lots: lots.length ? lots : [{ libelle: 'Logement', loyer: 0 }], vacance: vac, prixNuit: montantDe(fd, 'prixNuit', 'Prix d\'une nuit'), nuits,
        taxeFonciere: montantOuNull(fd, 'taxeFonciere', 'Taxe foncière'), copro: montantDe(fd, 'copro', 'Copropriété'), pno: montantDe(fd, 'pno', 'Assurance PNO'), gli: montantDe(fd, 'gli', 'Assurance loyers impayés'),
        gestionPct: tauxDe(fd, 'gestionPct', 'Gestion', 0), entretien: montantDe(fd, 'entretien', 'Entretien'), exploitation: montantDe(fd, 'exploitation', 'Énergie, internet, ménage'), autresCharges: montantDe(fd, 'autresCharges', 'Autres charges'),
        financement: { mode: fd.get('mode') === 'comptant' ? 'comptant' : 'credit', apport: montantDe(fd, 'apport', 'Apport'), montant: montantOuNull(fd, 'montant', 'Montant emprunté'), taux: tauxDe(fd, 'taux', 'Taux'), dureeMois: duree * 12, tauxAssurance: tauxDe(fd, 'tauxAssurance', 'Taux d\'assurance'), assuranceMode: fd.get('assuranceMode'), quotite },
      };
      if (b.notaireMode === 'saisi' && !b.notaireMontant) throw new Error('Saisis le montant donné par le notaire, ou choisis « Notaire estimé ».');
      return { b: R.normaliserBien(b, 0, [], B.notaire) };
    } catch (x) { return x.message; }
  }

  function modaleBien(id) {
    const existant = id ? bien(id) : null;
    if (id && !existant) return;
    if (!existant && E.biens.length >= R.MAX_BIENS) { toast(`${R.MAX_BIENS} biens au plus : retire celui que tu n'étudies plus.`); return; }
    const b = existant || R.normaliserBien({ nom: `Bien ${E.biens.length + 1}`, notairePct: B.notaire.ancien, financement: { mode: 'credit', dureeMois: 240 } }, E.biens.length, E.biens.map((x) => x.couleur), B.notaire);
    const pied = existant
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" type="button" data-action="bien-dupliquer" data-id="${b.id}">Dupliquer</button><button class="btn danger" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(existant ? esc(b.nom) : 'Nouveau bien à étudier', corpsBien(b), pied, (fd, action) => {
      if (action === 'supprimer') {
        if (E.biens.length <= 1) { toast('Garde au moins un bien : modifie plutôt celui-ci.'); garderOuverte(); return; }
        if (!confirm(`Supprimer le bien « ${b.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.biens = E.biens.filter((x) => x.id !== b.id);
        sauver(); rendre(); toast(`Bien « ${b.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const r = lireBien(fd, b);
      if (typeof r === 'string') return r;
      retenir();
      if (existant) Object.assign(existant, r.b); else { E.biens.push(r.b); E.actif = r.b.id; }
      sauver(); rendre();
      const x = R.analyser(r.b);
      toast(x.complet ? `« ${r.b.nom} » : ${R.pct(x.rendementNet)} net, ${eurS(x.cashflowMensuel)} par mois avant impôt.` : `« ${r.b.nom} » enregistré, à compléter : ${x.manque.join(', ')}.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const apercu = () => {
      const loc = f.querySelector('[name=location]').value;
      f.querySelector('[data-loyers="mois"]').hidden = loc === 'saisonnier';
      f.querySelector('[data-loyers="nuit"]').hidden = loc !== 'saisonnier';
      f.querySelector('[data-loc-aide]').textContent = B.locations[loc].aide;
      f.querySelector('[data-credit]').hidden = f.querySelector('[name=mode]:checked').value !== 'credit';
      const r = lireBien(new FormData(f), b);
      const el = $('#apercu');
      if (!el) return;
      if (typeof r === 'string') { el.textContent = ''; return; }
      const x = R.analyser(r.b);
      el.innerHTML = x.complet
        ? `Coût total <b>${eur(x.coutTotal)}</b> · brut <b>${esc(R.pct(x.rendementBrut))}</b> · net <b>${esc(R.pct(x.rendementNet))}</b> · cash-flow <b>${eurS(x.cashflowMensuel)}</b> par mois avant impôt`
        : `Coût total ${eur(x.coutTotal)} · à compléter : ${esc(x.manque.join(', '))}.`;
    };
    f.addEventListener('input', apercu);
    f.addEventListener('change', apercu);
    f.querySelector('[data-action="lot-ajout"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const cache2 = f.querySelector('[data-lot][hidden]');
      if (cache2) { cache2.hidden = false; cache2.querySelector('input').focus(); }
      if (!f.querySelector('[data-lot][hidden]')) e.currentTarget.disabled = true;
    });
    apercu();
  }

  function dupliquerBien(id) {
    const b = bien(id);
    if (!b) return;
    if (E.biens.length >= R.MAX_BIENS) { toast(`${R.MAX_BIENS} biens au plus.`); return; }
    retenir();
    const copie = R.normaliserBien({ ...structuredClone(b), id: R.nouvelId(), couleur: null, nom: `${b.nom} (variante)`.slice(0, 60) }, E.biens.length, E.biens.map((x) => x.couleur), B.notaire);
    E.biens.splice(E.biens.indexOf(b) + 1, 0, copie);
    E.actif = copie.id;
    sauver(); rendre();
    modaleBien(copie.id);
    toast('Bien dupliqué : change ce qui diffère (prix négocié, durée du crédit, type de location…).', { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Le comparatif des biens en tableur (CSV), ou la fiche d'analyse du bien affiché à imprimer (ou en PDF depuis le navigateur).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Comparatif en CSV</button><button class="btn petit" type="button" data-action="fiche-imprimer">Imprimer la fiche</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton étude est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button><button class="btn petit danger" type="button" data-action="tout-effacer">Recommencer à zéro</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du calcul, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données</h3><p class="mention">Ton étude est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Aucune connexion à une banque, une agence ni une plateforme : tu saisis toi-même prix, loyers, charges et crédit.</p></div>
      <div class="groupe"><h3>Sources et version</h3><p class="mention">Version ${esc(B.version)}. Aucun prix au m², loyer de référence, taux de crédit ni taux d'imposition intégré. Frais de notaire : hypothèse modifiable (${B.notaire.ancien} % ancien, ${B.notaire.neuf} % neuf, ordres de grandeur consultés le ${esc(B.notaire.verifie)}), à remplacer par le montant du notaire. Formules du crédit identiques à celles de la capacité d'emprunt QME. Résultats avant impôt : ne remplace pas un conseil en investissement ni un conseil fiscal.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.biens)) throw new Error();
        if (!confirm('Remplacer ton étude actuelle par cette copie ?')) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de l\'étude.'); }
    });
  }

  function toutEffacer() {
    if (!confirm('Effacer tous les biens étudiés et recommencer ?')) return;
    if (modale().open) modale().close();
    E = { ...etatVide(), tutorielVu: Boolean(E.tutorielVu) };
    if (session.demo) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); return; }
    sauver();
    ecranAccueil();
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const aujIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `investissement-locatif-${aujIso()}.json`);
  const exporterCsv = () => telecharger(R.csvComparaison(E.biens, B), 'text/csv;charset=utf-8', `comparatif-biens-${aujIso()}.csv`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Saisis le coût complet', `Le coût total additionne le prix, les frais de notaire et d'agence, les travaux, le mobilier et les frais bancaires. Les frais de notaire proposés (${B.notaire.ancien}&nbsp;% du prix dans l'ancien, ${B.notaire.neuf}&nbsp;% dans le neuf) sont une hypothèse&nbsp;: remplace-la par le montant du notaire. Tant que le prix, le loyer, la taxe foncière ou les conditions du crédit manquent, rien n'est calculé.`],
      ['beurre', 'Deux rendements', `Le <b>rendement brut</b> divise les loyers de l'année, sans vacance, par le prix d'achat&nbsp;: c'est le chiffre des annonces. Le <b>rendement net de charges</b> divise les loyers encaissés (vacance déduite), moins tes charges, par le coût total. Les deux sont calculés hors crédit et avant impôt.`],
      ['ciel', 'Le cash-flow', `Chaque mois&nbsp;: loyers encaissés, moins charges, moins mensualité du crédit assurance comprise. Négatif, c'est ton <b>effort d'épargne</b>&nbsp;: ce qu'il faut ajouter de ta poche. L'impôt sur les loyers n'est pas calculé&nbsp;: fais-le estimer à part.`],
      ['sable', 'Compare et teste', `<b>Comparatif</b> met jusqu'à ${R.MAX_BIENS} biens côte à côte. Indique le rendement que tu vises&nbsp;: l'outil donne, pour chaque bien, le prix maximal à proposer. <b>Sensibilité</b> montre ce que devient un bien si le loyer baisse de 10&nbsp;%, s'il reste vide un mois de plus ou si le taux du crédit monte d'un point.`],
    ];
    const corps = `
      <p>L'outil calcule pour toi le coût total, les rendements et le cash-flow de chaque bien, avant impôt. Ton rôle&nbsp;: saisir les vrais chiffres (prix, frais, loyers, charges, crédit), car aucun prix ni loyer du marché n'est intégré.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Analyse</b> détaille le calcul d'un bien et ce qu'il faut vérifier avant d'acheter&nbsp;; <b>Fiche</b> le résume sur une page à imprimer. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton étude est enregistrée en ligne avec ta clé&nbsp;: tu la retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    ouvrirModale('Comment ça marche', corps, `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`);
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'bien-nouveau': modaleBien(null); break;
      case 'bien': modaleBien(id); break;
      case 'bien-dupliquer': dupliquerBien(id); break;
      case 'choisir-bien': E.actif = id; sauver(); rendre(); break;
      case 'ouvrir-analyse': E.actif = id; sauver(); changerVue('analyse'); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fiche-imprimer': if (modale().open) modale().close(); changerVue('fiche'); setTimeout(() => window.print(), 80); break;
      case 'imprimer': if (modale().open) modale().close(); setTimeout(() => window.print(), 50); break;
      case 'tout-effacer': toutEffacer(); break;
      case 'fermer': modale().close(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="verif"]');
    if (!el) return;
    const b = actif();
    if (el.checked) b.verifs[el.dataset.id] = true; else delete b.verifs[el.dataset.id];
    sauver();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeur) > 40 && E && $('#vue') && (vue === 'comparatif' || vue === 'analyse' || vue === 'sensibilite') && !modale().open) { largeur = window.innerWidth; rendre(); } });
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
        if (estPret(E)) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__investissement = { etat: () => E, regles: R };
  init();
})();
