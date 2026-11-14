// Conformité des sous-traitants QME : opérations, lots, entreprises et chaîne de sous-traitance,
// acceptation et agrément des conditions de paiement, pièces de vigilance avec date de validité,
// alertes J-30 / J-15 / expirée, relances avec modèle, tableau de conformité, export CSV, registre
// imprimable. Données synchronisées par clé de licence. Outil d'aide : ne remplace pas un conseil juridique.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'STR';
  const CLE_CODE = 'qme-str-code';
  const CLE_CACHE = 'qme-str-cache';
  const CLE_DEMO = 'qme-str-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-str-ecran-accueil';
  const TAILLE_MAX = 900000;

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

  const { ajout, ecart, ajoutMois, dateFr, nombre, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? dateFr(s) : '–');
  const eur = (n) => `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
  const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let opOuverte = null; // opération ouverte dans l'onglet Opérations
  let entOuverte = null; // entreprise ouverte dans l'onglet Entreprises
  let registreOp = null; // opération choisie dans l'onglet Registre
  let annulation = null;
  const filtreEnt = { texte: '', etat: '' };

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const op = (id) => E.operations.find((o) => o.id === id);
  const ent = (id) => E.entreprises.find((e) => e.id === id);
  const itv = (id) => E.intervenants.find((i) => i.id === id);
  const piece = (id) => E.pieces.find((p) => p.id === id);
  const typeP = (code) => R.typeDe(E, code);
  const nomOp = (id) => op(id)?.nom || 'Opération supprimée';
  const nomEnt = (id) => ent(id)?.nom || 'Entreprise supprimée';
  const opsTriees = () => [...E.operations].sort((a, b) => !!a.close - !!b.close || a.nom.localeCompare(b.nom, 'fr'));
  const entsTriees = () => [...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const libStatut = (c) => B.statutsAcceptation.find((s) => s.code === c)?.nom || c;
  function verifierOuverts() {
    if (opOuverte && !op(opOuverte)) opOuverte = null;
    if (entOuverte && !ent(entOuverte)) entOuverte = null;
    if (registreOp && !op(registreOp)) registreOp = null;
  }

  // ---------- Stockage et synchronisation ----------
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
        toast('Un autre appareil a modifié tes données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime les opérations closes les plus anciennes.');
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
    if (E && (E.operations.length || E.entreprises.length)) { cache(false); demarrer(); } else ecranAccueil();
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
  // Entreprise générale fictive, trois opérations (dont une close). Noms d'entreprises inventés,
  // adresses e-mail sur le domaine réservé « .example », aucun SIRET. Couvre : pièce expirée, pièce
  // manquante, échéances à J-15 et J-30, sous-traitant intervenant sans acceptation, demande en attente,
  // acceptation sans agrément du paiement, refus, rang 2, entreprise établie hors de France, artisan
  // sans salarié, contrat sous le seuil de vigilance, paiement direct en marché public, relances.
  function donneesDemo() {
    const D = etatVide();
    D.structure = 'Entreprise générale (exemple)';
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n) => ajoutMois(t, n);
    const O = {};
    for (const [k, nom, mo, ville, debut, fin, pub, close, reference] of [
      ['aul', 'Résidence Les Aulnes, 42 logements', 'Bailleur social (fictif)', 'Secteur nord', m(-7), m(9), false, false, 'Marché 24-017'],
      ['mou', 'Groupe scolaire du Moulin', 'Commune (fictive)', 'Secteur est', m(-3), m(11), true, false, 'Marché public 2026-08'],
      ['qua', 'Bureaux Quai Est, réhabilitation', 'Foncière (fictive)', 'Secteur ouest', m(-20), m(-2), false, true, ''],
    ]) { O[k] = { id: uid(), nom, maitreOuvrage: mo, reference, ville, debut, fin, marchePublic: pub, close, notes: '' }; D.operations.push(O[k]); }
    O.mou.notes = 'Marché public : sous-traitants de rang 1 en paiement direct au-delà du seuil réglementaire.';
    const N = {};
    for (const [k, nom, ville, employeur, etranger] of [
      ['eg', 'Entreprise générale Exemple', 'Secteur nord', true, false],
      ['fer', 'Armatures Exemple', 'Secteur nord', true, false],
      ['cof', 'Coffrages Exemple Europe', 'Hors de France', true, true],
      ['etn', 'Étanchéité Démo', 'Secteur est', true, false],
      ['plt', 'Plâtrerie Modèle', 'Secteur nord', true, false],
      ['pnt', 'Peinture Exemple', 'Secteur nord', false, false],
      ['net', 'Nettoyage Exemple', 'Secteur nord', true, false],
      ['gru', 'Levage Démo', 'Secteur est', true, false],
      ['ele', 'Électricité Exemple Est', 'Secteur est', true, false],
      ['cab', 'Câblage Démo', 'Secteur est', true, false],
      ['men', 'Menuiseries Démo', 'Secteur ouest', true, false],
    ]) {
      N[k] = { id: uid(), nom, siret: '', ville, etranger, employeur, contact: 'Service administratif', email: `administratif@${k}.example`, telephone: '', notes: '' };
      D.entreprises.push(N[k]);
    }
    N.cof.notes = 'Établie hors de France : les pièces à demander diffèrent (article D8222-7 du code du travail), adapte la liste.';
    N.pnt.notes = 'Artisan sans salarié.';
    const I = {};
    const it = (k, o, e, lot, donneur, objet, montantHT, debut, decennale = true, acc = {}) => {
      I[k] = { id: uid(), operationId: O[o].id, entrepriseId: N[e].id, lot, donneurId: donneur ? I[donneur].id : '', objet, montantHT, debut, fin: '', decennale,
        acceptation: 'a-declarer', dateDemande: '', dateAcceptation: '', paiementAgree: false, paiementDirect: false, notes: '', ...acc };
      D.intervenants.push(I[k]);
    };
    const ok = (dem, acc, direct = false) => ({ acceptation: 'accepte', dateDemande: j(dem), dateAcceptation: j(acc), paiementAgree: true, paiementDirect: direct });
    it('aEG', 'aul', 'eg', '02 Gros œuvre', '', 'Gros œuvre', 1850000, m(-7));
    it('aFER', 'aul', 'fer', '02 Gros œuvre', 'aEG', 'Ferraillage', 64000, m(-6), true, ok(-200, -188));
    it('aCOF', 'aul', 'cof', '02 Gros œuvre', 'aEG', 'Coffrages et banches', 82000, m(-5), true, { acceptation: 'accepte', dateDemande: j(-170), dateAcceptation: j(-150), paiementAgree: false });
    it('aNET', 'aul', 'net', '00 Installations de chantier', 'aEG', 'Nettoyage de chantier', 3200, m(-6), false, ok(-195, -185));
    it('aETN', 'aul', 'etn', '03 Étanchéité', 'aEG', 'Étanchéité de toiture-terrasse', 38000, j(10), true, { acceptation: 'demande', dateDemande: j(-12) });
    it('aPLT', 'aul', 'plt', '05 Cloisons, doublages', 'aEG', 'Cloisons et doublages', 96000, m(-1));
    it('aPNT', 'aul', 'pnt', '05 Cloisons, doublages', 'aPLT', 'Bandes et enduits', 12000, j(20), true, { acceptation: 'demande', dateDemande: j(-5) });
    it('mEG', 'mou', 'eg', '01 Gros œuvre, VRD', '', 'Gros œuvre et VRD', 1200000, m(-3));
    it('mGRU', 'mou', 'gru', '01 Gros œuvre, VRD', 'mEG', 'Grue à tour avec grutier', 45000, m(-3), false, ok(-110, -96, true));
    it('mFER', 'mou', 'fer', '01 Gros œuvre, VRD', 'mEG', 'Ferraillage', 51000, m(-2), true, ok(-75, -64, true));
    it('mMEN', 'mou', 'men', '06 Menuiseries extérieures', '', 'Menuiseries aluminium', 140000, m(2));
    it('mELE', 'mou', 'ele', '07 Électricité', '', 'Courants forts et faibles', 310000, m(-1));
    it('mCAB', 'mou', 'cab', '07 Électricité', 'mELE', 'Câblage des courants faibles', 28000, j(15), true, { acceptation: 'refuse', dateDemande: j(-30), dateAcceptation: j(-8), notes: 'Refus du maître d\'ouvrage : références jugées insuffisantes.' });
    it('qEG', 'qua', 'eg', '01 Gros œuvre', '', 'Démolition et gros œuvre', 640000, m(-20));
    it('qPLT', 'qua', 'plt', '01 Gros œuvre', 'qEG', 'Cloisons', 54000, m(-14), true, ok(-470, -455));
    I.aPLT.notes = 'Déclaration de sous-traitance à envoyer au maître d\'ouvrage.';
    // Pièces : [entreprise, type, délivrée le, valable jusqu'au (si lue sur la pièce)].
    const P = (e, type, date, fin = '', verifiee = true, reference = '') => D.pieces.push({ id: uid(), entrepriseId: N[e].id, type, date, fin, recueLe: date > t ? t : ajout(date, 2) > t ? t : ajout(date, 2), verifiee, reference, notes: '' });
    const quatre = (e, d) => { P(e, 'VIG', d); P(e, 'KBS', d); P(e, 'ETR', d); };
    quatre('eg', j(-40)); P('eg', 'VIG', ajout(j(-40), -183)); P('eg', 'DEC', m(-10), j(48), true, 'Police fictive n° 0001');
    P('fer', 'VIG', ajout(m(-6), 9)); P('fer', 'VIG', ajout(m(-12), 9)); P('fer', 'KBS', j(-60)); P('fer', 'ETR', j(-60)); P('fer', 'DEC', m(-4), j(200));
    P('cof', 'VIG', ajout(m(-7), -4), '', false); P('cof', 'KBS', j(-90)); P('cof', 'DEC', m(-6), j(120));
    quatre('etn', j(-20)); P('etn', 'DEC', m(-11), j(25));
    quatre('plt', j(-100)); P('plt', 'DEC', m(-12), j(-10));
    P('pnt', 'VIG', j(-30)); P('pnt', 'KBS', j(-30)); P('pnt', 'DEC', m(-2), j(300));
    P('net', 'VIG', j(-50));
    P('gru', 'VIG', ajout(m(-6), 27)); P('gru', 'KBS', j(-10)); P('gru', 'ETR', j(-10));
    quatre('ele', j(-35)); P('ele', 'DEC', m(-3), j(150)); P('ele', 'RCP', m(-3), j(150));
    P('cab', 'VIG', j(-15)); P('cab', 'ETR', j(-15)); P('cab', 'DEC', m(-1), j(90));
    quatre('men', j(-5)); P('men', 'DEC', m(-1), j(70));
    // Relances déjà faites.
    const rel = (e, d, types, canal, notes = '') => D.relances.push({ id: uid(), entrepriseId: N[e].id, date: j(d), types, canal, notes });
    rel('fer', -3, ['VIG'], 'E-mail', 'Attestation annoncée pour la semaine prochaine.');
    rel('plt', -16, ['DEC'], 'E-mail');
    rel('cof', -20, ['VIG', 'ETR'], 'Courrier', 'Courrier recommandé, accusé de réception reçu.');
    rel('etn', -60, ['DEC'], 'Réunion de chantier');
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Conformité des sous-traitants · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="24" y="60" width="150" height="200" fill="#1D4E89"/>
          <rect x="48" y="96" width="102" height="12" fill="#F0EDE6"/><rect x="48" y="128" width="78" height="12" fill="#F0EDE6"/><rect x="48" y="160" width="92" height="12" fill="#F0EDE6"/>
          <circle cx="150" cy="228" r="34" fill="#F5B400"/>
          <path d="M136 228 l10 10 l20 -22" fill="none" stroke="#141414" stroke-width="8"/>
          <rect x="230" y="40" width="20" height="220" fill="#141414"/>
          <rect x="230" y="40" width="190" height="16" fill="#141414"/>
          <path d="M400 56 L400 120" stroke="#141414" stroke-width="6"/>
          <rect x="370" y="120" width="60" height="44" fill="#D9302A"/>
          <path d="M440 260 A100 100 0 0 1 540 160 V260 Z" fill="#F5B400"/>
          <rect x="200" y="250" width="340" height="10" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Conformité des sous-traitants</p>
          <h1>Aucune attestation périmée sur ton chantier.</h1>
          <p>Sous-traitants par lot et par rang, acceptation et agrément du paiement, pièces de vigilance datées, alertes J-30 et J-15, relances et registre imprimable.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton registre</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon registre</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/sous-traitants/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon registre'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const options = (liste, choisi) => liste.map((x) => `<option value="${esc(x.code)}" ${x.code === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const texte = (f, k) => String(f.get(k) || '').trim();

  function ecranAccueil() {
    document.title = 'Bienvenue · Conformité des sous-traitants';
    E = E || etatVide();
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ta première opération.</h1>
        <p class="intro">Crée l'opération à suivre ; tu y ajouteras ensuite les entreprises, lot par lot, avec leur rang dans la chaîne de sous-traitance, puis les pièces reçues. Les alertes se calculent seules.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Ta structure <small>En tête du registre et des relances.</small><input name="structure" maxlength="80" placeholder="Ex. : Entreprise générale du Val"></label>
            <label class="champ">Nom de l'opération<input name="nom" required maxlength="100" placeholder="Ex. : Résidence Les Aulnes"></label>
            <label class="champ">Maître d'ouvrage<input name="maitreOuvrage" maxlength="100" placeholder="Ex. : Office public de l'habitat"></label>
            <label class="champ">Référence du marché <small>Facultatif.</small><input name="reference" maxlength="60"></label>
          </div>
          <label class="case"><input type="checkbox" name="marchePublic"> Marché public (paiement direct des sous-traitants acceptés)</label>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer l'opération</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = texte(f, 'nom');
      if (!nom) { e.target.querySelector('.erreur').textContent = 'Indique le nom de l\'opération.'; return; }
      E = etatVide();
      E.structure = texte(f, 'structure');
      const o = { id: uid(), nom, maitreOuvrage: texte(f, 'maitreOuvrage'), reference: texte(f, 'reference'), ville: '', debut: '', fin: '', marchePublic: !!f.get('marchePublic'), close: false, notes: '' };
      E.operations.push(o);
      sauver();
      opOuverte = o.id; vue = 'operations';
      demarrer();
      toast(`${nom} créée : ajoute les entreprises qui interviennent.`);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    entreprises: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l6-4v4l6-4v16Z" fill="currentColor"/><rect x="16" y="3" width="5" height="18" fill="currentColor"/></svg>',
    relances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    registre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#D9302A"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Alertes'], ['operations', 'Opérations'], ['entreprises', 'Entreprises'], ['relances', 'Relances'], ['registre', 'Registre']];
  const COURTS = { operations: 'Opér.', entreprises: 'Entrep.' };
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    verifierOuverts();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/sous-traitants/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Entreprises et pièces fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Sous-<br>traitants</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et sources" title="Guide et sources">${ICONES.guide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, pièces suivies et export" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    verifierOuverts();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { ...Object.fromEntries(ONGLETS), guide: 'Guide' };
    const sous = vue === 'operations' && opOuverte ? op(opOuverte)?.nom : vue === 'entreprises' && entOuverte ? ent(entOuverte)?.nom : titres[vue];
    document.title = `${sous} · Sous-traitants`;
    $('#vue').innerHTML = {
      bord: vueBord,
      operations: () => (opOuverte ? vueOperation(op(opOuverte)) : vueOperations()),
      entreprises: () => (entOuverte ? vueEntreprise(ent(entOuverte)) : vueEntreprises()),
      relances: vueRelances, registre: vueRegistre, guide: vueGuide,
    }[vue]();
    brancher();
  }

  function changerVue(v) {
    vue = v;
    if (v !== 'operations') opOuverte = null;
    if (v !== 'entreprises') entOuverte = null;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  function ouvrir(v, id) {
    vue = v; opOuverte = v === 'operations' ? id : null; entOuverte = v === 'entreprises' ? id : null;
    history.replaceState(null, '', `#${v}`); rendre(); window.scrollTo({ top: 0 }); $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texteV, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${FORME_VIDE}<div><h3>${titre}</h3><p>${texteV}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const tuile = (libT, v, d, c, forme = '', act = '') => `<${act ? `button data-action="${act}"` : 'div'} class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${libT}</p><b>${v}</b><span>${d}</span></${act ? 'button' : 'div'}>`;

  const NIVEAU = { conforme: ['bleu', 'Conforme'], 'a-surveiller': ['jaune', 'À surveiller'], 'non-conforme': ['rouge', 'Non conforme'], terminee: ['gris', 'Terminée'] };
  const ACC = { 'sans-objet': ['contour', 'Titulaire'], ok: ['bleu', 'Accepté'], partielle: ['jaune', 'Paiement à agréer'], attente: ['jaune', 'Demandée'], manquante: ['rouge', 'Non accepté'], refuse: ['rouge', 'Refusé'] };
  const etiq = ([c, l]) => `<span class="etiquette ${c}">${l}</span>`;
  // Pastille d'une pièce : état et nombre de jours restants.
  function pastille(p) {
    if (p.etat === 'manquante') return '<span class="etiquette rouge">Manquante</span>';
    if (p.etat === 'expiree') return `<span class="etiquette rouge">Expirée</span>`;
    if (p.etat === 'j15' || p.etat === 'j30') return `<span class="etiquette jaune">J-${p.jours}</span>`;
    return `<span class="etiquette bleu">Valide</span>`;
  }
  const libAcceptation = (c, it) => (c === 'attente' || c === 'manquante' ? (it.acceptation === 'demande' ? (c === 'manquante' ? 'Demandée, pas encore acceptée' : 'Demandée') : 'Non déclarée') : ACC[c][1]);

  // ---------- Vue Alertes ----------
  function syntheseGlobale(t) {
    let total = 0, conformes = 0, surveiller = 0, non = 0;
    for (const o of E.operations) { const x = R.tableauOperation(E, o.id, t); total += x.total; conformes += x.conformes; surveiller += x.surveiller; non += x.nonConformes; }
    return { total, conformes, surveiller, non, taux: total ? conformes / total : null };
  }

  function vueBord() {
    const t = auj();
    const al = R.alertes(E, t);
    const g = syntheseGlobale(t);
    const rouges = al.filter((a) => a.gravite === 'rouge').length;
    const relancer = R.aRelancer(E, t);
    const titre = !al.length ? '<mark>Tout est conforme</mark> : aucune pièce à réclamer.'
      : rouges ? `<mark>${pluriel(rouges, 'point bloquant', 'points bloquants')}</mark>, ${pluriel(al.length - rouges, 'autre à surveiller', 'autres à surveiller')}.` : `${pluriel(al.length, 'point')} à surveiller, <mark>rien de bloquant</mark>.`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Ton registre')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="intervenant-nouveau">Intervention</button><button class="btn primaire" data-action="piece-nouvelle">${ICONES.plus}Pièce reçue</button></div></div>
      <div class="tuiles">
        ${tuile('Non conformes', g.non, `sur ${pluriel(g.total, 'intervention suivie', 'interventions suivies')}`, 'var(--rouge)', '', 'aller-operations')}
        ${tuile('À surveiller', g.surveiller, `Échéance à J-${E.reglages.j30} ou acceptation en cours`, 'var(--jaune)', 'rond')}
        ${tuile('À relancer', relancer.length, relancer.length ? 'Entreprises sans relance récente' : 'Aucune relance à faire', 'var(--encre)', '', 'aller-relances')}
        ${tuile('Conformité', g.taux === null ? '–' : `${Math.round(g.taux * 100)}<small>%</small>`, 'Interventions en cours conformes', 'var(--bleu)', 'rond', 'aller-registre')}
      </div>
      <h2 class="titre-section">Alertes <span>Pièces manquantes ou expirées d'abord, puis J-${E.reglages.j15} et J-${E.reglages.j30}, puis acceptations. Touche une ligne pour agir.</span></h2>
      ${al.length ? `<div class="bloc-liste">${al.map((a) => ligneAlerte(a, t)).join('')}</div>` : vide('Rien à réclamer', 'Toutes les pièces exigées sont valides et tous les sous-traitants sont acceptés.', '', true)}
      ${relancer.length ? `<h2 class="titre-section">À relancer <span>${pluriel(relancer.length, 'entreprise')} sans relance depuis ${pluriel(E.reglages.relanceJours, 'jour')} ou plus.</span></h2>
        <div class="bloc-liste">${relancer.slice(0, 5).map(ligneARelancer).join('')}</div>${relancer.length > 5 ? '<p class="note"><button class="btn lien" data-action="aller-relances">Voir toutes les relances à faire</button></p>' : ''}` : ''}`;
  }

  function ligneAlerte(a, t) {
    const e = ent(a.entrepriseId);
    const ops = a.operationIds.map(nomOp).join(', ');
    const rel = a.derniereRelance ? ` · relancée ${ecart(a.derniereRelance, t) === 0 ? 'aujourd\'hui' : `il y a ${pluriel(ecart(a.derniereRelance, t), 'jour')}`}` : '';
    if (a.genre === 'piece') {
      const ty = typeP(a.code);
      const pas = a.etat === 'manquante' ? '<span class="etiquette rouge">manque</span>' : a.etat === 'expiree' ? `<span class="etiquette rouge">${-a.jours} j</span>` : `<span class="etiquette jaune">J-${a.jours}</span>`;
      const quoi = a.etat === 'manquante' ? 'jamais reçue' : a.etat === 'expiree' ? `expirée le ${fmtCourt(a.echeance)}` : `expire le ${fmtCourt(a.echeance)}`;
      return `<button class="ligne-retard" data-action="piece-nouvelle" data-entreprise="${a.entrepriseId}" data-type="${esc(a.code)}">${pas}<span><b>${esc(ty?.nom || a.code)} · ${esc(e?.nom || '')}</b><small>${quoi} · ${esc(ops)}${rel}</small></span></button>`;
    }
    const i = itv(a.intervenantIds[0]);
    const txt = { manquante: i.acceptation === 'demande' ? 'Intervient sans être accepté (demande envoyée)' : 'Intervient sans déclaration au maître d\'ouvrage', refuse: 'Refusé par le maître d\'ouvrage', attente: `Demande envoyée, début ${i.debut ? `le ${fmtCourt(i.debut)}` : 'non daté'}`, partielle: 'Accepté, conditions de paiement à faire agréer' }[a.etat];
    const pas = a.gravite === 'rouge' ? `<span class="etiquette rouge">${a.etat === 'refuse' ? 'refus' : 'accept.'}</span>` : '<span class="etiquette jaune">accept.</span>';
    return `<button class="ligne-retard" data-action="intervenant-modifier" data-id="${i.id}">${pas}<span><b>${txt} · ${esc(e?.nom || '')}</b><small>${esc(nomOp(i.operationId))} · lot ${esc(i.lot || '–')}${i.dateDemande ? ` · demande du ${fmtCourt(i.dateDemande)}` : ''}</small></span></button>`;
  }

  function ligneARelancer(x) {
    const e = ent(x.entrepriseId);
    const noms = x.codes.map((c) => typeP(c)?.court || c).join(', ');
    return `<button class="ligne-retard" data-action="relance-nouvelle" data-entreprise="${x.entrepriseId}" data-codes="${esc(x.codes.join(','))}"><span class="etiquette ${x.pire === 'rouge' ? 'rouge' : 'jaune'}">relancer</span><span><b>${esc(e?.nom || '')}</b><small>${esc(noms)} · ${x.derniere ? `dernière relance le ${fmtCourt(x.derniere)}` : 'jamais relancée'}</small></span></button>`;
  }

  // ---------- Vue Opérations ----------
  function barreConformite(x) {
    if (!x.total) return '<p class="note">Aucune intervention en cours.</p>';
    const seg = (n, c, l) => (n ? `<i style="flex:${n};background:${c}" title="${l} : ${n}"></i>` : '');
    return `<div class="barre-conf" role="img" aria-label="${x.conformes} conformes, ${x.surveiller} à surveiller, ${x.nonConformes} non conformes">${seg(x.conformes, 'var(--bleu)', 'Conformes')}${seg(x.surveiller, 'var(--jaune)', 'À surveiller')}${seg(x.nonConformes, 'var(--rouge)', 'Non conformes')}</div>
      <p class="barre-conf-leg"><span><i style="background:var(--bleu)"></i>${x.conformes} conforme${x.conformes > 1 ? 's' : ''}</span><span><i style="background:var(--jaune)"></i>${x.surveiller} à surveiller</span><span><i style="background:var(--rouge)"></i>${x.nonConformes} non conforme${x.nonConformes > 1 ? 's' : ''}</span></p>`;
  }

  function vueOperations() {
    const t = auj();
    return `
      <div class="vue-tete"><div><h1>Opérations</h1><p>${pluriel(E.operations.length, 'opération')} · conformité des interventions en cours. Ouvre une opération pour son tableau par lot et par rang.</p></div>
        <div class="actions"><button class="btn" data-action="csv-registre">Exporter (CSV)</button><button class="btn primaire" data-action="operation-nouvelle">${ICONES.plus}Opération</button></div></div>
      ${E.operations.length ? `<ul class="cartes-ops">${opsTriees().map((o) => {
        const x = R.tableauOperation(E, o.id, t);
        const nb = E.intervenants.filter((i) => i.operationId === o.id).length;
        return `<li><button class="carte-op${o.close ? ' close' : ''}" data-action="operation" data-id="${o.id}">
          <span class="cs-tete">${o.close ? '<span class="etiquette gris">Close</span>' : x.nonConformes ? '<span class="etiquette rouge">Non conforme</span>' : x.surveiller ? '<span class="etiquette jaune">À surveiller</span>' : '<span class="etiquette bleu">Conforme</span>'}${o.marchePublic ? '<span class="etiquette contour">Marché public</span>' : ''}<small>${esc([o.maitreOuvrage, o.ville].filter(Boolean).join(' · '))}</small></span>
          <b>${esc(o.nom)}</b>
          <span class="cs-chiffres"><span><b>${nb}</b> intervention${nb > 1 ? 's' : ''}</span><span><b>${pct(x.taux)}</b> conformes</span>${o.fin ? `<span>fin ${fmtCourt(o.fin)}</span>` : ''}</span>
          ${o.close ? '' : barreConformite(x)}</button></li>`;
      }).join('')}</ul>` : vide('Aucune opération', 'Crée l\'opération à suivre, puis ajoute les entreprises qui y interviennent.', `<button class="btn primaire" data-action="operation-nouvelle">${ICONES.plus}Opération</button>`)}`;
  }

  // Colonnes de pièces du tableau : types exigés pour au moins une intervention de l'opération.
  function typesColonnes(lignes) {
    const codes = new Set(lignes.flatMap((l) => l.pieces.map((p) => p.type.code)));
    return (E.reglages.types || []).filter((ty) => codes.has(ty.code));
  }

  function vueOperation(o) {
    if (!o) { opOuverte = null; return vueOperations(); }
    const t = auj();
    const x = R.tableauOperation(E, o.id, t);
    const cols = typesColonnes(x.lignes);
    const cellule = (l, ty) => { const p = l.pieces.find((q) => q.type.code === ty.code); return p ? `<td class="centre">${pastille(p)}</td>` : '<td class="centre"><small>–</small></td>'; };
    const nom = (l) => `<span class="rang-nom r${Math.min(l.rang, 1)}" style="--r:${l.rang}">${l.rang ? '<i aria-hidden="true">└</i>' : ''}<button class="lien-v" data-action="intervenant-modifier" data-id="${l.intervenant.id}"><b>${esc(nomEnt(l.intervenant.entrepriseId))}</b><small>${l.rang ? `Rang ${l.rang}` : 'Titulaire'}${l.intervenant.objet ? ` · ${esc(l.intervenant.objet)}` : ''}</small></button></span>`;
    const montant = (it) => (it.montantHT === '' || it.montantHT == null ? '–' : eur(nombre(it.montantHT)));
    let lotPrec = null;
    const lignesTab = x.lignes.map((l) => {
      const it = l.intervenant;
      const tete = it.lot !== lotPrec ? `<tr class="lot"><th colspan="${4 + cols.length}">${esc(it.lot || 'Sans lot')}</th></tr>` : '';
      lotPrec = it.lot;
      return `${tete}<tr class="${l.niveau === 'terminee' ? 'terminee' : ''}"><td>${nom(l)}</td><td class="nb">${montant(it)}</td><td>${etiq([ACC[l.acceptation][0], libAcceptation(l.acceptation, it)])}</td>${cols.map((ty) => cellule(l, ty)).join('')}<td>${etiq(NIVEAU[l.niveau])}</td></tr>`;
    }).join('');
    lotPrec = null;
    const cartes = x.lignes.map((l) => {
      const it = l.intervenant;
      const tete = it.lot !== lotPrec ? `<li class="lot-titre">${esc(it.lot || 'Sans lot')}</li>` : '';
      lotPrec = it.lot;
      return `${tete}<li><button class="carte-itv" data-action="intervenant-modifier" data-id="${it.id}" style="--r:${Math.min(l.rang, 3)};--c:${{ conforme: 'var(--bleu)', 'a-surveiller': 'var(--jaune)', 'non-conforme': 'var(--rouge)', terminee: 'var(--trait)' }[l.niveau]}">
        <span class="cs-tete">${etiq(NIVEAU[l.niveau])}<small>${l.rang ? `Rang ${l.rang}` : 'Titulaire'} · ${montant(it)}</small></span>
        <b>${esc(nomEnt(it.entrepriseId))}</b>
        <span class="puces-pieces">${l.acceptation !== 'sans-objet' ? `<span>Acceptation ${etiq([ACC[l.acceptation][0], libAcceptation(l.acceptation, it)])}</span>` : ''}${l.pieces.map((p) => `<span>${esc(p.type.court)} ${pastille(p)}</span>`).join('')}</span></button></li>`;
    }).join('');
    return `
      <p class="fil"><button class="btn lien" data-action="vue" data-vue="operations">← Toutes les opérations</button></p>
      <div class="vue-tete fiche-tete"><div><p class="surtitre">${esc([o.maitreOuvrage, o.reference, o.ville].filter(Boolean).join(' · '))}${o.close ? ' · close' : ''}</p>
        <h1>${esc(o.nom)}</h1>
        <p>${[[o.debut && `Du ${fmtCourt(o.debut)}`, o.fin && `au ${fmtCourt(o.fin)}`].filter(Boolean).join(' '), o.marchePublic ? 'Marché public : paiement direct des sous-traitants acceptés' : ''].filter(Boolean).join(' · ') || 'Dates non renseignées.'}</p></div>
        <div class="actions"><button class="btn" data-action="operation-modifier" data-id="${o.id}">Modifier</button><button class="btn" data-action="registre-op" data-id="${o.id}">Registre</button><button class="btn primaire" data-action="intervenant-nouveau" data-operation="${o.id}">${ICONES.plus}Entreprise</button></div></div>
      <div class="tuiles">
        ${tuile('Conformité', x.taux === null ? '–' : `${Math.round(x.taux * 100)}<small>%</small>`, `${pluriel(x.total, 'intervention en cours', 'interventions en cours')}`, 'var(--bleu)', 'rond')}
        ${tuile('Non conformes', x.nonConformes, 'Pièce manquante ou expirée, ou non accepté', 'var(--rouge)')}
        ${tuile('À surveiller', x.surveiller, `Échéance à J-${E.reglages.j30} ou demande en cours`, 'var(--jaune)')}
        ${tuile('Sous-traitants', x.lignes.filter((l) => l.rang > 0).length, `dont ${x.lignes.filter((l) => l.rang > 1).length} de rang 2 ou plus`, 'var(--encre)', 'rond')}
      </div>
      <h2 class="titre-section">Tableau de conformité <span>Par lot, chaque sous-traitant sous son donneur d'ordre. Touche une entreprise pour ses pièces et son acceptation.</span></h2>
      ${x.lignes.length ? `<div class="defile seulement-grand"><table class="tableau conformite"><thead><tr><th>Entreprise</th><th class="nb">Montant HT</th><th>Acceptation</th>${cols.map((ty) => `<th class="centre" title="${esc(ty.nom)}">${esc(ty.court)}</th>`).join('')}<th>Conformité</th></tr></thead><tbody>${lignesTab}</tbody></table></div>
      <ul class="cartes-itv seulement-petit">${cartes}</ul>
      <p class="note">Pastilles : <b>Valide</b>, <b>J-n</b> (expire dans n jours, alerte à J-${E.reglages.j30} et J-${E.reglages.j15}), <b>Expirée</b>, <b>Manquante</b>. « – » : pièce non exigée pour ce contrat (sous le seuil de ${eur(E.reglages.seuil)} HT, pas de salariés ou décennale non exigée).</p>`
    : vide('Aucune entreprise sur cette opération', 'Ajoute le titulaire de chaque lot, puis ses sous-traitants.', `<button class="btn primaire" data-action="intervenant-nouveau" data-operation="${o.id}">${ICONES.plus}Entreprise</button>`, true)}
      ${o.notes ? `<h2 class="titre-section">Notes</h2><p class="aide">${esc(o.notes)}</p>` : ''}`;
  }

  // ---------- Vue Entreprises ----------
  function lignesEntreprises(t) {
    return E.entreprises.map((e) => {
      const its = E.intervenants.filter((i) => i.entrepriseId === e.id);
      const conf = its.map((i) => R.conformite(E, i, t)).filter((c) => c.niveau !== 'terminee');
      const pire = conf.some((c) => c.niveau === 'non-conforme') ? 'non-conforme' : conf.some((c) => c.niveau === 'a-surveiller') ? 'a-surveiller' : conf.length ? 'conforme' : 'terminee';
      const prochaine = conf.map((c) => c.prochaine).filter(Boolean).sort()[0] || '';
      return { e, its, actives: conf.length, pire, prochaine };
    });
  }

  function vueEntreprises() {
    const t = auj();
    const f = filtreEnt;
    const toutes = lignesEntreprises(t);
    const l = toutes.filter((x) => (!f.texte || R.plat(`${x.e.nom} ${x.e.ville} ${x.e.siret}`).includes(R.plat(f.texte))) && (!f.etat || x.pire === f.etat))
      .sort((a, b) => ({ 'non-conforme': 0, 'a-surveiller': 1, conforme: 2, terminee: 3 }[a.pire] - { 'non-conforme': 0, 'a-surveiller': 1, conforme: 2, terminee: 3 }[b.pire]) || a.e.nom.localeCompare(b.e.nom, 'fr'));
    return `
      <div class="vue-tete"><div><h1>Entreprises</h1><p>Les pièces sont rangées par entreprise : une attestation reçue vaut pour toutes ses opérations.</p></div>
        <div class="actions"><button class="btn" data-action="csv-pieces">Exporter les pièces</button><button class="btn primaire" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button></div></div>
      ${E.entreprises.length ? `<div class="filtres filtres-2" role="search">
        <label class="champ recherche">Rechercher<input type="search" id="fe-texte" value="${esc(f.texte)}" placeholder="Nom, ville, SIRET…"></label>
        <label class="champ">Conformité<select id="fe-etat"><option value="">Toutes</option>${['non-conforme', 'a-surveiller', 'conforme', 'terminee'].map((k) => `<option value="${k}" ${k === f.etat ? 'selected' : ''}>${k === 'terminee' ? 'Sans intervention en cours' : NIVEAU[k][1]}</option>`).join('')}</select></label>
      </div>
      <p class="note compte-filtre">${l.length === toutes.length ? pluriel(l.length, 'entreprise') : `${l.length} sur ${toutes.length} entreprises · <button class="btn lien" data-action="filtres-raz">Tout afficher</button>`}</p>
      ${l.length ? `<div class="bloc-liste">${l.map(({ e, actives, pire, prochaine }) => `<button class="ligne-eq" data-action="entreprise" data-id="${e.id}">${etiq(pire === 'terminee' ? ['gris', 'Inactive'] : NIVEAU[pire])}
        <span><b>${esc(e.nom)}</b><small>${[e.ville, e.siret && `SIRET ${e.siret}`, pluriel(actives, 'intervention en cours', 'interventions en cours'), e.etranger ? 'établie hors de France' : '', e.employeur === false ? 'sans salarié' : ''].filter(Boolean).map(esc).join(' · ')}</small></span>
        <span class="eq-ech">${prochaine ? `<small>prochaine échéance</small><b>${fmtCourt(prochaine)}</b>` : ''}</span></button>`).join('')}</div>` : vide('Aucune entreprise ne correspond', 'Change ou efface les filtres.', '<button class="btn" data-action="filtres-raz">Tout afficher</button>', true)}`
    : vide('Aucune entreprise', 'Ajoute une entreprise ici, ou directement depuis une opération.', `<button class="btn primaire" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button>`)}`;
  }

  function vueEntreprise(e) {
    if (!e) { entOuverte = null; return vueEntreprises(); }
    const t = auj();
    const its = E.intervenants.filter((i) => i.entrepriseId === e.id);
    const conf = its.map((i) => R.conformite(E, i, t));
    const actives = conf.filter((c) => c.niveau !== 'terminee');
    const exiges = new Set(actives.flatMap((c) => c.pieces.map((p) => p.type.code)));
    const types = (E.reglages.types || []).filter((ty) => exiges.has(ty.code) || E.pieces.some((p) => p.entrepriseId === e.id && p.type === ty.code));
    const etats = R.etatPieces(E, e.id, types, t);
    const manquantes = etats.filter((p) => exiges.has(p.type.code) && p.etat !== 'valide').map((p) => p.type.code);
    const hist = E.pieces.filter((p) => p.entrepriseId === e.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const rels = E.relances.filter((r) => r.entrepriseId === e.id).sort((a, b) => b.date.localeCompare(a.date));
    return `
      <p class="fil"><button class="btn lien" data-action="vue" data-vue="entreprises">← Toutes les entreprises</button></p>
      <div class="vue-tete fiche-tete"><div><p class="surtitre">${esc([e.ville, e.siret && `SIRET ${e.siret}`].filter(Boolean).join(' · ') || 'Entreprise')}</p>
        <h1>${esc(e.nom)}</h1>
        <p>${[e.contact && esc(e.contact), e.email && `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`, e.telephone && esc(e.telephone), e.employeur === false ? 'Sans salarié' : ''].filter(Boolean).join(' · ') || 'Aucun contact renseigné.'}</p></div>
        <div class="actions"><button class="btn" data-action="entreprise-modifier" data-id="${e.id}">Modifier</button>${manquantes.length ? `<button class="btn" data-action="relance-nouvelle" data-entreprise="${e.id}" data-codes="${esc(manquantes.join(','))}">Relancer</button>` : ''}<button class="btn primaire" data-action="piece-nouvelle" data-entreprise="${e.id}">${ICONES.plus}Pièce reçue</button></div></div>
      ${e.etranger ? '<p class="alerte-note"><b>Établie hors de France</b> : les documents de vigilance diffèrent (article D8222-7 du code du travail) ; adapte les pièces suivies dans les Réglages et vérifie la déclaration de détachement de ses salariés.</p>' : ''}
      <h2 class="titre-section">Pièces <span>État de la pièce la plus récente de chaque type. Touche une ligne pour enregistrer la nouvelle version.</span></h2>
      ${types.length ? `<div class="bloc-liste">${etats.map((p) => `<button class="ligne-eq" data-action="${p.piece ? 'piece-modifier' : 'piece-nouvelle'}" data-id="${p.piece?.id || ''}" data-entreprise="${e.id}" data-type="${esc(p.type.code)}">${pastille(p)}
        <span><b>${esc(p.type.nom)}</b><small>${p.piece ? `Délivrée le ${fmtCourt(p.piece.date)}${p.piece.verifiee ? ' · authenticité vérifiée' : ' · authenticité non vérifiée'}${p.piece.reference ? ` · ${esc(p.piece.reference)}` : ''}` : 'Jamais reçue'}${exiges.has(p.type.code) ? '' : ' · non exigée actuellement'}</small></span>
        <span class="eq-ech">${p.echeance ? `<small>${p.etat === 'expiree' ? 'expirée le' : 'valable jusqu\'au'}</small><b>${fmtCourt(p.echeance)}</b>` : ''}</span></button>`).join('')}</div>` : '<p class="note">Aucune pièce exigée : pas d\'intervention en cours au-dessus du seuil de vigilance.</p>'}
      <h2 class="titre-section">Interventions <span>${pluriel(its.length, 'intervention')}, dont ${actives.length} en cours.</span></h2>
      ${its.length ? `<div class="bloc-liste">${conf.map((c) => { const i = c.intervenant; return `<button class="ligne-eq" data-action="intervenant-modifier" data-id="${i.id}">${etiq(NIVEAU[c.niveau])}<span><b>${esc(nomOp(i.operationId))}</b><small>Lot ${esc(i.lot || '–')} · ${c.rang ? `rang ${c.rang}, donneur d'ordre ${esc(nomEnt(itv(i.donneurId)?.entrepriseId))}` : 'titulaire'}${i.montantHT !== '' && i.montantHT != null ? ` · ${eur(nombre(i.montantHT))} HT` : ''}</small></span><span class="eq-ech">${c.acceptation !== 'sans-objet' ? etiq([ACC[c.acceptation][0], libAcceptation(c.acceptation, i)]) : ''}</span></button>`; }).join('')}</div>` : '<p class="note">Cette entreprise n\'intervient sur aucune opération.</p>'}
      <div class="rang-actions"><button class="btn petit" data-action="intervenant-nouveau" data-entreprise="${e.id}">${ICONES.plus}L'ajouter à une opération</button></div>
      <h2 class="titre-section">Relances <span>${rels.length ? `Dernière le ${fmtCourt(rels[0].date)}.` : 'Aucune relance.'}</span></h2>
      ${rels.length ? `<div class="bloc-liste">${rels.map(ligneRelance).join('')}</div>` : ''}
      <h2 class="titre-section">Historique des pièces <span>${pluriel(hist.length, 'pièce enregistrée', 'pièces enregistrées')}.</span></h2>
      ${hist.length ? `<div class="bloc-liste">${hist.map((p) => { const ty = typeP(p.type); const ech = R.echeancePiece(p, ty); return `<button class="ligne-int" data-action="piece-modifier" data-id="${p.id}"><span class="etiquette contour">${esc(ty?.court || p.type)}</span><span><b>${esc(ty?.nom || p.type)}</b><small>Délivrée le ${fmtCourt(p.date)}${p.recueLe ? ` · reçue le ${fmtCourt(p.recueLe)}` : ''}${p.notes ? ` · ${esc(p.notes)}` : ''}</small></span><span class="nb">${fmtCourt(ech)}<small>échéance</small></span></button>`; }).join('')}</div>` : '<p class="note">Aucune pièce enregistrée.</p>'}
      ${e.notes ? `<h2 class="titre-section">Notes</h2><p class="aide">${esc(e.notes)}</p>` : ''}`;
  }

  // ---------- Vue Relances ----------
  function ligneRelance(r) {
    const noms = r.types.map((c) => typeP(c)?.court || c).join(', ');
    return `<button class="ligne-int" data-action="relance-modifier" data-id="${r.id}"><span class="etiquette contour">${esc(r.canal || 'relance')}</span><span><b>${esc(nomEnt(r.entrepriseId))}</b><small>${esc(noms || 'Pièces')}${r.notes ? ` · ${esc(r.notes)}` : ''}</small></span><span class="nb">${fmt(r.date)}<small>${r.date ? r.date.slice(0, 4) : ''}</small></span></button>`;
  }

  function vueRelances() {
    const t = auj();
    const l = R.aRelancer(E, t);
    const journal = [...E.relances].sort((a, b) => b.date.localeCompare(a.date));
    return `
      <div class="vue-tete"><div><h1>Relances</h1><p>Le texte part du modèle des Réglages, rempli avec les pièces de chaque entreprise. Copie-le ou ouvre ta messagerie, puis note la relance.</p></div>
        <div class="actions"><button class="btn" data-action="modele">Modifier le modèle</button></div></div>
      <h2 class="titre-section">À relancer <span>Pièce manquante, expirée ou à J-${E.reglages.j30}, sans relance depuis ${pluriel(E.reglages.relanceJours, 'jour')}.</span></h2>
      ${l.length ? `<div class="bloc-liste">${l.map(ligneARelancer).join('')}</div>` : vide('Aucune relance à faire', 'Les entreprises en retard ont été relancées récemment, ou tout est à jour.', '', true)}
      <h2 class="titre-section">Journal <span>${pluriel(journal.length, 'relance notée', 'relances notées')}.</span></h2>
      ${journal.length ? `<div class="bloc-liste">${journal.slice(0, 80).map(ligneRelance).join('')}</div>` : '<p class="note">Aucune relance notée.</p>'}`;
  }

  // ---------- Vue Registre (imprimable) ----------
  function docRegistre(o, t) {
    const x = R.tableauOperation(E, o.id, t);
    const cols = typesColonnes(x.lignes);
    const celPiece = (l, ty) => {
      const p = l.pieces.find((q) => q.type.code === ty.code);
      if (!p) return '<td class="date">–</td>';
      if (p.etat === 'manquante') return '<td class="date"><em>manquante</em></td>';
      return `<td class="date">${p.etat === 'expiree' ? `<em>expirée ${fmtCourt(p.echeance)}</em>` : fmtCourt(p.echeance)}${p.piece && !p.piece.verifiee ? ' *' : ''}</td>`;
    };
    const lignes = x.lignes.map((l) => {
      const it = l.intervenant;
      const e = ent(it.entrepriseId);
      const acc = l.acceptation === 'sans-objet' ? 'Titulaire' : `${libAcceptation(l.acceptation, it)}${it.dateAcceptation && it.acceptation !== 'demande' ? ` le ${fmtCourt(it.dateAcceptation)}` : it.dateDemande ? ` (demande ${fmtCourt(it.dateDemande)})` : ''}${it.paiementDirect ? ', paiement direct' : ''}`;
      return `<tr><td>${esc(it.lot || '–')}</td><td><b>${esc(e?.nom || '')}</b>${e?.siret ? `<br>${esc(e.siret)}` : ''}</td><td>${l.rang ? `Rang ${l.rang}<br>${esc(nomEnt(itv(it.donneurId)?.entrepriseId))}` : 'Titulaire'}</td><td class="num">${it.montantHT === '' || it.montantHT == null ? '–' : eur(nombre(it.montantHT))}</td><td>${l.niveau === 'non-conforme' && (l.acceptation === 'manquante' || l.acceptation === 'refuse') ? `<em>${acc}</em>` : acc}</td>${cols.map((ty) => celPiece(l, ty)).join('')}<td>${l.niveau === 'non-conforme' ? `<em>${NIVEAU[l.niveau][1]}</em>` : NIVEAU[l.niveau][1]}</td></tr>`;
    }).join('');
    return `<header><p class="pv-structure">${esc(E.structure || 'Registre des sous-traitants')}</p><h2>Registre des sous-traitants et de l'obligation de vigilance</h2>
      <dl><div><dt>Opération</dt><dd>${esc(o.nom)}</dd></div><div><dt>Maître d'ouvrage</dt><dd>${esc(o.maitreOuvrage || '–')}</dd></div><div><dt>Référence</dt><dd>${esc(o.reference || '–')}${o.marchePublic ? ' · marché public' : ''}</dd></div><div><dt>Situation au</dt><dd>${fmtCourt(t)}</dd></div></dl></header>
      <p class="pv-synthese"><b>${pluriel(x.total, 'intervention en cours', 'interventions en cours')}</b> : ${x.conformes} conforme${x.conformes > 1 ? 's' : ''}, ${x.surveiller} à surveiller, ${x.nonConformes} non conforme${x.nonConformes > 1 ? 's' : ''}.</p>
      ${x.lignes.length ? `<table><thead><tr><th>Lot</th><th>Entreprise</th><th>Rang</th><th>Montant HT</th><th>Acceptation et paiement</th>${cols.map((ty) => `<th>${esc(ty.court)} (fin)</th>`).join('')}<th>Conformité</th></tr></thead><tbody>${lignes}</tbody></table>` : '<p class="pv-vide">Aucune entreprise enregistrée sur cette opération.</p>'}
      <footer>Dates : fin de validité de la pièce la plus récente. * authenticité non vérifiée. Pièces exigées à partir de ${eur(E.reglages.seuil)} HT. Document de suivi établi avec un outil d'aide, qui ne remplace pas un conseil juridique ; règles lues le ${fmtCourt(B.verifieLe)} (service-public.gouv.fr, urssaf.fr, Légifrance).</footer>`;
  }

  function vueRegistre() {
    const t = auj();
    if (!E.operations.length) return `<div class="vue-tete"><div><h1>Registre</h1></div></div>${vide('Aucune opération', 'Crée une opération pour éditer son registre.', `<button class="btn primaire" data-action="operation-nouvelle">${ICONES.plus}Opération</button>`)}`;
    const o = op(registreOp) || opsTriees()[0];
    registreOp = o.id;
    return `
      <div class="vue-tete"><div><h1>Registre</h1><p>Situation de chaque entreprise à la date du jour, prête à imprimer ou à enregistrer en PDF (A4 paysage conseillé).</p></div>
        <div class="actions"><button class="btn" data-action="csv-registre" data-id="${o.id}">Exporter (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <div class="filtres filtres-2 seul"><label class="champ">Opération<select id="reg-op">${opsTriees().map((x) => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.nom)}${x.close ? ' (close)' : ''}</option>`).join('')}</select></label></div>
      <div class="pv-cadre"><div class="pv-doc registre" id="pv-doc">${docRegistre(o, t)}</div></div>`;
  }

  function imprimer() {
    const doc = $('#pv-doc');
    if (!doc) return;
    $('#impression').innerHTML = doc.innerHTML;
    window.print();
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const rg = E.reglages;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Ce que l'outil calcule, d'où viennent les règles, et ce qu'il ne fait pas.</p></div></div>
      <p class="alerte-note"><b>Outil d'aide au suivi</b> : il ne remplace pas un conseil juridique. Les règles ci-dessous ont été lues le <b>${fmtCourt(B.verifieLe)}</b> sur les sites officiels cités ; vérifie-les avant de t'y fier, elles peuvent changer.</p>
      <h2 class="titre-section">Démarrer</h2>
      <ul class="limites">
        <li><b>Opérations</b> : une par chantier ou par marché ; coche « marché public » si les sous-traitants acceptés y sont payés directement.</li>
        <li><b>Entreprises par lot</b> : ajoute le titulaire de chaque lot (donneur d'ordre : maître d'ouvrage), puis chaque sous-traitant sous son donneur d'ordre ; le rang se calcule seul. Montant HT du contrat : il décide des pièces exigées.</li>
        <li><b>Pièces</b> : à chaque pièce reçue, note sa date de délivrance (ou sa fin de validité quand elle est écrite dessus). Une pièce reçue vaut pour toutes les opérations de l'entreprise.</li>
      </ul>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Échéance</b> : date de fin saisie, sinon date de délivrance + durée du type de pièce (Réglages). Alertes à J-${rg.j30} et J-${rg.j15}, puis « expirée » le lendemain de l'échéance.</li>
        <li><b>Pièces exigées</b> : selon la portée de chaque type ; pour la vigilance, contrats à partir de ${esc(eur(rg.seuil))} HT (montant non saisi : exigées par prudence) ; liste des salariés étrangers seulement si l'entreprise emploie des salariés ; décennale selon la case de l'intervention.</li>
        <li><b>Acceptation</b> : le titulaire n'est pas concerné. Un sous-traitant est « non accepté » s'il a commencé sans acceptation (date de début passée ou absente), « demandé » avant son début, « paiement à agréer » s'il est accepté sans agrément de ses conditions de paiement.</li>
        <li><b>Conformité</b> : non conforme (pièce manquante ou expirée, non accepté, refusé), à surveiller (échéance proche, demande en cours), conforme. Une intervention dont la date de fin est passée, ou d'une opération close, sort du suivi.</li>
        <li><b>Relances</b> : une entreprise est proposée tant qu'il lui manque une pièce et qu'elle n'a pas été relancée depuis ${pluriel(rg.relanceJours, 'jour')}.</li>
      </ul>
      <h2 class="titre-section">Règles retenues et sources</h2>
      <div class="legal">
        <ul>
          <li>Obligation de vigilance : à la conclusion d'un contrat d'au moins 5 000 € HT, puis tous les 6 mois jusqu'à la fin de son exécution, le donneur d'ordre se fait remettre l'attestation de vigilance et le justificatif d'immatriculation ; à défaut, il peut être tenu solidairement des sommes dues par un sous-traitant condamné pour travail dissimulé.</li>
          <li>Attestation de vigilance : valable 6 mois ; authenticité à vérifier sur urssaf.fr avec le code de sécurité.</li>
          <li>Liste nominative des salariés étrangers soumis à autorisation de travail : à la conclusion du contrat, puis tous les 6 mois.</li>
          <li>Assurance décennale : attestation jointe aux devis et factures ; l'échéance est celle écrite sur l'attestation.</li>
          <li>Sous-traitance : l'entrepreneur principal fait accepter chaque sous-traitant et agréer ses conditions de paiement par le maître d'ouvrage ; en marché public, paiement direct du sous-traitant accepté ; le maître d'ouvrage qui connaît la présence d'un sous-traitant non accepté met l'entrepreneur en demeure.</li>
        </ul>
        <p><b>Sources lues le ${fmtCourt(B.verifieLe)}</b> :</p>
        <ul>${B.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a> · ${esc(s.editeur)}</li>`).join('')}</ul>
        <p><b>À surveiller</b> : ${esc(B.evolution)}</p>
      </div>
      <h2 class="titre-section">Données personnelles (RGPD)</h2>
      <ul class="limites">
        <li>Ne note que des coordonnées professionnelles (fonction ou service, e-mail et téléphone de l'entreprise). L'outil ne stocke aucun document : la liste des salariés étrangers, les attestations et leurs données restent dans tes dossiers ; seules leurs dates sont suivies.</li>
        <li>Supprime les entreprises et opérations qui ne servent plus, en tenant compte de tes propres obligations de conservation ; l'export CSV et la copie JSON te permettent d'archiver avant.</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Pas de pièces jointes</b> ni de collecte en ligne auprès des entreprises : tu enregistres les dates des pièces reçues.</li>
        <li><b>Entreprises établies hors de France</b> : les pièces diffèrent (article D8222-7) ; ajoute les types nécessaires dans les Réglages.</li>
        <li><b>Pas d'envoi automatique</b> : la relance s'ouvre dans ta messagerie ou se copie ; rien ne part sans toi.</li>
        <li><b>Un compte, une clé</b> : pas de droits par personne ; la personne qui suit les sous-traitants saisit pour l'équipe.</li>
      </ul>`;
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
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea')?.focus();
  }
  const PIED_NOUVEAU = (l2 = 'Ajouter') => `<button class="btn primaire" value="ok">${l2}</button><button class="btn" value="annuler">Annuler</button>`;
  const PIED_MODIF = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>';
  const montant = (f, k) => { const s = texte(f, k); if (!s) return ''; const n = nombre(s); return n >= 0 && /\d/.test(s) ? R.arrondi(n) : null; };
  const dateOk = (v) => !v || R.estDate(v);

  // Modifie l'état avec annulation possible depuis le toast.
  function modifier(fn, message, annulable = true) {
    const avant = structuredClone(E);
    const r = fn();
    if (typeof r === 'string') return r;
    annulation = annulable ? () => { E = avant; } : null;
    sauver(); rendre();
    if (message) toast(message, annulable ? { libelle: 'Annuler', faire: annuler } : null);
    return undefined;
  }

  function modaleOperation(id) {
    const o = id ? op(id) : null;
    const corps = `
      <label class="champ">Nom de l'opération<input name="nom" required maxlength="100" value="${esc(o?.nom || '')}" placeholder="Ex. : Résidence Les Aulnes"></label>
      <div class="grille-2">
        <label class="champ">Maître d'ouvrage<input name="maitreOuvrage" maxlength="100" value="${esc(o?.maitreOuvrage || '')}"></label>
        <label class="champ">Référence du marché<input name="reference" maxlength="60" value="${esc(o?.reference || '')}"></label>
        <label class="champ">Ville ou secteur<input name="ville" maxlength="60" value="${esc(o?.ville || '')}"></label>
        <span></span>
        <label class="champ">Début des travaux<input type="date" name="debut" value="${o?.debut || ''}"></label>
        <label class="champ">Fin prévue<input type="date" name="fin" value="${o?.fin || ''}"></label>
      </div>
      <label class="case"><input type="checkbox" name="marchePublic" ${o?.marchePublic ? 'checked' : ''}> Marché public (paiement direct des sous-traitants acceptés)</label>
      ${o ? `<label class="case"><input type="checkbox" name="close" ${o.close ? 'checked' : ''}> Opération close : plus d'alerte, registre conservé</label>` : ''}
      <label class="champ">Notes<textarea name="notes" maxlength="600">${esc(o?.notes || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(o ? 'Modifier l\'opération' : 'Nouvelle opération', corps, o ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const n = E.intervenants.filter((i) => i.operationId === o.id).length;
        if (!confirm(`Supprimer ${o.nom}${n ? ` et ses ${pluriel(n, 'intervention')}` : ''} ? Les entreprises et leurs pièces sont conservées. Pour garder le registre, coche plutôt « Opération close ».`)) return '';
        opOuverte = null;
        modifier(() => { E.operations = E.operations.filter((x) => x.id !== o.id); E.intervenants = E.intervenants.filter((i) => i.operationId !== o.id); }, `${o.nom} supprimée.`);
        return undefined;
      }
      const nom = texte(f, 'nom');
      if (!nom) return 'Indique le nom de l\'opération.';
      if (!dateOk(f.get('debut')) || !dateOk(f.get('fin'))) return 'Dates invalides.';
      if (f.get('debut') && f.get('fin') && f.get('fin') < f.get('debut')) return 'La fin ne peut pas précéder le début.';
      const champs = { nom, maitreOuvrage: texte(f, 'maitreOuvrage'), reference: texte(f, 'reference'), ville: texte(f, 'ville'), debut: f.get('debut') || '', fin: f.get('fin') || '', marchePublic: !!f.get('marchePublic'), notes: texte(f, 'notes') };
      if (o) return modifier(() => { Object.assign(o, champs, { close: !!f.get('close') }); }, `${nom} enregistrée.`);
      const n = { id: uid(), ...champs, close: false };
      modifier(() => { E.operations.push(n); }, `${nom} créée : ajoute les entreprises.`, false);
      ouvrir('operations', n.id);
      return undefined;
    });
  }

  function champsEntreprise(e) {
    return `
      <div class="grille-2">
        <label class="champ">Raison sociale<input name="nom" required maxlength="100" value="${esc(e?.nom || '')}"></label>
        <label class="champ">SIRET <small>Facultatif.</small><input name="siret" maxlength="20" inputmode="numeric" value="${esc(e?.siret || '')}"></label>
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(e?.ville || '')}"></label>
        <label class="champ">Contact <small>Fonction ou service de préférence.</small><input name="contact" maxlength="80" value="${esc(e?.contact || '')}" placeholder="Ex. : Service administratif"></label>
        <label class="champ">E-mail professionnel<input type="email" name="email" maxlength="120" value="${esc(e?.email || '')}"></label>
        <label class="champ">Téléphone<input name="telephone" maxlength="30" inputmode="tel" value="${esc(e?.telephone || '')}"></label>
      </div>
      <label class="case"><input type="checkbox" name="sansSalarie" ${e?.employeur === false ? 'checked' : ''}> Sans salarié (la liste des salariés étrangers n'est pas exigée)</label>
      <label class="case"><input type="checkbox" name="etranger" ${e?.etranger ? 'checked' : ''}> Établie hors de France (pièces différentes : à adapter)</label>`;
  }
  const lireEntreprise = (f) => ({ nom: texte(f, 'nom'), siret: texte(f, 'siret'), ville: texte(f, 'ville'), contact: texte(f, 'contact'), email: texte(f, 'email'), telephone: texte(f, 'telephone'), employeur: !f.get('sansSalarie'), etranger: !!f.get('etranger') });

  function modaleEntreprise(id) {
    const e = id ? ent(id) : null;
    const corps = `${champsEntreprise(e)}
      <label class="champ">Notes<textarea name="notes" maxlength="600">${esc(e?.notes || '')}</textarea></label>
      <p class="aide rgpd">Coordonnées professionnelles seulement ; aucun document ni nom de salarié n'est stocké ici.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', corps, e ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const ni = E.intervenants.filter((i) => i.entrepriseId === e.id).length, np = E.pieces.filter((p) => p.entrepriseId === e.id).length;
        if (!confirm(`Supprimer ${e.nom}${ni + np ? ` avec ${pluriel(ni, 'intervention')} et ${pluriel(np, 'pièce')}` : ''} ?`)) return '';
        entOuverte = null;
        modifier(() => {
          const ids = new Set(E.intervenants.filter((i) => i.entrepriseId === e.id).map((i) => i.id));
          E.intervenants.forEach((i) => { if (ids.has(i.donneurId)) i.donneurId = E.intervenants.find((x) => x.id === i.donneurId)?.donneurId || ''; });
          E.entreprises = E.entreprises.filter((x) => x.id !== e.id); E.intervenants = E.intervenants.filter((i) => !ids.has(i.id));
          E.pieces = E.pieces.filter((p) => p.entrepriseId !== e.id); E.relances = E.relances.filter((r) => r.entrepriseId !== e.id);
        }, `${e.nom} supprimée.`);
        return undefined;
      }
      const champs = { ...lireEntreprise(f), notes: texte(f, 'notes') };
      if (!champs.nom) return 'Indique la raison sociale.';
      if (E.entreprises.some((x) => R.plat(x.nom) === R.plat(champs.nom) && x.id !== e?.id)) return 'Une entreprise porte déjà ce nom.';
      if (e) return modifier(() => { Object.assign(e, champs); }, `${champs.nom} enregistrée.`);
      const n = { id: uid(), ...champs };
      modifier(() => { E.entreprises.push(n); }, `${champs.nom} ajoutée.`, false);
      ouvrir('entreprises', n.id);
      return undefined;
    });
  }

  function modaleIntervenant(id, defauts = {}) {
    const i = id ? itv(id) : null;
    if (!E.operations.length) { toast('Crée d\'abord une opération.'); return; }
    const t = auj();
    const opId = i?.operationId || defauts.operationId || opOuverte || opsTriees().find((o) => !o.close)?.id || opsTriees()[0].id;
    const entId = i?.entrepriseId || defauts.entrepriseId || '';
    let resume = '';
    if (i) {
      const c = R.conformite(E, i, t);
      const manque = c.pieces.filter((p) => p.etat !== 'valide').map((p) => p.type.code);
      resume = `<div class="resume-eq"><span>${etiq(NIVEAU[c.niveau])}</span>
        <span class="puces-pieces">${c.pieces.length ? c.pieces.map((p) => `<span>${esc(p.type.court)} ${pastille(p)}</span>`).join('') : '<span>Aucune pièce exigée pour ce contrat.</span>'}</span>
        <span class="rang"><button class="btn petit" type="button" data-action="entreprise" data-id="${i.entrepriseId}">Fiche de l'entreprise</button><button class="btn petit" type="button" data-action="piece-nouvelle" data-entreprise="${i.entrepriseId}" data-type="${esc(manque[0] || '')}">Pièce reçue</button>${manque.length ? `<button class="btn petit" type="button" data-action="relance-nouvelle" data-entreprise="${i.entrepriseId}" data-codes="${esc(manque.join(','))}">Relancer</button>` : ''}</span></div>`;
    }
    const corps = `${resume}
      <div class="grille-2">
        <label class="champ">Opération<select name="operationId" id="m-op">${opsTriees().map((o) => `<option value="${o.id}" ${o.id === opId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>
        <label class="champ">Entreprise<select name="entrepriseId" id="m-ent"><option value="">Nouvelle entreprise…</option>${entsTriees().map((e) => `<option value="${e.id}" ${e.id === entId ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
      </div>
      <fieldset class="nouvelle-ent" id="m-nouvelle"><legend>Nouvelle entreprise</legend>${champsEntreprise(null)}</fieldset>
      <div class="grille-2">
        <label class="champ">Lot<input name="lot" maxlength="60" list="m-lots" value="${esc(i?.lot ?? defauts.lot ?? '')}" placeholder="Ex. : 02 Gros œuvre"></label>
        <label class="champ">Donneur d'ordre<select name="donneurId" id="m-donneur"></select></label>
        <label class="champ">Objet <small>Prestation sous-traitée.</small><input name="objet" maxlength="120" value="${esc(i?.objet || '')}" placeholder="Ex. : ferraillage"></label>
        <label class="champ">Montant du contrat HT (€) <small>Décide des pièces exigées.</small><input name="montantHT" inputmode="decimal" value="${esc(i?.montantHT ?? '')}"></label>
        <label class="champ">Début d'intervention<input type="date" name="debut" value="${i?.debut || ''}"></label>
        <label class="champ">Fin d'intervention <small>Vide tant qu'elle dure.</small><input type="date" name="fin" value="${i?.fin || ''}"></label>
      </div>
      <datalist id="m-lots"></datalist>
      <label class="case"><input type="checkbox" name="decennale" ${i ? (i.decennale !== false ? 'checked' : '') : 'checked'}> Attestation décennale exigée (travaux de construction)</label>
      <fieldset class="bloc-acceptation" id="m-acc"><legend>Acceptation par le maître d'ouvrage</legend>
        <div class="grille-3">
          <label class="champ">Statut<select name="acceptation">${options(B.statutsAcceptation, i?.acceptation || 'a-declarer')}</select></label>
          <label class="champ">Demande envoyée le<input type="date" name="dateDemande" max="${t}" value="${i?.dateDemande || ''}"></label>
          <label class="champ">Décision le<input type="date" name="dateAcceptation" max="${t}" value="${i?.dateAcceptation || ''}"></label>
        </div>
        <label class="case"><input type="checkbox" name="paiementAgree" ${i?.paiementAgree ? 'checked' : ''}> Conditions de paiement agréées</label>
        <label class="case"><input type="checkbox" name="paiementDirect" ${i?.paiementDirect ? 'checked' : ''}> Paiement direct par le maître d'ouvrage (marché public)</label>
      </fieldset>
      <label class="champ">Notes<textarea name="notes" maxlength="600">${esc(i?.notes || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i ? esc(nomEnt(i.entrepriseId)) : 'Entreprise sur une opération', corps, i ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const enfants = E.intervenants.filter((x) => x.donneurId === i.id).length;
        if (!confirm(`Retirer ${nomEnt(i.entrepriseId)} de ${nomOp(i.operationId)} ?${enfants ? ` Ses ${pluriel(enfants, 'sous-traitant')} remonteront d'un rang.` : ''} L'entreprise et ses pièces sont conservées.`)) return '';
        modifier(() => { E.intervenants.forEach((x) => { if (x.donneurId === i.id) x.donneurId = i.donneurId; }); E.intervenants = E.intervenants.filter((x) => x.id !== i.id); }, 'Intervention retirée.');
        return undefined;
      }
      let entrepriseId = f.get('entrepriseId');
      let nouvelle = null;
      if (!entrepriseId) {
        nouvelle = { id: uid(), ...lireEntreprise(f), notes: '' };
        if (!nouvelle.nom) return 'Choisis une entreprise ou indique la raison sociale de la nouvelle.';
        const ex = E.entreprises.find((x) => R.plat(x.nom) === R.plat(nouvelle.nom));
        if (ex) { entrepriseId = ex.id; nouvelle = null; } else entrepriseId = nouvelle.id;
      }
      const m = montant(f, 'montantHT');
      if (m === null) return 'Montant : nombre positif (ou vide).';
      for (const k of ['debut', 'fin', 'dateDemande', 'dateAcceptation']) if (!dateOk(f.get(k))) return 'Une date est invalide.';
      if (f.get('debut') && f.get('fin') && f.get('fin') < f.get('debut')) return 'La fin ne peut pas précéder le début.';
      const donneurId = f.get('donneurId') || '';
      if (i && donneurId) { let c = itv(donneurId); const vus = new Set(); while (c && !vus.has(c.id)) { if (c.id === i.id) return 'Ce donneur d\'ordre est lui-même sous-traitant de cette entreprise.'; vus.add(c.id); c = itv(c.donneurId); } }
      const acc = f.get('acceptation');
      if (donneurId && acc === 'accepte' && !f.get('dateAcceptation')) return 'Indique la date d\'acceptation.';
      const champs = { operationId: f.get('operationId'), entrepriseId, lot: texte(f, 'lot'), donneurId, objet: texte(f, 'objet'), montantHT: m, debut: f.get('debut') || '', fin: f.get('fin') || '',
        decennale: !!f.get('decennale'), acceptation: donneurId ? acc : 'a-declarer', dateDemande: donneurId ? f.get('dateDemande') || '' : '', dateAcceptation: donneurId ? f.get('dateAcceptation') || '' : '',
        paiementAgree: !!donneurId && !!f.get('paiementAgree'), paiementDirect: !!donneurId && !!f.get('paiementDirect'), notes: texte(f, 'notes') };
      if (E.intervenants.some((x) => x.operationId === champs.operationId && x.entrepriseId === entrepriseId && x.lot === champs.lot && x.id !== i?.id)) return 'Cette entreprise figure déjà sur ce lot de l\'opération.';
      const nom = nouvelle?.nom || nomEnt(entrepriseId);
      if (i) return modifier(() => { Object.assign(i, champs); }, `${nom} enregistrée.`);
      return modifier(() => { if (nouvelle) E.entreprises.push(nouvelle); E.intervenants.push({ id: uid(), ...champs }); }, `${nom} ajoutée${donneurId ? ' comme sous-traitant' : ' comme titulaire'}.`);
    });
    const d = modale();
    const majEnt = () => { const n = !$('#m-ent', d).value; $('#m-nouvelle', d).hidden = !n; };
    const majOp = () => {
      const oid = $('#m-op', d).value;
      const sel = $('#m-donneur', d);
      const garde = sel.value || i?.donneurId || defauts.donneurId || '';
      const autres = E.intervenants.filter((x) => x.operationId === oid && x.id !== i?.id).sort((a, b) => String(a.lot).localeCompare(String(b.lot), 'fr', { numeric: true }) || nomEnt(a.entrepriseId).localeCompare(nomEnt(b.entrepriseId), 'fr'));
      sel.innerHTML = `<option value="">Maître d'ouvrage (titulaire du lot)</option>${autres.map((x) => `<option value="${x.id}" ${x.id === garde ? 'selected' : ''}>${esc(nomEnt(x.entrepriseId))}${x.lot ? ` · ${esc(x.lot)}` : ''}</option>`).join('')}`;
      $('#m-lots', d).innerHTML = [...new Set(E.intervenants.filter((x) => x.operationId === oid).map((x) => x.lot).filter(Boolean))].map((l) => `<option value="${esc(l)}"></option>`).join('');
      majDonneur();
    };
    const majDonneur = () => {
      const did = $('#m-donneur', d).value;
      $('#m-acc', d).hidden = !did;
      const lot = d.querySelector('[name=lot]');
      if (did && !lot.value) lot.value = itv(did)?.lot || '';
    };
    $('#m-ent', d).addEventListener('change', majEnt);
    $('#m-op', d).addEventListener('change', majOp);
    $('#m-donneur', d).addEventListener('change', majDonneur);
    majEnt(); majOp();
  }

  function modalePiece(id, defauts = {}) {
    const p = id ? piece(id) : null;
    if (!E.entreprises.length) { toast('Ajoute d\'abord une entreprise.'); return; }
    const t = auj();
    const entId = p?.entrepriseId || defauts.entrepriseId || entOuverte || entsTriees()[0].id;
    const code = p?.type || defauts.type || E.reglages.types[0]?.code;
    const corps = `
      <div class="grille-2">
        <label class="champ">Entreprise<select name="entrepriseId">${entsTriees().map((e) => `<option value="${e.id}" ${e.id === entId ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
        <label class="champ">Pièce<select name="type" id="m-type">${E.reglages.types.map((ty) => `<option value="${esc(ty.code)}" ${ty.code === code ? 'selected' : ''}>${esc(ty.nom)}</option>`).join('')}</select></label>
        <label class="champ">Délivrée le<input type="date" name="date" id="m-date" max="${t}" value="${p?.date || ''}"></label>
        <label class="champ"><span id="m-fin-lib">Valable jusqu'au</span><input type="date" name="fin" id="m-fin" value="${p?.fin || ''}"></label>
        <label class="champ">Reçue le<input type="date" name="recueLe" max="${t}" value="${p?.recueLe || (p ? '' : t)}"></label>
        <label class="champ">Référence <small>Code de sécurité, n° de police…</small><input name="reference" maxlength="60" value="${esc(p?.reference || '')}"></label>
      </div>
      <p class="apercu" id="m-ech" aria-live="polite"></p>
      <label class="case"><input type="checkbox" name="verifiee" ${p?.verifiee ? 'checked' : ''}> Authenticité vérifiée (par exemple sur urssaf.fr avec le code de sécurité)</label>
      <label class="champ">Notes<textarea name="notes" maxlength="400">${esc(p?.notes || '')}</textarea></label>
      <p class="aide" id="m-aide"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Pièce' : 'Pièce reçue', corps, p ? PIED_MODIF : PIED_NOUVEAU('Enregistrer'), (f, action) => {
      if (action === 'supprimer') { modifier(() => { E.pieces = E.pieces.filter((x) => x.id !== p.id); }, 'Pièce supprimée.'); return undefined; }
      const ty = typeP(f.get('type'));
      const date = f.get('date') || '', fin = f.get('fin') || '';
      if (!dateOk(date) || !dateOk(fin) || !dateOk(f.get('recueLe'))) return 'Une date est invalide.';
      if (ty?.depart === 'fin' && !fin) return 'Indique la date de fin de validité écrite sur la pièce.';
      if (!date && !fin) return 'Indique la date de délivrance.';
      if (date && fin && fin < date) return 'La fin de validité ne peut pas précéder la délivrance.';
      const champs = { entrepriseId: f.get('entrepriseId'), type: f.get('type'), date: date || '', fin, recueLe: f.get('recueLe') || '', verifiee: !!f.get('verifiee'), reference: texte(f, 'reference'), notes: texte(f, 'notes') };
      const ech = R.echeancePiece(champs, ty);
      const msg = `${ty?.court || 'Pièce'} de ${nomEnt(champs.entrepriseId)} : valable jusqu'au ${fmtCourt(ech)}.`;
      if (p) return modifier(() => { Object.assign(p, champs); }, msg);
      return modifier(() => { E.pieces.push({ id: uid(), ...champs }); }, msg);
    });
    const d = modale();
    const maj = () => {
      const ty = typeP($('#m-type', d).value);
      if (!ty) return;
      $('#m-fin-lib', d).textContent = ty.depart === 'fin' ? 'Valable jusqu\'au (écrit sur la pièce)' : `Valable jusqu'au (facultatif : ${ty.validiteMois} mois sinon)`;
      $('#m-aide', d).textContent = ty.aide || '';
      const ech = R.echeancePiece({ date: $('#m-date', d).value, fin: $('#m-fin', d).value }, ty);
      $('#m-ech', d).innerHTML = ech ? `Échéance retenue : <b>${fmtCourt(ech)}</b> (${{ expiree: 'déjà expirée', j15: `J-${ecart(t, ech)}`, j30: `J-${ecart(t, ech)}`, valide: `dans ${pluriel(ecart(t, ech), 'jour')}` }[R.etatEcheance(ech, t, E.reglages)]}).` : 'Saisis la date de délivrance pour calculer l\'échéance.';
    };
    ['#m-type', '#m-date', '#m-fin'].forEach((s) => $(s, d).addEventListener(s === '#m-type' ? 'change' : 'input', maj));
    maj();
  }

  let relanceEnt = null;
  function modaleRelance(id, entrepriseId, codes) {
    const r = id ? E.relances.find((x) => x.id === id) : null;
    const t = auj();
    const eId = r?.entrepriseId || entrepriseId;
    const e = ent(eId);
    if (!e) return;
    relanceEnt = eId;
    const liste = r ? r.types : codes;
    const opIds = [...new Set(E.intervenants.filter((i) => i.entrepriseId === eId && R.actif(E, i, t)).map((i) => i.operationId))];
    const txt = R.texteRelance(E, eId, liste, opIds, t);
    const corps = `
      <p><b>${esc(e.nom)}</b>${e.email ? ` · ${esc(e.email)}` : ' · aucun e-mail renseigné'}</p>
      ${r ? '' : `<label class="champ">Objet<input name="objet" id="m-objet" maxlength="200" value="${esc(txt.objet)}"></label>
      <label class="champ">Message <small>Modifiable avant l'envoi.</small><textarea name="corps" id="m-corps" rows="10">${esc(txt.corps)}</textarea></label>
      <div class="rang"><button class="btn petit" type="button" data-action="copier-relance">Copier le texte</button>${e.email ? '<button class="btn petit" type="button" data-action="mailto-relance">Ouvrir dans la messagerie</button>' : ''}</div>`}
      <div class="grille-2">
        <label class="champ">Relancée le<input type="date" name="date" max="${t}" value="${r?.date || t}"></label>
        <label class="champ">Canal<select name="canal">${B.canaux.map((c) => `<option ${c === (r?.canal || 'E-mail') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <p class="aide">Pièces relancées : ${esc(liste.map((c) => typeP(c)?.nom || c).join(', ') || '—')}.</p>
      <label class="champ">Notes<input name="notes" maxlength="200" value="${esc(r?.notes || '')}" placeholder="Ex. : réponse attendue vendredi"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Relance' : 'Relancer l\'entreprise', corps, r ? PIED_MODIF : PIED_NOUVEAU('Noter la relance'), (f, action) => {
      if (action === 'supprimer') { modifier(() => { E.relances = E.relances.filter((x) => x.id !== r.id); }, 'Relance supprimée.'); return undefined; }
      if (!R.estDate(f.get('date'))) return 'Indique la date de la relance.';
      const champs = { date: f.get('date'), canal: f.get('canal'), notes: texte(f, 'notes') };
      if (r) return modifier(() => { Object.assign(r, champs); }, 'Relance enregistrée.');
      return modifier(() => { E.relances.push({ id: uid(), entrepriseId: eId, types: [...liste], ...champs }); }, `Relance de ${e.nom} notée.`);
    });
  }

  function modaleModele() {
    const m = E.reglages.modele;
    const corps = `
      <p class="aide">Champs remplacés à chaque relance : <b>{entreprise}</b>, <b>{pieces}</b> (une ligne par pièce, avec son état), <b>{operations}</b>, <b>{structure}</b>, <b>{date}</b>.</p>
      <label class="champ">Objet<input name="objet" maxlength="200" value="${esc(m.objet)}"></label>
      <label class="champ">Message<textarea name="corps" rows="12" maxlength="4000">${esc(m.corps)}</textarea></label>
      <div class="rang"><button class="btn petit" type="button" data-action="modele-defaut">Revenir au modèle d'origine</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Modèle de relance', corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      if (!texte(f, 'objet') || !texte(f, 'corps')) return 'L\'objet et le message ne peuvent pas être vides.';
      return modifier(() => { E.reglages.modele = { objet: texte(f, 'objet'), corps: String(f.get('corps')).trim() }; }, 'Modèle de relance enregistré.');
    });
  }

  // Pièces suivies : nom, durée, départ de l'échéance, portée ; types ajoutés par l'utilisateur.
  function modaleTypes() {
    const ligne = (ty, k) => `<fieldset class="type-piece"><legend>${esc(ty.nom)}${ty.base ? '' : ' <small>(ajoutée)</small>'}</legend>
      <div class="grille-2">
        <label class="champ">Nom<input name="nom-${k}" maxlength="120" value="${esc(ty.nom)}"></label>
        <label class="champ">Nom court <small>Colonne du tableau.</small><input name="court-${k}" maxlength="30" value="${esc(ty.court)}"></label>
        <label class="champ">Échéance<select name="depart-${k}"><option value="emission" ${ty.depart === 'emission' ? 'selected' : ''}>Délivrance + durée</option><option value="fin" ${ty.depart === 'fin' ? 'selected' : ''}>Date de fin écrite sur la pièce</option></select></label>
        <label class="champ">Durée (mois)<input type="number" name="mois-${k}" min="1" max="120" value="${ty.validiteMois}"></label>
      </div>
      <label class="champ">Exigée pour<select name="portee-${k}">${options(B.portees, ty.portee)}</select></label>
      ${ty.source ? `<p class="aide">Source : ${esc(B.sources.find((s) => s.code === ty.source)?.titre || '')} (lue le ${fmtCourt(B.verifieLe)}).</p>` : ''}
      ${ty.base ? '' : `<label class="case"><input type="checkbox" name="suppr-${k}"> Retirer ce type (les pièces déjà saisies restent dans l'export)</label>`}</fieldset>`;
    const corps = `<p class="aide">Les valeurs d'origine suivent les sources citées dans le Guide. Adapte-les à tes contrats ou à une nouvelle réglementation : elles s'appliquent à toutes tes opérations.</p>
      ${E.reglages.types.map(ligne).join('')}
      <fieldset class="type-piece"><legend>Ajouter une pièce</legend>
        <div class="grille-2"><label class="champ">Nom<input name="nouveau-nom" maxlength="120" placeholder="Ex. : Carte BTP des salariés présents"></label>
        <label class="champ">Exigée pour<select name="nouveau-portee">${options(B.portees, 'toujours')}</select></label></div></fieldset>
      <div class="rang"><button class="btn petit" type="button" data-action="types-defaut">Revenir aux pièces d'origine</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Pièces suivies', corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      const types = [];
      for (const [k, ty] of E.reglages.types.entries()) {
        if (f.get(`suppr-${k}`)) continue;
        const mois = Number(f.get(`mois-${k}`));
        if (!Number.isInteger(mois) || mois < 1 || mois > 120) return `Durée de « ${ty.nom} » : nombre entier de mois, de 1 à 120.`;
        types.push({ ...ty, nom: texte(f, `nom-${k}`) || ty.nom, court: texte(f, `court-${k}`) || ty.court, depart: f.get(`depart-${k}`), validiteMois: mois, portee: f.get(`portee-${k}`) });
      }
      const nn = texte(f, 'nouveau-nom');
      if (nn) {
        let code = `P${types.length + 1}`; let n = types.length + 1;
        while (types.some((x) => x.code === code) || E.reglages.types.some((x) => x.code === code)) code = `P${++n}`;
        types.push({ code, nom: nn, court: nn.slice(0, 18), validiteMois: 12, depart: 'fin', portee: f.get('nouveau-portee'), source: '', aide: 'Pièce ajoutée par toi : saisis sa date de fin de validité.', base: false });
      }
      return modifier(() => { E.reglages.types = types; }, nn ? `« ${nn} » ajoutée aux pièces suivies.` : 'Pièces suivies enregistrées.');
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En tête du registre et signature des relances.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-2">
        <label class="champ">Première alerte (jours avant l'échéance)<input type="number" name="j30" min="1" max="180" value="${r.j30}"></label>
        <label class="champ">Seconde alerte (jours avant l'échéance)<input type="number" name="j15" min="0" max="180" value="${r.j15}"></label>
        <label class="champ">Seuil de vigilance (€ HT) <small>5 000 € HT au ${fmtCourt(B.verifieLe)} (service-public.gouv.fr).</small><input type="number" name="seuil" min="0" step="1" value="${r.seuil}"></label>
        <label class="champ">Délai entre deux relances (jours)<input type="number" name="relanceJours" min="0" max="90" value="${r.relanceJours}"></label>
      </div>
      <div class="rang"><button class="btn petit" type="button" data-action="types">Pièces suivies (${r.types.length})</button><button class="btn petit" type="button" data-action="modele">Modèle de relance</button></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Tableur (CSV) et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-registre">Registre (CSV)</button><button class="btn petit" type="button" data-action="csv-pieces">Pièces (CSV)</button></div>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import-json" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const vals = { j30: n('j30', 1, 180), j15: n('j15', 0, 180), seuil: n('seuil', 0, 100000000), relanceJours: n('relanceJours', 0, 90) };
      if (Object.values(vals).some((x) => x === null)) return 'Réglages : nombres entiers dans les limites indiquées.';
      if (vals.j15 > vals.j30) return 'La seconde alerte doit venir après la première (moins de jours avant l\'échéance).';
      return modifier(() => { E.structure = texte(f, 'structure'); Object.assign(r, vals); }, 'Réglages enregistrés.');
    });
    $('#import-json').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.operations) || !Array.isArray(d.entreprises)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.operations.length, 'opération')}, ${pluriel(d.entreprises.length, 'entreprise')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  // Relance : copie et ouverture de la messagerie avec le texte tel que modifié.
  function texteModale() { const d = modale(); return { objet: $('#m-objet', d)?.value || '', corps: $('#m-corps', d)?.value || '' }; }
  async function copierRelance() {
    const { objet, corps } = texteModale();
    try { await navigator.clipboard.writeText(`${objet}\n\n${corps}`); toast('Texte copié : colle-le dans ton e-mail.'); } catch { $('#m-corps')?.select(); toast('Copie impossible ici : sélectionne le texte et copie-le.'); }
  }
  function mailtoRelance(eId) {
    const e = ent(eId);
    const { objet, corps } = texteModale();
    if (!e?.email) return;
    location.href = `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
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
  function toast(texteT, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteT)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    verifierOuverts();
    sauver(); rendre();
  }

  // ---------- Filtres et sélecteurs des vues ----------
  function brancher() {
    const lier = (sel, fn) => { const el = $(sel); if (el) el.addEventListener(el.type === 'search' ? 'input' : 'change', fn); };
    lier('#fe-texte', (e) => { filtreEnt.texte = e.target.value; const pos = e.target.selectionStart; rendre(); const c = $('#fe-texte'); c.focus(); c.setSelectionRange(pos, pos); });
    lier('#fe-etat', (e) => { filtreEnt.etat = e.target.value; rendre(); });
    lier('#reg-op', (e) => { registreOp = e.target.value; rendre(); });
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const ferme = () => { if (modale().open) modale().close(); };
    const t = auj();
    const nomFichier = (q) => `sous-traitants-${q}-${t}.csv`;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); opOuverte = null; entOuverte = null; rendre(); } break;
      case 'deconnexion': ferme(); deconnecter(); break;
      case 'vue': ferme(); if (el.dataset.vue === 'operations') opOuverte = null; if (el.dataset.vue === 'entreprises') entOuverte = null; changerVue(el.dataset.vue); break;
      case 'aller-operations': changerVue('operations'); break;
      case 'aller-relances': changerVue('relances'); break;
      case 'aller-registre': changerVue('registre'); break;
      case 'operation': ferme(); ouvrir('operations', id); break;
      case 'entreprise': ferme(); ouvrir('entreprises', id); break;
      case 'registre-op': registreOp = id; changerVue('registre'); break;
      case 'filtres-raz': filtreEnt.texte = ''; filtreEnt.etat = ''; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'types': modaleTypes(); break;
      case 'types-defaut': if (confirm('Revenir aux pièces d\'origine ? Tes changements de durée et de portée, et les pièces ajoutées, seront perdus (les pièces saisies sont conservées).')) { ferme(); modifier(() => { E.reglages.types = R.typesDefaut(B); }, 'Pièces d\'origine rétablies.'); } break;
      case 'modele': modaleModele(); break;
      case 'modele-defaut': { const d = modale(); d.querySelector('[name=objet]').value = B.modeleRelance.objet; d.querySelector('[name=corps]').value = B.modeleRelance.corps; break; }
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'imprimer': imprimer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `sous-traitants-${t}.json`, 'application/json'); break;
      case 'csv-registre': telecharger(R.csvRegistre(E, t, id || ''), nomFichier(id ? 'registre-operation' : 'registre'), CSV); toast('Registre exporté (CSV, point-virgule).'); break;
      case 'csv-pieces': telecharger(R.csvPieces(E, t), nomFichier('pieces'), CSV); toast('Pièces exportées (CSV, point-virgule).'); break;
      case 'fermer': modale().close(); break;
      case 'operation-nouvelle': modaleOperation(); break;
      case 'operation-modifier': modaleOperation(id); break;
      case 'entreprise-nouvelle': modaleEntreprise(); break;
      case 'entreprise-modifier': modaleEntreprise(id); break;
      case 'intervenant-nouveau': modaleIntervenant(null, { operationId: el.dataset.operation, entrepriseId: el.dataset.entreprise }); break;
      case 'intervenant-modifier': if (id && itv(id)) modaleIntervenant(id); break;
      case 'piece-nouvelle': modalePiece(null, { entrepriseId: el.dataset.entreprise, type: el.dataset.type }); break;
      case 'piece-modifier': if (id && piece(id)) modalePiece(id); else modalePiece(null, { entrepriseId: el.dataset.entreprise, type: el.dataset.type }); break;
      case 'relance-nouvelle': modaleRelance(null, el.dataset.entreprise, (el.dataset.codes || '').split(',').filter(Boolean)); break;
      case 'relance-modifier': modaleRelance(id); break;
      case 'copier-relance': copierRelance(); break;
      case 'mailto-relance': mailtoRelance(relanceEnt); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
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
  window.__soustraitants = { etat: () => E };
  init();
})();
