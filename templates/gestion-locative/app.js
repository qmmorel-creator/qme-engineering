// Gestion locative QME : biens, baux, loyers, quittances, révision IRL, charges et rendement.
// Données synchronisées par clé de licence ou code d'accès. Rien n'est envoyé : les lettres sont à copier.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.GRT;
  const API = '/api/templates';
  const PRODUIT = 'GRT';
  const CLE_CODE = 'qme-grt-code';
  const CLE_CACHE = 'qme-grt-cache';
  const CLE_DEMO = 'qme-grt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-grt-ecran-accueil';
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
  const { ajout, versDate, euros, pct } = R;
  const auj = () => R.iso(new Date());
  // « 1er novembre » plutôt que « 1 novembre ».
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o).replace(/^1 /, '1er ').replace(/^(\D+ )1 /, '$11er ');
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const nomMois = (m) => versDate(`${m.slice(0, 7)}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const moisCourt = (m) => versDate(`${m.slice(0, 7)}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const categorie = (id) => B.categories.find((c) => c.id === id) || { id, nom: id, recuperable: false };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'jour';
  let moisLoyers = R.moisDe(auj());
  let anneeBilan = Number(auj().slice(0, 4));
  const filtreBaux = { statut: 'enCours' };
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const bail = (id) => E.baux.find((b) => b.id === id);
  const bien = (id) => E.biens.find((b) => b.id === id);
  const nomBien = (id) => bien(id)?.nom || 'Bien supprimé';
  const nomLocataire = (b) => b?.locataires || 'Locataire sans nom';
  const zone = () => E.reglages.zoneIrl || 'metropole';

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }
  function majBail(nouveau) { E.baux = E.baux.map((b) => (b.id === nouveau.id ? nouveau : b)); }

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
  // Code interne (GRT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Quatre biens fictifs, trois baux en cours et un bail terminé il y a trois semaines. Autour d'aujourd'hui,
  // tous les états : loyer payé, paiement partiel (reçu), loyers en retard à deux paliers, révision à demander
  // avec indices saisis, révision appliquée l'an dernier, prochaine révision dans un mois, dépôt de garantie à
  // restituer, régularisation des charges de l'an dernier, fin de bail prévue, logement vacant.
  // Indices IRL FICTIFS (valeurs inventées pour la démo, pas celles de l'Insee).
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.reglages.bailleurNom = 'Dominique Exemple (bailleur fictif)';
    e.reglages.bailleurAdresse = '12 allée des Exemples, 00000 Démoville';
    const bn = (nom, adresse, type, surface, prix, frais, travaux, dateAchat) => { const x = R.normaliserBien({ id: uid(), nom, adresse, type, surface, prixAchat: prix, fraisAchat: frais, travaux, dateAchat }); e.biens.push(x); return x; };
    const t2 = bn('T2 Les Lilas', '8 rue des Lilas, apt 3, 00000 Démoville', 'Appartement', 42, 13500000, 1000000, 500000, R.ajoutAns(t, -6));
    const studio = bn('Studio Gare', '2 place de la Gare, 00000 Démoville', 'Studio', 21, 7800000, 600000, 0, R.ajoutAns(t, -4));
    const maison = bn('Maison du Verger', '5 chemin du Verger, 00000 Exempleville', 'Maison', 88, 21000000, 1500000, 1800000, R.ajoutAns(t, -9));
    const t3 = bn('T3 Les Platanes', '30 avenue des Platanes, 00000 Démoville', 'Appartement', 64, 17500000, 1300000, 800000, R.ajoutAns(t, -3));
    // Indices fictifs : un par trimestre achevé depuis quatre ans, +0,45 par trimestre.
    let q = `${Number(t.slice(0, 4)) - 4}-T1`;
    let v = 136;
    while (R.finTrimestre(q) < t) {
      e.irl.push({ trimestre: q, valeur: Math.round(v * 100) / 100, zone: 'metropole' });
      v += 0.45 + (Number(q.slice(6)) === 3 ? 0.1 : 0);
      const a = Number(q.slice(0, 4)), n = Number(q.slice(6));
      q = n === 4 ? `${a + 1}-T1` : `${a}-T${n + 1}`;
    }
    e.irl.sort((a, b) => b.trimestre.localeCompare(a.trimestre));
    const trimDe = (d) => Math.ceil(Number(d.slice(5, 7)) / 3);
    // Baux.
    const debut1 = R.ajoutAns(j(-40), -3);
    const b1 = R.normaliserBail({ id: uid(), bien: t2.id, locataires: 'Camille et Sacha Exemple', type: 'vide', debut: debut1, loyer: 62000, charges: 6000, depot: 62000, jourEcheance: 1, revision: { clause: true, trimestre: trimDe(debut1) === 1 ? 4 : trimDe(debut1) - 1 }, note: 'Paiement par virement en début de mois.' }, t);
    const debut2 = R.ajoutMois(j(-10), -14);
    const b2 = R.normaliserBail({ id: uid(), bien: studio.id, locataires: 'Léo Martin (fictif)', type: 'meuble', debut: debut2, loyer: 49000, charges: 4000, depot: 98000, jourEcheance: 5, revision: { clause: true, trimestre: 2 }, finPrevue: R.ajoutMois(debut2, 24) }, t);
    const debut3 = R.ajoutAns(j(30), -5);
    const b3 = R.normaliserBail({ id: uid(), bien: maison.id, locataires: 'Famille Durand (fictive)', type: 'vide', debut: debut3, loyer: 98000, charges: 3000, depot: 98000, jourEcheance: 1, revision: { clause: true, trimestre: 3 } }, t);
    const fin4 = j(-21);
    const b4 = R.normaliserBail({ id: uid(), bien: t3.id, locataires: 'Nora Petit (fictive)', type: 'vide', debut: R.ajoutAns(R.ajoutMois(fin4, -5), -2), fin: fin4, loyer: 76000, charges: 7000, depot: 76000, jourEcheance: 1, revision: { clause: true, trimestre: 1 }, sortie: { remiseCles: fin4, conforme: false, retenues: [{ libelle: 'Peinture de la chambre (devis)', montant: 18000 }] } }, t);
    e.baux.push(b1, b2, b3, b4);
    // Révisions passées appliquées (sauf la dernière de b1, à demander ; et une perdue sur b4).
    const appliquer = (b, jusqua, decalage = 6) => {
      let x = b;
      for (const r of R.revisions(x, t, e.irl, 'metropole')) {
        if (r.date >= jusqua || r.etat !== 'aDemander' && r.etat !== 'perdue') continue;
        const res = R.appliquerRevision(x, r.date, ajout(r.date, decalage), e.irl, 'metropole');
        if (res.ok) x = res.bail;
      }
      return x;
    };
    e.baux = [appliquer(b1, j(-41)), appliquer(b2, t), appliquer(b3, t), b4];
    const pb4 = R.revisions(b4, t, e.irl, 'metropole');
    e.baux[3] = pb4.length > 1 ? R.appliquerRevision(b4, pb4[0].date, ajout(pb4[0].date, 4), e.irl, 'metropole').bail || b4 : b4;
    // Paiements : tout est réglé à l'échéance, sauf les cas de la démo.
    const mois = R.moisDe(t);
    const pmt = (b, m, date, montant, note = '') => e.paiements.push({ id: uid(), bail: b.id, mois: m, date, montant, note });
    for (const b of e.baux) {
      for (const ech of R.echeances(b, mois, e.reglages)) {
        const s = R.situation(ech, [], t, e.reglages);
        if (ech.date > t) continue;
        if (b === e.baux[1] && ech.mois >= R.moisSuivant(mois, -1)) continue; // studio : deux mois en retard
        if (b === e.baux[0] && ech.mois === mois) { pmt(b, ech.mois, ech.date, 40000, 'Virement partiel'); continue; }
        pmt(b, ech.mois, ajout(ech.date, (ech.mois.charCodeAt(6) % 3)), s.du);
      }
    }
    if (e.baux[1]) {
      const m1 = R.moisSuivant(mois, -1);
      const ech = R.echeance(e.baux[1], m1, e.reglages);
      if (ech) pmt(e.baux[1], m1, ajout(ech.date, 3), 20000, 'Acompte, reste promis');
    }
    e.quittances[`${e.baux[2].id}|${R.moisSuivant(mois, -1)}`] = j(-12);
    // Dépenses de l'an dernier et de cette année.
    const an = Number(t.slice(0, 4));
    const dep = (b, date, cat, montant, note = '') => e.depenses.push({ id: uid(), bien: b.id, date, categorie: cat, montant, recuperable: categorie(cat).recuperable, note });
    for (const a of [an - 1, an]) {
      const passe = (mmjj) => (`${a}-${mmjj}` <= t ? `${a}-${mmjj}` : null);
      [[t2, 98000, 18500, 21000, 64000, 52000], [studio, 61000, 11000, 15500, 38000, 26000], [maison, 165000, 26000, 34000, 0, 0], [t3, 118000, 21500, 24500, 82000, 61000]].forEach(([b, tf, teom, ass, copro, coproR]) => {
        if (passe('10-15')) dep(b, passe('10-15'), 'taxe-fonciere', tf - 24000);
        if (passe('10-15')) dep(b, passe('10-15'), 'teom', teom);
        if (passe('01-20')) dep(b, passe('01-20'), 'assurance', ass);
        if (copro && passe('04-05')) { dep(b, passe('04-05'), 'copro', copro / 2); dep(b, passe('04-05'), 'copro-recup', coproR / 2); }
        if (copro && passe('10-05')) { dep(b, passe('10-05'), 'copro', copro / 2); dep(b, passe('10-05'), 'copro-recup', coproR / 2); }
      });
      if (passe('06-12')) dep(maison, passe('06-12'), 'entretien', 14500, 'Entretien annuel de la chaudière');
      if (passe('03-02')) dep(studio, passe('03-02'), 'eau', 21000);
    }
    dep(t2, ajout(t, -60), 'travaux', 42000, 'Remplacement du chauffe-eau');
    dep(t3, ajout(t, -10), 'travaux', 26000, 'Rafraîchissement avant relocation');
    // Régularisation de l'an dernier déjà faite pour la maison.
    e.baux[2].regularisations = { [an - 1]: { date: `${an}-02-10`, solde: 0 } };
    e.relancesFaites.push({ id: uid(), bail: e.baux[1].id, mois: R.moisSuivant(mois, -1), palier: 1, date: j(-25) });
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
          <path d="M20 150 L120 50 L220 150 Z" fill="#D9302A"/>
          <rect x="40" y="150" width="160" height="130" fill="#1D4E89"/>
          <rect x="70" y="180" width="36" height="36" fill="#F5B400"/>
          <rect x="134" y="180" width="36" height="36" fill="#F5B400"/>
          <rect x="260" y="60" width="130" height="170" fill="none" stroke="#141414" stroke-width="4"/>
          <rect x="282" y="90" width="86" height="10" fill="#141414"/>
          <rect x="282" y="120" width="86" height="10" fill="#141414"/>
          <rect x="282" y="150" width="56" height="10" fill="#141414"/>
          <circle cx="470" cy="190" r="90" fill="#F0EDE6"/>
          <path d="M470 190 L470 100 A90 90 0 0 1 560 190 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion locative</p>
          <h1>Tes loyers, sans tableur.</h1>
          <p>Chaque échéance encaissée ou relancée, la quittance prête en un geste, la révision annuelle calculée avec l'IRL, les charges régularisées et le rendement réel de chaque bien.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta gestion locative</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes biens, baux et loyers sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/gestion-locative/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  const accueilVide = () => ({ etape: 1, bailleurNom: '', bailleurAdresse: '', bien: { nom: '', adresse: '', type: 'Appartement' }, bail: { locataires: '', type: 'vide', debut: '', loyer: '', charges: '', depot: '', jour: 1 }, zone: 'metropole' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On range tes loyers.</h1>
        <p class="intro">Tu décris tes biens et tes baux, tu notes les paiements reçus : échéances, retards, quittances, révisions et rendement se calculent. Rien n'est envoyé à ta place : les lettres sont prêtes à copier ou à imprimer.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton nom (bailleur) <small>Il figure sur les quittances.</small><input id="a-bnom" value="${esc(a.bailleurNom)}" maxlength="80" autocomplete="name"></label>
          <label class="champ">Ton adresse <small>Facultative, pour les courriers.</small><input id="a-badr" value="${esc(a.bailleurAdresse)}" maxlength="160"></label>
        </div>
        <h2 class="titre-section">Ton premier bien <span>Tu en ajouteras d'autres (jusqu'à ${R.MAX_BIENS}) dans l'onglet Baux.</span></h2>
        <div class="rang-champs" style="max-width:720px">
          <label class="champ">Nom du bien<input id="a-nom" value="${esc(a.bien.nom)}" maxlength="60" placeholder="Ex. : T2 centre-ville"></label>
          <label class="champ">Type<select id="a-type">${B.typesBien.map((x) => `<option ${x === a.bien.type ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        </div>
        <label class="champ" style="max-width:720px;margin-top:12px">Adresse du logement <small>Elle figure sur les quittances.</small><input id="a-adr" value="${esc(a.bien.adresse)}" maxlength="160"></label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Le bail en cours</h1>
        <p class="intro">Si ${esc(a.bien.nom || 'ce bien')} est loué, décris le bail : les échéances se créent depuis son début. Sinon, laisse vide et ajoute-le plus tard.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Locataire(s) <small>Un nom pour la quittance, rien de plus.</small><input id="a-loc" value="${esc(a.bail.locataires)}" maxlength="120"></label>
          <label class="champ">Type de bail<select id="a-tbail">${R.TYPES.map((x) => `<option value="${x}" ${x === a.bail.type ? 'selected' : ''}>${esc(R.LIB_TYPE[x])}</option>`).join('')}</select></label>
        </div>
        <div class="rang-champs" style="max-width:720px;margin-top:12px">
          <label class="champ">Début du bail<input id="a-debut" type="date" value="${esc(a.bail.debut)}"></label>
          <label class="champ">Jour d'échéance<input id="a-jour" type="number" min="1" max="31" value="${esc(a.bail.jour)}"></label>
        </div>
        <div class="rang-champs" style="max-width:720px;margin-top:12px">
          <label class="champ">Loyer hors charges (€/mois)<input id="a-loyer" inputmode="decimal" value="${esc(a.bail.loyer)}" placeholder="0,00"></label>
          <label class="champ">Charges (€/mois)<input id="a-charges" inputmode="decimal" value="${esc(a.bail.charges)}" placeholder="0,00"></label>
          <label class="champ">Dépôt de garantie (€)<input id="a-depot" inputmode="decimal" value="${esc(a.bail.depot)}" placeholder="0,00"></label>
        </div>
        <label class="champ" style="max-width:340px;margin-top:12px">Zone de l'indice IRL<select id="a-zone">${B.zones.map(([id, n]) => `<option value="${id}" ${id === a.zone ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <p class="aide" style="max-width:720px;margin-top:16px">${esc(B.sourceIrl)}</p>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma gestion locative</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, f) => $(sel)?.addEventListener('input', (e) => f(e.target.value));
    lier('#a-bnom', (v) => { accueil.bailleurNom = v; });
    lier('#a-badr', (v) => { accueil.bailleurAdresse = v; });
    lier('#a-nom', (v) => { accueil.bien.nom = v; });
    lier('#a-adr', (v) => { accueil.bien.adresse = v; });
    $('#a-type')?.addEventListener('change', (e) => { accueil.bien.type = e.target.value; });
    lier('#a-loc', (v) => { accueil.bail.locataires = v; });
    $('#a-tbail')?.addEventListener('change', (e) => { accueil.bail.type = e.target.value; });
    lier('#a-debut', (v) => { accueil.bail.debut = v; });
    $('#a-debut')?.addEventListener('change', (e) => { accueil.bail.debut = e.target.value; });
    lier('#a-jour', (v) => { accueil.bail.jour = v; });
    lier('#a-loyer', (v) => { accueil.bail.loyer = v; });
    lier('#a-charges', (v) => { accueil.bail.charges = v; });
    lier('#a-depot', (v) => { accueil.bail.depot = v; });
    $('#a-zone')?.addEventListener('change', (e) => { accueil.zone = e.target.value; });
  }

  function erreurAccueil(m) { const p = $('#erreur-accueil'); if (p) p.textContent = m; }
  function accueilSuivant() {
    if (!accueil.bien.nom.trim()) return erreurAccueil('Donne un nom à ton premier bien.');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    const a = accueil.bail;
    const avecBail = a.locataires.trim() || a.debut || String(a.loyer).trim();
    let nouveauBail = null;
    if (avecBail) {
      if (!R.estDate(a.debut)) return erreurAccueil('Indique la date de début du bail (ou vide les champs du bail).');
      const loyer = R.lireMontant(a.loyer);
      if (!loyer) return erreurAccueil('Loyer illisible : écris par exemple 650,00.');
      const charges = String(a.charges).trim() ? R.lireMontant(a.charges) : 0;
      if (charges === null) return erreurAccueil('Charges illisibles : écris par exemple 50,00.');
      const depot = String(a.depot).trim() ? R.lireMontant(a.depot) : 0;
      if (depot === null) return erreurAccueil('Dépôt de garantie illisible : écris par exemple 650,00.');
      const jour = Math.round(Number(a.jour));
      if (!(jour >= 1 && jour <= 31)) return erreurAccueil('Le jour d\'échéance va de 1 à 31.');
      nouveauBail = { locataires: a.locataires.trim(), type: a.type, debut: a.debut, loyer, charges, depot, jourEcheance: jour, revision: { clause: true, trimestre: Math.ceil(Number(a.debut.slice(5, 7)) / 3) } };
    }
    E = etatVide();
    E.reglages.bailleurNom = accueil.bailleurNom.trim();
    E.reglages.bailleurAdresse = accueil.bailleurAdresse.trim();
    E.reglages.zoneIrl = accueil.zone;
    const b = R.normaliserBien({ id: uid(), nom: accueil.bien.nom.trim(), adresse: accueil.bien.adresse.trim(), type: accueil.bien.type });
    E.biens.push(b);
    if (nouveauBail) E.baux.push(R.normaliserBail({ id: uid(), bien: b.id, ...nouveauBail }, auj()));
    accueil = accueilVide();
    vue = 'jour';
    sauver();
    demarrer();
    toast(nouveauBail ? 'C\'est prêt. Note les loyers déjà reçus dans l\'onglet Loyers.' : 'C\'est prêt. Ajoute un bail dans l\'onglet Baux.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    jour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    loyers: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    baux: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 11 12 3l10 8z" fill="currentColor"/><rect x="5" y="11" width="14" height="10" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="15" width="4" height="6" fill="currentColor"/></svg>',
    revisions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['jour', 'Aujourd\'hui'], ['loyers', 'Loyers'], ['baux', 'Baux'], ['revisions', 'Révisions'], ['bilan', 'Bilan']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la gestion de tes locations : ce n\'est ni un conseil juridique ni un conseil fiscal, ni un logiciel de comptabilité. Les modèles de lettres sont à adapter à ta situation ; le bail et les textes font foi, l\'ADIL de ton département renseigne gratuitement. Les indices IRL sont ceux que tu saisis. Rendements avant impôts et avant crédit.</p>';
  const COULEUR_ECH = { payee: 'vert', partielle: 'jaune', aujourdhui: 'jaune', aVenir: 'sable', retard: 'rouge' };
  const COULEUR_REV = { aVenir: 'ciel', aDemander: 'jaune', appliquee: 'vert', ignoree: 'sable', perdue: 'rose', bloquee: 'sable' };
  const etiquetteEch = (s) => `<span class="etiquette ${COULEUR_ECH[s.etat]}">${s.etat === 'retard' && s.partiel ? 'Partiel, en retard' : R.LIB_ECHEANCE[s.etat]}</span>`;
  const etiquetteRev = (r) => `<span class="etiquette ${COULEUR_REV[r.etat]}">${R.LIB_REVISION[r.etat]}</span>`;
  const statutBail = (b, t) => (b.debut > t ? 'aVenir' : b.fin && b.fin < t ? 'termine' : 'enCours');
  const LIB_STATUT_BAIL = { enCours: 'En cours', aVenir: 'À venir', termine: 'Terminé' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/gestion-locative/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données et indices fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion<br>locative</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, bailleur et sauvegarde" title="Réglages">${ICONES.reglages}</button>
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
    $('#vue').innerHTML = { jour: vueJour, loyers: vueLoyers, baux: vueBaux, revisions: vueRevisions, bilan: vueBilan }[vue]();
    brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 48 L36 12 L72 48Z" fill="#D9302A"/><rect x="8" y="48" width="56" height="48" fill="#1D4E89"/><circle cx="78" cy="24" r="18" fill="#F5B400"/></svg>';
  const sansBail = () => `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bail</h3><p>Ajoute un bail à l'un de tes biens (locataire, début, loyer, charges, dépôt) : ses échéances se créent toutes seules.</p><div class="actions"><button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Ajouter un bail</button></div></div></div>`;
  const pastilleDate = (d, cl = '') => `<span class="date-pastille ${cl}"><b>${versDate(d).getDate()}</b>${fmt(d, { month: 'short' }).replace('.', '')}</span>`;

  // Ligne d'échéance (Aujourd'hui, Loyers).
  function ligneEcheance(s) {
    const b = bail(s.bail);
    const actions = [];
    if (s.reste) actions.push(`<button class="btn petit primaire" data-action="encaisser" data-id="${b.id}" data-mois="${s.mois}">Encaisser</button>`);
    if (s.paye > 0) actions.push(`<button class="btn petit" data-action="document" data-id="${b.id}" data-mois="${s.mois}">${s.reste ? 'Reçu' : 'Quittance'}</button>`);
    if (s.etat === 'retard') actions.push(`<button class="btn petit" data-action="relance" data-id="${b.id}" data-mois="${s.mois}">Relancer</button>`);
    const deja = E.relancesFaites.filter((r) => r.bail === b.id && r.mois === s.mois);
    const remise = E.quittances[`${b.id}|${s.mois}`];
    return `<li class="ligne-ech etat-${s.etat}">
      ${pastilleDate(s.date, s.etat === 'retard' ? 'retard' : s.etat === 'payee' ? 'paye' : '')}
      <button class="lien-ligne" data-action="bail" data-id="${b.id}"><b>${esc(nomLocataire(b))} · ${esc(nomBien(b.bien))}</b><span>${nomMois(s.mois)} · ${euros(s.loyer)} + ${euros(s.charges)} de charges${s.prorata ? ` (prorata ${s.jours}/${s.joursMois} j)` : ''}${s.paye ? ` · reçu ${euros(s.paye)}` : ''}${s.etat === 'retard' ? ` · ${pluriel(s.joursRetard, 'jour')} de retard` : ''}${deja.length ? ` · ${R.LIB_PALIER[Math.max(...deja.map((r) => r.palier))].toLowerCase()} envoyé le ${dateCourte(deja[deja.length - 1].date)}` : ''}${remise ? ` · quittance remise le ${dateCourte(remise)}` : ''}</span></button>
      <span class="ech-montant"><b>${euros(s.reste || s.du)}</b><small>${s.reste ? (s.reste < s.du ? 'reste dû' : 'dû') : 'payé'}</small></span>
      <span class="ech-etat">${etiquetteEch(s)}</span>
      <span class="ech-actions">${actions.join('')}</span>
    </li>`;
  }

  // ---------- Aujourd'hui ----------
  function vueJour() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Aujourd'hui</h1><p>${dateLongue(t)} : les loyers à encaisser ou à relancer, les révisions, les dépôts et les charges à régulariser.</p></div>
        <div class="actions">${E.baux.length ? '<button class="btn primaire" data-action="vue" data-vue="loyers">Voir les loyers</button>' : ''}</div></div>`;
    if (!E.baux.length) return `${titre}${sansBail()}${AVERTISSEMENT}`;
    const mois = R.moisDe(t);
    const duMois = R.situations(E, t, mois).filter((s) => s.mois === mois);
    const attendu = duMois.reduce((s, x) => s + x.du, 0);
    const recu = duMois.reduce((s, x) => s + Math.min(x.paye, x.du), 0);
    const a = R.alertes(E, t);
    const totalImpaye = a.impayes.reduce((s, x) => s + x.reste, 0);
    const bil = R.bilan(E, Number(t.slice(0, 4)), t);
    const aDem = a.revisions.filter((r) => r.etat === 'aDemander').length;
    const tuiles = [
      ['Encaissé ce mois', euros(recu, { centimes: false }), `sur ${euros(attendu, { centimes: false })} attendus en ${nomMois(mois)}`, 'var(--bleu)', ''],
      ['Impayés', euros(totalImpaye, { centimes: false }), a.impayes.length ? `${pluriel(a.impayes.length, 'échéance')} en retard` : 'aucun loyer en retard', 'var(--rouge)', 'rond'],
      ['Révisions', String(aDem), `à demander · ${pluriel(a.revisions.length - aDem, 'autre')} sous 45 jours`, 'var(--jaune)', ''],
      ['Rendement net', bil.net === null ? '–' : pct(bil.net), `${t.slice(0, 4)}, avant impôts · brut ${bil.brut === null ? '–' : pct(bil.brut)}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const cartes = [];
    a.revisions.forEach((r) => {
      const b = bail(r.bail);
      cartes.push(`<article class="decision ${r.etat === 'aDemander' && r.joursRestants < 60 ? 'niv-depasse' : ''}">${etiquetteRev(r)}
        <button class="decision-corps" data-action="revision" data-id="${b.id}" data-date="${r.date}"><b>Révision · ${esc(nomBien(b.bien))}</b>
        <span class="decision-titre">${r.etat === 'aDemander' ? `Depuis le ${dateLongue(r.date)}, à demander avant le ${dateLongue(r.limite)}` : `Le ${dateLongue(r.date)}`}</span>
        <span>${r.manque ? `Indice IRL du ${R.libTrimestre(r.manque)} à saisir` : r.nouveau ? `${euros(r.loyer)} → ${euros(r.nouveau)} hors charges (IRL ${R.indice(r.irlAncien)} → ${R.indice(r.irlNouveau)})` : ''}</span></button></article>`);
    });
    a.depots.forEach((d) => {
      const b = bail(d.bail);
      cartes.push(`<article class="decision ${d.etat === 'enRetard' ? 'niv-depasse' : ''}"><span class="etiquette ${d.etat === 'enRetard' ? 'rouge' : 'jaune'}">${d.etat === 'enRetard' ? 'Dépôt en retard' : 'Dépôt à restituer'}</span>
        <button class="decision-corps" data-action="sortie" data-id="${b.id}"><b>Dépôt de garantie · ${esc(nomLocataire(b))}</b>
        <span class="decision-titre">${euros(d.aRendre)} à rendre ${d.etat === 'enRetard' ? `depuis le ${dateLongue(d.limite)}` : `avant le ${dateLongue(d.limite)}`}</span>
        <span>${esc(nomBien(b.bien))} · dépôt ${euros(b.depot)}${d.retenues ? `, retenues ${euros(d.retenues)}` : ''}</span></button></article>`);
    });
    a.regularisations.forEach((r) => {
      const b = bail(r.bail);
      cartes.push(`<article class="decision"><span class="etiquette ciel">Charges ${r.annee}</span>
        <button class="decision-corps" data-action="regularisation" data-id="${b.id}" data-annee="${r.annee}"><b>Régularisation · ${esc(nomBien(b.bien))}</b>
        <span class="decision-titre">${r.solde > 0 ? `Complément de ${euros(r.solde)} à demander` : r.solde < 0 ? `Trop-perçu de ${euros(-r.solde)} à rendre` : 'Provisions égales aux charges réelles'}</span>
        <span>${esc(nomLocataire(b))} · provisions ${euros(r.provisions)}, réel ${euros(r.reel)}</span></button></article>`);
    });
    a.finsBail.forEach((f) => {
      const b = bail(f.bail);
      cartes.push(`<article class="decision"><span class="etiquette sable">Fin de bail</span>
        <button class="decision-corps" data-action="bail" data-id="${b.id}"><b>${esc(nomBien(b.bien))}</b>
        <span class="decision-titre">Fin prévue le ${dateLongue(f.date)}, dans ${pluriel(f.jours, 'jour')}</span>
        <span>${esc(nomLocataire(b))} · ${esc(R.LIB_TYPE[b.type])}</span></button></article>`);
    });
    const restant = duMois.filter((s) => s.reste);
    const anciens = a.impayes.filter((s) => s.mois < mois);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${a.irlManquants.length ? `<p class="aide alerte-taux">Indice IRL à saisir pour calculer une révision : ${a.irlManquants.map((q) => R.libTrimestre(q)).join(', ')}. <button class="btn lien" data-action="nouvel-irl" data-trimestre="${a.irlManquants[0]}">Saisir l'indice</button></p>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Loyers de ${nomMois(mois)} <span>${restant.length ? `${euros(restant.reduce((s, x) => s + x.reste, 0))} restant à encaisser` : 'tout est encaissé'}</span></h2>
          ${duMois.length ? `<ul class="echeances">${[...duMois].sort((x, y) => (x.reste ? 0 : 1) - (y.reste ? 0 : 1) || x.date.localeCompare(y.date)).map(ligneEcheance).join('')}</ul>` : '<p class="aide">Aucun bail en cours ce mois-ci.</p>'}
          ${anciens.length ? `<h2 class="titre-section">Retards des mois précédents <span>${euros(anciens.reduce((s, x) => s + x.reste, 0))}</span></h2><ul class="echeances">${anciens.map(ligneEcheance).join('')}</ul>` : ''}
        </section>
        <section>
          <h2 class="titre-section">À faire <span>Révisions, dépôts, charges, fins de bail</span></h2>
          ${cartes.length ? `<div class="decisions">${cartes.join('')}</div>` : '<div class="vide-etat petit"><div><h3>Rien d\'autre à faire</h3><p>Aucune révision à demander, aucun dépôt à rendre, aucune régularisation en attente.</p></div></div>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Loyers ----------
  function vueLoyers() {
    const t = auj();
    const m = moisLoyers;
    const titre = `<div class="vue-tete"><div><h1>Loyers</h1><p>Une échéance par bail et par mois. Note chaque paiement reçu : la quittance (ou le reçu, si le paiement est partiel) est prête, et les retards se relancent au bon palier.</p></div>
      <div class="actions"><button class="btn petit" data-action="csv-echeances">Exporter (CSV)</button></div></div>`;
    if (!E.baux.length) return `${titre}${sansBail()}`;
    const nav = `<div class="nav-mois"><button class="btn petit" data-action="mois" data-n="-1" aria-label="Mois précédent">‹</button><h2>${nomMois(m)}</h2><button class="btn petit" data-action="mois" data-n="1" aria-label="Mois suivant">›</button>${m !== R.moisDe(t) ? '<button class="btn petit" data-action="mois" data-n="0">Ce mois-ci</button>' : ''}</div>`;
    const liste = E.baux.map((b) => R.echeance(b, m, E.reglages)).filter(Boolean).map((e) => R.situation(e, E.paiements, t, E.reglages)).sort((x, y) => x.date.localeCompare(y.date));
    const du = liste.reduce((s, x) => s + x.du, 0), paye = liste.reduce((s, x) => s + Math.min(x.paye, x.du), 0);
    const annee = Number(m.slice(0, 4));
    const moisA = R.moisAnnee(annee);
    const bauxA = E.baux.filter((b) => b.debut <= `${annee}-12-31` && R.finBail(b) >= `${annee}-01-01`);
    const symbole = { payee: '✓', retard: '!', partielle: '½', aujourdhui: '•', aVenir: '·' };
    const grille = bauxA.length ? `<div class="defile"><table class="tableau grille-loyers"><caption class="sr-only">Échéances de ${annee} par bail</caption><thead><tr><th>Bail</th>${moisA.map((x) => `<th class="nb">${moisCourt(x)}</th>`).join('')}</tr></thead><tbody>${bauxA.map((b) => `<tr><td class="gl-nom"><button class="btn lien" data-action="bail" data-id="${b.id}">${esc(nomBien(b.bien))}</button></td>${moisA.map((x) => {
      const e = R.echeance(b, x, E.reglages);
      if (!e) return '<td class="gl-case gl-vide"><span class="sr-only">pas d\'échéance</span></td>';
      const s = R.situation(e, E.paiements, t, E.reglages);
      return `<td class="gl-case gl-${s.etat} ${x === m ? 'gl-actif' : ''}"><button data-action="mois-aller" data-mois="${x}" title="${esc(`${nomMois(x)} · ${R.LIB_ECHEANCE[s.etat]} · ${euros(s.paye)} sur ${euros(s.du)}`)}"><span aria-hidden="true">${symbole[s.etat]}</span><span class="sr-only">${nomMois(x)} : ${R.LIB_ECHEANCE[s.etat]}</span></button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="legende-cal"><span class="pastille-l gl-payee"></span>Payé <span class="pastille-l gl-partielle"></span>Partiel <span class="pastille-l gl-retard"></span>En retard <span class="pastille-l gl-aVenir"></span>À venir · touche un mois pour l'afficher</p>` : '';
    const imp = R.impayes(E, t);
    return `${titre}${nav}
      <p class="resume-liste">${pluriel(liste.length, 'échéance')} · ${euros(paye)} encaissés sur ${euros(du)}</p>
      ${liste.length ? `<ul class="echeances">${liste.map(ligneEcheance).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucune échéance ce mois-ci</h3><p>Aucun bail n'est en cours en ${nomMois(m)}.</p></div></div>`}
      <h2 class="titre-section">L'année ${annee} <span>Une case par échéance</span></h2>
      ${grille}
      <h2 class="titre-section">Tous les impayés <span>${imp.length ? `${euros(imp.reduce((s, x) => s + x.reste, 0))} au total` : 'aucun'}</span></h2>
      ${imp.length ? `<ul class="echeances">${imp.map(ligneEcheance).join('')}</ul>` : `<p class="aide">Aucun loyer en retard. Les relances proposées suivent tes paliers (J+${E.reglages.relances.join(', J+')}).</p>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Baux ----------
  const FILTRES_BAUX = [['enCours', 'En cours'], ['aVenir', 'À venir'], ['termine', 'Terminés'], ['tous', 'Tous']];
  function vueBaux() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Biens et baux</h1><p>Tes logements, leurs baux successifs et ce que chacun prévoit : loyer et charges en vigueur, dépôt de garantie, révision, sortie du locataire.</p></div>
      <div class="actions">${E.biens.length < R.MAX_BIENS ? `<button class="btn" data-action="nouveau-bien">${ICONES.plus}Bien</button>` : ''}${E.biens.length ? `<button class="btn primaire" data-action="nouveau-bail">${ICONES.plus}Bail</button>` : ''}</div></div>`;
    const nb = (f) => E.baux.filter((b) => f === 'tous' || statutBail(b, t) === f).length;
    const filtres = `<div class="filtres" role="group" aria-label="Filtrer les baux">${FILTRES_BAUX.map(([id, lib]) => `<button class="filtre" data-action="filtre-baux" data-statut="${id}" aria-pressed="${filtreBaux.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>`;
    const blocs = E.biens.map((bn) => {
      const baux = E.baux.filter((b) => b.bien === bn.id).sort((x, y) => y.debut.localeCompare(x.debut));
      const vis = baux.filter((b) => filtreBaux.statut === 'tous' || statutBail(b, t) === filtreBaux.statut);
      const actif = baux.find((b) => R.actifLe(b, t));
      return `<section class="bien-bloc">
        <div class="bien-tete"><button class="lien-ligne" data-action="bien" data-id="${bn.id}"><b>${esc(bn.nom)}</b><span>${esc(bn.type)}${bn.surface ? ` · ${String(bn.surface).replace('.', ',')} m²` : ''}${bn.adresse ? ` · ${esc(bn.adresse)}` : ''}</span></button>
          <span class="etiquette ${actif ? 'vert' : 'rose'}">${actif ? 'Loué' : 'Vacant'}</span></div>
        ${vis.length ? `<ul class="lignes-fac">${vis.map((b) => ligneBail(b, t)).join('')}</ul>` : `<p class="aide">${baux.length ? 'Aucun bail dans ce filtre.' : 'Aucun bail pour ce bien.'} <button class="btn lien" data-action="nouveau-bail" data-bien="${bn.id}">Ajouter un bail</button></p>`}
      </section>`;
    }).join('');
    return `${titre}
      ${E.biens.length ? `<div class="outils-liste">${filtres}</div>${blocs}` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bien</h3><p>Ajoute ton premier logement.</p><div class="actions"><button class="btn primaire" data-action="nouveau-bien">${ICONES.plus}Ajouter un bien</button></div></div></div>`}
      <div class="rgpd"><h2>Données de tes locataires</h2><p>Garde le minimum utile : le nom qui figure sur la quittance. Pas de pièce d'identité, de justificatif de revenus ni de coordonnées bancaires ici. Après le départ d'un locataire, ouvre son bail pour <b>effacer ses données</b> (dates et montants restent pour tes comptes), ou efface d'un coup les anciens locataires dans les Réglages.</p></div>`;
  }

  function ligneBail(b, t) {
    const v = R.enVigueur(b, t < b.debut ? b.debut : t);
    const st = statutBail(b, t);
    const d = R.etatDepot(b, t);
    const ctl = R.controleDepot(b);
    const tags = [`<span class="etiquette ${st === 'enCours' ? 'ciel' : 'sable'}">${LIB_STATUT_BAIL[st]}</span>`, `<span class="etiquette sable">${esc(R.LIB_TYPE[b.type])}</span>`];
    if (ctl) tags.push('<span class="etiquette rouge">Dépôt à vérifier</span>');
    if (d.etat === 'aRestituer') tags.push('<span class="etiquette jaune">Dépôt à rendre</span>');
    if (d.etat === 'enRetard') tags.push('<span class="etiquette rouge">Dépôt en retard</span>');
    if (b.efface) tags.push('<span class="etiquette sable">Locataire effacé</span>');
    return `<li class="ligne-fac ${st === 'termine' ? 'st-termine' : ''}">
      <button class="ligne-info" data-action="bail" data-id="${b.id}">
        <b>${esc(nomLocataire(b))}</b>
        <span class="ligne-detail">Depuis le ${fmt(b.debut)}${b.fin ? ` jusqu'au ${fmt(b.fin)}` : b.finPrevue ? ` · fin prévue le ${fmt(b.finPrevue)}` : ''} · échéance le ${b.jourEcheance}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${euros(v.loyer + v.charges)}</b><small>${euros(v.loyer)} + ${euros(v.charges)} ${b.modeCharges === 'forfait' ? 'forfait' : 'provisions'}</small></span>
        <span class="ligne-proch">${b.depot ? `Dépôt ${euros(b.depot)}` : 'Sans dépôt'}</span>
      </div>
    </li>`;
  }

  // ---------- Révisions ----------
  function vueRevisions() {
    const t = auj();
    const z = zone();
    const titre = `<div class="vue-tete"><div><h1>Révisions</h1><p>Une fois par an, si le bail le prévoit : nouveau loyer = loyer × IRL du trimestre de référence ÷ IRL du même trimestre un an plus tôt. La demande au locataire doit partir dans l'année, sans effet rétroactif.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvel-irl">${ICONES.plus}Saisir un indice</button></div></div>`;
    const bauxActifs = E.baux.filter((b) => statutBail(b, t) !== 'termine');
    const cartes = bauxActifs.map((b) => {
      const r = R.revisionCourante(b, t, E.irl, z);
      if (!r) return `<article class="revision-carte"><div class="menage-tete"><span class="etiquette sable">Pas encore</span></div><button class="decision-corps" data-action="bail" data-id="${b.id}"><b>${esc(nomBien(b.bien))} · ${esc(nomLocataire(b))}</b><span>Première révision un an après le début du bail.</span></button></article>`;
      const hist = R.revisions(b, t, E.irl, z).filter((x) => x.date !== r.date && x.date <= t).reverse();
      const bloc = R.blocageRevision(b);
      return `<article class="revision-carte etat-${r.etat}">
        <div class="menage-tete">${etiquetteRev(r)}${r.retardIndice && r.etat === 'aDemander' ? '<span class="etiquette rose">Indice plus récent à saisir ?</span>' : ''}</div>
        <button class="decision-corps" data-action="revision" data-id="${b.id}" data-date="${r.date}"><b>${esc(nomBien(b.bien))} · ${esc(nomLocataire(b))}</b>
          <span class="decision-titre">${bloc ? esc(bloc) : r.etat === 'aDemander' ? `Révision du ${dateLongue(r.date)} · à demander avant le ${dateLongue(r.limite)}` : `Prochaine révision le ${dateLongue(r.date)}`}</span>
          <span>${bloc ? '' : r.manque ? `Indice du ${R.libTrimestre(r.manque)} non saisi` : r.nouveau ? `${euros(r.loyer)} → <b>${euros(r.nouveau)}</b> hors charges · IRL ${R.indice(r.irlAncien)} → ${R.indice(r.irlNouveau)} (+${pct(((r.nouveau - r.loyer) / r.loyer) * 100, 2)})` : ''}</span></button>
        ${hist.length ? `<details class="plus-tard"><summary>Révisions passées (${hist.length})</summary><ul class="mini-liste">${hist.map((x) => `<li><span>${fmt(x.date)} · ${R.LIB_REVISION[x.etat]}${x.fait?.statut === 'appliquee' ? ` · ${euros(x.fait.ancienLoyer)} → ${euros(x.fait.nouveauLoyer)} dès le ${fmt(x.fait.dateEffet)}` : ''}</span>${x.fait ? `<button type="button" class="btn petit" data-action="annuler-revision" data-id="${b.id}" data-date="${x.date}">Annuler</button>` : ''}</li>`).join('')}</ul></details>` : ''}
      </article>`;
    }).join('');
    const irl = E.irl.filter((x) => x.zone === z);
    return `${titre}
      ${bauxActifs.length ? `<div class="grille-relances">${cartes}</div>` : sansBail()}
      <h2 class="titre-section">Indices IRL saisis <span>${esc(B.zones.find(([id]) => id === z)?.[1] || z)} · valeurs publiées par l'Insee</span></h2>
      <p class="aide">${esc(B.sourceIrl)}${session.demo ? ' <b>Démo : indices fictifs, à ne pas utiliser.</b>' : ''}</p>
      ${irl.length ? `${tableIrl(irl.slice(0, 8), z)}${irl.length > 8 ? `<details class="plus-tard"><summary>Indices plus anciens (${irl.length - 8})</summary>${tableIrl(irl.slice(8), z)}</details>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucun indice saisi</h3><p>Ajoute l\'indice du trimestre de référence de tes baux, et celui du même trimestre un an plus tôt : le nouveau loyer se calcule.</p></div></div>'}
      <details class="plus-tard champs-aide" style="margin-top:20px"><summary>Repères légaux et sources</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([lb, u]) => `<li>${esc(lb)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      ${AVERTISSEMENT}`;
  }

  const tableIrl = (liste, z) => `<div class="defile"><table class="tableau irl"><thead><tr><th>Trimestre</th><th class="nb">Indice</th><th class="nb">Sur un an</th><th class="nb"><span class="sr-only">Action</span></th></tr></thead><tbody>${liste.map((x) => { const p = R.valeurIrl(E.irl, R.trimestrePrecedentAnnee(x.trimestre), z); return `<tr><td>${R.libTrimestre(x.trimestre)}</td><td class="nb"><b>${R.indice(x.valeur)}</b></td><td class="nb">${p ? pct(((x.valeur - p) / p) * 100, 2) : '–'}</td><td class="nb"><button class="btn petit" data-action="irl" data-trimestre="${x.trimestre}">Modifier</button></td></tr>`; }).join('')}</tbody></table></div>`;

  // ---------- Bilan ----------
  function vueBilan() {
    const t = auj();
    const a = anneeBilan;
    const s = R.bilan(E, a, t);
    const titre = `<div class="vue-tete"><div><h1>Bilan ${a}</h1><p>Ce que rapporte chaque bien : loyers hors charges, dépenses, rendement brut et net de charges (avant impôts et avant crédit), et la régularisation des charges de chaque bail.</p></div>
      <div class="actions"><button class="btn petit" data-action="annee" data-n="-1" aria-label="Année précédente">‹ ${a - 1}</button><button class="btn petit" data-action="annee" data-n="1" aria-label="Année suivante">${a + 1} ›</button><button class="btn primaire" data-action="nouvelle-depense">${ICONES.plus}Dépense</button></div></div>`;
    if (!E.biens.length) return `${titre}<div class="vide-etat petit"><div><h3>Aucun bien</h3><p>Ajoute un bien dans l'onglet Baux.</p></div></div>`;
    const tuiles = [
      ['Loyers hors charges', euros(s.loyers, { centimes: false }), `appelés en ${a} · ${euros(s.encaisse, { centimes: false })} encaissés, charges comprises`, 'var(--bleu)', ''],
      ['Dépenses', euros(s.recup + s.nonRecup, { centimes: false }), `dont ${euros(s.recup, { centimes: false })} récupérables sur les locataires`, 'var(--rouge)', 'rond'],
      ['Rendement brut', s.brut === null ? '–' : pct(s.brut), `loyers ÷ coût des biens (${euros(s.cout, { centimes: false })})`, 'var(--jaune)', ''],
      ['Rendement net', s.net === null ? '–' : pct(s.net), 'après charges non récupérables, avant impôts', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const parMois = R.moisAnnee(a).map((m) => ({ mois: m, montant: E.paiements.filter((p) => p.mois === m).reduce((x, p) => x + p.montant, 0) }));
    const regs = E.baux.map((b) => R.regularisation(E, b.id, a)).filter(Boolean);
    const deps = E.depenses.filter((d) => d.date.startsWith(`${a}-`)).sort((x, y) => y.date.localeCompare(x.date));
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Encaissé par mois <span>Loyers et charges reçus, rattachés à leur mois</span></h2>
      ${graphiqueMois(parMois, t)}
      <h2 class="titre-section">Par bien <span>${a}</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Bien</th><th class="nb">Loyers HC</th><th class="nb">Dépenses non récup.</th><th class="nb">Impayés</th><th class="nb">Jours sans bail</th><th class="nb">Brut</th><th class="nb">Net</th></tr></thead><tbody>${s.parBien.map((x) => `<tr><td><button class="btn lien" data-action="bien" data-id="${x.bien}">${esc(nomBien(x.bien))}</button></td><td class="nb">${euros(x.loyers)}</td><td class="nb">${euros(x.nonRecup)}</td><td class="nb">${x.impaye ? `<b class="texte-alerte">${euros(x.impaye)}</b>` : '–'}</td><td class="nb">${x.joursVacants}</td><td class="nb">${x.brut === null ? '–' : pct(x.brut)}</td><td class="nb"><b>${x.net === null ? '–' : pct(x.net)}</b></td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${euros(s.loyers)}</td><td class="nb">${euros(s.nonRecup)}</td><td class="nb">${euros(s.impaye)}</td><td class="nb"></td><td class="nb">${s.brut === null ? '–' : pct(s.brut)}</td><td class="nb">${s.net === null ? '–' : pct(s.net)}</td></tr></tfoot></table></div>
      ${E.biens.some((b) => !R.coutBien(b)) ? `<p class="aide alerte-taux">Prix d'achat non renseigné pour ${E.biens.filter((b) => !R.coutBien(b)).map((b) => esc(b.nom)).join(', ')} : son rendement n'est pas calculé. Ouvre le bien pour le saisir.</p>` : ''}
      <h2 class="titre-section">Régularisation des charges ${a} <span>Provisions appelées contre charges récupérables réelles, au prorata de l'occupation</span></h2>
      ${regs.length ? `<div class="grille-relances">${regs.map(carteRegularisation).join('')}</div>` : '<p class="aide">Aucun bail cette année.</p>'}
      <h2 class="titre-section">Dépenses ${a} <span>${pluriel(deps.length, 'dépense')} · ${euros(deps.reduce((x, d) => x + d.montant, 0))}</span></h2>
      ${deps.length ? `<div class="defile"><table class="tableau depenses"><thead><tr><th>Date</th><th>Dépense</th><th>Bien</th><th>Récupérable</th><th class="nb">Montant</th></tr></thead><tbody>${deps.map((d) => `<tr><td class="nb">${fmt(d.date, { day: 'numeric', month: 'short' })}</td><td><button class="btn lien" data-action="depense" data-id="${d.id}">${esc(categorie(d.categorie).nom)}</button>${d.note ? `<br><small>${esc(d.note)}</small>` : ''}</td><td>${esc(nomBien(d.bien))}</td><td>${d.recuperable ? '<span class="etiquette ciel">Oui</span>' : '<span class="etiquette sable">Non</span>'}</td><td class="nb"><b>${euros(d.montant)}</b></td></tr>`).join('')}</tbody></table></div>` : `<div class="vide-etat petit"><div><h3>Aucune dépense en ${a}</h3><p>Note la taxe foncière, l'assurance, les charges de copropriété et les travaux : le rendement net et la régularisation des charges en dépendent.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-depense">${ICONES.plus}Ajouter une dépense</button></div></div></div>`}
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv-depenses">Exporter les dépenses (CSV)</button><button class="btn petit" data-action="csv-echeances">Exporter les échéances (CSV)</button></div>
      <div class="rgpd"><h2>Et les impôts ?</h2><p>Tes loyers sont imposables. L'outil ne calcule aucun régime (micro-foncier, réel, location meublée) ni aucun abattement : il te donne les loyers, les charges et les dépenses par bien et par an, à reporter ou à transmettre à ton comptable. Fais vérifier ta situation par un professionnel ou sur impots.gouv.fr.</p></div>
      ${AVERTISSEMENT}`;
  }

  function carteRegularisation(r) {
    const b = bail(r.bail);
    if (r.forfait) return `<article class="relance-carte"><span class="etiquette sable">Forfait</span><b>${esc(nomBien(b.bien))} · ${esc(nomLocataire(b))}</b><span class="mention">Charges au forfait : pas de régularisation.</span></article>`;
    return `<article class="relance-carte ${r.faite ? '' : 'due'}"><span class="etiquette ${r.faite ? 'vert' : r.solde > 0 ? 'jaune' : r.solde < 0 ? 'ciel' : 'sable'}">${r.faite ? `Faite le ${dateCourte(r.faite.date)}` : r.solde > 0 ? 'Complément' : r.solde < 0 ? 'Trop-perçu' : 'Équilibrée'}</span>
      <button class="decision-corps" data-action="regularisation" data-id="${b.id}" data-annee="${r.annee}"><b>${esc(nomBien(b.bien))} · ${esc(nomLocataire(b))}</b>
      <span class="decision-titre">${r.solde > 0 ? `${euros(r.solde)} à demander` : r.solde < 0 ? `${euros(-r.solde)} à rendre` : 'Rien à demander ni à rendre'}</span>
      <span>Provisions ${euros(r.provisions)} · réel ${euros(r.reel)} (${r.jours} j sur ${r.joursAnnee})</span></button></article>`;
  }

  // Encaissé par mois : une seule série (bleu), valeur au-dessus du plus haut mois, infobulle au survol.
  function graphiqueMois(mois, t) {
    const max = Math.max(...mois.map((m) => m.montant), 1);
    const iMax = mois.findIndex((m) => m.montant === max);
    const cols = mois.map((m, i) => `<div class="col-proj ${i === iMax ? 'max' : ''} ${m.mois === t.slice(0, 7) ? 'actif' : ''}" tabindex="0" aria-label="${esc(`${nomMois(m.mois)} : ${euros(m.montant)}`)}" data-info="${esc(`<b>${nomMois(m.mois)}</b>Encaissé ${euros(m.montant)}`)}">
        <span class="cp-val">${m.montant ? euros(m.montant, { centimes: false }) : ''}</span>
        <span class="cp-zone"><span class="cp-barre" style="height:${m.montant > 0 ? Math.max(2, (m.montant / max) * 100) : 0}%"></span></span>
        <span class="cp-mois">${moisCourt(m.mois)}</span>
      </div>`).join('');
    return `<figure class="graphique"><div class="projection">${cols}</div><div class="infobulle" hidden></div></figure>`;
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
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight + 24)}px`;
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const champMontant = (nom, lib, v, aide = '', req = false) => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" ${req ? 'required' : ''} value="${R.saisieMontant(v)}" placeholder="0,00"></label>`;
  const lireOpt = (fd, k) => (String(fd.get(k) || '').trim() ? R.lireMontant(fd.get(k)) : 0);

  // Copier un texte (zone de texte de la modale) dans le presse-papiers.
  async function copier(sel = '#texte-copie') {
    const zoneTexte = $(sel);
    if (!zoneTexte) return;
    try { await navigator.clipboard.writeText(zoneTexte.value); toast('Texte copié : colle-le dans ta messagerie ou ton traitement de texte.'); } catch { zoneTexte.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }
  const zoneCopie = (texte, lignes = 12, lib = 'Texte') => `<label class="champ">${lib} <small>Modifiable avant de copier. Rien n'est envoyé : colle-le dans ta messagerie ou ton courrier.</small><textarea id="texte-copie" rows="${lignes}">${esc(texte)}</textarea></label><div class="rang"><button class="btn" type="button" data-action="copier">Copier le texte</button></div>`;

  // ----- Bien -----
  function modaleBien(id) {
    const b = id ? bien(id) : null;
    if (!b && E.biens.length >= R.MAX_BIENS) { toast(`${R.MAX_BIENS} biens au plus.`); return; }
    const v = b || { nom: '', adresse: '', type: 'Appartement', surface: null, prixAchat: 0, fraisAchat: 0, travaux: 0, dateAchat: null, note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom du bien<input name="nom" maxlength="60" required value="${esc(v.nom)}" placeholder="Ex. : T2 centre-ville"></label>
        <label class="champ">Type<select name="type">${B.typesBien.map((x) => `<option ${x === v.type ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Adresse <small>Elle figure sur les quittances.</small><input name="adresse" maxlength="160" value="${esc(v.adresse)}"></label>
      <div class="rang-champs">
        <label class="champ">Surface (m²)<input name="surface" inputmode="decimal" value="${v.surface ? String(v.surface).replace('.', ',') : ''}"></label>
        <label class="champ">Date d'achat<input type="date" name="dateAchat" value="${v.dateAchat || ''}"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Coût du bien <small>Pour le rendement : prix, frais d'achat (notaire, agence) et travaux.</small></legend>
        <div class="rang-champs">${champMontant('prixAchat', 'Prix d\'achat', v.prixAchat)}${champMontant('fraisAchat', 'Frais d\'achat', v.fraisAchat)}${champMontant('travaux', 'Travaux', v.travaux)}</div></fieldset>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${b ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${b ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(b ? 'Bien' : 'Nouveau bien', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!R.peutSupprimerBien(E, b.id)) return 'Ce bien a des baux ou des dépenses : supprime-les d\'abord, ou garde le bien.';
        if (!confirm(`Supprimer le bien « ${b.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.biens = E.biens.filter((x) => x.id !== b.id);
        sauver(); rendre(); toast(`« ${b.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au bien.';
      const montants = ['prixAchat', 'fraisAchat', 'travaux'].map((k) => lireOpt(fd, k));
      if (montants.includes(null)) return 'Montant illisible : écris par exemple 150 000,00.';
      const surf = String(fd.get('surface') || '').trim() ? Number(String(fd.get('surface')).replace(',', '.')) : null;
      if (surf !== null && !(surf > 0 && surf < 10000)) return 'Surface illisible.';
      retenir();
      const d = R.normaliserBien({ id: b?.id || uid(), nom, type: fd.get('type'), adresse: String(fd.get('adresse') || '').trim(), surface: surf, prixAchat: montants[0], fraisAchat: montants[1], travaux: montants[2], dateAchat: fd.get('dateAchat'), note: String(fd.get('note') || '').trim() });
      if (b) Object.assign(b, d); else E.biens.push(d);
      sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Bail (création, modification) -----
  function modaleBail(id, { bienId = '' } = {}) {
    const t = auj();
    const b = id ? bail(id) : null;
    if (id && !b) return;
    if (!E.biens.length) { modaleBien(null); return; }
    const v = b || { bien: bienId || E.biens[0].id, locataires: '', type: 'vide', debut: t, fin: null, finPrevue: null, loyer: null, charges: 0, modeCharges: 'provision', jourEcheance: 1, depot: null, revision: { clause: true, trimestre: Math.ceil(Number(t.slice(5, 7)) / 3), date: null, dpeFG: false }, note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Bien<select name="bien">${E.biens.map((x) => `<option value="${x.id}" ${x.id === v.bien ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Type de bail<select name="type" id="b-type">${R.TYPES.map((x) => `<option value="${x}" ${x === v.type ? 'selected' : ''}>${esc(R.LIB_TYPE[x])}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Locataire(s) <small>Le nom qui figure sur la quittance, rien de plus.</small><input name="locataires" maxlength="120" value="${esc(v.locataires)}" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Début<input type="date" name="debut" required value="${v.debut}"></label>
        <label class="champ">Fin prévue <small>Facultative (rappel).</small><input type="date" name="finPrevue" value="${v.finPrevue || ''}"></label>
        <label class="champ">Jour d'échéance<input type="number" name="jourEcheance" min="1" max="31" value="${v.jourEcheance}"></label>
      </div>
      ${b ? '<p class="mention">Le loyer et les charges ci-dessous sont ceux du début du bail. Pour un changement en cours de bail (révision, nouvelles provisions), utilise « Changer le loyer ou les charges » dans le détail du bail.</p>' : ''}
      <div class="rang-champs">
        ${champMontant('loyer', b ? 'Loyer initial hors charges' : 'Loyer hors charges', v.loyer, 'par mois', true)}
        ${champMontant('charges', b ? 'Charges initiales' : 'Charges', v.charges, 'par mois')}
      </div>
      <fieldset class="champ"><legend>Charges <small>Provisions : régularisées chaque année sur le réel. Forfait : aucune régularisation.</small></legend><div class="choix-statut deux">${[['provision', 'Provisions'], ['forfait', 'Forfait']].map(([k, l]) => `<label><input type="radio" name="modeCharges" value="${k}" ${v.modeCharges === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      ${champMontant('depot', 'Dépôt de garantie', v.depot, '<span id="b-depot-max"></span>')}
      <fieldset class="champ cadre-champs" id="b-revision"><legend>Révision annuelle <small>Indice de référence des loyers (IRL).</small></legend>
        <label class="case"><input type="checkbox" name="clause" ${v.revision.clause ? 'checked' : ''}> Le bail prévoit une révision annuelle</label>
        <div class="rang-champs">
          <label class="champ">Trimestre de référence de l'IRL<select name="trimestre">${[1, 2, 3, 4].map((q) => `<option value="${q}" ${v.revision.trimestre === q ? 'selected' : ''}>${q}${q === 1 ? 'er' : 'e'} trimestre</option>`).join('')}</select></label>
          <label class="champ">Date de révision <small>Vide : anniversaire du bail.</small><input name="dateRevision" maxlength="5" placeholder="JJ/MM" value="${v.revision.date ? `${v.revision.date.slice(3)}/${v.revision.date.slice(0, 2)}` : ''}"></label>
        </div>
        <label class="case"><input type="checkbox" name="dpeFG" ${v.revision.dpeFG ? 'checked' : ''}> Logement classé F ou G au DPE (révision interdite, voir les repères)</label>
      </fieldset>
      <label class="champ">Note <small>Facultative. Évite les informations personnelles inutiles.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = b
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(b ? 'Modifier le bail' : 'Nouveau bail', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const n = E.paiements.filter((p) => p.bail === b.id).length;
        if (!confirm(`Supprimer le bail de ${nomLocataire(b)}${n ? ` et ses ${pluriel(n, 'paiement')}` : ''} ? Pour un locataire parti, indique plutôt sa sortie.`)) { garderOuverte(); return; }
        retenir();
        E.baux = E.baux.filter((x) => x.id !== b.id);
        E.paiements = E.paiements.filter((p) => p.bail !== b.id);
        sauver(); rendre(); toast('Bail supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const debut = fd.get('debut');
      if (!R.estDate(debut)) return 'Indique la date de début du bail.';
      const loyer = R.lireMontant(fd.get('loyer'));
      if (!loyer) return 'Loyer illisible : écris par exemple 650,00.';
      const charges = lireOpt(fd, 'charges'), depot = lireOpt(fd, 'depot');
      if (charges === null) return 'Charges illisibles : écris par exemple 50,00.';
      if (depot === null) return 'Dépôt illisible : écris par exemple 650,00.';
      const jour = Math.round(Number(fd.get('jourEcheance')));
      if (!(jour >= 1 && jour <= 31)) return 'Le jour d\'échéance va de 1 à 31.';
      const dr = String(fd.get('dateRevision') || '').trim();
      let dateRev = null;
      if (dr) {
        const m = /^(\d{1,2})\s*[/.-]\s*(\d{1,2})$/.exec(dr);
        if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 1 || Number(m[1]) > R.joursDansMois(2024, Number(m[2]))) return 'Date de révision illisible : écris par exemple 01/07.';
        dateRev = `${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
      }
      const type = fd.get('type');
      const candidat = R.normaliserBail({ ...(b || {}), id: b?.id || 'nouveau', bien: fd.get('bien'), locataires: String(fd.get('locataires') || '').trim(), type, debut, finPrevue: fd.get('finPrevue'), loyer, charges, modeCharges: fd.get('modeCharges'), jourEcheance: jour, depot,
        revision: { clause: !!fd.get('clause'), trimestre: Number(fd.get('trimestre')), date: dateRev, dpeFG: !!fd.get('dpeFG') }, note: String(fd.get('note') || '').trim() }, t);
      if (type === 'mobilite' && depot > 0) return 'Dépôt de garantie interdit en bail mobilité : laisse le champ vide.';
      const ctl = R.controleDepot(candidat);
      if (ctl) return ctl;
      if (candidat.fin && candidat.fin < debut) return 'La fin du bail précède son début.';
      const ch = R.chevauchementBail(E, candidat);
      if (ch) return `Ce bien est déjà loué à ${nomLocataire(ch)} sur cette période (depuis le ${fmt(ch.debut)}${ch.fin ? ` jusqu'au ${fmt(ch.fin)}` : ''}). Indique d'abord la sortie de ce locataire.`;
      retenir();
      if (b) majBail({ ...candidat, id: b.id }); else E.baux.push({ ...candidat, id: uid() });
      sauver(); rendre();
      toast(b ? 'Bail enregistré.' : `Bail ajouté : ${nomBien(candidat.bien)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const majType = () => {
      const tp = f.type.value;
      const mob = tp === 'mobilite';
      f.depot.disabled = mob;
      if (mob) { f.depot.value = ''; f.querySelector('[name=modeCharges][value=forfait]').checked = true; f.clause.checked = false; }
      f.clause.disabled = mob;
      const l = R.lireMontant(f.loyer.value);
      $('#b-depot-max').textContent = mob ? 'Interdit en bail mobilité.' : `Au plus ${R.DEPOT_MAX[tp]} mois de loyer hors charges${l ? `, soit ${euros(R.DEPOT_MAX[tp] * l)}` : ''}.`;
    };
    f.type.addEventListener('change', majType);
    f.loyer.addEventListener('input', majType);
    majType();
  }

  // ----- Détail d'un bail -----
  function modaleDetailBail(id) {
    const t = auj();
    const b = bail(id);
    if (!b) return;
    const bn = bien(b.bien);
    const v = R.enVigueur(b, b.debut > t ? b.debut : t);
    const situ = R.echeances(b, R.moisDe(t), E.reglages).map((e) => R.situation(e, E.paiements, t, E.reglages));
    const retard = situ.filter((s) => s.etat === 'retard');
    const r = R.revisionCourante(b, t, E.irl, zone());
    const dep = R.etatDepot(b, t);
    const ctl = R.controleDepot(b);
    const hist = [{ date: b.debut, loyer: b.loyer, charges: b.charges, motif: 'Début du bail' }, ...[...b.historique].sort((x, y) => x.date.localeCompare(y.date))];
    const corps = `
      <div class="resume-facture">
        <div><span>Bien</span><b><button type="button" class="btn lien" data-action="bien" data-id="${b.bien}">${esc(bn?.nom || 'Bien supprimé')}</button></b><small>${esc(bn?.adresse || '')}</small></div>
        <div><span>Bail</span><b>${esc(R.LIB_TYPE[b.type])}</b><small>${LIB_STATUT_BAIL[statutBail(b, t)]} · depuis le ${fmt(b.debut)}${b.fin ? `, jusqu'au ${fmt(b.fin)}` : ''}</small></div>
        <div><span>Loyer en vigueur</span><b>${euros(v.loyer + v.charges)}</b><small>${euros(v.loyer)} + ${euros(v.charges)} ${b.modeCharges === 'forfait' ? 'de forfait' : 'de provisions'} · le ${b.jourEcheance} du mois</small></div>
        <div><span>Paiements</span><b>${retard.length ? `${euros(retard.reduce((s, x) => s + x.reste, 0))} en retard` : 'À jour'}</b><small>${pluriel(situ.filter((s) => s.etat === 'payee').length, 'échéance payée', 'échéances payées')} sur ${situ.length}</small></div>
      </div>
      ${b.note ? `<p class="aide">${esc(b.note)}</p>` : ''}
      <section class="bloc-detail"><h3>Loyer et charges <span>${pluriel(hist.length, 'montant')}</span></h3>
        <ul class="mini-liste">${hist.map((h, i) => `<li><span>${fmt(h.date)} · ${esc(h.motif || 'Changement')}</span><b>${euros(h.loyer)} + ${euros(h.charges)}</b>${i ? `<button type="button" class="btn-suppr" data-action="suppr-changement" data-id="${b.id}" data-date="${h.date}" aria-label="Supprimer ce changement">×</button>` : ''}</li>`).join('')}</ul>
        <div class="rang"><button type="button" class="btn petit" data-action="changement" data-id="${b.id}">${ICONES.plus}Changer le loyer ou les charges</button></div>
      </section>
      <section class="bloc-detail"><h3>Révision <span>${r ? R.LIB_REVISION[r.etat] : 'pas encore'}</span></h3>
        <p class="mention">${R.blocageRevision(b) ? esc(R.blocageRevision(b)) : r ? `Trimestre de référence : ${b.revision.trimestre}${b.revision.trimestre === 1 ? 'er' : 'e'}. ${r.etat === 'aDemander' ? `À demander avant le ${fmt(r.limite)}.` : `Prochaine le ${fmt(r.date)}.`}` : 'Première révision un an après le début du bail.'}</p>
        ${r && !R.blocageRevision(b) ? `<div class="rang"><button type="button" class="btn petit" data-action="revision" data-id="${b.id}" data-date="${r.date}">Voir la révision</button></div>` : ''}
      </section>
      <section class="bloc-detail"><h3>Dépôt de garantie <span>${b.depot ? euros(b.depot) : 'aucun'}</span></h3>
        ${ctl ? `<p class="aide alerte-taux">${esc(ctl)}</p>` : ''}
        <p class="mention">${b.type === 'mobilite' ? 'Interdit en bail mobilité.' : `Maximum : ${R.DEPOT_MAX[b.type]} mois de loyer hors charges (${euros(R.depotMax(b))}).`} ${dep.etat === 'conserve' ? 'Conservé jusqu\'à la sortie du locataire.' : dep.etat === 'aRestituer' ? `À rendre avant le ${fmt(dep.limite)} : ${euros(dep.aRendre)}.` : dep.etat === 'enRetard' ? `À rendre depuis le ${fmt(dep.limite)} : ${euros(dep.aRendre)}.` : dep.etat === 'restitue' ? `Restitué le ${fmt(b.sortie.restitueLe)} : ${euros(dep.restitue)}.` : ''}</p>
      </section>
      <section class="bloc-detail"><h3>Sortie du locataire <span>${b.sortie.remiseCles ? `clés rendues le ${dateCourte(b.sortie.remiseCles)}` : ''}</span></h3>
        <div class="rang"><button type="button" class="btn petit" data-action="sortie" data-id="${b.id}">${b.sortie.remiseCles ? 'Voir la sortie et le dépôt' : 'Indiquer la sortie'}</button></div>
      </section>
      <section class="bloc-detail"><h3>Données du locataire</h3>
        <p class="mention">Effacer remplace le nom par « Locataire effacé » et vide la note. Dates, loyers et paiements restent pour tes comptes.</p>
        <div class="rang"><button type="button" class="btn petit" data-action="effacer-locataire" data-id="${b.id}" ${b.efface ? 'disabled' : ''}>Effacer le locataire</button></div></section>`;
    ouvrirModale(esc(nomLocataire(b)), corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier-bail" data-id="${b.id}">Modifier</button>`);
  }

  // Changement de loyer ou de charges en cours de bail (nouvelles provisions, avenant).
  function modaleChangement(id) {
    const t = auj();
    const b = bail(id);
    if (!b) return;
    const v = R.enVigueur(b, t < b.debut ? b.debut : t);
    ouvrirModale(`Changer le loyer · ${esc(nomLocataire(b))}`, `
      <p class="mention">S'applique aux échéances à partir de cette date. Pour la révision annuelle, passe plutôt par l'onglet Révisions : le calcul et la lettre sont prêts.</p>
      <label class="champ">À partir du<input type="date" name="date" required value="${t}"></label>
      <div class="rang-champs">${champMontant('loyer', 'Loyer hors charges', v.loyer, '', true)}${champMontant('charges', 'Charges', v.charges)}</div>
      <label class="champ">Motif<input name="motif" maxlength="80" value="Nouvelles provisions pour charges"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const date = fd.get('date');
      if (!R.estDate(date) || date <= b.debut) return 'La date doit suivre le début du bail.';
      const loyer = R.lireMontant(fd.get('loyer')), charges = lireOpt(fd, 'charges');
      if (!loyer || charges === null) return 'Montant illisible : écris par exemple 650,00.';
      retenir();
      majBail({ ...b, historique: [...b.historique.filter((h) => h.date !== date), { date, loyer, charges, motif: String(fd.get('motif') || '').trim() || 'Changement' }] });
      sauver(); rendre(); garderOuverte(); modaleDetailBail(b.id);
      toast(`Nouveau montant à partir du ${fmt(date)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Encaissement -----
  function modaleEncaisser(id, mois) {
    const t = auj();
    const b = bail(id);
    const e = b && R.echeance(b, mois, E.reglages);
    if (!e) return;
    const s = R.situation(e, E.paiements, t, E.reglages);
    const pmts = E.paiements.filter((p) => p.bail === id && p.mois === mois);
    ouvrirModale(`Encaisser · ${esc(nomBien(b.bien))}`, `
      <p>${esc(nomLocataire(b))}, ${nomMois(mois)} : <b>${euros(e.du)}</b> (${euros(e.loyer)} de loyer + ${euros(e.charges)} de charges). Reste à recevoir : <b>${euros(s.reste)}</b>.</p>
      ${pmts.length ? `<ul class="mini-liste">${pmts.map((p) => `<li><span>${fmt(p.date)}${p.note ? ` · ${esc(p.note)}` : ''}</span><b>${euros(p.montant)}</b><button type="button" class="btn-suppr" data-action="suppr-paiement" data-id="${p.id}" aria-label="Supprimer ce paiement">×</button></li>`).join('')}</ul>` : ''}
      <div class="rang-champs">
        ${champMontant('montant', 'Montant reçu', s.reste || e.du, '', true)}
        <label class="champ">Date du paiement<input type="date" name="date" required value="${t < e.date ? t : t}"></label>
      </div>
      <label class="champ">Note <small>Facultative (virement, chèque…).</small><input name="note" maxlength="120"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const mt = R.lireMontant(fd.get('montant'));
      if (!mt) return 'Montant illisible : écris par exemple 650,00.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date du paiement.';
      retenir();
      E.paiements.push({ id: uid(), bail: id, mois, date: fd.get('date'), montant: mt, note: String(fd.get('note') || '').trim() });
      sauver(); rendre();
      const s2 = R.situation(e, E.paiements, t, E.reglages);
      toast(s2.reste ? `Paiement de ${euros(mt)} noté : reste ${euros(s2.reste)}. Un reçu est prêt.` : `${nomMois(mois)} payé : la quittance est prête.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Quittance ou reçu -----
  function documentHtml(d) {
    const q = d.type === 'quittance';
    const chargesLib = d.modeCharges === 'forfait' ? 'Forfait de charges' : 'Provisions pour charges';
    return `<article class="quittance">
      <h3>${q ? 'Quittance de loyer' : 'Reçu de paiement partiel'}</h3>
      <p class="q-periode">Période du ${dateLongue(d.periodeDebut)} au ${dateLongue(d.periodeFin)}</p>
      <div class="q-parties"><div><span>Bailleur</span><b>${esc(d.bailleur || '[nom du bailleur]')}</b><small>${esc(d.bailleurAdresse)}</small></div><div><span>Locataire</span><b>${esc(d.locataire || '[locataire]')}</b><small>${esc(d.adresse || d.bien)}</small></div></div>
      <p>${q
        ? `Je soussigné(e) ${esc(d.bailleur || '[nom du bailleur]')}, bailleur du logement situé ${esc(d.adresse || d.bien)}, déclare avoir reçu de ${esc(d.locataire || '[locataire]')} la somme de <b>${euros(d.du)}</b> au titre du loyer et des charges de la période ci-dessus, et lui en donne quittance.`
        : `Je soussigné(e) ${esc(d.bailleur || '[nom du bailleur]')}, bailleur du logement situé ${esc(d.adresse || d.bien)}, déclare avoir reçu de ${esc(d.locataire || '[locataire]')} la somme de <b>${euros(d.paye)}</b> en paiement partiel du loyer et des charges de la période ci-dessus. Reste dû : <b>${euros(d.reste)}</b>. Ce reçu ne vaut pas quittance.`}</p>
      <table class="q-detail"><tbody><tr><td>Loyer hors charges</td><td>${euros(d.loyer)}</td></tr><tr><td>${chargesLib}</td><td>${euros(d.charges)}</td></tr><tr class="q-total"><td>Total de l'échéance</td><td>${euros(d.du)}</td></tr>${q ? '' : `<tr><td>Reçu</td><td>${euros(d.paye)}</td></tr><tr class="q-total"><td>Reste dû</td><td>${euros(d.reste)}</td></tr>`}</tbody></table>
      <p class="q-pied">${d.paiements.length === 1 ? `Paiement reçu le ${dateLongue(d.paiements[0].date)}.` : `Paiements reçus les ${d.paiements.map((p) => `${dateCourte(p.date)} (${euros(p.montant)})`).join(', ')}.`}<br>Fait à ____________________, le ${dateLongue(auj())}.<br>Signature :</p>
    </article>`;
  }
  function documentTexte(d) {
    const q = d.type === 'quittance';
    const adr = d.adresse || d.bien;
    return [q ? 'QUITTANCE DE LOYER' : 'REÇU DE PAIEMENT PARTIEL', `Période du ${dateLongue(d.periodeDebut)} au ${dateLongue(d.periodeFin)}`, '',
      `Bailleur : ${d.bailleur || '[nom du bailleur]'}${d.bailleurAdresse ? `, ${d.bailleurAdresse}` : ''}`, `Locataire : ${d.locataire || '[locataire]'}`, `Logement : ${adr}`, '',
      q ? `Je soussigné(e) ${d.bailleur || '[nom du bailleur]'}, bailleur du logement situé ${adr}, déclare avoir reçu de ${d.locataire || '[locataire]'} la somme de ${euros(d.du)} au titre du loyer et des charges de la période ci-dessus, et lui en donne quittance.`
        : `Je soussigné(e) ${d.bailleur || '[nom du bailleur]'}, bailleur du logement situé ${adr}, déclare avoir reçu de ${d.locataire || '[locataire]'} la somme de ${euros(d.paye)} en paiement partiel du loyer et des charges de la période ci-dessus. Reste dû : ${euros(d.reste)}. Ce reçu ne vaut pas quittance.`,
      '', `Loyer hors charges : ${euros(d.loyer)}`, `${d.modeCharges === 'forfait' ? 'Forfait de charges' : 'Provisions pour charges'} : ${euros(d.charges)}`, `Total de l'échéance : ${euros(d.du)}`, ...(q ? [] : [`Reçu : ${euros(d.paye)}`, `Reste dû : ${euros(d.reste)}`]),
      '', `Fait le ${dateLongue(auj())}.`].join('\n');
  }
  function modaleDocument(id, mois) {
    const t = auj();
    const d = R.documentPaiement(E, id, mois, t);
    if (!d) return;
    const cle = `${id}|${mois}`;
    const remise = E.quittances[cle];
    ouvrirModale(d.type === 'quittance' ? `Quittance · ${nomMois(mois)}` : `Reçu · ${nomMois(mois)}`, `
      ${!E.reglages.bailleurNom ? '<p class="aide alerte-taux">Ton nom de bailleur n\'est pas renseigné. <button type="button" class="btn lien" data-action="reglages">Le saisir dans les Réglages</button></p>' : ''}
      <div id="doc-apercu">${documentHtml(d)}</div>
      <p class="mention">La quittance est remise gratuitement au locataire qui la demande ; par e-mail, seulement avec son accord (service-public.gouv.fr, F35247). ${remise ? `<b>Remise le ${fmt(remise)}.</b>` : ''}</p>
      <details class="plus-tard"><summary>Version texte à copier</summary>${zoneCopie(documentTexte(d), 14, 'Texte')}</details>`,
    `<button class="btn primaire" type="button" data-action="imprimer-document">Imprimer ou PDF</button><button class="btn" type="button" data-action="quittance-remise" data-id="${id}" data-mois="${mois}">${remise ? 'Remise annulée' : 'Noter comme remise'}</button><button class="btn gauche" value="annuler">Fermer</button>`);
  }

  // Impression : seul le document est imprimé (le reste de la page est masqué).
  function imprimer(html) {
    let zoneImp = $('#impression');
    if (!zoneImp) { zoneImp = document.createElement('div'); zoneImp.id = 'impression'; document.body.appendChild(zoneImp); }
    zoneImp.innerHTML = html;
    document.body.classList.add('imprimer');
    setTimeout(() => window.print(), 60);
  }
  window.addEventListener('afterprint', () => document.body.classList.remove('imprimer'));

  // ----- Relance -----
  function varsBail(b, extra = {}) {
    const bn = bien(b.bien);
    return { locataire: nomLocataire(b), bailleur: E.reglages.bailleurNom, bailleurAdresse: E.reglages.bailleurAdresse, bien: bn?.nom || '', bienAdresse: bn?.adresse || bn?.nom || '', aujourdhui: dateLongue(auj()), ...extra };
  }
  function modaleRelance(id, mois, palierChoisi) {
    const t = auj();
    const b = bail(id);
    const e = b && R.echeance(b, mois, E.reglages);
    if (!e) return;
    const s = R.situation(e, E.paiements, t, E.reglages);
    const palier = palierChoisi || Math.max(1, s.palier);
    const imp = R.impayes(E, t).filter((x) => x.bail === id);
    const modele = [null, B.modeles.rappel, B.modeles.relance, B.modeles.miseEnDemeure][palier];
    const texte = R.remplir(modele.texte, varsBail(b, { mois: nomMois(mois), du: euros(e.du), reste: euros(s.reste), echeance: dateLongue(e.date), jours: s.joursRetard,
      resteTotal: euros(imp.reduce((x, y) => x + y.reste, 0)), detailImpayes: imp.map((x) => `- ${nomMois(x.mois)} (échéance du ${dateLongue(x.date)}) : ${euros(x.reste)}`).join('\n') }));
    const deja = E.relancesFaites.filter((r) => r.bail === id && r.mois === mois);
    ouvrirModale(`Relance · ${esc(nomLocataire(b))}`, `
      <p>${nomMois(mois)} : <b>${euros(s.reste)}</b> restant dû depuis le ${dateLongue(e.date)} (${pluriel(s.joursRetard, 'jour')} de retard). Palier proposé : <b>${R.LIB_PALIER[Math.max(1, s.palier)]}</b> (J+${E.reglages.relances[Math.max(1, s.palier) - 1]}).</p>
      <fieldset class="champ"><legend>Modèle</legend><div class="choix-statut">${[1, 2, 3].map((p) => `<label><input type="radio" name="palier" value="${p}" ${p === palier ? 'checked' : ''} data-action="palier" data-id="${id}" data-mois="${mois}"><span>${R.LIB_PALIER[p]}</span></label>`).join('')}</div></fieldset>
      ${deja.length ? `<p class="mention">Déjà noté : ${deja.map((r) => `${R.LIB_PALIER[r.palier].toLowerCase()} le ${fmt(r.date)}`).join(', ')}.</p>` : ''}
      ${zoneCopie(texte, palier === 3 ? 18 : 11, 'Message')}
      <p class="mention">Aucune pénalité ni frais de retard ne peuvent être facturés au locataire (service-public.gouv.fr, F2889). Pour une mise en demeure, la lettre recommandée avec avis de réception laisse une trace. Si les difficultés durent, l'ADIL de ton département peut t'orienter.</p>`,
    `<button class="btn primaire" type="button" data-action="relance-envoyee" data-id="${id}" data-mois="${mois}" data-palier="${palier}">Noter comme envoyée</button><button class="btn gauche" value="annuler">Fermer</button>`);
  }

  // ----- Révision -----
  function modaleRevision(id, date) {
    const t = auj();
    const b = bail(id);
    if (!b) return;
    const r = R.revisions(b, t, E.irl, zone()).find((x) => x.date === date) || R.revisionCourante(b, t, E.irl, zone());
    if (!r) return;
    const bloc = R.blocageRevision(b);
    const v = R.enVigueur(b, r.date);
    const peutAppliquer = !bloc && !r.fait && !r.manque && r.nouveau && r.etat !== 'perdue';
    const lettre = peutAppliquer ? R.remplir(B.modeles.revision.texte, varsBail(b, { dateRevision: dateLongue(r.date), ancienLoyer: euros(r.loyer), nouveauLoyer: euros(r.nouveau), irlNouveau: R.indice(r.irlNouveau), irlAncien: R.indice(r.irlAncien), trimestreNouveau: R.libTrimestre(r.trimestreNouveau), trimestreAncien: R.libTrimestre(r.trimestreAncien), dateEffet: dateLongue(r.date > t ? r.date : t), charges: euros(v.charges) })) : '';
    const corps = `
      <div class="resume-facture">
        <div><span>Date de révision</span><b>${fmt(r.date)}</b><small>${etiquetteRev(r)}</small></div>
        <div><span>Limite de la demande</span><b>${fmt(r.limite)}</b><small>${r.etat === 'aDemander' ? `dans ${pluriel(r.joursRestants, 'jour')}` : 'un an après la date de révision'}</small></div>
        <div><span>Loyer actuel</span><b>${euros(r.loyer)}</b><small>hors charges</small></div>
        <div><span>Nouveau loyer</span><b>${r.nouveau ? euros(r.nouveau) : '–'}</b><small>${r.nouveau ? `+${euros(r.nouveau - r.loyer)} par mois` : ''}</small></div>
      </div>
      ${bloc ? `<p class="aide alerte-taux">${esc(bloc)}</p>` : ''}
      ${r.manque ? `<p class="aide alerte-taux">Indice IRL du ${R.libTrimestre(r.manque)} non saisi (${esc(B.zones.find(([z]) => z === zone())?.[1] || '')}). <button type="button" class="btn lien" data-action="nouvel-irl" data-trimestre="${r.manque}">Le saisir</button></p>` : ''}
      ${r.irlNouveau && r.irlAncien ? `<p class="recap">${euros(r.loyer)} × ${R.indice(r.irlNouveau)} (${R.libTrimestre(r.trimestreNouveau)}) ÷ ${R.indice(r.irlAncien)} (${R.libTrimestre(r.trimestreAncien)}) = <b>${r.nouveau ? euros(r.nouveau) : '–'}</b>, arrondi au centime.</p>` : ''}
      ${r.retardIndice && r.etat === 'aDemander' ? '<p class="mention">L\'indice utilisé n\'est pas celui de l\'année de révision : si l\'Insee a publié un indice plus récent pour ce trimestre avant la date de révision, saisis-le.</p>' : ''}
      ${r.fait ? `<p class="mention">${r.fait.statut === 'appliquee' ? `Appliquée : demande du ${fmt(r.fait.demandeLe)}, nouveau loyer ${euros(r.fait.nouveauLoyer)} à partir du ${fmt(r.fait.dateEffet)}.` : 'Tu as choisi de ne pas réviser cette année.'}</p>` : ''}
      ${r.etat === 'perdue' ? '<p class="mention">Plus d\'un an s\'est écoulé depuis la date de révision : la révision de cette année ne peut plus être demandée (F1311).</p>' : ''}
      ${peutAppliquer ? `${zoneCopie(lettre, 16, 'Lettre au locataire')}
        <label class="champ">Date de la demande au locataire <small>Le nouveau loyer s'applique à partir de cette date (pas avant la date de révision), sans effet rétroactif.</small><input type="date" name="demandeLe" value="${t}"></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = peutAppliquer
      ? `<button class="btn primaire" value="appliquer">Appliquer le nouveau loyer</button><button class="btn" value="ignorer">Ne pas réviser cette année</button><button class="btn gauche" value="annuler">Fermer</button>`
      : `<button class="btn primaire" value="annuler">Fermer</button>${r.fait ? `<button class="btn danger gauche" type="button" data-action="annuler-revision" data-id="${b.id}" data-date="${r.date}">Annuler l'enregistrement</button>` : ''}`;
    ouvrirModale(`Révision · ${esc(nomBien(b.bien))}`, corps, pied, (fd, action) => {
      if (action === 'ignorer') {
        retenir(); majBail(R.ignorerRevision(b, r.date)); sauver(); rendre();
        toast('Révision de cette année laissée de côté.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (action !== 'appliquer') return;
      const res = R.appliquerRevision(b, r.date, fd.get('demandeLe'), E.irl, zone());
      if (!res.ok) return res.erreur;
      retenir(); majBail(res.bail); sauver(); rendre();
      toast(`Nouveau loyer : ${euros(res.revision.nouveauLoyer)} à partir du ${fmt(res.revision.dateEffet)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Indice IRL -----
  function modaleIrl(trimestre) {
    const z = zone();
    const exist = trimestre ? E.irl.find((x) => x.trimestre === trimestre && x.zone === z) : null;
    const tq = trimestre || (() => { const t = auj(); let a = Number(t.slice(0, 4)), q = Math.ceil(Number(t.slice(5, 7)) / 3) - 1; if (!q) { q = 4; a--; } return `${a}-T${q}`; })();
    const an = Number(tq.slice(0, 4));
    ouvrirModale(exist ? 'Modifier un indice' : 'Saisir un indice IRL', `
      <p class="mention">Valeur publiée par l'Insee pour la zone « ${esc(B.zones.find(([id]) => id === z)?.[1] || z)} » (à changer dans les Réglages). Source : insee.fr, série « Indice de référence des loyers ».</p>
      <div class="rang-champs">
        <label class="champ">Année<input type="number" name="annee" min="2000" max="2100" value="${an}"></label>
        <label class="champ">Trimestre<select name="q">${[1, 2, 3, 4].map((q) => `<option value="${q}" ${Number(tq.slice(6)) === q ? 'selected' : ''}>${q}${q === 1 ? 'er' : 'e'} trimestre</option>`).join('')}</select></label>
        <label class="champ">Indice<input name="valeur" inputmode="decimal" required value="${exist ? R.indice(exist.valeur) : ''}" placeholder="Ex. : 140,25"></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${exist ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        retenir(); E.irl = E.irl.filter((x) => !(x.trimestre === trimestre && x.zone === z)); sauver(); rendre();
        toast('Indice supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const a = Math.round(Number(fd.get('annee')));
      if (!(a >= 2000 && a <= 2100)) return 'Année illisible.';
      const val = R.lireIndice(fd.get('valeur'));
      if (val === null) return 'Indice illisible : écris la valeur publiée, par exemple 140,25.';
      const tr = `${a}-T${fd.get('q')}`;
      retenir();
      if (exist && tr !== trimestre) E.irl = E.irl.filter((x) => !(x.trimestre === trimestre && x.zone === z));
      E.irl = R.majIrl(E.irl, tr, val, z);
      sauver(); rendre(); toast(`IRL du ${R.libTrimestre(tr)} : ${R.indice(val)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Dépense -----
  function modaleDepense(id) {
    const t = auj();
    const d = id ? E.depenses.find((x) => x.id === id) : null;
    if (!E.biens.length) { modaleBien(null); return; }
    const v = d || { bien: E.biens[0].id, date: t, categorie: 'taxe-fonciere', montant: null, recuperable: false, note: '' };
    ouvrirModale(d ? 'Dépense' : 'Nouvelle dépense', `
      <div class="rang-champs">
        <label class="champ">Bien<select name="bien">${E.biens.map((x) => `<option value="${x.id}" ${x.id === v.bien ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" required value="${v.date}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="categorie" id="d-cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        ${champMontant('montant', 'Montant', v.montant, '', true)}
      </div>
      <label class="case"><input type="checkbox" name="recuperable" id="d-recup" ${v.recuperable ? 'checked' : ''}> Récupérable sur le locataire (comptée dans la régularisation des charges)</label>
      <p class="mention">La liste des charges récupérables est fixée par le décret n° 87-713 (service-public.gouv.fr, F947). La case est proposée selon la catégorie : vérifie-la, en particulier pour les charges de copropriété.</p>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="160" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${d ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${d ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        retenir(); E.depenses = E.depenses.filter((x) => x.id !== d.id); sauver(); rendre();
        toast('Dépense supprimée.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const mt = R.lireMontant(fd.get('montant'));
      if (!mt) return 'Montant illisible : écris par exemple 120,00.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date.';
      retenir();
      const n = { id: d?.id || uid(), bien: fd.get('bien'), date: fd.get('date'), categorie: fd.get('categorie'), montant: mt, recuperable: !!fd.get('recuperable'), note: String(fd.get('note') || '').trim() };
      if (d) Object.assign(d, n); else E.depenses.push(n);
      sauver(); rendre(); toast(`${categorie(n.categorie).nom} : ${euros(mt)} enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
    if (!d) modale().querySelector('#d-cat').addEventListener('change', (e) => { modale().querySelector('#d-recup').checked = categorie(e.target.value).recuperable; });
  }

  // ----- Régularisation des charges -----
  function modaleRegularisation(id, annee) {
    const b = bail(id);
    const r = b && R.regularisation(E, id, annee);
    if (!r) return;
    if (r.forfait) { toast('Charges au forfait : pas de régularisation.'); return; }
    const detail = r.detail.length ? r.detail.map((x) => `- ${categorie(x.categorie).nom} : ${euros(x.part)}${r.jours < r.joursAnnee ? ` (sur ${euros(x.total)} pour l'année)` : ''}`).join('\n') : '- aucune charge récupérable notée';
    const conclusion = r.solde > 0 ? `Il reste donc ${euros(r.solde)} à votre charge, que je vous remercie de régler avec votre prochain loyer.` : r.solde < 0 ? `Vos provisions dépassent les charges réelles : je vous rembourse ${euros(-r.solde)}.` : 'Vos provisions couvrent exactement les charges réelles : rien à régler.';
    const texte = R.remplir(B.modeles.regularisation.texte, varsBail(b, { annee, debut: dateLongue(r.debut), fin: dateLongue(r.fin), detailCharges: detail, prorata: `${r.jours} jours sur ${r.joursAnnee}`, reel: euros(r.reel), provisions: euros(r.provisions), conclusion }));
    ouvrirModale(`Charges ${annee} · ${esc(nomBien(b.bien))}`, `
      <div class="resume-facture">
        <div><span>Provisions appelées</span><b>${euros(r.provisions)}</b><small>du ${fmt(r.debut)} au ${fmt(r.fin)}</small></div>
        <div><span>Charges réelles</span><b>${euros(r.reel)}</b><small>${euros(r.totalBien)} pour le bien × ${r.jours}/${r.joursAnnee} j</small></div>
      </div>
      <p class="recap">${r.solde > 0 ? `Complément à demander : <b>${euros(r.solde)}</b>` : r.solde < 0 ? `Trop-perçu à rendre : <b>${euros(-r.solde)}</b>` : 'Rien à demander ni à rendre.'}</p>
      ${r.detail.length ? '' : '<p class="aide alerte-taux">Aucune dépense récupérable notée pour ce bien cette année : ajoute-les dans l\'onglet Bilan avant de régulariser.</p>'}
      ${zoneCopie(texte, 14, 'Décompte à envoyer')}
      <p class="mention">Le décompte par nature de charges est communiqué un mois avant la régularisation, et les justificatifs restent à disposition du locataire pendant six mois (service-public.gouv.fr, F947).</p>
      ${r.faite ? `<p class="mention"><b>Marquée faite le ${fmt(r.faite.date)}.</b></p>` : ''}`,
    `<button class="btn primaire" type="button" data-action="regul-faite" data-id="${id}" data-annee="${annee}">${r.faite ? 'Marquer à faire' : 'Marquer comme faite'}</button><button class="btn gauche" value="annuler">Fermer</button>`);
  }

  // ----- Sortie du locataire et dépôt de garantie -----
  function modaleSortie(id) {
    const t = auj();
    const b = bail(id);
    if (!b) return;
    const s = b.sortie;
    const dep = R.etatDepot(b, t);
    const ret = [...s.retenues, { libelle: '', montant: null }, { libelle: '', montant: null }].slice(0, Math.max(3, s.retenues.length + 1));
    const texte = s.remiseCles ? R.remplir(B.modeles.depot.texte, varsBail(b, { remiseCles: dateLongue(s.remiseCles), depot: euros(b.depot), detailRetenues: s.retenues.length ? s.retenues.map((r) => `- retenue « ${r.libelle || 'sans libellé'} » : ${euros(r.montant)}`).join('\n') : '- aucune retenue', restitue: euros(dep.aRendre ?? b.depot), justificatifs: s.retenues.length ? 'Les justificatifs des retenues (état des lieux, devis ou factures) sont joints.' : '' })) : '';
    ouvrirModale(`Sortie · ${esc(nomLocataire(b))}`, `
      <div class="rang-champs">
        <label class="champ">Remise des clés<input type="date" name="remiseCles" value="${s.remiseCles || ''}"></label>
        <label class="champ">Fin du bail <small>Vide : le jour de la remise des clés.</small><input type="date" name="fin" value="${b.fin || ''}"></label>
      </div>
      <label class="case"><input type="checkbox" name="conforme" ${s.conforme ? 'checked' : ''}> État des lieux de sortie conforme à celui d'entrée</label>
      <p class="mention">Restitution du dépôt dans le mois qui suit la remise des clés si l'état des lieux est conforme, dans les deux mois sinon ; en cas de retard, le locataire peut réclamer 10 % du loyer mensuel hors charges par mois de retard commencé, après mise en demeure. Les retenues se justifient (état des lieux, devis, factures) (service-public.gouv.fr, F31269).</p>
      ${b.depot ? `<fieldset class="champ cadre-champs"><legend>Retenues sur le dépôt <small>Dépôt versé : ${euros(b.depot)}.</small></legend>
        ${ret.map((r, i) => `<div class="ligne-taux"><label class="champ"><span class="sr-only">Libellé ${i + 1}</span><input name="rl${i}" maxlength="80" value="${esc(r.libelle)}" placeholder="Ex. : réparation, loyer impayé"></label><label class="champ"><span class="sr-only">Montant ${i + 1}</span><input name="rm${i}" inputmode="decimal" value="${R.saisieMontant(r.montant)}" placeholder="0,00"></label></div>`).join('')}</fieldset>
      <div class="rang-champs">
        <label class="champ">Restitué le<input type="date" name="restitueLe" value="${s.restitueLe || ''}"></label>
        ${champMontant('restitue', 'Montant restitué', s.restitue ?? null, 'Vide : dépôt moins les retenues.')}
      </div>` : '<p class="mention">Aucun dépôt de garantie pour ce bail.</p>'}
      ${dep.limite ? `<p class="recap">${dep.etat === 'restitue' ? `Restitué le ${fmt(s.restitueLe)}${dep.enRetard ? ', après la date limite' : ''}.` : `À rendre : <b>${euros(dep.aRendre)}</b> avant le <b>${fmt(dep.limite)}</b>.`}${dep.etat === 'enRetard' ? ` En retard de ${pluriel(dep.moisRetard, 'mois commencé', 'mois commencés')} : jusqu'à ${euros(dep.majorationIndicative)} de majoration peuvent être réclamés.` : ''}</p>` : ''}
      ${texte ? zoneCopie(texte, 11, 'Message au locataire') : ''}
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const remise = fd.get('remiseCles');
      if (remise && !R.estDate(remise)) return 'Date de remise des clés illisible.';
      if (remise && remise < b.debut) return 'La remise des clés précède le début du bail.';
      const fin = fd.get('fin') || remise || null;
      if (fin && fin < b.debut) return 'La fin du bail précède son début.';
      const retenues = [];
      for (let i = 0; i < ret.length; i++) {
        const lib = String(fd.get(`rl${i}`) || '').trim(), m = String(fd.get(`rm${i}`) || '').trim();
        if (!lib && !m) continue;
        const mt = R.lireMontant(m);
        if (!mt) return `Montant de la retenue ${i + 1} illisible.`;
        retenues.push({ libelle: lib, montant: mt });
      }
      if (retenues.reduce((x, r) => x + r.montant, 0) > b.depot && b.depot) return 'Les retenues dépassent le dépôt : le reste se réclame à part.';
      const restitueStr = String(fd.get('restitue') || '').trim();
      const restitue = restitueStr ? R.lireMontant(restitueStr) : null;
      if (restitueStr && restitue === null) return 'Montant restitué illisible.';
      const candidat = { ...b, fin: fin || null, sortie: { remiseCles: remise || null, conforme: !!fd.get('conforme'), restitueLe: fd.get('restitueLe') || null, restitue, retenues } };
      const n = R.normaliserBail(candidat, t);
      const apres = E.paiements.filter((p) => p.bail === b.id && n.fin && p.mois > R.moisDe(n.fin)).length;
      if (apres && !confirm(`${pluriel(apres, 'paiement')} après la fin du bail ne ${apres > 1 ? 'seront' : 'sera'} plus rattaché${apres > 1 ? 's' : ''} à une échéance. Continuer ?`)) { garderOuverte(); return; }
      retenir(); majBail(n); sauver(); rendre();
      toast('Sortie enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // ----- Réglages -----
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <div class="groupe"><h3>Bailleur <small class="mention">sur les quittances et les lettres</small></h3>
        <div class="rang-champs"><label class="champ">Nom<input name="bailleurNom" maxlength="80" value="${esc(g.bailleurNom)}"></label><label class="champ">Adresse<input name="bailleurAdresse" maxlength="160" value="${esc(g.bailleurAdresse)}"></label></div></div>
      <div class="groupe"><h3>Biens <span class="etiquette sable">${E.biens.length} / ${R.MAX_BIENS}</span></h3>
        ${E.biens.length ? `<ul class="mini-liste">${E.biens.map((x) => `<li><span><b>${esc(x.nom)}</b> · ${esc(x.type)}</span><button type="button" class="btn petit" data-action="bien" data-id="${x.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Aucun bien.</p>'}
        <div class="rang">${E.biens.length < R.MAX_BIENS ? `<button type="button" class="btn petit" data-action="nouveau-bien">${ICONES.plus}Ajouter un bien</button>` : ''}</div></div>
      <div class="groupe"><h3>Révision du loyer <span class="etiquette jaune">Indice saisi</span></h3>
        <label class="champ">Zone de l'IRL<select name="zoneIrl">${B.zones.map(([id, n]) => `<option value="${id}" ${id === g.zoneIrl ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <p class="aide">${esc(B.sourceIrl)}</p></div>
      <div class="groupe"><h3>Relances <small class="mention">jours de retard après l'échéance</small></h3>
        <div class="rang-champs">${[0, 1, 2].map((i) => `<label class="champ">${R.LIB_PALIER[i + 1]}<input type="number" name="relance${i}" min="1" max="180" value="${g.relances[i]}"></label>`).join('')}</div></div>
      <div class="groupe"><h3>Échéances</h3>
        <label class="case"><input type="checkbox" name="prorata" ${g.prorata ? 'checked' : ''}> Premier et dernier mois au prorata des jours occupés</label>
        <label class="champ" style="max-width:280px">Rappel de fin de bail (jours avant)<input type="number" name="alerteFinBail" min="0" max="365" value="${g.alerteFinBail}"></label></div>
      <details class="champs-aide"><summary>Repères légaux et sources (relevés le ${fmt(B.verifieLe)})</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([lb, u]) => `<li>${esc(lb)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Données des locataires</h3><p class="aide">Efface le nom et la note des baux terminés depuis longtemps : dates, loyers et paiements restent pour tes comptes. Les durées de conservation qui s'imposent à toi sont à vérifier.</p>
        <div class="rang"><label class="champ" style="flex:0 1 220px">Terminés depuis plus de (mois)<input type="number" id="anciens" min="1" max="120" value="36"></label><button type="button" class="btn petit" data-action="effacer-anciens" style="align-self:flex-end">Effacer ces locataires</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte tes échéances et tes dépenses en tableur (CSV) pour ta déclaration ou ton comptable.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-echeances">Échéances (CSV)</button><button class="btn petit" type="button" data-action="csv-depenses">Dépenses (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tes biens, baux, paiements et les noms de tes locataires sont enregistrés en ligne, liés à ta clé, et ne sont ni lus ni partagés par QME. Tu es responsable des données de tes locataires : garde le minimum et efface ce qui ne sert plus.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucune banque, aucun service de paiement ni aucune messagerie n'est connecté : tu notes les paiements et tu copies les lettres toi-même. Outil d'aide à la gestion, pas un conseil juridique ni fiscal.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const rel = [0, 1, 2].map((i) => Math.round(Number(fd.get(`relance${i}`))));
      if (rel.some((x) => !(x >= 1 && x <= 180)) || !(rel[0] < rel[1] && rel[1] < rel[2])) return 'Les paliers de relance vont de 1 à 180 jours, du plus court au plus long.';
      const fb = Math.round(Number(fd.get('alerteFinBail')));
      if (!(fb >= 0 && fb <= 365)) return 'Le rappel de fin de bail va de 0 à 365 jours.';
      Object.assign(E.reglages, { bailleurNom: String(fd.get('bailleurNom') || '').trim(), bailleurAdresse: String(fd.get('bailleurAdresse') || '').trim(), zoneIrl: fd.get('zoneIrl'), relances: rel, prorata: !!fd.get('prorata'), alerteFinBail: fb });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.baux) || !Array.isArray(d.biens)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.biens.length, 'bien')}, ${pluriel(d.baux.length, 'bail', 'baux')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ta gestion locative.'); }
    });
  }

  function effacerAnciens() {
    const mois = Math.round(Number($('#anciens')?.value));
    if (!(mois >= 1 && mois <= 120)) { toast('Indique un nombre de mois entre 1 et 120.'); return; }
    const avant = R.ajoutMois(auj(), -mois);
    const n = E.baux.filter((b) => b.fin && b.fin < avant && !b.efface).length;
    if (!n) { toast('Aucun bail terminé avant cette date à effacer.'); return; }
    if (!confirm(`Effacer le nom et la note de ${pluriel(n, 'locataire')} dont le bail s'est terminé avant le ${fmt(avant)} ?`)) return;
    retenir();
    E = R.effacerAnciens(E, avant).etat;
    sauver(); rendre(); modale().close();
    toast(`${pluriel(n, 'locataire effacé', 'locataires effacés')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `gestion-locative-${auj()}.json`);

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
    const t = auj();
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-echeances': telecharger(R.csvEcheances(E, t), 'text/csv;charset=utf-8', `echeances-${t}.csv`); break;
      case 'csv-depenses': telecharger(R.csvDepenses(E, B.categories), 'text/csv;charset=utf-8', `depenses-${t}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'copier': copier(); break;
      case 'bien': modaleBien(id); break;
      case 'nouveau-bien': modaleBien(null); break;
      case 'nouveau-bail': modaleBail(null, { bienId: el.dataset.bien }); break;
      case 'bail': modaleDetailBail(id); break;
      case 'modifier-bail': modaleBail(id); break;
      case 'changement': modaleChangement(id); break;
      case 'suppr-changement': { const b = bail(id); if (!b) break; retenir(); majBail({ ...b, historique: b.historique.filter((h) => h.date !== el.dataset.date) }); sauver(); rendre(); modaleDetailBail(id); toast('Changement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'encaisser': modaleEncaisser(id, el.dataset.mois); break;
      case 'suppr-paiement': { const p = E.paiements.find((x) => x.id === id); if (!p) break; retenir(); E.paiements = E.paiements.filter((x) => x.id !== id); sauver(); rendre(); modaleEncaisser(p.bail, p.mois); toast('Paiement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'document': modaleDocument(id, el.dataset.mois); break;
      case 'imprimer-document': imprimer($('#doc-apercu')?.innerHTML || ''); break;
      case 'quittance-remise': { const cle = `${id}|${el.dataset.mois}`; retenir(); if (E.quittances[cle]) delete E.quittances[cle]; else E.quittances[cle] = t; sauver(); rendre(); modaleDocument(id, el.dataset.mois); toast(E.quittances[cle] ? 'Quittance notée comme remise.' : 'Remise annulée.'); break; }
      case 'relance': modaleRelance(id, el.dataset.mois); break;
      case 'palier': modaleRelance(id, el.dataset.mois, Number(el.value)); break;
      case 'relance-envoyee': retenir(); E.relancesFaites.push({ id: uid(), bail: id, mois: el.dataset.mois, palier: Number(el.dataset.palier), date: t }); sauver(); rendre(); modale().close(); toast(`${R.LIB_PALIER[Number(el.dataset.palier)]} notée comme envoyée.`, { libelle: 'Annuler', faire: annuler }); break;
      case 'revision': modaleRevision(id, el.dataset.date); break;
      case 'annuler-revision': { const b = bail(id); if (!b || !confirm('Annuler cette révision enregistrée ? Le loyer revient à son montant précédent.')) break; retenir(); majBail(R.annulerRevision(b, el.dataset.date)); sauver(); rendre(); if (modale().open) modale().close(); toast('Révision annulée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'irl': modaleIrl(el.dataset.trimestre); break;
      case 'nouvel-irl': modaleIrl(null); if (el.dataset.trimestre) { const f = modale().querySelector('form'); f.annee.value = el.dataset.trimestre.slice(0, 4); f.q.value = el.dataset.trimestre.slice(6); } break;
      case 'nouvelle-depense': modaleDepense(null); break;
      case 'depense': modaleDepense(id); break;
      case 'regularisation': modaleRegularisation(id, Number(el.dataset.annee)); break;
      case 'regul-faite': { const b = bail(id); const a = el.dataset.annee; if (!b) break; retenir(); const regs = { ...b.regularisations }; if (regs[a]) delete regs[a]; else regs[a] = { date: t, solde: R.regularisation(E, id, Number(a)).solde }; majBail({ ...b, regularisations: regs }); sauver(); rendre(); modaleRegularisation(id, Number(a)); toast(regs[a] ? 'Régularisation marquée faite.' : 'Régularisation remise à faire.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'sortie': modaleSortie(id); break;
      case 'effacer-locataire': { const b = bail(id); if (!b || !confirm(`Effacer le nom « ${nomLocataire(b)} » et la note de ce bail ? Dates, loyers et paiements restent.`)) break; retenir(); E = R.effacerLocataire(E, id); sauver(); rendre(); modaleDetailBail(id); toast('Locataire effacé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'effacer-anciens': effacerAnciens(); break;
      case 'mois': moisLoyers = el.dataset.n === '0' ? R.moisDe(t) : R.moisSuivant(moisLoyers, Number(el.dataset.n)); rendre(); break;
      case 'mois-aller': moisLoyers = el.dataset.mois; rendre(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'annee': anneeBilan += Number(el.dataset.n); rendre(); break;
      case 'filtre-baux': filtreBaux.statut = el.dataset.statut; rendre(); break;
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
  window.__gestionLocative = { etat: () => E, regles: R };
  init();
})();
