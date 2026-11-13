// Planner horaire QME : semaine en blocs de 30 min, bilan prévu / réalisé, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PHR;
  const API = '/api/templates';
  const PRODUIT = 'PHR';
  const CLE_CODE = 'qme-phr-code';
  const CLE_CACHE = 'qme-phr-cache';
  const CLE_DEMO = 'qme-phr-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-phr-ecran-accueil';

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
  const { ajout, versDate, lundiDe, jourIndex } = R;
  const auj = () => R.iso(new Date());
  const maintenant = () => { const d = new Date(); return { date: R.iso(d), min: d.getHours() * 60 + d.getMinutes() }; };
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const JOURS_LETTRE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const plage = (b) => `${R.heure(b.debut)} – ${R.heure(b.debut + b.duree)}`;
  const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const teinte = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[6];
  const categorie = (id) => E.categories.find((c) => c.id === id);
  const styleCat = (id) => { const c = teinte(categorie(id)?.couleur); return `--c:${c.hex};--t:${c.texte}`; };
  const nomCat = (id) => categorie(id)?.nom || 'Sans catégorie';
  const LIB_STATUT = { prevu: 'Prévu', fait: 'Fait', raccourci: 'Raccourci', deplace: 'Déplacé', pasfait: 'Pas fait' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  let lundiVu = lundiDe(auj());
  let jourVu = auj();
  let lundiBilan = lundiDe(auj());
  let annulation = null;
  let defilerAuRendu = true;

  const etatVide = () => ({ version: 1, prenom: '', profil: null, reglages: { debut: 7 * 60, fin: 21 * 60, weekend: true }, categories: [], series: [], blocs: [], modeles: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return {
      ...v, ...d,
      reglages: { ...v.reglages, ...(d.reglages || {}) },
      categories: tab(d.categories), series: tab(d.series).map((s) => ({ exceptions: {}, jusqua: null, note: '', ...s })),
      blocs: tab(d.blocs).map((b) => ({ statut: 'prevu', note: '', ...b })), modeles: tab(d.modeles),
    };
  };

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
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
        toast('Un autre appareil a modifié ton planner entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours || glisse) return;
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
  // Code interne (PHR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
  // Freelance fictif : semaine type en séries depuis 5 semaines, historique marqué avec les vraies règles.
  function creerDepuisType(etat, type, depuis, garder = null) {
    etat.profil = type.id;
    etat.reglages.debut = type.heures[0]; etat.reglages.fin = type.heures[1];
    R.assurerCategories(etat, type.categories, B.categories, B.couleurs.map((c) => c.id));
    const modele = { blocs: garder ? type.blocs.filter((_, i) => garder.has(i)) : type.blocs };
    R.appliquerModele(etat, modele, depuis, { recurrent: true, presets: B.categories, couleurs: B.couleurs.map((c) => c.id) });
  }

  function donneesDemo() {
    const e = etatVide();
    e.prenom = 'Camille';
    const t = auj();
    const n = maintenant();
    const lundi = lundiDe(t);
    creerDepuisType(e, B.semainesTypes.find((x) => x.id === 'freelance'), ajout(lundi, -35));
    const ponctuel = (date, debut, fin, titre, cat, statut = 'prevu') => { const b = { id: uid(), date, debut, duree: fin - debut, titre, cat, note: '', statut }; e.blocs.push(b); return b; };
    // Blocs ponctuels : rendez-vous client, atelier, chevauchement volontaire aujourd'hui.
    ponctuel(ajout(t, -8), 17 * 60, 18 * 60, 'Appel découverte', 'prospection');
    ponctuel(ajout(t, -1), 17 * 60, 18 * 60, 'Rédaction de la proposition', 'prospection');
    ponctuel(t, 10 * 60 + 30, 11 * 60 + 30, 'Appel client · point d\'étape', 'production');
    ponctuel(ajout(t, 1), 14 * 60, 16 * 60, 'Atelier de lancement client', 'production');
    ponctuel(ajout(t, 4), 9 * 60 + 30, 11 * 60, 'Préparation des devis', 'prospection');
    ponctuel(ajout(lundi, 7), 16 * 60 + 30, 17 * 60 + 30, 'Webinaire métier', 'veille');

    // Historique : chaque occurrence commencée reçoit une marque déterministe.
    let k = 0;
    const debutHisto = ajout(lundi, -35);
    for (const o of R.occurrences(e, debutHisto, t)) {
      if (!R.commence(o, n)) continue;
      k++;
      const recent = o.date >= ajout(t, -3);
      // Restent à marquer : deux blocs de la semaine en cours et le premier bloc terminé aujourd'hui.
      if (o.date >= lundi && o.date < t && k % 9 === 0) continue;
      if (o.date === t && o.debut + o.duree > n.min) continue; // en cours : pas encore marqué
      if (o.date === t && k % 4 === 1) continue;
      const b = R.materialiser(e, o.id);
      if (!b) continue;
      const r = (k * 7 + o.debut / 30) % 13;
      if (o.id === b.id && b.titre === 'Rédaction de la proposition') continue; // traité plus bas
      if (b.cat === 'perso' && r < 4) R.marquer(b, 'pasfait');
      else if (b.cat === 'prospection' && r < 6) R.marquer(b, 'pasfait');
      else if (b.duree >= 90 && r < 4 && !recent) R.marquer(b, 'raccourci', Math.max(15, Math.round(b.duree * 0.6 / 15) * 15));
      else R.marquer(b, 'fait');
    }
    // États forcés, relatifs à aujourd'hui.
    const hier = e.blocs.find((b) => b.titre === 'Rédaction de la proposition');
    if (hier) { hier.statut = 'prevu'; R.deplacerVers(e, hier.id, ajout(t, 1), 10 * 60); }
    const avantHier = R.occurrences(e, ajout(t, -2), ajout(t, -2)).filter((o) => o.statut !== 'deplace');
    const long = avantHier.find((o) => o.duree >= 120);
    if (long) { const b = R.materialiser(e, long.id); R.marquer(b, 'raccourci', b.duree - 60); }
    const sport = avantHier.find((o) => o.cat === 'perso');
    if (sport) R.marquer(R.materialiser(e, sport.id), 'pasfait');
    // Un modèle enregistré par l'utilisatrice.
    e.modeles.push({ id: uid(), nom: 'Semaine de livraison', blocs: [
      { titre: 'Production client', cat: 'production', jours: [0, 1, 2, 3, 4], debut: 8 * 60 + 30, duree: 240 },
      { titre: 'Recette avec le client', cat: 'production', jours: [3], debut: 14 * 60, duree: 120 },
      { titre: 'Déjeuner', cat: 'pauses', jours: [0, 1, 2, 3, 4], debut: 12 * 60 + 30, duree: 60 },
      { titre: 'Facturation', cat: 'factures', jours: [4], debut: 16 * 60, duree: 60 },
    ] });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planner horaire · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="120" height="70" fill="#1D4E89"/>
          <rect x="10" y="100" width="120" height="40" fill="#F5B400"/>
          <rect x="140" y="20" width="120" height="120" fill="#D9302A"/>
          <rect x="140" y="150" width="120" height="130" fill="#F0EDE6"/>
          <rect x="10" y="150" width="120" height="130" fill="none" stroke="#F0EDE6" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="410" cy="150" r="130" fill="#F5B400"/>
          <path d="M410 150 L410 20 A130 130 0 0 1 540 150 Z" fill="#141414"/>
          <rect x="400" y="60" width="20" height="100" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planner horaire · time-blocking</p>
          <h1>Chaque heure a sa place.</h1>
          <p>Ta semaine en blocs de 30 minutes, posés au glisser-déposer, puis le bilan du prévu et du réalisé, catégorie par catégorie.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planner</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta semaine est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon planner</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de planner ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon planner'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', type: null, garder: new Set(), debut: 7 * 60, fin: 21 * 60, weekend: true };

  function apercuModele(blocs, cats) {
    // Mini-semaine : 7 colonnes, 6 h → 22 h, un rectangle par bloc à la couleur de sa catégorie.
    const couleurDe = (cat) => teinte(cats[cat] || B.categories.find((c) => c.id === cat)?.couleur).hex;
    const rects = blocs.flatMap((b) => b.jours.map((j) => `<rect x="${j * 20 + 1}" y="${Math.max(0, (b.debut - 360) / 10)}" width="18" height="${Math.max(2, b.duree / 10 - 1)}" fill="${couleurDe(b.cat)}"/>`)).join('');
    return `<svg class="apercu" viewBox="0 0 140 96" preserveAspectRatio="none" aria-hidden="true"><rect width="140" height="96" fill="var(--surface)"/>${[1, 2, 3, 4, 5, 6].map((i) => `<line x1="${i * 20}" x2="${i * 20}" y1="0" y2="96" stroke="var(--trait)"/>`).join('')}${rects}</svg>`;
  }

  function ecranAccueil() {
    const a = accueil;
    const type = B.semainesTypes.find((x) => x.id === a.type);
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ta semaine.</h1>
        <p class="intro">Choisis la semaine type la plus proche de la tienne : ses catégories et ses blocs seront préremplis. Tout reste modifiable.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Ta semaine type</h2>
        <div class="types" role="group" aria-label="Semaine type">
          ${B.semainesTypes.map((x) => `<button type="button" class="type" data-action="type" data-id="${x.id}" aria-pressed="${a.type === x.id}">
            ${apercuModele(x.blocs, {})}<b>${esc(x.nom)}</b><span>${esc(x.detail)}</span><small>${x.blocs.length ? `${R.duree(R.totalModele(x))} planifiées par semaine` : 'À remplir toi-même'}</small></button>`).join('')}
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.type ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const opts = (sel, de, a2) => Array.from({ length: (a2 - de) / 60 + 1 }, (_, i) => de + i * 60).map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${R.heure(m)}</option>`).join('');
      corps = `
        <p class="surtitre">${esc(type.nom)}</p>
        <h1>Tes blocs de chaque semaine</h1>
        <p class="intro">Décoche ceux qui ne te concernent pas : les autres se répéteront chaque semaine. Tu pourras ensuite les déplacer au glisser-déposer.</p>
        <div class="rang-champs">
          <label class="champ">La journée commence à<select id="acc-debut">${opts(a.debut, 0, 12 * 60)}</select></label>
          <label class="champ">et finit à<select id="acc-fin">${opts(a.fin, 14 * 60, 24 * 60)}</select></label>
          <label class="case" style="align-self:flex-end"><input type="checkbox" id="acc-weekend" ${a.weekend ? 'checked' : ''}> Afficher le week-end</label>
        </div>
        ${type.blocs.length ? `<div class="choix-blocs">${type.blocs.map((b, i) => `<label class="case choix-bloc" style="${`--c:${teinte(B.categories.find((c) => c.id === b.cat).couleur).hex}`}"><input type="checkbox" data-action="garder" value="${i}" ${a.garder.has(i) ? 'checked' : ''}><i></i><span><b>${esc(b.titre)}</b> ${b.jours.map((j) => JOURS_COURTS[j]).join(', ')} · ${plage(b)}</span></label>`).join('')}</div>`
          : '<p class="aide">Semaine vierge : tu poseras tes blocs toi-même sur la grille.</p>'}
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon planner</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#acc-debut')?.addEventListener('change', (e) => { accueil.debut = Number(e.target.value); });
    $('#acc-fin')?.addEventListener('change', (e) => { accueil.fin = Number(e.target.value); });
    $('#acc-weekend')?.addEventListener('change', (e) => { accueil.weekend = e.target.checked; });
  }

  function terminerAccueil() {
    const type = B.semainesTypes.find((x) => x.id === accueil.type);
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    creerDepuisType(E, type, lundiDe(auj()), accueil.garder);
    E.reglages = { debut: accueil.debut, fin: Math.max(accueil.fin, accueil.debut + 120), weekend: accueil.weekend };
    accueil = { etape: 1, prenom: '', type: null, garder: new Set(), debut: 7 * 60, fin: 21 * 60, weekend: true };
    vue = 'semaine';
    sauver();
    demarrer();
    toast('Ton planner est prêt. Glisse un bloc pour le déplacer, ou clique sur une case vide pour en créer un.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="9" fill="currentColor"/><rect x="10" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="14" fill="currentColor"/><rect x="10" y="10" width="5" height="11" fill="currentColor"/><rect x="3" y="14" width="5" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="14" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="9" height="4" fill="currentColor"/></svg>',
    modeles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['semaine', 'Semaine'], ['aujourdhui', 'Aujourd\'hui'], ['bilan', 'Bilan'], ['modeles', 'Modèles']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planner<br>horaire</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    defilerAuRendu = true;
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { semaine: 'Semaine', aujourdhui: 'Aujourd\'hui', bilan: 'Bilan', modeles: 'Modèles' };
    document.title = `${titres[vue]} · Planner horaire`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, aujourdhui: vueAujourdhui, bilan: vueBilan, modeles: vueModeles }[vue]();
    if (vue === 'semaine' && defilerAuRendu) { defilerAuRendu = false; requestAnimationFrame(defilerVersMaintenant); }
    if (vue === 'bilan') brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    defilerAuRendu = true;
    rendre();
    if (v !== 'semaine') window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Semaine (grille) ----------
  const hauteurPas = () => (estTel() ? 40 : 24);

  function joursAffiches() {
    if (estTel()) return [jourVu];
    return R.joursSemaine(lundiVu, E.reglages.weekend ? 7 : 5);
  }

  function bornesGrille(liste) {
    let de = E.reglages.debut, a = E.reglages.fin;
    for (const b of liste) { de = Math.min(de, Math.floor(b.debut / 60) * 60); a = Math.max(a, Math.ceil((b.debut + b.duree) / 60) * 60); }
    return [de, Math.max(a, de + 60)];
  }

  function etiquetteSemaine(lundi) {
    const fin = ajout(lundi, 6);
    const memeMois = versDate(lundi).getMonth() === versDate(fin).getMonth();
    return `${versDate(lundi).getDate()}${memeMois ? '' : ` ${fmt(lundi, { month: 'short' })}`} – ${fmt(fin, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function vueSemaine() {
    if (estTel() && lundiDe(jourVu) !== lundiVu) lundiVu = lundiDe(jourVu);
    const t = auj();
    const n = maintenant();
    const jours = joursAffiches();
    const semaine = R.occurrences(E, lundiVu, ajout(lundiVu, 6));
    const liste = semaine.filter((b) => jours.includes(b.date));
    const [gDe, gA] = bornesGrille(liste);
    const H = hauteurPas();
    const lignes = (gA - gDe) / 30;
    const totalJour = (d) => semaine.filter((b) => b.date === d && b.statut !== 'deplace').reduce((s, b) => s + b.duree, 0);
    const heures = Array.from({ length: (gA - gDe) / 60 }, (_, i) => `<span style="top:${i * 2 * H}px">${R.heure(gDe + i * 60)}</span>`).join('');
    const colonnes = jours.map((d) => {
      const blocsJour = liste.filter((b) => b.date === d);
      const place = R.disposer(blocsJour);
      const ligneMaintenant = d === t && n.min >= gDe && n.min <= gA ? `<div class="maintenant" style="top:${((n.min - gDe) / 30) * H}px" aria-hidden="true"></div>` : '';
      return `<div class="g-col ${d === t ? 'auj' : ''} ${d < t ? 'passe' : ''}" data-date="${d}" style="height:${lignes * H}px" aria-label="${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}">${blocsJour.map((b) => blocHtml(b, place[b.id], gDe, H, n)).join('')}${ligneMaintenant}</div>`;
    }).join('');
    const tetes = jours.map((d) => `<div class="g-jour ${d === t ? 'auj' : ''}"><b>${JOURS_COURTS[jourIndex(d)]} ${versDate(d).getDate()}</b><span>${totalJour(d) ? R.duree(totalJour(d)) : '–'}</span></div>`).join('');
    const bandeJours = estTel() ? `<div class="bande-jours" role="group" aria-label="Jour affiché">${R.joursSemaine(lundiVu).map((d) => `<button class="${d === t ? 'auj' : ''}" data-action="jour" data-jour="${d}" aria-pressed="${d === jourVu}"><span>${JOURS_LETTRE[jourIndex(d)]}</span><b>${versDate(d).getDate()}</b><small>${totalJour(d) ? R.duree(totalJour(d)).replace(' ', '') : ''}</small></button>`).join('')}</div>` : '';
    const total = semaine.filter((b) => b.statut !== 'deplace').reduce((s, b) => s + b.duree, 0);
    const titre = estTel() ? fmt(jourVu, { weekday: 'long', day: 'numeric', month: 'long' }) : `Semaine du ${etiquetteSemaine(lundiVu)}`;
    return `
      <div class="vue-tete semaine-tete">
        <div><h1 class="titre-semaine">${esc(titre)}</h1><p>${pluriel(semaine.filter((b) => b.statut !== 'deplace').length, 'bloc')} · ${R.duree(total)} prévues dans la semaine</p></div>
        <div class="actions">
          <div class="nav-semaine">
            <button class="btn-icone" data-action="semaine-prec" aria-label="${estTel() ? 'Jour précédent' : 'Semaine précédente'}">${ICONES.gauche}</button>
            <button class="btn petit" data-action="semaine-auj">${estTel() ? 'Aujourd\'hui' : 'Cette semaine'}</button>
            <button class="btn-icone" data-action="semaine-suiv" aria-label="${estTel() ? 'Jour suivant' : 'Semaine suivante'}">${ICONES.droite}</button>
          </div>
          <button class="btn" data-action="semaine-outils">Copier / modèle</button>
          <button class="btn primaire" data-action="bloc-nouveau">${ICONES.plus}Bloc</button>
        </div>
      </div>
      ${bandeJours}
      <div class="legende-cats">${E.categories.map((c) => `<span style="${styleCat(c.id)}"><i></i>${esc(c.nom)}</span>`).join('')}</div>
      <div class="grille" style="--h:${H}px;--cols:${jours.length}">
        <div class="g-tete"><div class="g-coin"></div>${tetes}</div>
        <div class="g-corps" id="g-corps"><div class="g-heures" style="height:${lignes * H}px">${heures}</div>${colonnes}</div>
      </div>
      <p class="astuce">${estTel() ? 'Touche une case vide pour créer un bloc. Appui long sur un bloc pour le déplacer, poignée du bas pour changer sa durée.' : 'Glisse un bloc pour le déplacer, tire sa poignée du bas pour changer sa durée, glisse sur une zone vide pour en créer un. Au clavier : flèches pour déplacer, Maj + flèches pour la durée, Entrée pour ouvrir, Suppr pour effacer.'}</p>`;
  }

  function blocHtml(b, place, gDe, H, n) {
    const top = ((b.debut - gDe) / 30) * H;
    const haut = (b.duree / 30) * H;
    const { couloir, couloirs } = place || { couloir: 0, couloirs: 1 };
    const aMarquer = b.statut === 'prevu' && R.commence(b, n) && !(b.date === n.date && b.debut + b.duree > n.min);
    const enCours = b.statut === 'prevu' && b.date === n.date && b.debut <= n.min && b.debut + b.duree > n.min;
    const reste = b.statut === 'raccourci' ? Math.round((1 - b.dureeReelle / b.duree) * 100) : 0;
    const etat = b.statut !== 'prevu' ? LIB_STATUT[b.statut] : aMarquer ? 'À marquer' : enCours ? 'En cours' : '';
    const libelle = `${b.titre}, ${nomCat(b.cat)}, ${fmt(b.date, { weekday: 'long' })} ${plage(b)}${etat ? `, ${etat}` : ''}${b.serieId ? ', répété chaque semaine' : ''}`;
    const marque = { fait: '✓', raccourci: '½', deplace: '→', pasfait: '✕' }[b.statut] || (aMarquer ? '•' : '');
    return `<button class="bloc st-${b.statut} ${aMarquer ? 'a-marquer' : ''} ${enCours ? 'en-cours' : ''} ${b.duree <= 30 ? 'court' : b.duree <= 60 ? 'moyen' : ''}" data-id="${b.id}" style="${styleCat(b.cat)};top:${top}px;height:${haut}px;left:calc(${(couloir / couloirs) * 100}% + 2px);width:calc(${100 / couloirs}% - 4px)" aria-label="${esc(libelle)}">
      ${reste ? `<i class="reste" style="height:${reste}%"></i>` : ''}
      <b>${esc(b.titre)}</b><span class="heure">${plage(b)}</span>${marque ? `<span class="marque-bloc" aria-hidden="true">${marque}</span>` : ''}${b.serieId ? '<span class="serie" aria-hidden="true">↻</span>' : ''}
      ${b.statut === 'deplace' ? '' : '<span class="poignee" aria-hidden="true"></span>'}
    </button>`;
  }

  function defilerVersMaintenant() {
    const corps = $('#g-corps');
    if (!corps) return;
    const n = maintenant();
    const col = corps.querySelector('.g-col.auj') || corps.querySelector('.g-col');
    const premier = col?.querySelector('.bloc');
    const H = hauteurPas();
    let cible = null;
    const [gDe] = bornesGrille(R.occurrences(E, lundiVu, ajout(lundiVu, 6)).filter((b) => joursAffiches().includes(b.date)));
    if (corps.querySelector('.g-col.auj')) cible = ((n.min - gDe) / 30) * H - 2 * H;
    else if (premier) cible = parseFloat(premier.style.top) - H;
    if (cible === null || !estTel()) return; // sur ordinateur, la grille tient dans la page
    const y = corps.getBoundingClientRect().top + window.scrollY + Math.max(0, cible) - 260;
    window.scrollTo({ top: Math.max(0, y) });
  }

  // ---------- Glisser-déposer (souris, tactile) ----------
  let glisse = null;
  let ignorerClic = false;

  function colonneSous(x) {
    const cols = [...document.querySelectorAll('.g-col')];
    if (cols.length === 1) return cols[0];
    return cols.find((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; }) || null;
  }
  function minuteSous(col, y, gDe) {
    const r = col.getBoundingClientRect();
    return gDe + Math.floor((y - r.top) / hauteurPas()) * 30;
  }
  const gDebutAffiche = () => bornesGrille(R.occurrences(E, lundiVu, ajout(lundiVu, 6)).filter((b) => joursAffiches().includes(b.date)))[0];

  function debutGlisse(e) {
    if (e.button > 0 || modale().open) return;
    const blocEl = e.target.closest('.bloc');
    const col = e.target.closest('.g-col');
    if (!col) return;
    const gDe = gDebutAffiche();
    const tactile = e.pointerType !== 'mouse';
    if (blocEl) {
      const id = blocEl.dataset.id;
      const b = R.occurrences(E, lundiVu, ajout(lundiVu, 6)).find((x) => x.id === id);
      if (!b || b.statut === 'deplace') return;
      const redim = !!e.target.closest('.poignee');
      const prise = minuteSous(col, e.clientY, gDe) - b.debut;
      glisse = { mode: redim ? 'redim' : 'deplacer', id, b, el: blocEl, x0: e.clientX, y0: e.clientY, prise, gDe, actif: false, tactile, pointeur: e.pointerId, cible: { date: b.date, debut: b.debut, duree: b.duree } };
      if (redim) { activerGlisse(); e.preventDefault(); return; }
      if (tactile) glisse.minuteurAppui = setTimeout(() => { if (glisse && !glisse.actif) { activerGlisse(); navigator.vibrate?.(15); } }, 350);
    } else if (!tactile) {
      // Souris sur une zone vide : on dessine un nouveau bloc.
      const m = minuteSous(col, e.clientY, gDe);
      glisse = { mode: 'creer', col, gDe, m0: m, x0: e.clientX, y0: e.clientY, actif: false, tactile: false, cible: { date: col.dataset.date, debut: m, duree: 30 } };
      e.preventDefault();
    }
  }

  function activerGlisse() {
    glisse.actif = true;
    document.body.classList.add('glisse-en-cours');
    if (glisse.el) glisse.el.classList.add('saisi');
    const fantome = document.createElement('div');
    fantome.className = 'fantome';
    fantome.setAttribute('aria-hidden', 'true');
    if (glisse.b) fantome.setAttribute('style', styleCat(glisse.b.cat));
    glisse.fantome = fantome;
    placerFantome();
  }

  function placerFantome() {
    const { cible, gDe, fantome } = glisse;
    const col = document.querySelector(`.g-col[data-date="${cible.date}"]`);
    if (!col || !fantome) return;
    if (fantome.parentNode !== col) col.appendChild(fantome);
    const H = hauteurPas();
    fantome.style.top = `${((cible.debut - gDe) / 30) * H}px`;
    fantome.style.height = `${(cible.duree / 30) * H}px`;
    fantome.innerHTML = `<b>${R.heure(cible.debut)} – ${R.heure(cible.debut + cible.duree)}</b><span>${R.duree(cible.duree)}</span>`;
  }

  function mouvementGlisse(e) {
    if (!glisse) return;
    const dist = Math.hypot(e.clientX - glisse.x0, e.clientY - glisse.y0);
    if (!glisse.actif) {
      if (glisse.tactile) { if (dist > 8) { clearTimeout(glisse.minuteurAppui); glisse = null; } return; }
      if (dist < 4) return;
      activerGlisse();
    }
    e.preventDefault();
    defilementAuto(e.clientY);
    const { gDe, b } = glisse;
    const H = hauteurPas();
    const col = colonneSous(e.clientX) || document.querySelector(`.g-col[data-date="${glisse.cible.date}"]`);
    if (!col) return;
    const m = minuteSous(col, e.clientY, gDe);
    const gA = gDe + (parseFloat(col.style.height) / H) * 30;
    if (glisse.mode === 'deplacer') {
      const deb = Math.max(gDe, Math.min(gA - b.duree, m - glisse.prise));
      glisse.cible = { date: col.dataset.date, debut: R.borner(deb, b.duree).debut, duree: b.duree };
    } else if (glisse.mode === 'redim') {
      const fin = Math.min(gA, Math.max(b.debut + 30, m + 30));
      glisse.cible = { date: b.date, debut: b.debut, duree: fin - b.debut };
    } else {
      const de = Math.min(glisse.m0, m), a = Math.max(glisse.m0, m) + 30;
      glisse.cible = { date: glisse.col.dataset.date, debut: de, duree: Math.min(a, gA) - de };
    }
    placerFantome();
  }

  let minuteurDefil = null;
  function defilementAuto(y) {
    clearInterval(minuteurDefil);
    const marge = 70;
    const sens = y < marge + 60 ? -1 : y > window.innerHeight - marge - (estTel() ? 70 : 0) ? 1 : 0;
    if (sens) minuteurDefil = setInterval(() => window.scrollBy(0, sens * 12), 30);
  }

  function finGlisse(e) {
    if (!glisse) return;
    clearTimeout(glisse.minuteurAppui);
    clearInterval(minuteurDefil);
    const g = glisse;
    glisse = null;
    document.body.classList.remove('glisse-en-cours');
    g.fantome?.remove();
    g.el?.classList.remove('saisi');
    if (e.type === 'pointercancel') return;
    if (!g.actif) {
      if (g.mode === 'creer') { ignorerClic = true; setTimeout(() => { ignorerClic = false; }, 60); modaleBloc(null, { date: g.cible.date, debut: g.cible.debut, duree: 60 }); }
      return; // simple clic sur un bloc : géré par l'événement click
    }
    ignorerClic = true;
    setTimeout(() => { ignorerClic = false; }, 60);
    if (g.mode === 'creer') { modaleBloc(null, g.cible); return; }
    const c = g.cible;
    if (c.date === g.b.date && c.debut === g.b.debut && c.duree === g.b.duree) return;
    appliquerPosition(g.id, c, g.mode === 'redim' ? 'durée' : 'position');
  }

  // Déplace ou redimensionne un bloc (une occurrence de série est détachée de sa série).
  function appliquerPosition(id, c, quoi, focus = false) {
    retenir();
    const etaitSerie = R.estOccurrence(id);
    const b = R.materialiser(E, id);
    if (!b) return;
    const p = R.borner(c.debut, c.duree);
    b.date = c.date; b.debut = p.debut; b.duree = p.duree;
    if (!estTel() && lundiDe(b.date) !== lundiVu) lundiVu = lundiDe(b.date);
    if (estTel() && b.date !== jourVu) jourVu = b.date;
    sauver(); rendre();
    if (focus) document.querySelector(`.bloc[data-id="${b.id}"]`)?.focus();
    toast(`${b.titre} : ${fmt(b.date, { weekday: 'long' })} ${plage(b)}${etaitSerie ? ' (cette semaine seulement)' : ''}.`, { libelle: 'Annuler', faire: annuler });
    void quoi;
  }

  // Clavier sur un bloc de la grille.
  function clavierBloc(e) {
    const el = e.target.closest('.bloc');
    if (!el || modale().open) return;
    const b = R.occurrences(E, lundiVu, ajout(lundiVu, 6)).find((x) => x.id === el.dataset.id);
    if (!b) return;
    const k = e.key;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); supprimerBloc(b.id); return; }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) || b.statut === 'deplace') return;
    e.preventDefault();
    const c = { date: b.date, debut: b.debut, duree: b.duree };
    if (e.shiftKey) {
      if (k === 'ArrowUp') c.duree = Math.max(30, b.duree - 30);
      else if (k === 'ArrowDown') c.duree = Math.min(R.JOUR - b.debut, b.duree + 30);
      else return;
    } else if (k === 'ArrowUp') c.debut = Math.max(0, b.debut - 30);
    else if (k === 'ArrowDown') c.debut = Math.min(R.JOUR - b.duree, b.debut + 30);
    else {
      const pas = k === 'ArrowLeft' ? -1 : 1;
      c.date = ajout(b.date, pas);
      if (!E.reglages.weekend && !estTel()) while (jourIndex(c.date) > 4) c.date = ajout(c.date, pas);
    }
    if (c.date === b.date && c.debut === b.debut && c.duree === b.duree) return;
    appliquerPosition(b.id, c, 'clavier', true);
  }

  function supprimerBloc(id) {
    const tous = R.occurrences(E, ajout(lundiVu, -400), ajout(lundiVu, 400));
    const b = tous.find((x) => x.id === id) || E.blocs.find((x) => x.id === id);
    if (!b) return;
    retenir();
    R.supprimer(E, id);
    sauver(); rendre();
    toast(`« ${b.titre} » supprimé${b.serieId ? ' (cette occurrence)' : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Aujourd'hui ----------
  function vueAujourdhui() {
    const t = auj();
    const n = maintenant();
    const lundi = lundiDe(t);
    const duJour = R.occurrences(E, t, t);
    const actifs = duJour.filter((b) => b.statut !== 'deplace');
    const enCours = actifs.find((b) => b.debut <= n.min && b.debut + b.duree > n.min);
    const suivant = actifs.find((b) => b.debut > n.min);
    const prevu = actifs.reduce((s, b) => s + b.duree, 0);
    const realise = actifs.reduce((s, b) => s + R.realise(b), 0);
    const aMarquerAvant = R.occurrences(E, lundi, ajout(t, -1)).filter((b) => b.statut === 'prevu');
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const titre = actifs.length ? `${salut}<mark>${R.duree(prevu)}</mark> prévues aujourd'hui.` : `${salut}Aucun bloc aujourd'hui.`;
    const carte = (b, lib) => b ? `<div class="carte-mini" style="${styleCat(b.cat)}"><p class="surtitre">${lib}</p><b>${esc(b.titre)}</b><span>${plage(b)} · ${esc(nomCat(b.cat))}</span></div>` : `<div class="carte-mini vide"><p class="surtitre">${lib}</p><b>${lib === 'Maintenant' ? 'Temps libre' : 'Plus rien ensuite'}</b><span>${lib === 'Maintenant' ? 'Aucun bloc en cours.' : 'La journée prévue est terminée.'}</span></div>`;
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${prevu ? `<p class="sous">${R.duree(realise)} réalisées sur ${R.duree(prevu)} prévues</p><div class="jauge" aria-hidden="true"><i style="width:${Math.min(100, (realise / prevu) * 100)}%"></i></div>` : ''}
          <div class="actions"><button class="btn primaire" data-action="bloc-nouveau" data-date="${t}">${ICONES.plus}Bloc</button><button class="btn" data-action="vue" data-vue="semaine">Voir la semaine</button></div>
        </div>
        <div class="cartes-mini">${carte(enCours, 'Maintenant')}${carte(suivant, 'Ensuite')}</div>
      </section>
      <h2 class="titre-section">Blocs du jour <span>Marque chaque bloc une fois commencé : le bilan de la semaine s'en sert.</span></h2>
      ${duJour.length ? `<ul class="lignes-blocs">${duJour.map((b) => ligneBloc(b, n)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Journée libre</h3><p>Aucun bloc prévu aujourd'hui. Pose-en un, ou applique une semaine type depuis l'onglet Modèles.</p><div class="actions"><button class="btn primaire" data-action="bloc-nouveau" data-date="${t}">${ICONES.plus}Ajouter un bloc</button></div></div></div>`}
      ${aMarquerAvant.length ? `<h2 class="titre-section">À marquer cette semaine <span>${pluriel(aMarquerAvant.length, 'bloc passé', 'blocs passés')} sans marque.</span></h2><ul class="lignes-blocs">${aMarquerAvant.map((b) => ligneBloc(b, n, true)).join('')}</ul>` : ''}`;
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  function ligneBloc(b, n, avecJour = false) {
    const commence = R.commence(b, n);
    const enCours = b.date === n.date && b.debut <= n.min && b.debut + b.duree > n.min;
    let droite;
    if (b.statut === 'deplace') {
      const v = E.blocs.find((x) => x.id === b.versId);
      droite = `<span class="etiquette">Déplacé${v ? ` · ${fmt(v.date, { weekday: 'short' })} ${R.heure(v.debut)}` : ''}</span>`;
    } else if (b.statut !== 'prevu') {
      const cls = { fait: 'bleu', raccourci: 'jaune', pasfait: 'rouge' }[b.statut];
      droite = `<span class="etiquette ${cls}">${LIB_STATUT[b.statut]}${b.statut === 'raccourci' ? ` · ${R.duree(b.dureeReelle)}` : ''}</span><button class="btn lien" data-action="bloc" data-id="${b.id}">Changer</button>`;
    } else if (commence) {
      droite = `<div class="marques" role="group" aria-label="Marquer ${esc(b.titre)}">${[['fait', 'Fait'], ['raccourci', 'Raccourci'], ['deplace', 'Déplacé'], ['pasfait', 'Pas fait']].map(([s, l]) => `<button class="mq mq-${s}" data-action="marquer" data-id="${b.id}" data-statut="${s}">${l}</button>`).join('')}</div>`;
    } else {
      droite = `<span class="a-venir">À venir</span><button class="btn lien" data-action="bloc" data-id="${b.id}">Modifier</button>`;
    }
    return `<li class="ligne-bloc ${enCours ? 'en-cours' : ''} st-${b.statut}" style="${styleCat(b.cat)}">
      <i class="bande"></i>
      <button class="ligne-info" data-action="bloc" data-id="${b.id}"><span class="h">${avecJour ? `${fmt(b.date, { weekday: 'short', day: 'numeric' })} · ` : ''}${plage(b)}${enCours ? ' · <b>en cours</b>' : ''}</span><b>${esc(b.titre)}</b><span>${esc(nomCat(b.cat))} · ${R.duree(b.duree)}${b.serieId ? ' · chaque semaine' : ''}</span></button>
      <div class="ligne-droite">${droite}</div></li>`;
  }

  // ---------- Marques ----------
  function marquerRapide(id, statut) {
    const occ = R.occurrences(E, ajout(auj(), -400), ajout(auj(), 400)).find((x) => x.id === id);
    if (!occ) return;
    if (statut === 'raccourci') return modaleRaccourci(occ);
    if (statut === 'deplace') return modaleDeplace(occ);
    retenir();
    const b = R.materialiser(E, id);
    R.marquer(b, statut);
    sauver(); rendre();
    toast(`« ${b.titre} » : ${LIB_STATUT[statut].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleRaccourci(occ) {
    const options = [];
    for (let m = 15; m < occ.duree; m += 15) options.push(m);
    const defaut = Math.max(15, Math.round(occ.duree / 2 / 15) * 15);
    ouvrirModale('Bloc raccourci', `
      <p><b>${esc(occ.titre)}</b> · ${fmt(occ.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${plage(occ)} (${R.duree(occ.duree)} prévues)</p>
      <label class="champ">Temps réellement passé<select name="reel">${options.map((m) => `<option value="${m}" ${m === (occ.dureeReelle || defaut) ? 'selected' : ''}>${R.duree(m)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      const b = R.materialiser(E, occ.id);
      const err = R.marquer(b, 'raccourci', Number(f.get('reel')));
      if (err) { E = annulation; annulation = null; return err; }
      sauver(); rendre();
      toast(`« ${b.titre} » : ${R.duree(b.dureeReelle)} réalisées sur ${R.duree(b.duree)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  const optionsHeures = (sel, de = 0, a = R.JOUR - 30) => { let s = ''; for (let m = de; m <= a; m += 30) s += `<option value="${m}" ${m === sel ? 'selected' : ''}>${R.heure(m)}</option>`; return s; };
  const optionsDurees = (sel) => { let s = ''; for (let m = 30; m <= 12 * 60; m += 30) s += `<option value="${m}" ${m === sel ? 'selected' : ''}>${R.duree(m)}</option>`; return s; };

  function modaleDeplace(occ) {
    const t = auj();
    const date = occ.date < t ? t : ajout(occ.date, 1);
    ouvrirModale('Déplacer le bloc', `
      <p><b>${esc(occ.titre)}</b> n'a pas eu lieu ${fmt(occ.date, { weekday: 'long', day: 'numeric', month: 'long' })} à ${R.heure(occ.debut)}. Il reste visible, barré, et une copie est posée au nouveau créneau.</p>
      <div class="rang-champs"><label class="champ">Nouveau jour<input type="date" name="date" value="${date}" required></label>
      <label class="champ">Début<select name="debut">${optionsHeures(occ.debut)}</select></label></div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Déplacer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = f.get('date');
      if (!d) return 'Choisis le nouveau jour.';
      retenir();
      const copie = R.deplacerVers(E, occ.id, d, Number(f.get('debut')));
      if (!copie) { annulation = null; return 'Ce bloc n\'existe plus.'; }
      sauver(); rendre();
      toast(`« ${copie.titre} » déplacé ${fmt(d, { weekday: 'long', day: 'numeric' })} à ${R.heure(copie.debut)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Bilan ----------
  function vueBilan() {
    const n = maintenant();
    const bl = R.bilan(E, lundiBilan, n);
    const tot = bl.total;
    const cats = bl.categories.filter((c) => c.prevu || c.realise || c.deplaces || categorie(c.id));
    const echelle = Math.max(60, ...cats.map((c) => Math.max(c.prevu, c.realise)));
    const tuiles = [
      ['Prévu', R.duree(tot.prevu), `${pluriel(tot.blocs, 'bloc')} dans la semaine`, 'var(--bleu)', ''],
      ['Réalisé', R.duree(tot.realise), `sur ${R.duree(tot.prevuAJour)} prévues à ce jour`, 'var(--encre)', 'rond'],
      ['Taux de réalisation', tot.taux === null ? '–' : `${tot.taux}<small>%</small>`, 'Réalisé ÷ prévu des blocs commencés', 'var(--jaune)', ''],
      ['À marquer', tot.aMarquer, `${pluriel(tot.deplaces, 'déplacé')} · ${pluriel(tot.pasFaits, 'pas fait', 'pas faits')}`, 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const barres = cats.map((c) => `
      <div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(c.nom)}</b>Prévu : ${R.duree(c.prevu)}<br>Réalisé : ${R.duree(c.realise)}${c.prevuAJour ? ` (${c.taux} % du prévu à ce jour)` : ''}<br>Déplacés : ${c.deplaces} · pas faits : ${c.pasFaits} · à marquer : ${c.aMarquer}`)}" style="${c.couleur ? `--c:${teinte(c.couleur).hex}` : '--c:var(--trait)'}">
        <span class="bc-nom"><i></i>${esc(c.nom)}</span>
        <span class="bc-piste"><span class="bc-prevu" style="width:${(c.prevu / echelle) * 100}%"></span><span class="bc-realise" style="width:${(c.realise / echelle) * 100}%"></span></span>
        <span class="bc-val"><b>${R.duree(c.realise)}</b> / ${R.duree(c.prevu)}</span>
      </div>`).join('');
    const lignes = cats.map((c) => {
      const ecartMin = c.realise - c.prevuAJour;
      return `<tr style="${c.couleur ? `--c:${teinte(c.couleur).hex}` : '--c:var(--trait)'}"><td><span class="nom-cat"><i></i>${esc(c.nom)}</span></td><td class="nb">${R.duree(c.prevu)}</td><td class="nb">${R.duree(c.prevuAJour)}</td><td class="nb">${R.duree(c.realise)}</td><td class="nb ${ecartMin < 0 ? 'negatif' : ''}">${ecartMin ? `${ecartMin < 0 ? '−' : '+'}${R.duree(ecartMin)}` : '0'}</td><td class="nb">${c.taux === null ? '–' : `${c.taux} %`}</td><td class="nb">${c.deplaces}</td><td class="nb">${c.pasFaits}</td><td class="nb">${c.aMarquer}</td></tr>`;
    }).join('');
    const tend = R.tendance(E, lundiBilan, 6, n);
    const maxT = Math.max(60, ...tend.map((x) => Math.max(x.prevu, x.realise)));
    const colonnes = tend.map((x) => `<div class="col-tend ${x.lundi === lundiBilan ? 'active' : ''}" tabindex="0" data-info="${esc(`<b>Semaine du ${fmt(x.lundi, { day: 'numeric', month: 'long' })}</b>Prévu : ${R.duree(x.prevu)}<br>Réalisé : ${R.duree(x.realise)}${x.taux === null ? '' : `<br>Taux : ${x.taux} %`}`)}">
        <span class="ct-zone"><span class="ct-prevu" style="height:${(x.prevu / maxT) * 100}%"></span><span class="ct-realise" style="height:${(x.realise / maxT) * 100}%"></span></span>
        <b>${x.taux === null ? '–' : `${x.taux} %`}</b><span>${fmt(x.lundi, { day: 'numeric', month: 'short' })}</span></div>`).join('');
    const estCourante = lundiBilan === lundiDe(auj());
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Semaine du ${etiquetteSemaine(lundiBilan)}${estCourante ? ' (en cours)' : ''}. Le réalisé compte les blocs faits et le temps réel des blocs raccourcis ; un bloc déplacé compte à sa nouvelle place.</p></div>
        <div class="actions nav-semaine">
          <button class="btn-icone" data-action="bilan-prec" aria-label="Semaine précédente">${ICONES.gauche}</button>
          <button class="btn petit" data-action="bilan-auj" ${estCourante ? 'disabled' : ''}>Cette semaine</button>
          <button class="btn-icone" data-action="bilan-suiv" aria-label="Semaine suivante">${ICONES.droite}</button>
        </div></div>
      <div class="tuiles">${tuiles}</div>
      ${tot.aMarquer ? `<p class="aide" style="margin-top:16px">${pluriel(tot.aMarquer, 'bloc commencé n\'est pas encore marqué', 'blocs commencés ne sont pas encore marqués')} : ils comptent dans le prévu à ce jour mais pas dans le réalisé. <button class="btn lien" data-action="vue" data-vue="aujourdhui">Les marquer</button></p>` : ''}
      <h2 class="titre-section">Prévu et réalisé par catégorie</h2>
      <figure class="graphique" id="graphique-cats">
        <div class="graphique-tete"><h2>Heures de la semaine</h2><div class="legende"><span><i class="lg-prevu"></i>Prévu</span><span><i class="lg-realise"></i>Réalisé (couleur de la catégorie)</span></div></div>
        ${cats.length ? `<div class="barres-cats">${barres}</div>` : '<p class="aide">Aucune catégorie.</p>'}
        <div class="infobulle" hidden></div>
      </figure>
      <div class="defile" style="margin-top:16px"><table class="tableau"><caption class="sr-only">Prévu et réalisé par catégorie</caption><thead><tr><th>Catégorie</th><th class="nb">Prévu</th><th class="nb">Prévu à ce jour</th><th class="nb">Réalisé</th><th class="nb">Écart</th><th class="nb">Taux</th><th class="nb">Déplacés</th><th class="nb">Pas faits</th><th class="nb">À marquer</th></tr></thead>
        <tbody>${lignes}</tbody><tfoot><tr><td>Total</td><td class="nb">${R.duree(tot.prevu)}</td><td class="nb">${R.duree(tot.prevuAJour)}</td><td class="nb">${R.duree(tot.realise)}</td><td class="nb">${tot.realise - tot.prevuAJour ? `${tot.realise < tot.prevuAJour ? '−' : '+'}${R.duree(tot.realise - tot.prevuAJour)}` : '0'}</td><td class="nb">${tot.taux === null ? '–' : `${tot.taux} %`}</td><td class="nb">${tot.deplaces}</td><td class="nb">${tot.pasFaits}</td><td class="nb">${tot.aMarquer}</td></tr></tfoot></table></div>
      <h2 class="titre-section">6 dernières semaines <span>Hauteur : heures prévues (contour) et réalisées (plein) ; chiffre : taux de réalisation.</span></h2>
      <figure class="graphique" id="graphique-tend">
        <div class="tendance">${colonnes}</div>
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Tendance sur 6 semaines</caption><thead><tr><th>Semaine du</th><th>Prévu</th><th>Réalisé</th><th>Taux</th></tr></thead><tbody>${tend.map((x) => `<tr><td>${fmt(x.lundi)}</td><td>${R.duree(x.prevu)}</td><td>${R.duree(x.realise)}</td><td>${x.taux === null ? '–' : `${x.taux} %`}</td></tr>`).join('')}</tbody></table>
      </figure>`;
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
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
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

  // ---------- Modèles ----------
  function vueModeles() {
    const t = auj();
    const couleursEtat = Object.fromEntries(E.categories.map((c) => [c.id, c.couleur]));
    const carteModele = (m, base) => `
      <article class="modele">
        ${apercuModele(m.blocs, couleursEtat)}
        <div class="modele-corps"><h3>${esc(m.nom)}</h3><p>${base ? esc(m.detail) : 'Enregistré depuis ta semaine'}</p><p class="modele-chiffres">${pluriel(m.blocs.reduce((s, b) => s + b.jours.length, 0), 'bloc')} · ${R.duree(R.totalModele(m))} par semaine</p></div>
        <div class="modele-pied">${m.blocs.length ? `<button class="btn petit" data-action="modele-appliquer" data-id="${m.id}">Appliquer</button>` : ''}${base ? '' : `<button class="btn petit danger" data-action="modele-suppr" data-id="${m.id}">Supprimer</button>`}</div>
      </article>`;
    const series = E.series.filter((s) => !s.jusqua || s.jusqua >= t).sort((a, b) => a.jours[0] - b.jours[0] || a.debut - b.debut);
    const lignesSeries = series.map((s) => `<tr style="${styleCat(s.cat)}"><td><span class="nom-cat"><i></i><span><b>${esc(s.titre)}</b><br><small>${esc(nomCat(s.cat))}</small></span></span></td><td><span class="jours-serie">${JOURS_LETTRE.map((l, i) => `<abbr title="${JOURS_COURTS[i]}" class="${s.jours.includes(i) ? 'oui' : ''}">${l}</abbr>`).join('')}</span></td><td>${plage(s)}</td><td>${s.depuis > t ? `dès le ${fmt(s.depuis)}` : s.jusqua ? `jusqu'au ${fmt(s.jusqua)}` : 'en cours'}</td><td class="nb"><button class="btn petit" data-action="serie-modifier" data-id="${s.id}">Modifier</button> <button class="btn petit danger" data-action="serie-arreter" data-id="${s.id}">Arrêter</button></td></tr>`).join('');
    const lundi = lundiDe(t);
    const parCat = (id) => R.occurrences(E, lundi, ajout(lundi, 6)).filter((b) => b.cat === id && b.statut !== 'deplace').reduce((s, b) => s + b.duree, 0);
    return `
      <div class="vue-tete"><div><h1>Modèles</h1><p>Semaines types à poser en un geste, blocs qui se répètent chaque semaine et catégories de couleur.</p></div>
        <div class="actions"><button class="btn" data-action="modele-enregistrer">Enregistrer la semaine affichée</button></div></div>
      <h2 class="titre-section">Semaines types</h2>
      <div class="modeles">${B.semainesTypes.filter((x) => x.blocs.length).map((m) => carteModele(m, true)).join('')}${E.modeles.map((m) => carteModele(m, false)).join('')}</div>
      <h2 class="titre-section">Blocs récurrents <span>Un changement par la grille ne touche qu'une semaine ; ici, il vaut pour toutes les semaines à venir.</span></h2>
      ${series.length ? `<div class="defile"><table class="tableau tableau-series"><thead><tr><th>Bloc</th><th>Jours</th><th>Horaire</th><th>Période</th><th class="nb"><span class="sr-only">Actions</span></th></tr></thead><tbody>${lignesSeries}</tbody></table></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bloc récurrent</h3><p>Crée un bloc et coche « Répéter chaque semaine », ou applique une semaine type en blocs récurrents.</p></div></div>`}
      <h2 class="titre-section">Catégories <span>${E.categories.length} sur ${B.couleurs.length} : une couleur fixe par catégorie.</span></h2>
      <div class="categories">${E.categories.map((c) => `<button class="categorie" data-action="cat-modifier" data-id="${c.id}" style="${styleCat(c.id)}"><i></i><b>${esc(c.nom)}</b><span>${R.duree(parCat(c.id))} cette semaine</span></button>`).join('')}
        ${E.categories.length < B.couleurs.length ? `<button class="categorie ajout" data-action="cat-nouvelle">${ICONES.plus}<b>Nouvelle catégorie</b></button>` : ''}</div>
      <h2 class="titre-section">Conseils de méthode</h2>
      <ol class="conseils">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <p class="mention" style="margin-top:24px">Semaines types et conseils : exemples indicatifs rédigés pour ce planner, à adapter à ton rythme.</p>`;
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
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const choixCategories = (sel) => `<fieldset class="champ"><legend>Catégorie</legend><div class="choix-cat">${E.categories.map((c) => `<label style="${styleCat(c.id)}"><input type="radio" name="cat" value="${c.id}" ${c.id === sel ? 'checked' : ''}><span><i></i>${esc(c.nom)}</span></label>`).join('')}</div></fieldset>`;
  const choixJours = (sel) => `<div class="choix-jours">${JOURS_COURTS.map((j, i) => `<label><input type="checkbox" name="jours" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span>${j}</span></label>`).join('')}</div>`;

  // Nouveau bloc (valeurs par défaut) ou bloc existant (id d'un bloc ou d'une occurrence).
  function modaleBloc(id, defaut = {}) {
    if (!E.categories.length) { toast('Crée d\'abord une catégorie (onglet Modèles).'); return; }
    const n = maintenant();
    const occ = id ? R.occurrences(E, ajout(auj(), -400), ajout(auj(), 400)).find((x) => x.id === id) || null : null;
    if (id && !occ) return;
    const serie = occ?.serieId ? E.series.find((s) => s.id === occ.serieId) : null;
    const b = occ || { titre: '', cat: E.categories[0].id, date: defaut.date || jourVu, debut: defaut.debut ?? 9 * 60, duree: defaut.duree || 60, note: '' };
    const commence = occ && R.commence(occ, n) && occ.statut !== 'deplace';
    const titres = [...new Set([...E.series.map((s) => s.titre), ...E.blocs.map((x) => x.titre)])].slice(0, 40);
    const marques = commence ? `<div class="groupe-marques"><p class="surtitre" style="margin:0">Marquer · actuellement <b>${LIB_STATUT[occ.statut].toLowerCase()}${occ.statut === 'raccourci' ? ` (${R.duree(occ.dureeReelle)})` : ''}</b></p><div class="marques">${[['fait', 'Fait'], ['raccourci', 'Raccourci'], ['deplace', 'Déplacé'], ['pasfait', 'Pas fait'], ['prevu', 'Effacer']].filter(([s]) => s !== occ.statut).map(([s, l]) => `<button type="button" class="mq mq-${s}" data-action="marquer" data-id="${occ.id}" data-statut="${s}">${l}</button>`).join('')}</div></div>` : '';
    const portee = serie ? `<fieldset class="champ"><legend>Modifier</legend><div class="choix-portee"><label class="case"><input type="radio" name="portee" value="bloc" checked> Ce bloc seulement (${fmt(occ.date, { weekday: 'long', day: 'numeric' })})</label><label class="case"><input type="radio" name="portee" value="serie"> Toute la série à partir de ce jour</label></div></fieldset>` : '';
    const repetition = !occ ? `<label class="case"><input type="checkbox" name="repeter" id="repeter"> Répéter chaque semaine</label><div id="zone-jours" hidden>${choixJours([jourIndex(b.date)])}</div>` : serie ? `<div id="zone-jours" hidden><p class="champ" style="margin-bottom:6px">Jours de la série</p>${choixJours(serie.jours)}</div>` : '';
    const corps = `
      ${occ?.statut === 'deplace' ? '<p class="aide">Ce bloc a été déplacé : il reste visible pour l\'historique. Modifie plutôt sa copie.</p>' : ''}
      ${marques}
      <label class="champ">Titre<input name="titre" required maxlength="80" value="${esc(b.titre)}" list="titres-connus" placeholder="Ex. : Travail de fond"></label>
      <datalist id="titres-connus">${titres.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      ${choixCategories(b.cat)}
      <div class="rang-champs">
        <label class="champ" id="champ-date">Jour<input type="date" name="date" value="${b.date}" required></label>
        <label class="champ">Début<select name="debut">${optionsHeures(b.debut)}</select></label>
        <label class="champ">Durée<select name="duree">${optionsDurees(b.duree)}</select></label>
      </div>
      ${portee}${repetition}
      <label class="champ">Note<small>Facultative.</small><input name="note" maxlength="200" value="${esc(b.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = occ
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(occ ? 'Modifier le bloc' : 'Nouveau bloc', corps, pied, (f, action) => {
      if (action === 'supprimer') { supprimerBloc(occ.id); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique un titre.';
      const date = f.get('date');
      const debut = Number(f.get('debut')), duree = Number(f.get('duree'));
      if (debut + duree > R.JOUR) return 'Le bloc doit finir avant minuit.';
      const cat = f.get('cat') || E.categories[0].id;
      const note = String(f.get('note') || '').trim();
      const jours = f.getAll('jours').map(Number);
      retenir();
      if (!occ) {
        if (!date) return 'Choisis le jour.';
        if (f.get('repeter')) {
          if (!jours.length) return 'Coche au moins un jour.';
          E.series.push({ id: uid(), titre, cat, jours: jours.sort(), debut, duree, depuis: date, jusqua: null, exceptions: {}, note });
          toast(`« ${titre} » ajouté chaque ${jours.map((j) => JOURS_COURTS[j].toLowerCase()).join(', ')} à ${R.heure(debut)}.`, { libelle: 'Annuler', faire: annuler });
        } else {
          E.blocs.push({ id: uid(), date, debut, duree, titre, cat, note, statut: 'prevu' });
          toast(`« ${titre} » ajouté ${fmt(date, { weekday: 'long', day: 'numeric' })} à ${R.heure(debut)}.`, { libelle: 'Annuler', faire: annuler });
        }
        if (estTel()) jourVu = date; else if (lundiDe(date) !== lundiVu && vue === 'semaine') lundiVu = lundiDe(date);
      } else if (serie && f.get('portee') === 'serie') {
        if (!jours.length) return 'Coche au moins un jour.';
        R.modifierSerieDepuis(E, serie.id, occ.date, { titre, cat, debut, duree, jours: jours.sort(), note });
        if (!occ.virtuel) { const x = E.blocs.find((y) => y.id === occ.id); if (x && x.statut === 'prevu') { Object.assign(x, { titre, cat, debut, duree, note }); } }
        toast('Série modifiée pour les semaines à venir.', { libelle: 'Annuler', faire: annuler });
      } else {
        if (!date) return 'Choisis le jour.';
        const x = R.materialiser(E, occ.id);
        Object.assign(x, { titre, cat, date, debut, duree, note });
        toast(serie ? 'Bloc modifié (cette semaine seulement).' : 'Bloc enregistré.', { libelle: 'Annuler', faire: annuler });
      }
      sauver(); rendre();
    });
    const d = modale();
    const majPortee = () => {
      const serieChoisie = d.querySelector('[name=portee]:checked')?.value === 'serie';
      const rep = d.querySelector('#repeter')?.checked;
      const zone = d.querySelector('#zone-jours');
      if (zone) zone.hidden = !(serieChoisie || rep);
      d.querySelector('#champ-date').hidden = serieChoisie;
    };
    d.querySelectorAll('[name=portee],#repeter').forEach((x) => x.addEventListener('change', majPortee));
  }

  function modaleSerie(id) {
    const s = E.series.find((x) => x.id === id);
    if (!s) return;
    // Ouvre la prochaine occurrence, portée « série » cochée.
    const t = auj();
    const occ = R.occurrences(E, t, ajout(t, 60)).find((o) => o.serieId === id && o.statut === 'prevu');
    if (!occ) { toast('Aucune occurrence à venir pour cette série.'); return; }
    modaleBloc(occ.id);
    const r = modale().querySelector('[name=portee][value=serie]');
    if (r) { r.checked = true; r.dispatchEvent(new Event('change')); }
  }

  function arreterSerie(id) {
    const s = E.series.find((x) => x.id === id);
    if (!s) return;
    if (!confirm(`Arrêter « ${s.titre} » à partir d'aujourd'hui ? Les semaines passées et leurs marques sont conservées.`)) return;
    retenir();
    R.arreterSerie(E, id, auj());
    sauver(); rendre();
    toast(`« ${s.titre} » ne se répète plus.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleAppliquer(modeleId) {
    const m = B.semainesTypes.find((x) => x.id === modeleId) || E.modeles.find((x) => x.id === modeleId);
    if (!m) return;
    const lundi = vue === 'semaine' ? lundiVu : lundiDe(auj());
    ouvrirModale(`Appliquer « ${esc(m.nom)} »`, `
      <p>${pluriel(m.blocs.reduce((s, b) => s + b.jours.length, 0), 'bloc')}, ${R.duree(R.totalModele(m))} par semaine. Les blocs déjà posés restent en place.</p>
      <label class="champ">À partir de la semaine du<input type="date" name="lundi" value="${lundi}" required></label>
      <fieldset class="champ"><legend>Comment ?</legend>
        <label class="case"><input type="radio" name="mode" value="ponctuel" checked> Cette semaine seulement (blocs ponctuels)</label>
        <label class="case"><input type="radio" name="mode" value="recurrent"> Chaque semaine (blocs récurrents)</label></fieldset>
      <p class="aide">Les catégories du modèle qui manquent sont ajoutées, dans la limite de ${B.couleurs.length} couleurs.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Appliquer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = f.get('lundi');
      if (!d) return 'Choisis la semaine.';
      retenir();
      const l = lundiDe(d);
      const nb = R.appliquerModele(E, m, l, { recurrent: f.get('mode') === 'recurrent', presets: B.categories, couleurs: B.couleurs.map((c) => c.id) });
      lundiVu = l; jourVu = l <= auj() && auj() <= ajout(l, 6) ? auj() : l;
      sauver(); vue = 'semaine'; history.replaceState(null, '', '#semaine'); rendre();
      toast(`${pluriel(nb, 'bloc posé', 'blocs posés')} (semaine du ${fmt(l, { day: 'numeric', month: 'long' })}).`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleOutilsSemaine() {
    const prec = ajout(lundiVu, -7);
    const nbPrec = E.blocs.filter((b) => b.date >= prec && b.date <= ajout(prec, 6) && !b.serieId && b.statut !== 'deplace').length;
    ouvrirModale('Copier ou appliquer', `
      <div class="groupe" style="border:0;padding:0"><h3>Copier la semaine précédente</h3><p class="aide">${nbPrec ? `${pluriel(nbPrec, 'bloc ponctuel', 'blocs ponctuels')} de la semaine du ${fmt(prec, { day: 'numeric', month: 'long' })} copiés sur celle-ci, sans leurs marques. Les blocs récurrents se répètent déjà seuls.` : 'La semaine précédente n\'a pas de bloc ponctuel à copier (les blocs récurrents se répètent déjà seuls).'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="copier-semaine" ${nbPrec ? '' : 'disabled'}>Copier ${nbPrec ? pluriel(nbPrec, 'bloc') : ''}</button></div></div>
      <div class="groupe"><h3>Appliquer un modèle</h3><div class="rang">${[...B.semainesTypes.filter((x) => x.blocs.length), ...E.modeles].map((m) => `<button class="btn petit" type="button" data-action="modele-appliquer" data-id="${m.id}">${esc(m.nom)}</button>`).join('')}</div></div>
      <div class="groupe"><h3>Enregistrer comme modèle</h3><p class="aide">Garde cette semaine pour la reposer plus tard.</p><div class="rang"><button class="btn petit" type="button" data-action="modele-enregistrer">Enregistrer la semaine</button></div></div>`,
    '<button class="btn" value="annuler">Fermer</button>');
  }

  function modaleEnregistrerModele() {
    const lundi = vue === 'semaine' ? lundiVu : lundiDe(auj());
    ouvrirModale('Enregistrer comme modèle', `
      <p>Les blocs de la semaine du ${fmt(lundi, { day: 'numeric', month: 'long' })} (ponctuels et récurrents) deviennent un modèle réutilisable.</p>
      <label class="champ">Nom du modèle<input name="nom" required maxlength="50" placeholder="Ex. : Semaine de rentrée"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au modèle.';
      const m = R.semaineVersModele(E, lundi, nom);
      if (!m.blocs.length) return 'Cette semaine ne contient aucun bloc.';
      E.modeles.push(m);
      sauver(); rendre(); toast(`Modèle « ${nom} » enregistré.`);
    });
  }

  function modaleCategorie(id) {
    const c = id ? categorie(id) : null;
    const prises = new Set(E.categories.filter((x) => x.id !== id).map((x) => x.couleur));
    const libres = B.couleurs.filter((x) => !prises.has(x.id));
    const defaut = c?.couleur || libres[0]?.id;
    const nb = c ? E.blocs.filter((b) => b.cat === id).length + E.series.filter((s) => s.cat === id).length : 0;
    const autres = E.categories.filter((x) => x.id !== id);
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(c?.nom || '')}" placeholder="Ex. : Projets perso"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur <small>Une couleur par catégorie.</small></legend><div class="pastilles">${B.couleurs.map((x) => `<label title="${x.nom}${prises.has(x.id) ? ' (déjà prise)' : ''}"><input type="radio" name="couleur" value="${x.id}" ${x.id === defaut ? 'checked' : ''} ${prises.has(x.id) ? 'disabled' : ''} aria-label="${x.nom}"><span style="--c:${x.hex}" class="${prises.has(x.id) ? 'prise' : ''}"></span></label>`).join('')}</div></fieldset>
      ${c && nb && autres.length ? `<label class="champ">En cas de suppression, ses ${pluriel(nb, 'bloc')} rejoignent<select name="vers">${autres.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = c ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${autres.length ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier la catégorie' : 'Nouvelle catégorie', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const vers = f.get('vers') || autres[0].id;
        retenir();
        E.blocs.forEach((b) => { if (b.cat === id) b.cat = vers; });
        E.series.forEach((s) => { if (s.cat === id) s.cat = vers; });
        E.modeles.forEach((m) => m.blocs.forEach((b) => { if (b.cat === id) b.cat = vers; }));
        E.categories = autres;
        sauver(); rendre(); toast(`« ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      const couleur = f.get('couleur');
      if (!nom) return 'Indique un nom.';
      if (!couleur) return 'Toutes les couleurs sont prises.';
      if (E.categories.some((x) => x.id !== id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Cette catégorie existe déjà.';
      if (c) Object.assign(c, { nom, couleur }); else E.categories.push({ id: uid(), nom, couleur });
      sauver(); rendre(); toast(c ? 'Catégorie enregistrée.' : `« ${nom} » créée.`);
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const opts = (sel, de, a) => { let s = ''; for (let m = de; m <= a; m += 60) s += `<option value="${m}" ${m === sel ? 'selected' : ''}>${R.heure(m)}</option>`; return s; };
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <div class="rang-champs"><label class="champ">Grille de<select name="debut">${opts(r.debut, 0, 22 * 60)}</select></label><label class="champ">à<select name="fin">${opts(r.fin, 2 * 60, 24 * 60)}</select></label></div>
      <label class="case"><input type="checkbox" name="weekend" ${r.weekend ? 'checked' : ''}> Afficher le samedi et le dimanche</label>
      <p class="aide">Un bloc posé hors de ces heures agrandit la grille de sa semaine.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const debut = Number(f.get('debut')), fin = Number(f.get('fin'));
      if (fin - debut < 120) return 'La grille doit couvrir au moins 2 heures.';
      E.prenom = String(f.get('prenom') || '').trim();
      Object.assign(r, { debut, fin, weekend: !!f.get('weekend') });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.categories) || !Array.isArray(d.blocs) || !Array.isArray(d.series)) throw new Error();
        if (!confirm(`Remplacer ton planner actuel par cette copie (${pluriel(d.categories.length, 'catégorie')}, ${pluriel(d.blocs.length + d.series.length, 'bloc')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planner.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planner-horaire-${auj()}.json`;
    a.click();
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
    if (ignorerClic) { ignorerClic = false; if (e.target.closest('.g-col')) { e.preventDefault(); return; } }
    const blocGrille = e.target.closest('.g-col .bloc');
    if (blocGrille) { modaleBloc(blocGrille.dataset.id); return; }
    const col = e.target.closest('.g-col');
    if (col && !e.target.closest('[data-action]')) {
      // Toucher une case vide (tactile) : nouveau bloc sur ce créneau.
      if (dernierPointeur === 'mouse') return;
      const m = minuteSous(col, e.clientY, gDebutAffiche());
      modaleBloc(null, { date: col.dataset.date, debut: m, duree: 60 });
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'type': {
        accueil.type = id;
        const ty = B.semainesTypes.find((x) => x.id === id);
        accueil.garder = new Set(ty.blocs.map((_, i) => i));
        [accueil.debut, accueil.fin] = ty.heures;
        accueil.weekend = id === 'etudiant' || ty.blocs.some((b) => b.jours.some((j) => j > 4)) || id === 'vierge';
        ecranAccueil(); break;
      }
      case 'garder': if (el.checked) accueil.garder.add(Number(el.value)); else accueil.garder.delete(Number(el.value)); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'bloc': modaleBloc(id); break;
      case 'bloc-nouveau': modaleBloc(null, { date: el.dataset.date || (estTel() ? jourVu : (lundiVu === lundiDe(auj()) ? auj() : lundiVu)), debut: Math.min(20 * 60, Math.ceil(maintenant().min / 30) * 30) }); break;
      case 'marquer': if (modale().open) modale().close(); if (el.dataset.statut === 'prevu') { retenir(); const b = R.materialiser(E, id); R.marquer(b, 'prevu'); sauver(); rendre(); toast('Marque effacée.', { libelle: 'Annuler', faire: annuler }); } else marquerRapide(id, el.dataset.statut); break;
      case 'semaine-prec': if (estTel()) jourVu = ajout(jourVu, -1); else lundiVu = ajout(lundiVu, -7); defilerAuRendu = true; rendre(); break;
      case 'semaine-suiv': if (estTel()) jourVu = ajout(jourVu, 1); else lundiVu = ajout(lundiVu, 7); defilerAuRendu = true; rendre(); break;
      case 'semaine-auj': jourVu = auj(); lundiVu = lundiDe(auj()); defilerAuRendu = true; rendre(); break;
      case 'jour': jourVu = el.dataset.jour; defilerAuRendu = true; rendre(); break;
      case 'semaine-outils': modaleOutilsSemaine(); break;
      case 'copier-semaine': {
        modale().close(); retenir();
        const nb = R.copierSemaine(E, ajout(lundiVu, -7), lundiVu);
        sauver(); rendre(); toast(`${pluriel(nb, 'bloc copié', 'blocs copiés')}.`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'modele-appliquer': modaleAppliquer(id); break;
      case 'modele-enregistrer': modaleEnregistrerModele(); break;
      case 'modele-suppr': { const m = E.modeles.find((x) => x.id === id); if (!m) break; retenir(); E.modeles = E.modeles.filter((x) => x.id !== id); sauver(); rendre(); toast(`Modèle « ${m.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'serie-modifier': modaleSerie(id); break;
      case 'serie-arreter': arreterSerie(id); break;
      case 'cat-modifier': modaleCategorie(id); break;
      case 'cat-nouvelle': modaleCategorie(); break;
      case 'bilan-prec': lundiBilan = ajout(lundiBilan, -7); rendre(); break;
      case 'bilan-suiv': lundiBilan = ajout(lundiBilan, 7); rendre(); break;
      case 'bilan-auj': lundiBilan = lundiDe(auj()); rendre(); break;
      default: break;
    }
  });

  let dernierPointeur = 'mouse';
  document.addEventListener('pointerdown', (e) => { dernierPointeur = e.pointerType; if (e.target.closest('#g-corps')) debutGlisse(e); });
  document.addEventListener('pointermove', mouvementGlisse, { passive: false });
  document.addEventListener('pointerup', finGlisse);
  document.addEventListener('pointercancel', finGlisse);
  // Au doigt, une fois le bloc saisi, la page ne défile plus sous le doigt.
  document.addEventListener('touchmove', (e) => { if (glisse?.actif) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('.g-col .bloc')) e.preventDefault(); });
  document.addEventListener('keydown', (e) => { if (e.target.closest?.('.g-col .bloc')) clavierBloc(e); });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  MQ_TEL.addEventListener('change', () => { if (E && $('#vue')) { defilerAuRendu = true; rendre(); } });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !glisse) rendre(); // l'heure et le jour ont changé
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
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
  window.__planner = { etat: () => E, regles: R };
  init();
})();
