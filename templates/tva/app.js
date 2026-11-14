// Suivi de TVA QME : opérations (ventes, achats, frais, immobilisations) avec calcul HT ↔ TTC au centime,
// périodes selon le régime (réel normal mensuel ou trimestriel, réel simplifié), TVA collectée, déductible,
// nette ou crédit reporté, échéancier paramétrable, pointage « déclarée / payée », contrôles de cohérence,
// export et import CSV. Données synchronisées par clé de licence ou code d'accès.
// Outil d'aide au suivi : aucun lien avec l'espace professionnel des impôts, une banque ou un logiciel comptable.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.TVA;
  const API = '/api/templates';
  const PRODUIT = 'TVA';
  const CLE_CODE = 'qme-tva-code';
  const CLE_CACHE = 'qme-tva-cache';
  const CLE_DEMO = 'qme-tva-demo';
  const CLE_PREF = 'qme-tva-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-tva-ecran-accueil';

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
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const fmtNb = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNb0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const eur = (x) => `${fmtNb.format(Number(x) || 0)} €`;
  const eur0 = (x) => `${fmtNb0.format(Math.round(Number(x) || 0))} €`;
  const pct = (t) => `${String(t).replace('.', ',')} %`;
  const dC = R.dateCourte;
  const dateLongue = (d) => R.versDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const typeDe = (id) => B.types.find((t) => t.id === id) || B.types[0];
  const NOM_REGIME = Object.fromEntries(B.regimes.map((r) => [r.id, r.nom]));

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'synthese';
  const pref = stock.lire(CLE_PREF) || {};
  const filtre = { type: '', periode: '', texte: '', echeances: pref.echeances === 'toutes' ? 'toutes' : 'afaire' };
  let annulation = null;
  let BL = [], ECH = [], CTL = [], CTL_OP = new Map(); // recalculés à chaque rendu

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const trouverOp = (id) => E.operations.find((o) => o.id === id);
  function sauverPref() { stock.ecrire(CLE_PREF, { echeances: filtre.echeances }); }

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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte puis retire les années anciennes (Réglages).');
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
  // Code interne (TVA-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Menuiserie fictive au réel normal mensuel, suivie depuis onze mois : ventes à 20, 10 et 5,5 %, achats,
  // frais, deux gros investissements (crédit de TVA reporté sur plusieurs mois), toutes les déclarations
  // pointées sauf les plus récentes (une déclarée mais non payée, la suivante à faire bientôt), un taux
  // inhabituel, une TVA qui ne correspond pas à HT × taux et un achat saisi après la déclaration de son mois.
  function donneesDemo() {
    const t = auj();
    const m0 = R.ajoutMois(R.debutMois(t), -11);
    const e = etatVide();
    e.reglages = R.normaliserReglages({ ...B.reglages, societe: 'Atelier des Tilleuls, menuiserie (fictif)', regime: 'mensuel', debut: m0, creditInitial: 0, jourEcheance: 15 }, B);
    const ops = [];
    const op = (k, jour, type, libelle, ht, taux, piece, x = {}) => {
      const mois = R.ajoutMois(m0, k);
      const date = R.jourDansMois(mois, jour);
      if (date > t) return;
      const c = R.calculer('ht', ht, taux);
      ops.push({ id: uid(), date, type, libelle, piece, ...c, taux, creeLe: date, ...x });
    };
    let f = 101, a = 1;
    const fac = () => `F-${String(f++).padStart(4, '0')}`;
    const ach = () => `A-${String(a++).padStart(3, '0')}`;
    const ventes = [
      ['Cuisine sur mesure, maison neuve', 20], ['Rénovation d\'escalier, logement ancien', 10], ['Fenêtres isolantes posées, logement ancien', 5.5],
      ['Agencement de boutique', 20], ['Placards et dressing, logement ancien', 10], ['Bibliothèque sur mesure', 20],
    ];
    for (let k = 0; k <= 11; k++) {
      const calme = k >= 4 && k <= 6; // trois mois creux pendant l'investissement
      const nb = calme ? 1 : 3;
      for (let i = 0; i < nb; i++) {
        const [lib, taux] = ventes[(k * 2 + i) % ventes.length];
        op(k, 4 + i * 9, 'vente', lib, (calme ? 2600 : 3100 + ((k * 7 + i * 13) % 9) * 410), taux, fac());
      }
      op(k, 6, 'achat', 'Panneaux et bois massif', 1450 + (k % 4) * 260, 20, ach());
      op(k, 17, 'achat', 'Quincaillerie et visserie', 240 + (k % 3) * 55, 20, ach());
      op(k, 2, 'frais', 'Loyer de l\'atelier', 1200, 20, `L-${k + 1}`);
      op(k, 21, 'frais', 'Téléphone et internet', 49.9, 20, '');
      if (k % 3 === 0) op(k, 12, 'frais', 'Assurance professionnelle (exonérée)', 310, 0, '');
    }
    op(4, 9, 'immo', 'Machine à commande numérique', 6400, 20, ach());
    op(5, 14, 'immo', 'Fourgon utilitaire', 4800, 20, ach());
    op(6, 11, 'immo', 'Système d\'aspiration des copeaux', 1500, 20, ach());
    e.operations = ops;
    // Pointage : déclarations faites deux jours avant l'échéance, avec le montant calculé à ce moment-là.
    const bl = R.bilans(R.normaliser(e, B), t);
    const n = bl.length;
    for (const [i, b] of bl.entries()) {
      if (b.fin >= t) continue;
      const ech = b.echeances.declaration;
      const avantDernier = i === n - 3, dernier = i === n - 2;
      if (dernier && ech >= t) continue; // à déclarer bientôt
      const decl = ech < t ? R.ajout(ech, -2) : R.ajout(t, -1);
      e.suivi[b.cle] = { declare: decl, montant: b.aPayer };
      if (!avantDernier || ech >= t) { if (b.aPayer > 0) e.suivi[b.cle].paye = decl; }
    }
    // Anomalies à contrôler.
    const k2 = Math.max(0, n - 4), k1 = Math.max(0, n - 3);
    op(k2, 23, 'vente', 'Vente de chutes de bois', 180, 8, fac());
    const mauvais = R.calculer('ht', 2062.5, 20);
    op(k1 + 1 > 11 ? 11 : k1 + 1, 8, 'achat', 'Lasure et vernis', 2062.5, 20, ach(), { tva: R.arrondi(mauvais.tva + 2.5), ttc: R.arrondi(mauvais.ttc + 2.5) });
    const k3 = Math.max(0, n - 5);
    const decl3 = e.suivi[bl[k3].cle]?.declare;
    if (decl3) op(k3, 25, 'achat', 'Facture de colle retrouvée', 386, 20, ach(), { creeLe: R.ajout(t, -3) > decl3 ? R.ajout(t, -3) : R.ajout(decl3, 1) });
    e.operations = ops;
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT = '<div class="avertissement-fiscal"><b>Outil d\'aide au suivi, pas un conseil fiscal.</b> Les montants sont calculés à partir de ce que tu saisis et des réglages (taux, échéances) que tu peux modifier. Ce suivi ne remplace ni ton expert-comptable ni les déclarations officielles : seule la déclaration déposée auprès de l\'administration fiscale fait foi.</div>';

  function ecranConnexion(message = '') {
    document.title = 'Suivi de TVA · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="150" width="70" height="130" rx="14" fill="#1D4E89"/>
          <rect x="100" y="90" width="70" height="190" rx="14" fill="#F5B400"/>
          <rect x="180" y="190" width="70" height="90" rx="14" fill="#1D4E89"/>
          <rect x="260" y="60" width="70" height="220" rx="14" fill="#F5B400"/>
          <circle cx="455" cy="110" r="70" fill="#D9302A"/>
          <path d="M385 280 L455 210 L525 280 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi de TVA</p>
          <h1>Ta TVA, période par période.</h1>
          <p>Collectée, déductible, nette à payer ou crédit reporté, échéancier de tes déclarations et contrôles de cohérence avant de déclarer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi de TVA</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton suivi est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi de TVA</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/tva/">Voir le suivi de TVA</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
        <p class="mention">Outil d'aide au suivi : pas un conseil fiscal, il ne remplace ni ton expert-comptable ni tes déclarations officielles.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi de TVA'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, societe: '', regime: 'mensuel', debut: `${auj().slice(0, 4)}-01-01`, credit: '', jour: String(B.reglages.jourEcheance), cloture: '12' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ta TVA suivie au centime, période par période.</h1>
        <p class="intro">Tu saisis tes ventes, achats, frais et immobilisations. Le suivi calcule la TVA collectée et déductible de chaque période, ce qui reste à payer ou le crédit à reporter, rappelle tes échéances et signale ce qui mérite un coup d'œil avant de déclarer.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        ${AVERTISSEMENT}
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton régime de TVA</h1>
        <p class="intro">Tout se modifie ensuite dans Réglages → Régime, taux et échéances. En cas de doute sur ton régime, demande à ton expert-comptable.</p>
        <div class="form-accueil">
          <label class="champ">Nom de la société <small>facultatif, affiché en tête des exports</small><input id="a-societe" value="${esc(a.societe)}" maxlength="80"></label>
          <fieldset><legend>Régime</legend>
            <div class="modeles-choix">${B.regimes.map((x) => `<label class="modele-choix"><input type="radio" name="a-regime" value="${x.id}" ${x.id === a.regime ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.detail)}</small></span></label>`).join('')}</div>
          </fieldset>
          <div class="rang-champs">
            <label class="champ">Début du suivi<small>premier jour d'une période</small><input id="a-debut" type="date" value="${a.debut}"></label>
            <label class="champ">Crédit de TVA à reporter<small>au début du suivi, en euros</small><input id="a-credit" inputmode="decimal" value="${esc(a.credit)}" placeholder="0"></label>
          </div>
          <div class="rang-champs">
            <label class="champ">Jour d'échéance des CA3<small>entre le 15 et le 24 selon ton entreprise</small><input id="a-jour" inputmode="numeric" value="${esc(a.jour)}"></label>
            <label class="champ">Mois de clôture de l'exercice<small>réel simplifié</small><select id="a-cloture">${R.MOIS.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === a.cloture ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          </div>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-societe', 'societe'); lier('#a-debut', 'debut'); lier('#a-credit', 'credit'); lier('#a-jour', 'jour'); lier('#a-cloture', 'cloture');
    document.querySelectorAll('[name=a-regime]').forEach((r) => r.addEventListener('change', (e) => { accueil.regime = e.target.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    if (!R.estDate(a.debut)) return ecranAccueil('Indique la date de début du suivi.');
    const credit = R.lireNombre(a.credit || '0');
    if (credit === null || credit < 0) return ecranAccueil('Le crédit de TVA est un montant positif (ou vide).');
    E = etatVide();
    E.reglages = R.normaliserReglages({ ...B.reglages, societe: a.societe, regime: a.regime, debut: a.debut, creditInitial: credit, jourEcheance: a.jour, clotureMois: a.cloture }, B);
    if (a.regime === 'simplifie') E.reglages.debut = R.periodeDe(E.reglages, a.debut).debut;
    accueil = accueilVide();
    vue = 'operations';
    sauver();
    demarrer();
    toast('Ton suivi est prêt : ajoute tes premières opérations.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    synthese: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor"/></svg>',
    operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1.5" fill="currentColor"/><rect x="3" y="10" width="18" height="4" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" rx="1.5" fill="currentColor"/></svg>',
    periodes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="5" rx="2" fill="currentColor"/><circle cx="12" cy="15.5" r="2.5" fill="currentColor"/></svg>',
    controles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['synthese', 'Synthèse'], ['operations', 'Opérations'], ['periodes', 'Périodes'], ['echeances', 'Échéances'], ['controles', 'Contrôles']];
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="26" height="56" rx="6" fill="#1D4E89"/><rect x="34" y="16" width="26" height="80" rx="6" fill="#F5B400"/><circle cx="80" cy="22" r="16" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const GRAV = { rouge: ['rouge', 'À corriger'], jaune: ['jaune', 'À vérifier'], info: ['ciel', 'Pour info'] };
  const STATUT = { fait: ['vert', 'Fait'], encours: ['sable', 'Période en cours'], retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], avenir: ['ciel', 'À venir'] };
  const etiquetteType = (id) => `<span class="etiquette type-${id}">${esc(typeDe(id).nom)}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/tva/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Société fictive, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi<br>de TVA</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>
      <footer class="pied-app"><p><b>Outil d'aide au suivi de la TVA</b>, pas un conseil fiscal : il ne remplace ni ton expert-comptable ni les déclarations officielles. Taux et échéances vérifiés le ${dC(B.verifieLe)}, modifiables dans les réglages.</p></footer>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function calculer() {
    const t = auj();
    BL = R.bilans(E, t);
    ECH = R.echeancier(E, t);
    CTL = R.controles(E, t);
    CTL_OP = new Map();
    for (const c of CTL) if (c.op) CTL_OP.set(c.op, [...(CTL_OP.get(c.op) || []), c]);
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    calculer();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const nb = CTL.filter((c) => c.gravite === 'rouge').length;
    const og = $('.onglet[data-vue="controles"]');
    if (og) og.querySelector('em')?.remove();
    if (og && nb) og.insertAdjacentHTML('beforeend', `<em class="pastille-nb" aria-label="${nb} points à corriger">${nb > 99 ? '99+' : nb}</em>`);
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Suivi de TVA`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { synthese: vueSynthese, operations: vueOperations, periodes: vuePeriodes, echeances: vueEcheances, controles: vueControles }[vue]();
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
    $('#filtre-periode')?.addEventListener('change', (e) => { filtre.periode = e.target.value; rendre(); });
    const rech = $('#recherche');
    rech?.addEventListener('input', (e) => { filtre.texte = e.target.value; const pos = e.target.selectionStart; rendre(); const r2 = $('#recherche'); r2.focus(); r2.setSelectionRange(pos, pos); });
    brancherGraphique();
  }

  const tuile = (lib, v, d, c, forme = '') => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;
  const periodeCourante = () => BL.find((b) => b.debut <= auj() && b.fin >= auj()) || BL[BL.length - 1];
  const bilan = (cle) => BL.find((b) => b.cle === cle);

  // ---------- Synthèse ----------
  function vueSynthese() {
    const r = E.reglages;
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(r.societe || 'Suivi de TVA')} · ${esc(NOM_REGIME[r.regime])}</p><h1>Synthèse</h1></div><div class="actions"><button class="btn primaire" data-action="operation">${ICONES.plus}Opération</button></div></div>`;
    if (!E.operations.length) return `${tete}${videEtat('Aucune opération pour l\'instant', 'Saisis tes ventes (TVA collectée), tes achats, frais et immobilisations (TVA déductible). Tu peux aussi importer un fichier CSV depuis les réglages.', `<button class="btn primaire" data-action="operation">${ICONES.plus}Première opération</button><button class="btn" data-action="reglages">Importer un CSV</button>`)}${AVERTISSEMENT}`;
    const p = periodeCourante();
    const t = auj();
    const aFaire = ECH.filter((e) => e.statut !== 'fait' && e.statut !== 'encours');
    const prochaine = aFaire[0] || ECH.find((e) => e.statut === 'encours');
    const retards = ECH.filter((e) => e.statut === 'retard');
    const clos = BL.filter((b) => b.fin < t);
    const dernierClos = clos[clos.length - 1];
    const rouges = CTL.filter((c) => c.gravite === 'rouge').length, jaunes = CTL.filter((c) => c.gravite === 'jaune').length;
    const tuiles = [
      tuile(`En cours · ${esc(p.libelle)}`, p.creditFin > 0 ? `− ${eur0(p.creditFin)}` : eur0(p.aPayer), p.creditFin > 0 ? 'Crédit à ce jour (rien à payer)' : `Collectée ${eur0(p.collectee)} · déductible ${eur0(p.deductible)}`, 'var(--bleu)', 'rond'),
      tuile('Prochaine échéance', prochaine ? esc(dC(prochaine.date).slice(0, 5)) : '—', prochaine ? `${esc(prochaine.libelle)} · ${(prochaine.montantDeclare ?? prochaine.montant) ? eur((prochaine.montantDeclare ?? prochaine.montant)) : 'rien à payer'}` : 'Aucune échéance', prochaine?.statut === 'retard' ? 'var(--rouge)' : 'var(--jaune)'),
      tuile('Crédit reporté', eur0(dernierClos?.creditReporte || 0), dernierClos ? `À fin ${esc(dernierClos.libelle)}` : 'Aucune période close', 'var(--encre)', 'rond'),
      tuile('Contrôles', String(rouges + jaunes), rouges ? `${pluriel(rouges, 'point')} à corriger, ${jaunes} à vérifier` : jaunes ? `${pluriel(jaunes, 'point')} à vérifier` : 'Rien à signaler', rouges ? 'var(--rouge)' : 'var(--encre)'),
    ].join('');
    const alerte = retards.length ? `<button class="alerte-lien" data-action="vue" data-vue="echeances"><b>${pluriel(retards.length, 'échéance passée', 'échéances passées')} sans pointage.</b> ${esc(retards.map((e) => e.libelle).join(' · '))} <u>Voir l'échéancier</u></button>` : '';
    const prochaines = aFaire.slice(0, 4);
    return `${tete}
      <div class="tuiles">${tuiles}</div>
      ${alerte}
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">TVA collectée et déductible <span>${pluriel(Math.min(12, BL.length), 'dernière période', 'dernières périodes')}</span></h2>${graphique()}</section>
        <section><h2 class="titre-section">À faire <button class="btn petit lien" data-action="vue" data-vue="echeances">Tout l'échéancier</button></h2>
          ${prochaines.length ? `<ul class="echeances">${prochaines.map(ligneEcheance).join('')}</ul>` : '<p class="ok-ligne">Rien en attente : toutes les échéances passées sont pointées.</p>'}
          <h2 class="titre-section">Période en cours</h2>${cartePeriode(p)}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Graphique : TVA collectée et déductible des 12 dernières périodes (barres groupées, une seule échelle).
  function graphique() {
    const per = BL.slice(-12);
    const L = Math.round(Math.min(700, Math.max(300, (estTel() ? window.innerWidth - 48 : Math.min(window.innerWidth, 1180) * 0.55)))), H = L < 500 ? 210 : 250, g = L < 500 ? 46 : 58, bas = 26, hz = H - bas - 12;
    const max = Math.max(100, ...per.map((b) => Math.max(b.collectee, b.deductible)));
    const pasBrut = max / 4, p10 = 10 ** Math.floor(Math.log10(pasBrut));
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((v) => v >= pasBrut);
    const haut = pas * 4, larg = (L - g) / per.length;
    const y = (v) => 12 + hz - (v / haut) * hz;
    const kEur = (v) => (v >= 1000 ? `${String(Math.round(v / 100) / 10).replace('.', ',')} k€` : `${Math.round(v)} €`);
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${kEur(i * pas)}</text>`).join('');
    const pasEtiq = per.length > 6 && L < 500 ? 2 : 1;
    const cols = per.map((b, i) => {
      const w = Math.max(4, Math.min(22, larg * 0.32)), x0 = g + i * larg + larg / 2 - w - 1;
      const barre = (v, x, c, cl) => (v > 0 ? `<path class="${cl}" d="M${x},${y(0)} V${y(v) + Math.min(4, y(0) - y(v))} q0,-4 4,-4 H${x + w - 4} q4,0 4,4 V${y(0)} Z" fill="${c}"/>` : '');
      const etiq = (per.length - 1 - i) % pasEtiq === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 8}" text-anchor="middle">${esc(b.court)}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - bas}"/><g class="colonne" data-i="${i}">${barre(b.collectee, x0, B.couleurs.collectee, 'b-col')}${barre(b.deductible, x0 + w + 2, B.couleurs.deductible, 'b-ded')}</g>${etiq}`;
    }).join('');
    return `<figure class="graphique" id="graphique">
      <div class="graphique-tete"><div class="legende"><span><i style="background:${B.couleurs.collectee}"></i>TVA collectée</span><span><i style="background:${B.couleurs.deductible}"></i>TVA déductible</span></div></div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="TVA collectée et déductible par période, détail dans le tableau qui suit">${grilles}${cols}</svg>
      <div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Période</th><th class="nb">Collectée</th><th class="nb">Déductible</th><th class="nb">À payer</th><th class="nb">Crédit</th></tr></thead><tbody>${per.map((b) => `<tr><td>${esc(b.libelle)}</td><td class="nb">${eur(b.collectee)}</td><td class="nb">${eur(b.deductible)}</td><td class="nb">${eur(b.aPayer)}</td><td class="nb">${eur(b.creditFin)}</td></tr>`).join('')}</tbody></table></div></details>
    </figure>`;
  }
  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const per = BL.slice(-12);
    const bulle = fig.querySelector('.infobulle');
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), b = per[i];
      fig.querySelectorAll('.colonne').forEach((x) => x.classList.toggle('active', x.dataset.i === String(i)));
      bulle.innerHTML = `<b>${esc(b.libelle)}</b><div><i style="background:${B.couleurs.collectee}"></i>Collectée : ${eur(b.collectee)}</div><div><i style="background:${B.couleurs.deductible}"></i>Déductible : ${eur(b.deductible)}</div>${b.creditAnterieur ? `<div>Crédit antérieur : ${eur(b.creditAnterieur)}</div>` : ''}<div>${b.creditFin ? `Crédit : ${eur(b.creditFin)}` : `À payer : ${eur(b.aPayer)}`}</div>`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '44px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((x) => x.classList.remove('active')); });
  }

  // ---------- Opérations ----------
  function vueOperations() {
    const r = E.reglages;
    const per = [...BL].reverse();
    const p = filtre.periode ? bilan(filtre.periode) : null;
    if (filtre.periode && !p) filtre.periode = '';
    const q = R.plat(filtre.texte.trim());
    const dansP = E.operations.filter((o) => !p || R.dansPeriode(o, p));
    const liste = dansP.filter((o) => (!filtre.type || o.type === filtre.type) && (!q || R.plat(`${o.libelle} ${o.piece || ''}`).includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.piece || '').localeCompare(String(a.piece || '')));
    const nbType = (t) => dansP.filter((o) => o.type === t).length;
    const totC = R.eur(liste.filter((o) => o.type === 'vente').reduce((x, o) => x + R.cts(o.tva), 0));
    const totD = R.eur(liste.filter((o) => o.type !== 'vente').reduce((x, o) => x + R.cts(o.tva), 0));
    const filtres = `<div class="filtres" role="group" aria-label="Type"><button class="filtre" data-action="filtre-type" data-f="" aria-pressed="${!filtre.type}">Toutes <small>${dansP.length}</small></button>${B.types.map((t) => `<button class="filtre" data-action="filtre-type" data-f="${t.id}" aria-pressed="${filtre.type === t.id}">${esc(t.pluriel)} <small>${nbType(t.id)}</small></button>`).join('')}</div>`;
    const outils = `<div class="outils-ops">
      <label class="champ">Période<select id="filtre-periode"><option value="">Toutes les périodes</option>${per.map((b) => `<option value="${b.cle}" ${b.cle === filtre.periode ? 'selected' : ''}>${esc(b.libelle)}</option>`).join('')}</select></label>
      <label class="champ recherche">Rechercher<input id="recherche" type="search" value="${esc(filtre.texte)}" placeholder="Libellé ou pièce"></label></div>`;
    const tete = `<div class="vue-tete"><div><h1>Opérations</h1><p>Ventes : TVA collectée. Achats, frais et immobilisations : TVA déductible. Date à retenir : celle où la TVA devient exigible ou déductible (livraison, encaissement pour les services sauf option) ; en cas de doute, vois avec ton expert-comptable.</p></div>
      <div class="actions"><button class="btn primaire" data-action="operation">${ICONES.plus}Opération</button></div></div>`;
    if (!E.operations.length) return `${tete}${videEtat('Aucune opération', 'Ajoute ta première vente ou ton premier achat, en HT ou en TTC : la TVA est calculée au centime.', `<button class="btn primaire" data-action="operation">${ICONES.plus}Ajouter une opération</button>`)}`;
    const lignes = liste.map((o) => {
      const cf = CTL_OP.get(o.id) || [];
      const grave = cf.some((c) => c.gravite === 'rouge') ? 'rouge' : cf.length ? 'jaune' : '';
      return `<li><button class="op ${grave ? `op-${grave}` : ''}" data-action="operation" data-id="${o.id}" title="${esc(cf.map((c) => c.nom).join(' · '))}">
        <span class="op-date">${esc(dC(o.date).slice(0, 5))}<small>${o.date.slice(0, 4)}</small></span>
        <span class="op-lib"><b>${esc(o.libelle || 'Sans libellé')}</b><span>${etiquetteType(o.type)}${o.piece ? ` <span class="op-piece">${esc(o.piece)}</span>` : ''}${cf.length ? ` <span class="etiquette ${grave}">${cf.length > 1 ? `${cf.length} contrôles` : esc(cf[0].nom)}</span>` : ''}</span></span>
        <span class="op-ht nb">${eur(o.ht)}<small>HT · ${pct(o.taux)}</small></span>
        <span class="op-tva nb ${o.type === 'vente' ? 'collectee' : 'deductible'}">${o.type === 'vente' ? '+' : '−'} ${eur(o.tva)}<small>TVA ${o.type === 'vente' ? 'collectée' : 'déductible'}</small></span>
        <span class="op-ttc nb">${eur(o.ttc)}<small>TTC</small></span>
      </button></li>`;
    }).join('');
    return `${tete}${outils}${filtres}
      <p class="resume-liste">${pluriel(liste.length, 'opération')} · TVA collectée <b>${eur(totC)}</b> · TVA déductible <b>${eur(totD)}</b>${p ? ` · ${esc(p.libelle)}` : ''}</p>
      ${liste.length ? `<ul class="ops">${lignes}</ul>` : '<p class="ok-ligne">Aucune opération pour ce filtre.</p>'}
      <p class="mention avertissement">Taux de ta liste : ${r.taux.map((t) => pct(t.taux)).join(', ')}. Un autre taux est accepté mais signalé dans les contrôles.</p>`;
  }

  // ---------- Périodes ----------
  function statutPeriode(b) {
    const e = ECH.find((x) => x.cle === b.cle);
    return e ? STATUT[e.statut] : STATUT.avenir;
  }
  function cartePeriode(b) {
    const [c, lib] = statutPeriode(b);
    const s = E.suivi[b.cle] || {};
    const simp = E.reglages.regime === 'simplifie';
    return `<article class="periode">
      <button class="periode-corps" data-action="periode" data-id="${b.cle}">
        <span class="periode-tete"><b>${esc(b.libelle)}</b><span class="etiquette ${c}">${lib}</span></span>
        <span class="periode-lignes">
          <span><small>Collectée</small><b class="nb">${eur(b.collectee)}</b></span>
          <span><small>Déductible</small><b class="nb">${eur(b.deductible)}</b></span>
          ${b.creditAnterieur ? `<span><small>Crédit antérieur</small><b class="nb">− ${eur(b.creditAnterieur)}</b></span>` : ''}
          ${simp ? `<span><small>Acomptes</small><b class="nb">− ${eur(b.totalAcomptes || 0)}</b></span>` : ''}
          <span class="periode-solde ${b.creditFin ? 'credit' : ''}"><small>${b.creditFin ? 'Crédit' : simp ? 'Solde à payer' : 'À payer'}</small><b class="nb">${eur(b.creditFin || b.aPayer)}</b></span>
        </span>
        <span class="periode-pied">${b.nombre ? pluriel(b.nombre, 'opération') : 'Aucune opération'} · échéance ${esc(dC(b.echeances.declaration))}${s.declare ? ` · déclarée le ${esc(dC(s.declare))}` : ''}${s.paye ? ` · payée le ${esc(dC(s.paye))}` : ''}${b.rembourse ? ` · remboursement demandé ${eur(b.rembourse)}` : ''}</span>
      </button></article>`;
  }
  function vuePeriodes() {
    const r = E.reglages;
    const liste = [...BL].reverse();
    const an = R.debutMois(auj()).slice(0, 4);
    const deLAnnee = BL.filter((b) => b.fin.slice(0, 4) === an);
    const somme = (k) => R.eur(deLAnnee.reduce((x, b) => x + R.cts(b[k]), 0));
    return `<div class="vue-tete"><div><h1>Périodes</h1><p>${esc(NOM_REGIME[r.regime])} : TVA collectée, déductible, crédit antérieur, ${r.regime === 'simplifie' ? 'acomptes, ' : ''}puis ce qui reste à payer ou le crédit reporté sur la période suivante. Touche une période pour le détail par taux et le pointage.</p></div>
        <div class="actions"><button class="btn" data-action="regime">Régime et échéances</button></div></div>
      <div class="tuiles tuiles-3">
        ${tuile(`Collectée ${an}`, eur0(somme('collectee')), 'Périodes qui finissent cette année', B.couleurs.collectee, 'rond')}
        ${tuile(`Déductible ${an}`, eur0(somme('deductible')), `dont immobilisations ${eur0(somme('deductibleImmo'))}`, B.couleurs.deductible)}
        ${tuile(`Payée ou à payer ${an}`, eur0(somme('aPayer')), 'Total des soldes à payer', 'var(--encre)', 'rond')}
      </div>
      <div class="periodes">${liste.map(cartePeriode).join('')}</div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Échéances ----------
  function ligneEcheance(e) {
    const [c, lib] = STATUT[e.statut];
    const d = R.versDate(e.date);
    const montant = e.montantDeclare ?? e.montant;
    const actions = e.statut === 'fait' ? `<button class="btn petit" data-action="pointer" data-id="${e.cle}">Pointage</button>`
      : e.type === 'acompte' ? `<button class="btn petit primaire" data-action="marquer-paye" data-id="${e.cle}">Payé</button>`
        : !e.declare ? `<button class="btn petit ${e.finie ? 'primaire' : ''}" data-action="marquer-declare" data-id="${e.cle}" ${e.finie ? '' : 'disabled title="La période n\'est pas finie"'}>Déclarée</button>`
          : `<button class="btn petit primaire" data-action="marquer-paye" data-id="${e.cle}">Payée</button>`;
    return `<li class="echeance st-${e.statut}">
      <span class="date-pastille ${e.statut === 'retard' ? 'alerte' : ''}"><b>${d.getDate()}</b>${R.MOIS_C[d.getMonth()]}</span>
      <button class="lien-ligne" data-action="pointer" data-id="${e.cle}"><b>${esc(e.libelle)}</b><span>${e.credit ? `Crédit de ${eur(e.credit)}, rien à payer` : montant ? `${eur(montant)}${e.montantDeclare !== null && e.montantDeclare !== e.montant ? ` déclarés (calcul ${eur(e.montant)})` : ''}` : 'Rien à payer'}${e.declare ? ` · déclarée le ${esc(dC(e.declare))}` : ''}${e.paye ? ` · payée le ${esc(dC(e.paye))}` : ''}</span></button>
      <span class="echeance-droite"><span class="etiquette ${c}">${lib}</span>${actions}</span></li>`;
  }
  function vueEcheances() {
    const r = E.reglages;
    const liste = filtre.echeances === 'toutes' ? [...ECH].reverse() : ECH.filter((e) => e.statut !== 'fait');
    const nb = (s) => ECH.filter((e) => e.statut === s).length;
    const regle = r.regime === 'simplifie'
      ? `Acomptes de ${pct(r.acompte1Pct)} et ${pct(r.acompte2Pct)} de la TVA de référence au ${r.jourAcompte} du 7e et du 12e mois de l'exercice (juillet et décembre pour un exercice civil), dispense sous ${eur0(r.dispenseAcomptes)} ; CA12 ${r.clotureMois === 12 ? (r.ca12Jour ? `le ${r.ca12Jour} ${R.MOIS[r.ca12Mois - 1]}` : 'le 2e jour ouvré suivant le 1er mai') : `dans les ${r.ca12Delai} mois de la clôture`}.`
      : `CA3 ${r.regime === 'mensuel' ? 'mensuelle' : 'trimestrielle'}, à déposer et payer le ${r.jourEcheance} du mois suivant la période.`;
    return `<div class="vue-tete"><div><h1>Échéances</h1><p>${esc(regle)} Les dates qui tombent un week-end ou un jour férié sont reportées au jour ouvrable suivant. Pointe chaque déclaration « déclarée » puis « payée ».</p></div>
        <div class="actions"><button class="btn" data-action="regime">Modifier les échéances</button></div></div>
      <div class="filtres" role="group" aria-label="Affichage"><button class="filtre" data-action="filtre-ech" data-f="afaire" aria-pressed="${filtre.echeances === 'afaire'}">À faire <small>${ECH.length - nb('fait')}</small></button><button class="filtre" data-action="filtre-ech" data-f="toutes" aria-pressed="${filtre.echeances === 'toutes'}">Toutes <small>${ECH.length}</small></button></div>
      ${nb('retard') ? `<p class="alerte-texte"><b>${pluriel(nb('retard'), 'échéance passée', 'échéances passées')} sans pointage.</b> Si c'est déjà fait, pointe-la ; sinon, régularise sans attendre (des pénalités de retard peuvent s'appliquer).</p>` : ''}
      ${liste.length ? `<ul class="echeances">${liste.map(ligneEcheance).join('')}</ul>` : '<p class="ok-ligne">Tout est pointé. Les prochaines échéances apparaîtront à la fin de chaque période.</p>'}
      <p class="aide" style="margin-top:20px">Le jour exact de tes échéances dépend de ton entreprise (forme juridique, département, numéro SIREN) : il figure dans ton espace professionnel. Saisis-le dans Réglages → Régime, taux et échéances.</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Contrôles ----------
  function vueControles() {
    const tete = `<div class="vue-tete"><div><h1>Contrôles</h1><p>Ce qui mérite un coup d'œil avant de déclarer : erreurs de calcul, taux inhabituels, opérations hors période ou saisies après la déclaration, périodes non déclarées ou non payées, crédits oubliés.</p></div></div>`;
    if (!CTL.length) return `${tete}${videEtat('Rien à signaler', 'Les calculs, les taux et les pointages sont cohérents avec ce que tu as saisi.')}${AVERTISSEMENT}`;
    const groupes = ['rouge', 'jaune', 'info'].map((g) => [g, CTL.filter((c) => c.gravite === g)]).filter(([, l]) => l.length);
    return `${tete}
      ${groupes.map(([g, l]) => `<h2 class="titre-section">${GRAV[g][1]} <span>${pluriel(l.length, 'point')}</span></h2>
        <ul class="controles">${l.map((c) => `<li class="ctl-${g}"><span class="etiquette ${GRAV[g][0]}">${esc(c.nom)}</span><p>${esc(c.texte)}</p>${c.op ? `<button class="btn petit" data-action="operation" data-id="${c.op}">Voir l'opération</button>` : c.echeance ? `<button class="btn petit" data-action="pointer" data-id="${c.echeance}">Pointer</button>` : c.periode ? `<button class="btn petit" data-action="periode" data-id="${c.periode}">Voir la période</button>` : `<button class="btn petit" data-action="regime">Réglages</button>`}</li>`).join('')}</ul>`).join('')}
      <p class="mention avertissement">Tolérance d'arrondi : ${eur(E.reglages.tolerance)} ; alerte après ${E.reglages.periodesDeductible} périodes de déductible supérieure à la collectée et après ${E.reglages.periodesCredit} périodes de crédit reporté. Modifiables dans Réglages → Régime, taux et échéances.</p>
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
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) p.textContent = err; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;

  // Opération : saisie en HT ou en TTC, TVA calculée au centime et modifiable (écart signalé).
  function modaleOperation(id, type0 = '') {
    const o0 = id ? trouverOp(id) : null;
    if (id && !o0) return;
    const r = E.reglages;
    const o = o0 ? { ...o0 } : { date: auj(), type: type0 || (filtre.type || 'vente'), libelle: '', piece: '', ht: '', taux: r.taux[0]?.taux ?? 20, tva: '', ttc: '' };
    const tauxConnu = r.taux.some((t) => t.taux === Number(o.taux));
    const num = (v) => (v === '' || v === null || v === undefined ? '' : fmtNb.format(v).replace(/ | /g, ' '));
    const corps = `
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut quatre">${B.types.map((t) => `<label><input type="radio" name="type" value="${t.id}" ${t.id === o.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
      <p class="aide" id="m-aide-type">${esc(typeDe(o.type).aide)}</p>
      <div class="rang-champs"><label class="champ">Date<input name="date" type="date" value="${o.date}"></label><label class="champ">Pièce<small>n° de facture</small><input name="piece" value="${esc(o.piece || '')}" maxlength="40"></label></div>
      <label class="champ">Libellé<small>client, fournisseur ou nature</small><input name="libelle" value="${esc(o.libelle)}" maxlength="120"></label>
      <fieldset class="champ"><legend>Saisir à partir du</legend><div class="choix-statut deux"><label><input type="radio" name="depuis" value="ht" checked><span>Montant HT</span></label><label><input type="radio" name="depuis" value="ttc"><span>Montant TTC</span></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ">Taux<select name="taux" id="m-taux">${r.taux.map((t) => `<option value="${t.taux}" ${t.taux === Number(o.taux) ? 'selected' : ''}>${pct(t.taux)} · ${esc(t.nom)}</option>`).join('')}<option value="autre" ${tauxConnu ? '' : 'selected'}>Autre taux…</option></select></label>
        <label class="champ" id="m-autre" ${tauxConnu ? 'hidden' : ''}>Autre taux (%)<input name="tauxAutre" inputmode="decimal" value="${tauxConnu ? '' : String(o.taux).replace('.', ',')}"></label>
      </div>
      <div class="rang-champs montants">
        <label class="champ">Montant HT<input name="ht" inputmode="decimal" value="${num(o.ht)}"></label>
        <label class="champ">TVA<small>calculée, modifiable</small><input name="tva" inputmode="decimal" value="${num(o.tva)}"></label>
        <label class="champ">Montant TTC<input name="ttc" inputmode="decimal" value="${num(o.ttc)}"></label>
      </div>
      <div class="apercu" id="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(o0 ? 'Modifier l\'opération' : 'Nouvelle opération', corps, PIED(!!o0), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.operations = E.operations.filter((x) => x.id !== o0.id); sauver(); rendre(); toast('Opération supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      const n = lire(fd);
      if (n === null) return 'Taux invalide : indique un pourcentage entre 0 et 100.';
      const err = R.validerOperation(n);
      if (err) return err;
      retenir();
      const i = E.operations.findIndex((x) => x.id === n.id);
      if (i >= 0) E.operations[i] = n; else E.operations.push(n);
      sauver(); rendre();
      const cf = R.ecartsOperation(n, r.tolerance);
      toast(cf.tvaKo || cf.ttcKo ? 'Opération enregistrée, avec un écart signalé dans les contrôles.' : o0 ? 'Opération modifiée.' : 'Opération ajoutée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    const taux = () => (f.taux.value === 'autre' ? R.lireNombre(f.tauxAutre.value) : Number(f.taux.value));
    function lire(fd) {
      const t = taux();
      if (t === null || t < 0 || t > 100) return null;
      return R.normaliserOperation({ ...(o0 || {}), id: o0?.id || uid(), creeLe: o0?.creeLe || auj(), date: fd.get('date'), type: fd.get('type'), libelle: fd.get('libelle'), piece: fd.get('piece'), taux: t, ht: R.lireNombre(fd.get('ht')) ?? 0, tva: R.lireNombre(fd.get('tva')) ?? 0, ttc: R.lireNombre(fd.get('ttc')) ?? 0 });
    }
    const ecrire = (champ, v) => { f[champ].value = num(v); };
    // Recalcule à partir du champ de départ (HT ou TTC) ; si la TVA est modifiée à la main, l'autre montant suit.
    function recalculer(source) {
      const t = taux();
      if (t === null) return apercu();
      const depuis = f.depuis.value;
      if (source === 'tva') {
        const tva = R.lireNombre(f.tva.value) ?? 0;
        if (depuis === 'ht') { const ht = R.lireNombre(f.ht.value); if (ht !== null) ecrire('ttc', R.arrondi(ht + tva)); } else { const ttc = R.lireNombre(f.ttc.value); if (ttc !== null) ecrire('ht', R.arrondi(ttc - tva)); }
      } else {
        const m = R.lireNombre(f[depuis].value);
        if (m !== null) { const c = R.calculer(depuis, m, t); ecrire('ht', c.ht); ecrire('tva', c.tva); ecrire('ttc', c.ttc); }
      }
      apercu();
    }
    function apercu() {
      const el = $('#apercu');
      const n = lire(new FormData(f));
      if (!n || (!n.ht && !n.ttc)) { el.innerHTML = ''; return; }
      const e = R.ecartsOperation(n, r.tolerance);
      const l = [`<p>${n.type === 'vente' ? 'TVA collectée' : 'TVA déductible'} : <b>${eur(n.tva)}</b> · HT × ${pct(n.taux)} = ${eur(e.tvaAttendue)}</p>`];
      if (e.tvaKo) l.push(`<p class="cd-alerte">⚠ TVA différente de HT × taux (écart ${eur(e.ecartTva)}). Garde le montant de la facture s'il est juste : l'écart restera signalé dans les contrôles.</p>`);
      if (e.ttcKo) l.push(`<p class="cd-alerte">⚠ HT + TVA ne fait pas le TTC (écart ${eur(e.ecartTtc)}).</p>`);
      if (!r.taux.some((x) => x.taux === n.taux)) l.push('<p class="cd-alerte">⚠ Taux absent de ta liste : vérifie la facture.</p>');
      const p = BL.find((b) => R.dansPeriode(n, b));
      const s = p && E.suivi[p.cle];
      if (p && s?.declare && (!o0 || o0.date !== n.date)) l.push(`<p class="cd-alerte">⚠ ${esc(p.libelle)} est déjà déclarée (le ${esc(dC(s.declare))}) : cette opération sera à régulariser.</p>`);
      el.innerHTML = l.join('');
    }
    f.ht.addEventListener('input', () => { if (f.depuis.value === 'ht') recalculer('ht'); else apercu(); });
    f.ttc.addEventListener('input', () => { if (f.depuis.value === 'ttc') recalculer('ttc'); else apercu(); });
    f.tva.addEventListener('input', () => recalculer('tva'));
    $('#m-taux').addEventListener('change', (e) => { $('#m-autre').hidden = e.target.value !== 'autre'; recalculer(f.depuis.value); });
    f.tauxAutre.addEventListener('input', () => recalculer(f.depuis.value));
    f.querySelectorAll('[name=depuis]').forEach((x) => x.addEventListener('change', apercu));
    f.querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', (e) => { $('#m-aide-type').textContent = typeDe(e.target.value).aide; apercu(); }));
    f.date.addEventListener('input', apercu); f.libelle.addEventListener('input', apercu);
    apercu();
  }

  // Période : détail par taux, acomptes, pointage de la déclaration et du paiement.
  function modalePeriode(cle) {
    const b = bilan(cle);
    if (!b) return;
    const r = E.reglages, s = E.suivi[cle] || {};
    const simp = r.regime === 'simplifie';
    const lignesTaux = (sens) => b.parTaux.filter((x) => x.sens === sens).map((x) => `<tr><td>${pct(x.taux)}</td><td class="nb">${x.nombre}</td><td class="nb">${eur(x.ht)}</td><td class="nb">${eur(x.tva)}</td></tr>`).join('') || '<tr><td colspan="4">Aucune opération.</td></tr>';
    const val = (v) => (Number.isFinite(v) ? String(v).replace('.', ',') : '');
    const corps = `
      <p class="mention">Du ${esc(dC(b.debut))} au ${esc(dC(b.fin))} · ${esc(simp ? 'CA12' : 'CA3')} à déposer avant le <b>${esc(dateLongue(b.echeances.declaration))}</b>.</p>
      <div class="bloc-detail"><h3>TVA collectée <span>${eur(b.collectee)}</span></h3><div class="defile"><table class="tableau petit"><thead><tr><th>Taux</th><th class="nb">Opér.</th><th class="nb">Base HT</th><th class="nb">TVA</th></tr></thead><tbody>${lignesTaux('collectee')}</tbody></table></div></div>
      <div class="bloc-detail"><h3>TVA déductible <span>${eur(b.deductible)}</span></h3><div class="defile"><table class="tableau petit"><thead><tr><th>Taux</th><th class="nb">Opér.</th><th class="nb">Base HT</th><th class="nb">TVA</th></tr></thead><tbody>${lignesTaux('deductible')}</tbody></table></div>
        <p class="ligne-somme"><span>dont biens et services</span><b>${eur(b.deductibleBS)}</b></p><p class="ligne-somme"><span>dont immobilisations</span><b>${eur(b.deductibleImmo)}</b></p></div>
      <div class="bloc-detail">
        <p class="ligne-somme"><span>TVA collectée</span><b>${eur(b.collectee)}</b></p>
        <p class="ligne-somme"><span>− TVA déductible</span><b>${eur(b.deductible)}</b></p>
        <p class="ligne-somme"><span>− Crédit reporté de la période précédente</span><b>${eur(b.creditAnterieur)}</b></p>
        ${simp ? b.acomptes.map((a) => `<p class="ligne-somme"><span>− ${a.numero === 1 ? '1er' : '2e'} acompte (${pct(a.pct)}, ${esc(dC(a.date))})</span><b>${eur(a.verse)}</b></p>`).join('') : ''}
        <p class="ligne-somme total"><span>${b.creditFin ? 'Crédit de TVA' : 'TVA à payer'}</span><b>${eur(b.creditFin || b.aPayer)}</b></p>
        ${b.rembourse ? `<p class="ligne-somme"><span>Remboursement demandé</span><b>− ${eur(b.rembourse)}</b></p>` : ''}
        <p class="ligne-somme"><span>Crédit reporté sur la période suivante</span><b>${eur(b.creditReporte)}</b></p>
      </div>
      ${simp ? `<label class="champ">TVA de référence pour les acomptes<small>TVA due l'exercice précédent, avant TVA sur immobilisations. Vide = calculée depuis l'exercice précédent du suivi${b.baseAcomptes !== null ? ` (${eur(b.baseAcomptes)})` : ''}.</small><input name="base" inputmode="decimal" value="${val(s.base)}"></label>` : ''}
      <fieldset class="cadre-champs"><legend>Pointage</legend>
        <div class="rang-champs"><label class="champ">Déclarée le<input name="declare" type="date" value="${s.declare || ''}"></label><label class="champ">Payée le<input name="paye" type="date" value="${s.paye || ''}"></label></div>
        <div class="rang-champs"><label class="champ">Montant déclaré<small>vide = montant calculé</small><input name="montant" inputmode="decimal" value="${val(s.montant)}" placeholder="${esc(fmtNb.format(b.aPayer))}"></label>
        ${b.creditFin ? `<label class="champ">Remboursement demandé<small>sur le crédit de ${eur(b.creditFin)}</small><input name="remboursement" inputmode="decimal" value="${val(s.remboursement)}"></label>` : ''}</div>
        <label class="champ">Note<small>facultatif</small><input name="note" value="${esc(s.note || '')}" maxlength="200"></label>
      </fieldset>
      ${simp ? b.acomptes.filter((a) => a.calcule || Number.isFinite(E.suivi[a.cle]?.montant)).map((a) => { const sa = E.suivi[a.cle] || {}; return `<fieldset class="cadre-champs"><legend>${a.numero === 1 ? '1er' : '2e'} acompte · ${eur(a.calcule)} calculé, avant le ${esc(dC(a.date))}</legend><div class="rang-champs"><label class="champ">Payé le<input name="paye-${a.numero}" type="date" value="${sa.paye || ''}"></label><label class="champ">Montant versé<small>vide = calculé</small><input name="montant-${a.numero}" inputmode="decimal" value="${val(sa.montant)}"></label></div></fieldset>`; }).join('') : ''}
      <div class="rang"><button class="btn petit" type="button" data-action="voir-ops" data-id="${cle}">Voir les ${pluriel(b.nombre, 'opération')}</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(b.libelle.charAt(0).toUpperCase() + b.libelle.slice(1)), corps, PIED(false), (fd) => {
      const lireM = (k) => { const v = String(fd.get(k) ?? '').trim(); if (!v) return undefined; const n = R.lireNombre(v); return n === null ? NaN : n; };
      const champs = { montant: lireM('montant'), remboursement: lireM('remboursement'), base: lireM('base') };
      if (Object.values(champs).some((v) => Number.isNaN(v))) return 'Un montant est illisible : écris par exemple 1 234,56.';
      const declare = String(fd.get('declare') || ''), paye = String(fd.get('paye') || '');
      if (paye && declare && paye < declare) return 'La date de paiement précède la déclaration : vérifie les dates.';
      retenir();
      E.suivi[cle] = { declare, paye, note: fd.get('note'), ...Object.fromEntries(Object.entries(champs).filter(([, v]) => v !== undefined)) };
      if (simp) for (const a of b.acomptes) {
        const p = String(fd.get(`paye-${a.numero}`) ?? ''), m = lireM(`montant-${a.numero}`);
        if (fd.get(`paye-${a.numero}`) === null) continue;
        E.suivi[a.cle] = { paye: p, ...(Number.isFinite(m) ? { montant: m } : {}) };
      }
      E.suivi = R.normaliserSuivi(E.suivi);
      sauver(); rendre();
      toast('Pointage enregistré.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // Pointage rapide depuis l'échéancier.
  function marquer(cle, quoi) {
    const e = ECH.find((x) => x.cle === cle);
    if (!e) return;
    retenir();
    const s = { ...(E.suivi[cle] || {}) };
    const t = auj();
    if (quoi === 'declare') s.declare = t;
    if (quoi === 'paye') { s.paye = t; if (!s.declare && e.type !== 'acompte') s.declare = t; }
    E.suivi = R.normaliserSuivi({ ...E.suivi, [cle]: s });
    sauver(); rendre();
    toast(quoi === 'paye' ? `${e.libelle} : payée aujourd'hui.` : `${e.libelle} : déclarée aujourd'hui.`, { libelle: 'Annuler', faire: annuler });
  }
  function pointer(cle) {
    const e = ECH.find((x) => x.cle === cle);
    if (!e) return;
    modalePeriode(e.periode);
  }

  // Régime, taux et échéances, avec leurs sources.
  function modaleRegime() {
    const r = E.reglages;
    const v = (x) => String(x).replace('.', ',');
    const lignesTaux = [...r.taux, { taux: '', nom: '' }, { taux: '', nom: '' }].map((t, i) => `<li><label class="champ"><span class="sr-only">Taux ${i + 1} (%)</span><input name="taux-${i}" inputmode="decimal" value="${t.taux === '' ? '' : v(t.taux)}" placeholder="%"></label><label class="champ"><span class="sr-only">Nom du taux ${i + 1}</span><input name="nomtaux-${i}" value="${esc(t.nom)}" maxlength="40" placeholder="Nom"></label></li>`).join('');
    const corps = `
      <fieldset class="champ"><legend>Régime</legend><div class="modeles-choix">${B.regimes.map((x) => `<label class="modele-choix"><input type="radio" name="regime" value="${x.id}" ${x.id === r.regime ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.detail)}</small></span></label>`).join('')}</div></fieldset>
      <div class="rang-champs"><label class="champ">Début du suivi<input name="debut" type="date" value="${r.debut}"></label><label class="champ">Crédit de TVA au début<input name="creditInitial" inputmode="decimal" value="${v(r.creditInitial)}"></label></div>
      <fieldset class="cadre-champs"><legend>Réel normal (CA3)</legend>
        <div class="rang-champs"><label class="champ">Jour d'échéance<small>du mois suivant la période, entre le 15 et le 24 : à vérifier pour ton entreprise</small><input name="jourEcheance" inputmode="numeric" value="${r.jourEcheance}"></label>
        <label class="champ">Seuil du trimestriel (€)<small>TVA exigible annuelle sous laquelle la CA3 peut être trimestrielle</small><input name="seuilTrimestriel" inputmode="decimal" value="${v(r.seuilTrimestriel)}"></label></div></fieldset>
      <fieldset class="cadre-champs"><legend>Réel simplifié (acomptes et CA12)</legend>
        <div class="rang-champs"><label class="champ">Clôture de l'exercice<select name="clotureMois">${R.MOIS.map((m, i) => `<option value="${i + 1}" ${i + 1 === r.clotureMois ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="champ">Jour des acomptes<small>à vérifier</small><input name="jourAcompte" inputmode="numeric" value="${r.jourAcompte}"></label></div>
        <div class="rang-champs"><label class="champ">1er acompte (%)<input name="acompte1Pct" inputmode="decimal" value="${v(r.acompte1Pct)}"></label><label class="champ">2e acompte (%)<input name="acompte2Pct" inputmode="decimal" value="${v(r.acompte2Pct)}"></label><label class="champ">Dispense sous (€)<input name="dispenseAcomptes" inputmode="decimal" value="${v(r.dispenseAcomptes)}"></label></div>
        <div class="rang-champs"><label class="champ">CA12, jour<small>0 = 2e jour ouvré après le 1er mai</small><input name="ca12Jour" inputmode="numeric" value="${r.ca12Jour}"></label><label class="champ">CA12, mois<select name="ca12Mois">${R.MOIS.map((m, i) => `<option value="${i + 1}" ${i + 1 === r.ca12Mois ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="champ">Délai si clôture en cours d'année<small>en mois</small><input name="ca12Delai" inputmode="numeric" value="${r.ca12Delai}"></label></div>
        <label class="champ">Fin annoncée du régime simplifié<small>loi de finances pour 2025 : à vérifier</small><input name="finSimplifie" type="date" value="${r.finSimplifie}"></label></fieldset>
      <fieldset class="cadre-champs"><legend>Taux de TVA<small>Un taux absent de cette liste est signalé dans les contrôles. Laisse une ligne vide pour la retirer.</small></legend><ul class="taux-liste">${lignesTaux}</ul></fieldset>
      <fieldset class="cadre-champs"><legend>Contrôles</legend>
        <div class="rang-champs"><label class="champ">Tolérance d'arrondi (€)<input name="tolerance" inputmode="decimal" value="${v(r.tolerance)}"></label><label class="champ">Déductible > collectée<small>nombre de périodes de suite</small><input name="periodesDeductible" inputmode="numeric" value="${r.periodesDeductible}"></label><label class="champ">Crédit reporté<small>nombre de périodes de suite</small><input name="periodesCredit" inputmode="numeric" value="${r.periodesCredit}"></label></div></fieldset>
      <div class="groupe"><h3>Sources des valeurs par défaut <span class="etiquette ciel">vérifiées le ${esc(dC(B.verifieLe))}</span></h3>
        <ul class="sources">${B.sources.map((s) => `<li><b>${esc(s.sujet)}</b> <span class="etiquette ${s.statut === 'vérifié' ? 'vert' : 'jaune'}">${esc(s.statut)}</span><span>${esc(s.texte)}</span></li>`).join('')}</ul>
        <div class="rang"><button class="btn petit" type="button" data-action="defauts">Revenir aux valeurs par défaut</button></div></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Régime, taux et échéances', corps, PIED(false), (fd) => {
      const taux = [];
      for (let i = 0; i < r.taux.length + 2; i++) {
        const t = String(fd.get(`taux-${i}`) ?? '').trim();
        if (!t) continue;
        const n = R.lireNombre(t);
        if (n === null || n < 0 || n > 100) return `Taux « ${t} » invalide (entre 0 et 100).`;
        taux.push({ taux: n, nom: fd.get(`nomtaux-${i}`) || '' });
      }
      if (!taux.length) return 'Garde au moins un taux.';
      if (!R.estDate(String(fd.get('debut')))) return 'Indique la date de début du suivi.';
      const champs = Object.fromEntries(['regime', 'debut', 'creditInitial', 'jourEcheance', 'seuilTrimestriel', 'clotureMois', 'jourAcompte', 'acompte1Pct', 'acompte2Pct', 'dispenseAcomptes', 'ca12Jour', 'ca12Mois', 'ca12Delai', 'finSimplifie', 'tolerance', 'periodesDeductible', 'periodesCredit'].map((k) => [k, fd.get(k)]));
      retenir();
      const n = R.normaliserReglages({ ...r, ...champs, taux }, B);
      if (n.regime === 'simplifie') n.debut = R.periodeDe(n, n.debut).debut;
      const change = n.regime !== r.regime;
      E.reglages = n;
      sauver(); rendre();
      toast(change ? `Régime changé : ${NOM_REGIME[n.regime]}. Les périodes sont recalculées ; les pointages des anciennes périodes sont gardés.` : 'Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }
  function valeursParDefaut() {
    if (!confirm('Remettre les taux, échéances et seuils de contrôle aux valeurs par défaut ? Le régime, le début du suivi et le crédit initial sont gardés.')) return;
    retenir();
    const r = E.reglages;
    E.reglages = R.normaliserReglages({ ...B.reglages, societe: r.societe, regime: r.regime, debut: r.debut, creditInitial: r.creditInitial, clotureMois: r.clotureMois }, B);
    modale().close(); sauver(); rendre();
    toast('Valeurs par défaut rétablies.', { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pc = Math.round((t / 900000) * 100);
    const corps = `
      <label class="champ">Nom de la société<small>affiché en tête des exports</small><input name="societe" value="${esc(E.reglages.societe)}" maxlength="80"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Régime, taux et échéances</h3><p class="aide">${esc(NOM_REGIME[E.reglages.regime])} · taux ${E.reglages.taux.map((x) => pct(x.taux)).join(', ')}. Valeurs par défaut vérifiées le ${esc(dC(B.verifieLe))}, avec leurs sources.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="regime">Voir et modifier</button></div></div>
      <div class="groupe"><h3>Exporter en CSV</h3><p class="aide">Pour ton tableur ou ton expert-comptable (séparateur point-virgule, virgule décimale, accents conservés).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-ops">Opérations</button><button class="btn petit" type="button" data-action="csv-periodes">Bilan des périodes</button><button class="btn petit" type="button" data-action="csv-echeances">Échéancier</button></div></div>
      <div class="groupe"><h3>Importer des opérations (CSV)</h3><p class="aide">Colonnes reconnues par leur titre : Date, Type (Vente, Achat, Frais ou Immobilisation), Libellé, Pièce, Montant HT, Taux, TVA, Montant TTC. Il faut au moins la date, le type et le HT ou le TTC ; le reste est calculé. Le fichier exporté ici se réimporte tel quel.</p>
        <div class="rang"><label class="btn petit" style="cursor:pointer">Choisir un fichier CSV<input type="file" accept=".csv,text/csv,text/plain" id="import-csv" hidden></label><button class="btn petit" type="button" data-action="modele-csv">Télécharger un modèle</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton suivi est enregistré en ligne avec ta clé. Tu peux aussi garder une copie complète sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${Math.round(t / 1000)} Ko sur 900 Ko permis (${pc} %)${pc >= 70 ? ' : exporte puis retire les opérations des années anciennes.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer les opérations avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le suivi de TVA à ton écran d'accueil pour l'ouvrir comme une application, et saisir un ticket ou une facture sur le moment.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données</h3><p class="mention">Le suivi est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Il contient des montants et des libellés : n'y mets pas de données personnelles de tes clients au-delà de leur nom commercial.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Outil d'aide au suivi de la TVA, pas un conseil fiscal : il ne remplace ni ton expert-comptable ni les déclarations officielles, et ne transmet rien à l'administration. Aucune connexion à l'espace professionnel des impôts, à une banque ou à un logiciel comptable : les données s'exportent en CSV. Cas non gérés : autoliquidation, TVA sur marge, prorata de déduction, opérations intracommunautaires et outre-mer (à voir avec ton expert-comptable).</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      E.reglages = R.normaliserReglages({ ...E.reglages, societe: fd.get('societe') }, B);
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.operations) || !donnees.reglages) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.operations.length, 'opération')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi de TVA.'); }
    });
    $('#import-csv').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      const { operations, erreurs } = R.importerCsv(await fichier.text(), auj());
      modale().close();
      modaleImport(operations, erreurs, fichier.name);
    });
  }

  function modaleImport(operations, erreurs, nom) {
    const cles = new Set(E.operations.map((o) => `${o.date}|${o.type}|${o.ht}|${o.tva}|${R.plat(o.libelle)}`));
    const doublons = operations.filter((o) => cles.has(`${o.date}|${o.type}|${o.ht}|${o.tva}|${R.plat(o.libelle)}`)).length;
    const corps = `<p>Fichier <b>${esc(nom)}</b> : ${pluriel(operations.length, 'opération lisible', 'opérations lisibles')}${erreurs.length ? `, ${pluriel(erreurs.length, 'ligne ignorée', 'lignes ignorées')}` : ''}.</p>
      ${operations.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Type</th><th>Libellé</th><th class="nb">HT</th><th class="nb">TVA</th></tr></thead><tbody>${operations.slice(0, 8).map((o) => `<tr><td>${esc(dC(o.date))}</td><td>${esc(typeDe(o.type).nom)}</td><td>${esc(o.libelle)}</td><td class="nb">${eur(o.ht)}</td><td class="nb">${eur(o.tva)}</td></tr>`).join('')}</tbody></table></div>${operations.length > 8 ? `<p class="mention">… et ${operations.length - 8} autres.</p>` : ''}` : ''}
      ${doublons ? `<p class="aide">${pluriel(doublons, 'opération semble déjà saisie', 'opérations semblent déjà saisies')} (même date, type, montants et libellé) : elles ne seront pas ajoutées.</p>` : ''}
      ${erreurs.length ? `<details class="champs-aide"><summary>Lignes ignorées</summary><ul>${erreurs.slice(0, 30).map((x) => `<li>Ligne ${x.ligne} : ${esc(x.message)}</li>`).join('')}</ul></details>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Importer des opérations', corps, operations.length ? '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>' : '<button class="btn primaire" value="annuler">Fermer</button>', () => {
      const nouvelles = operations.filter((o) => !cles.has(`${o.date}|${o.type}|${o.ht}|${o.tva}|${R.plat(o.libelle)}`));
      retenir();
      E.operations.push(...nouvelles);
      sauver(); rendre();
      toast(`${pluriel(nouvelles.length, 'opération ajoutée', 'opérations ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.operations.filter((o) => o.date < d).length;
    if (!n) { toast('Aucune opération avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'opération')} antérieure${n > 1 ? 's' : ''} au ${R.dateFr(d)} ? Exporte-les en CSV avant. Le début du suivi passe à cette date et le crédit reporté à cette date devient le crédit initial.`)) return;
    retenir();
    const bl = R.bilans(E, auj());
    const avant = bl.filter((b) => b.fin < d);
    const credit = avant.length ? avant[avant.length - 1].creditReporte : E.reglages.creditInitial;
    E.operations = E.operations.filter((o) => o.date >= d);
    E.reglages = R.normaliserReglages({ ...E.reglages, debut: R.periodeDe(E.reglages, d).debut, creditInitial: credit }, B);
    modale().close(); sauver(); rendre();
    toast(`${pluriel(n, 'opération retirée', 'opérations retirées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const CSV = 'text/csv;charset=utf-8';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-tva-${auj()}.json`);
  const MODELE_CSV = R.versCsv([['Date', 'Type', 'Libellé', 'Pièce', 'Montant HT', 'Taux (%)', 'TVA', 'Montant TTC'], ['2026-11-03', 'Vente', 'Prestation client', 'F-0001', 1000, 20, 200, 1200], ['2026-11-05', 'Achat', 'Fournitures', 'A-001', '', 20, '', 60], ['2026-11-10', 'Immobilisation', 'Ordinateur', 'A-002', 900, 20, '', '']]);

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
      <p>Enregistre ton suivi de TVA sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    if (!el || el.disabled) return;
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'regime': fermer(); modaleRegime(); break;
      case 'defauts': valeursParDefaut(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-ops': telecharger(R.csvOperations(E, auj()), CSV, `tva-operations-${auj()}.csv`); break;
      case 'csv-periodes': telecharger(R.csvPeriodes(E, auj()), CSV, `tva-periodes-${auj()}.csv`); break;
      case 'csv-echeances': telecharger(R.csvEcheancier(E, auj()), CSV, `tva-echeancier-${auj()}.csv`); break;
      case 'modele-csv': telecharger(MODELE_CSV, CSV, 'modele-operations-tva.csv'); break;
      case 'purger': purger(); break;
      case 'fermer': modale().close(); break;
      case 'operation': fermer(); modaleOperation(id || null); break;
      case 'periode': fermer(); modalePeriode(id); break;
      case 'pointer': fermer(); pointer(id); break;
      case 'marquer-declare': marquer(id, 'declare'); break;
      case 'marquer-paye': marquer(id, 'paye'); break;
      case 'voir-ops': fermer(); filtre.periode = id; filtre.type = ''; filtre.texte = ''; changerVue('operations'); break;
      case 'filtre-type': filtre.type = el.dataset.f; rendre(); break;
      case 'filtre-ech': filtre.echeances = el.dataset.f; sauverPref(); rendre(); break;
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
  // Passage ordinateur ↔ téléphone : le graphique change de taille.
  MQ_TEL.addEventListener('change', () => { if (E && vue === 'synthese' && !modale().open) rendre(); });

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
  window.__tva = { etat: () => E, regles: R, controles: () => CTL, echeancier: () => ECH };
  init();
})();
