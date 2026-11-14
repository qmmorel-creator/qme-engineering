// Carnet de musculation et cross-training QME : séances, WOD et scores, volume, records détectés,
// progression, minuteur hors ligne, modèles. Données synchronisées par clé de licence ou code d'accès.
// Aucune donnée de santé : seulement des performances sportives.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MSC;
  const API = '/api/templates';
  const PRODUIT = 'MSC';
  const CLE_CODE = 'qme-msc-code';
  const CLE_CACHE = 'qme-msc-cache';
  const CLE_DEMO = 'qme-msc-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-msc-ecran-accueil';
  const CLE_SON = 'qme-msc-son';
  const DEFAUTS = { reglages: B.reglages, groupes: B.groupes };

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, nombre, formatDuree } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const u = () => E.reglages.unite;
  const champNombre = (x) => (x === null || x === undefined ? '' : String(x).replace('.', ','));

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'seances';
  let annulation = null;
  const filtreBiblio = { groupe: '', q: '' };
  const filtreRecords = { q: '' };
  const prog = { mesure: 'tonnage', periode: 7, ex: '' };
  let semainesVisibles = 6;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  let IDX = R.index(B, null);
  const majIndex = () => { IDX = R.index(B, E); };
  const ex = (id) => IDX.get(id);
  const nomEx = (id) => ex(id)?.nom || 'Exercice supprimé';
  const nomGroupe = (id) => B.groupes.find((g) => g.id === id)?.nom || 'Autre';
  const seance = (id) => E.seances.find((s) => s.id === id);
  const modele = (id) => E.modeles.find((m) => m.id === id);
  const evts = () => R.chronologieRecords(E, IDX, E.reglages);
  // Un record par exercice (ou WOD) et par séance : le 1RM estimé passe avant la charge max.
  const uniques = (l) => { const vu = new Set(); return l.filter((x) => { const k = `${x.seance}|${x.ex || x.cle}`; if (vu.has(k)) return false; vu.add(k); return true; }); };

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    majIndex(); sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }

  // Valeur d'un record, lisible.
  function valeurTexte(type, v, exId) {
    const e = ex(exId);
    switch (type) {
      case 'rm': return `≈ ${nombre(v)} ${u()}`;
      case 'charge': return `${nombre(v, 2)} ${u()}`;
      case 'reps': return `${v} reps`;
      case 'temps': return formatDuree(v);
      case 'distance': return `${nombre(v, 0)} m`;
      case 'allure': return `${formatDuree(v)} /${nombre(e?.allure || 1000, 0)} m`;
      case 'calories': return `${v} cal`;
      default: return String(v);
    }
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
        E = normaliser(corps.donnees); majIndex();
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
        E = normaliser(corps.donnees); majIndex();
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
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes séances sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Code interne (MSC-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      E = normaliser(c.etat); majIndex(); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E) { majIndex(); cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    majIndex();
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    arreterMinuteur(true);
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Pratiquant fictif sur 10 semaines (une semaine de pause) : force le lundi et le mercredi, WOD le
  // vendredi (AMRAP refait avec un meilleur score, For Time d'abord au temps limite puis terminé, EMOM,
  // intervalles), soulevé de terre et rameur un samedi sur deux, séance du jour avec un record, un WOD
  // du jour sans score, un exercice personnel et un modèle personnel. Charges et dates fictives.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const L = R.lundi(t);
    const jour = (k, d) => ajout(L, 7 * k + d);
    const r25 = (x) => Math.round(x / 2.5) * 2.5;
    const r125 = (x) => Math.round(x / 1.25) * 1.25;
    e.modeles = B.modeles.map(R.modeleDeBase);
    e.exercicesPerso = [R.normaliserExercice({ id: 'p-tirage-elastique', nom: 'Tirage poitrine à l\'élastique', groupe: 'dos', mesure: 'reps' }, B.groupes.map((g) => g.id))];
    const seances = [];
    const s = (date, titre, blocs, extra = {}) => { if (date <= t) seances.push(R.normaliserSeance({ date, titre, type: 'series', exercices: blocs.map(([x, series]) => ({ ex: x, series })), ...extra })); };
    const w = (date, mId, score, extra = {}) => {
      if (date > t) return;
      const m = e.modeles.find((x) => x.id === mId);
      const sc = R.seanceDepuisModele(m, date);
      sc.wod.mouvements.forEach((mv) => { if (extra.charges?.[mv.ex]) mv.charge = extra.charges[mv.ex]; });
      Object.assign(sc.wod.score, score);
      seances.push(sc);
    };
    const n = (k, charge, reps, rpe = null) => Array.from({ length: k }, (_, i) => ({ charge, reps, rpe: i === k - 1 ? rpe : null }));
    for (let k = -9; k <= 0; k++) {
      if (k === -5) continue; // semaine de pause
      const p = k + 9;
      s(jour(k, 0), 'Bas du corps · force', [
        ['squat', n(5, r25(80 + 2.5 * p), 5, Math.min(9, 7 + p * 0.25))],
        ['sdt-roumain', n(3, r25(60 + 2.5 * Math.floor(p / 2)), 8)],
        ['fente-bulgare', n(3, 16 + 2 * Math.floor(p / 3), 8)],
        ['leg-curl', n(3, 35 + 5 * Math.floor(p / 4), 12)],
        ...(p % 2 ? [['mollets-debout', n(3, 60, 12)]] : []),
      ], { modele: 'm-bas-force', duree: 65 });
      s(jour(k, 2), 'Haut du corps · poussée', [
        ['dev-couche', n(4, r125(60 + 1.25 * p), 6, Math.min(9, 7.5 + p * 0.2))],
        ['dev-militaire', n(3, r125(35 + 1.25 * Math.floor(p / 2)), 8)],
        ['dev-incline-halteres', n(3, 20 + 2 * Math.floor(p / 3), 10)],
        ['elevations-laterales', n(3, p > 5 ? 10 : 8, 12)],
        ['extension-poulie', n(3, 25, 12)],
      ], { modele: 'm-haut-pousse', duree: 55 });
      const typeWod = (k + 12) % 4;
      if (typeWod === 0) w(jour(k, 4), 'm-amrap-12', { tours: 5 + Math.floor(p / 3), reps: (p * 7) % 40 });
      if (typeWod === 1) w(jour(k, 4), 'm-fortime-rameur', p < 4 ? { termine: false, tours: 2, reps: 18 } : { termine: true, temps: 870 - 25 * (p - 4) }, { charges: { thruster: 35 } });
      if (typeWod === 2) w(jour(k, 4), 'm-emom-10', { reussies: p < 5 ? 8 : 10 }, { charges: { 'kb-swing': 16 } });
      if (typeWod === 3) w(jour(k, 4), 'm-intervalles-20-10', { reps: 118 + 3 * p });
      if (p % 2 === 0) {
        s(jour(k, 5), 'Soulevé de terre et rameur', [
          ['souleve-terre', [{ charge: r25(110 + 2.5 * p), reps: 5, rpe: 8 }, { charge: r25(120 + 2.5 * p), reps: 3, rpe: 8.5 }, { charge: r25(130 + 2.5 * p), reps: 1, rpe: 9 }]],
          ['tractions', [{ reps: 6 + Math.floor(p / 3) }, { reps: 5 + Math.floor(p / 3) }, { reps: 5 }]],
          ['gainage', [{ temps: 45 + 5 * p }, { temps: 45 }]],
          ['rameur', [{ distance: 2000, temps: 500 - 4 * p }]],
        ], { duree: 50 });
      }
    }
    // Séance du jour (record aux tractions) et WOD du jour encore sans score.
    s(t, 'Haut du corps · tirage', [
      ['tractions', [{ reps: 11, rpe: 9 }, { reps: 8 }, { reps: 7 }]],
      ['rowing-barre', n(4, 62.5, 8, 8)],
      ['tirage-horizontal', n(3, 50, 10)],
      ['p-tirage-elastique', [{ reps: 15 }, { reps: 15 }]],
      ['curl-halteres', n(3, 12, 10)],
    ], { modele: 'm-haut-tirage', note: 'Bonne séance, prise large aux tractions.', duree: 50 });
    const emom = R.seanceDepuisModele(e.modeles.find((x) => x.id === 'm-emom-10'), t);
    emom.wod.mouvements[0].charge = 20;
    seances.push(emom);
    e.seances = seances;
    const lundiPasse = e.seances.find((x) => x.titre === 'Bas du corps · force' && x.date < t);
    if (lundiPasse) e.modeles.unshift({ ...R.modeleDepuisSeance(lundiPasse, 'Mes jambes du lundi'), id: 'perso-jambes' });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT_TEXTE = 'Ce carnet n\'est ni un programme d\'entraînement ni un avis médical. Avant de reprendre une activité intense, ou en cas de doute sur ta santé, consulte un médecin ou un professionnel du sport. Les 1RM affichés sont des estimations par formule : ne cherche pas à les vérifier sans encadrement.';
  const AVERTISSEMENT = `<p class="mention avertissement">${AVERTISSEMENT_TEXTE}</p>`;

  function ecranConnexion(message = '') {
    document.title = 'Carnet de musculation et cross-training · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="120" width="40" height="100" fill="#141414"/>
          <rect x="70" y="90" width="40" height="160" fill="#1D4E89"/>
          <rect x="110" y="160" width="220" height="20" fill="#141414"/>
          <rect x="330" y="90" width="40" height="160" fill="#1D4E89"/>
          <rect x="380" y="120" width="40" height="100" fill="#141414"/>
          <circle cx="500" cy="80" r="50" fill="#F5B400"/>
          <path d="M440 300 L440 220 A80 80 0 0 1 520 300 Z" fill="#D9302A"/>
          <rect x="20" y="250" width="120" height="40" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Carnet de musculation et cross-training</p>
          <h1>Chaque série notée, chaque record vu.</h1>
          <p>Tes séances et tes WOD, le volume de la semaine, les records détectés tout seuls et le minuteur pour l'AMRAP, l'EMOM, le For Time et les intervalles.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton carnet</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton carnet est enregistré en ligne et te suit sur tous tes appareils, même à la salle sans réseau.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
        <p class="mention">${AVERTISSEMENT_TEXTE}</p>
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
  const accueilVide = () => ({ unite: 'kg', formule: 'epley', modeles: B.modeles.map((m) => m.id) });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const choix = (nom, options, valeur) => `<div class="choix-statut deux">${options.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${valeur === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On prépare ton carnet.</h1>
      <p class="intro">Tu notes tes séances et tes WOD : le volume, les records et les courbes de progression se calculent. Le carnet garde seulement tes performances sportives, aucune donnée de santé (pas de poids de corps, de mensurations ni de fréquence cardiaque).</p>
      <div class="form-accueil">
        <fieldset class="champ"><legend>Unité des charges <small>Les charges sont gardées telles que tu les saisis, sans conversion.</small></legend>${choix('unite', [['kg', 'Kilogrammes (kg)'], ['lb', 'Livres (lb)']], a.unite)}</fieldset>
        <fieldset class="champ"><legend>Estimation du 1RM <small>Le maximum sur une répétition est estimé à partir de tes séries de 10 répétitions au plus. ${esc(B.formules.epley.texte)}.</small></legend>${choix('formule', [['epley', 'Epley'], ['brzycki', 'Brzycki']], a.formule)}</fieldset>
        <fieldset class="champ cadre-champs"><legend>Modèles de séances à ajouter <small>Rédigés pour QME, sans charge : tu mets les tiennes. Tu pourras en créer depuis n'importe quelle séance.</small></legend>
          <div class="choix-modeles">${B.modeles.map((m) => `<label class="case"><input type="checkbox" name="modele" value="${m.id}" ${a.modeles.includes(m.id) ? 'checked' : ''}> <span><b>${esc(m.nom)}</b><small>${m.type === 'wod' ? esc(R.descriptionWod(R.normaliserWod(m.wod))) : `${pluriel(m.exercices.length, 'exercice')}`}</small></span></label>`).join('')}</div>
        </fieldset>
      </div>
      <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <p class="aide" style="margin-top:20px;max-width:760px">${AVERTISSEMENT_TEXTE}</p>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Créer mon carnet</button></div>
    </div>`;
    document.querySelectorAll('[name=unite]').forEach((el) => el.addEventListener('change', () => { accueil.unite = el.value; }));
    document.querySelectorAll('[name=formule]').forEach((el) => el.addEventListener('change', () => { accueil.formule = el.value; }));
    document.querySelectorAll('[name=modele]').forEach((el) => el.addEventListener('change', () => { accueil.modeles = [...document.querySelectorAll('[name=modele]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.reglages = R.normaliserReglages({ unite: accueil.unite, formule: accueil.formule }, B.reglages);
    E.modeles = B.modeles.filter((m) => accueil.modeles.includes(m.id)).map(R.modeleDeBase);
    accueil = accueilVide();
    majIndex();
    vue = 'seances';
    sauver();
    demarrer();
    toast('Ton carnet est prêt. Note ta première séance.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    seances: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="3" height="6" fill="currentColor"/><rect x="5" y="6" width="3" height="12" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><rect x="16" y="6" width="3" height="12" fill="currentColor"/><rect x="19" y="9" width="3" height="6" fill="currentColor"/></svg>',
    progres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="14" width="4" height="7" fill="currentColor"/><rect x="10" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="4" width="4" height="17" fill="currentColor"/></svg>',
    records: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    chrono: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13V5A8 8 0 0 1 20 13Z" fill="currentColor"/><rect x="10" y="1" width="4" height="2" fill="currentColor"/></svg>',
    biblio: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['seances', 'Séances'], ['progres', 'Progression'], ['records', 'Records'], ['chrono', 'Minuteur'], ['biblio', 'Bibliothèque']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/musculation/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Musculation et<br>cross-training</span>
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
    document.title = `${titres[vue]} · Carnet de musculation`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { seances: vueSeances, progres: vueProgres, records: vueRecords, chrono: vueChrono, biblio: vueBiblio }[vue]();
    brancherInfobulles();
    for (const [sel, f] of [['#recherche-biblio', filtreBiblio], ['#recherche-records', filtreRecords]]) {
      const q = $(sel);
      if (q) q.addEventListener('input', (e) => { f.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); });
    }
    $('#choix-ex-prog')?.addEventListener('change', (e) => { prog.ex = e.target.value; rendre(); });
    const fig = $('.graphique.courbe');
    if (fig && derniereCourbe) {
      const l = fig.clientWidth - 2 * parseFloat(getComputedStyle(fig).paddingLeft || 0);
      const vb = Number(fig.querySelector('svg').viewBox.baseVal.width);
      if (l > 0 && Math.abs(l - vb) > 8) {
        const { points, exId, type } = derniereCourbe;
        fig.outerHTML = courbe(points, exId, type, l);
        brancherInfobulles();
      }
    }
    document.querySelectorAll('.filtres').forEach((f) => { const a = f.querySelector('[aria-pressed="true"]'); if (a && f.scrollWidth > f.clientWidth) f.scrollLeft = a.offsetLeft - f.offsetLeft - 12; });
    if (vue === 'chrono') brancherChrono();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const etiquetteFormat = (s) => (s.type === 'wod' ? `<span class="etiquette ciel">${esc(B.formats[s.wod.format].court)}</span>` : '<span class="etiquette sable">Séries</span>');

  // Résumé d'une séance en une ligne.
  function resumeSeance(s) {
    if (s.type === 'wod') return `${esc(R.descriptionWod(s.wod))} · ${s.wod.mouvements.map((m) => esc(nomEx(m.ex))).join(', ')}`;
    const v = R.volumeSeance(s, IDX);
    const noms = s.exercices.map((b) => esc(nomEx(b.ex)));
    return `${noms.slice(0, 3).join(', ')}${noms.length > 3 ? ` et ${noms.length - 3} autre${noms.length > 4 ? 's' : ''}` : ''} · ${pluriel(v.series, 'série')}${v.tonnage ? ` · ${nombre(v.tonnage, 0)} ${u()} soulevés` : ''}`;
  }

  function carteSeance(s, records) {
    const r = [...new Set(records.filter((x) => x.seance === s.id && !x.premier).map((x) => x.ex || x.cle))]; // un record par exercice
    const d = versDate(s.date);
    const scoreManquant = s.type === 'wod' && !R.scoreRempli(s.wod);
    return `<li class="carte-seance ${s.date === auj() ? 'aujourdhui' : ''}">
      <span class="date-pastille ${s.date === auj() ? 'auj' : ''}"><b>${d.getDate()}</b>${fmt(s.date, { weekday: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="seance" data-id="${s.id}"><b>${esc(s.titre || (s.type === 'wod' ? R.descriptionWod(s.wod) : 'Séance'))}</b><span>${resumeSeance(s)}</span>${s.type === 'wod' && !scoreManquant ? `<span class="score-ligne">${esc(R.scoreTexte(s.wod))}</span>` : ''}</button>
      <span class="cs-etiquettes">${etiquetteFormat(s)}${r.length ? `<span class="etiquette record">${r.length > 1 ? `${r.length} records` : 'Record'}</span>` : ''}${scoreManquant ? '<span class="etiquette jaune">Score à saisir</span>' : ''}</span>
    </li>`;
  }

  // ---------- Séances ----------
  function vueSeances() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Séances</h1><p>Tes séances et tes WOD, semaine par semaine. Les records se détectent à l'enregistrement.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle-seance">${ICONES.plus}Séance</button><button class="btn" data-action="nouveau-wod">${ICONES.plus}WOD</button><button class="btn" data-action="depuis-modele">Depuis un modèle</button></div></div>`;
    if (!E.seances.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune séance pour l'instant</h3><p>Note ta première séance : exercices, séries, charges et répétitions. Ou pars d'un modèle, ou d'un WOD (AMRAP, EMOM, For Time, intervalles) avec son score.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-seance">${ICONES.plus}Noter une séance</button><button class="btn" data-action="depuis-modele">Partir d'un modèle</button></div></div></div>${AVERTISSEMENT}`;
    }
    const sem = R.volumeSemaines(E, IDX, t, 2);
    const [prec, cette] = sem;
    const ev = evts();
    const recents = uniques(ev.filter((x) => !x.premier && R.ecart(x.date, t) <= 30 && x.date <= t));
    const ecartT = prec.tonnage ? Math.round((cette.tonnage - prec.tonnage) / prec.tonnage * 100) : null;
    const affilee = R.semainesAffilee(E, t);
    const tuiles = [
      ['Cette semaine', String(cette.seances), `${pluriel(cette.seances, 'séance')} · ${affilee ? `${pluriel(affilee, 'semaine')} d'affilée` : 'reprends cette semaine'}`, 'var(--bleu)', 'rond'],
      ['Tonnage', `${nombre(cette.tonnage, 0)}`, `${u()} soulevés${ecartT !== null ? ` · ${ecartT >= 0 ? '+' : '−'}${Math.abs(ecartT)} % / sem. passée` : ''}`, 'var(--jaune)', ''],
      ['Séries', String(cette.series), `cette semaine · ${prec.series} la précédente`, 'var(--encre)', ''],
      ['Records', String(recents.length), 'sur les 30 derniers jours', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    // Séances groupées par semaine, de la plus récente à la plus ancienne.
    const triees = R.chronologiques(E).reverse();
    const semaines = [];
    for (const s of triees) {
      const l = R.lundi(s.date);
      if (!semaines.length || semaines.at(-1).lundi !== l) semaines.push({ lundi: l, seances: [] });
      semaines.at(-1).seances.push(s);
    }
    const visibles = semaines.slice(0, semainesVisibles);
    const listeRecords = recents.slice(-6).reverse();
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${listeRecords.length ? `<h2 class="titre-section">Derniers records <span>${pluriel(recents.length, 'record')} en 30 jours</span></h2><ul class="records-recents">${listeRecords.map(puceRecord).join('')}</ul>` : ''}
      ${visibles.map((w) => {
        const v = R.volumePeriode(E, IDX, w.lundi, ajout(w.lundi, 6));
        const nom = w.lundi === R.lundi(t) ? 'Cette semaine' : w.lundi === ajout(R.lundi(t), -7) ? 'La semaine dernière' : `Semaine du ${dateCourte(w.lundi)}`;
        return `<section class="semaine"><h2 class="titre-section">${nom} <span>${pluriel(v.seances, 'séance')} · ${pluriel(v.series, 'série')} · ${nombre(v.tonnage, 0)} ${u()}</span></h2><ul class="liste-seances">${w.seances.map((s) => carteSeance(s, ev)).join('')}</ul></section>`;
      }).join('')}
      ${semaines.length > semainesVisibles ? `<div class="rang" style="margin-top:16px"><button class="btn" data-action="plus-semaines">Voir les semaines précédentes (${semaines.length - semainesVisibles})</button></div>` : ''}
      ${AVERTISSEMENT}`;
  }

  function puceRecord(x) {
    const nom = x.type === 'wod' ? (seance(x.seance)?.titre || 'WOD') : nomEx(x.ex);
    const val = x.type === 'wod' ? x.valeur : valeurTexte(x.type, x.valeur, x.ex);
    const avant = x.ancien === null ? '' : x.type === 'wod' ? ` · avant : ${esc(x.ancien)}` : ` · avant : ${esc(valeurTexte(x.type, x.ancien, x.ex))}`;
    return `<li><span class="date-pastille record"><b>${versDate(x.date).getDate()}</b>${fmt(x.date, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="${x.type === 'wod' ? 'seance' : 'exercice'}" data-id="${x.type === 'wod' ? x.seance : x.ex}"><b>${esc(nom)}</b><span>${R.LIB_RECORD[x.type]} : <strong>${esc(val)}</strong>${avant}</span></button></li>`;
  }

  // ---------- Graphiques ----------
  // Une seule série par graphique (pas de légende : le titre la nomme), barres et ligne de la teinte 1
  // de la palette validée (skill dataviz), semaine en cours en encre, infobulle au survol et au clavier,
  // tableau accessible dans chaque bloc.
  function colonnesSemaines(sem, cle) {
    const max = Math.max(1, ...sem.map((s) => s[cle]));
    const t = R.lundi(auj());
    const unit = cle === 'tonnage' ? u() : 'séries';
    const val = (s) => (cle === 'tonnage' ? nombre(s.tonnage, 0) : String(s.series));
    const cols = sem.map((s, i) => {
      const h = s[cle] / max * 100;
      const etiq = sem.length - 1 - i;
      return `<div class="col-proj ${s.lundi === t ? 'actif' : ''} ${s[cle] === max && max > 1 ? 'max' : ''}" tabindex="0" data-info="<b>Semaine du ${esc(dateCourte(s.lundi))}</b>${esc(val(s))} ${unit} · ${pluriel(s.seances, 'séance')}"><span class="cp-val">${s[cle] ? (cle === 'tonnage' ? nombre(s.tonnage / 1000, 1) + ' t' : s.series) : ''}</span><span class="cp-zone">${s[cle] ? `<span class="cp-barre" style="height:${h.toFixed(1)}%"></span>` : ''}</span><span class="cp-mois">${etiq % 2 === 0 || !estTel() ? esc(fmt(s.lundi, { day: 'numeric', month: 'numeric' })) : ''}</span></div>`;
    }).join('');
    const table = `<table class="tableau petit"><thead><tr><th>Semaine du</th><th class="nb">Séances</th><th class="nb">Séries</th><th class="nb">Tonnage (${u()})</th></tr></thead><tbody>${sem.map((s) => `<tr><td>${dateCourte(s.lundi)}</td><td class="nb">${s.seances}</td><td class="nb">${s.series}</td><td class="nb">${nombre(s.tonnage, 0)}</td></tr>`).join('')}</tbody></table>`;
    return `<figure class="graphique"><div class="projection" role="img" aria-label="${cle === 'tonnage' ? 'Tonnage' : 'Séries'} par semaine sur ${sem.length} semaines">${cols}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile">${table}</div></details></figure>`;
  }

  function barresGroupes(v) {
    const lignes = B.groupes.map((g) => ({ g, ...(v.groupes[g.id] || { series: 0, tonnage: 0 }) }));
    const max = Math.max(1, ...lignes.map((l) => l.series));
    return `<figure class="graphique"><div class="barres-cats" role="img" aria-label="Séries par groupe musculaire">${lignes.map((l) => `<div class="barre-cat ${l.series ? '' : 'zero'}" tabindex="0" data-info="<b>${esc(l.g.nom)}</b>${pluriel(l.series, 'série')}${l.tonnage ? ` · ${nombre(l.tonnage, 0)} ${u()}` : ''}"><span class="bc-nom">${esc(l.g.nom)}</span><span class="bc-piste">${l.series ? `<span class="bc-barre" style="width:${(l.series / max * 100).toFixed(1)}%"></span>` : ''}</span><span class="bc-val">${l.series ? pluriel(l.series, 'série') : '–'}</span></div>`).join('')}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Groupe</th><th class="nb">Séries</th><th class="nb">Tonnage (${u()})</th></tr></thead><tbody>${lignes.map((l) => `<tr><td>${esc(l.g.nom)}</td><td class="nb">${l.series}</td><td class="nb">${nombre(l.tonnage, 0)}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
  }

  // Graduations « propres » (1, 2, 2,5, 5 × 10^n).
  function graduations(min, max, n = 4) {
    if (min === max) { min -= 1; max += 1; }
    const brut = (max - min) / n;
    const p = 10 ** Math.floor(Math.log10(brut));
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= brut) || 10 * p;
    const debut = Math.floor(min / pas) * pas, fin = Math.ceil(max / pas) * pas;
    const t = [];
    for (let x = debut; x <= fin + pas / 1000; x += pas) t.push(Math.round(x * 1000) / 1000);
    return t;
  }

  // Largeur du tracé = largeur réelle du cadre (mesurée après le premier rendu) : texte à taille réelle.
  let derniereCourbe = null;
  function courbe(points, exId, type, largeurCadre = null) {
    derniereCourbe = { points, exId, type };
    const largeur = Math.max(260, Math.round(largeurCadre ?? Math.min(1120, ($('#vue')?.clientWidth || 800) - (estTel() ? 22 : 34))));
    const H = estTel() ? 220 : 260;
    const g = 44, d = 18, h = 14, b = 28;
    const dates = points.map((p) => p.date);
    const x0 = dates[0], etendue = Math.max(1, R.ecart(x0, dates.at(-1)));
    const vals = points.map((p) => p.valeur);
    const ticks = graduations(Math.min(...vals), Math.max(...vals));
    const yMin = ticks[0], yMax = ticks.at(-1);
    const X = (dt) => (points.length === 1 ? (g + largeur - d) / 2 : g + R.ecart(x0, dt) / etendue * (largeur - g - d));
    const Y = (v) => h + (1 - (v - yMin) / (yMax - yMin)) * (H - h - b);
    const fy = (v) => (type === 'temps' || type === 'allure' ? formatDuree(v) : nombre(v, v >= 100 ? 0 : 1));
    const chemin = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Y(p.valeur).toFixed(1)}`).join(' ');
    // Étiquettes de l'axe des dates comptées depuis la fin pour ne pas se chevaucher.
    const pasX = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((largeur - g) / 90))));
    const etiquettesX = points.map((p, i) => ((points.length - 1 - i) % pasX === 0 ? `<text x="${X(p.date).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(fmt(p.date, { day: 'numeric', month: 'short' }).replace('.', ''))}</text>` : '')).join('');
    const dernier = points.at(-1);
    return `<figure class="graphique courbe">
      <svg viewBox="0 0 ${largeur} ${H}" width="100%" role="img" aria-label="Progression de ${esc(nomEx(exId))} : ${esc(R.LIB_RECORD[type])} par séance">
        ${ticks.map((v) => `<line class="grille" x1="${g}" x2="${largeur - d}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axe" x="${g - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fy(v))}</text>`).join('')}
        <g class="axe-x">${etiquettesX}</g>
        <line class="reticule" x1="0" x2="0" y1="${h}" y2="${H - b}" hidden/>
        <path class="trace" d="${chemin}"/>
        ${points.map((p) => `<circle class="point" cx="${X(p.date).toFixed(1)}" cy="${Y(p.valeur).toFixed(1)}" r="4"/>`).join('')}
        <text class="etiquette-fin" x="${Math.min(X(dernier.date), largeur - d - 4).toFixed(1)}" y="${(Y(dernier.valeur) - 10).toFixed(1)}" text-anchor="end">${esc(valeurTexte(type, dernier.valeur, exId))}</text>
        ${points.map((p) => `<circle class="cible" cx="${X(p.date).toFixed(1)}" cy="${Y(p.valeur).toFixed(1)}" r="14" tabindex="0" data-info="<b>${esc(valeurTexte(type, p.valeur, exId))}</b>${esc(dateLongue(p.date))}"/>`).join('')}
      </svg><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th class="nb">${esc(R.LIB_RECORD[type])}</th></tr></thead><tbody>${points.slice().reverse().map((p) => `<tr><td>${dateCourte(p.date)}</td><td class="nb">${esc(valeurTexte(type, p.valeur, exId))}</td></tr>`).join('')}</tbody></table></div></details>
    </figure>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      if (fig.dataset.branche) return;
      fig.dataset.branche = '1';
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const reticule = fig.querySelector('.reticule');
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        if (reticule) { const cx = el.getAttribute('cx'); reticule.setAttribute('x1', cx); reticule.setAttribute('x2', cx); reticule.hidden = false; }
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 8;
        if (y < 4) y = re.bottom - rf.top + 8;
        bulle.style.left = `${x}px`;
        bulle.style.top = `${y}px`;
      };
      const cacher = () => { bulle.hidden = true; if (reticule) reticule.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      const cibles = [...fig.querySelectorAll('[data-info]')];
      cibles.forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      // Courbe : le réticule suit le pointeur et s'accroche au point le plus proche en x.
      const svg = fig.querySelector('.courbe svg, svg');
      if (fig.classList.contains('courbe') && svg) {
        svg.addEventListener('pointermove', (e) => {
          let meilleur = null, dist = Infinity;
          for (const c of cibles) { const r = c.getBoundingClientRect(); const dd = Math.abs(r.left + r.width / 2 - e.clientX); if (dd < dist) { dist = dd; meilleur = c; } }
          if (meilleur && !meilleur.classList.contains('survol')) montrer(meilleur);
        });
      }
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Progression ----------
  function vueProgres() {
    const t = auj();
    const titre = '<div class="vue-tete"><div><h1>Progression</h1><p>Le volume de tes semaines, l\'équilibre entre les groupes musculaires et la courbe de chaque exercice.</p></div></div>';
    if (!E.seances.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à tracer pour l'instant</h3><p>Les graphiques apparaissent dès ta première séance enregistrée.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-seance">${ICONES.plus}Noter une séance</button></div></div></div>${AVERTISSEMENT}`;
    const sem = R.volumeSemaines(E, IDX, t, 12);
    const vg = R.volumePeriode(E, IDX, ajout(t, -(prog.periode - 1)), t);
    const pratiques = R.exercicesPratiques(E);
    if (!prog.ex || !pratiques.some((p) => p.ex === prog.ex)) prog.ex = pratiques.find((p) => ex(p.ex)?.mesure === 'charge')?.ex || pratiques[0]?.ex || '';
    const e = ex(prog.ex);
    const type = e ? R.PRINCIPALE[e.mesure] : null;
    const points = e ? R.progression(E, IDX, E.reglages, prog.ex) : [];
    let blocCourbe;
    if (!pratiques.length) blocCourbe = '<div class="vide-etat petit"><div><h3>Aucun exercice en séries</h3><p>La courbe suit les exercices notés en séances « séries ». Les mouvements de WOD comptent dans le volume, pas dans les courbes.</p></div></div>';
    else if (!points.length) blocCourbe = `<div class="vide-etat petit"><div><h3>Pas encore de valeur à tracer</h3><p>${e?.mesure === 'charge' ? `Le 1RM s'estime sur des séries de ${E.reglages.repsMax} répétitions au plus avec une charge.` : 'Renseigne la mesure de cet exercice dans tes séries.'}</p></div></div>`;
    else {
      const premier = points[0], dernier = points.at(-1);
      const evol = premier.valeur ? Math.round((dernier.valeur - premier.valeur) / premier.valeur * 100) : 0;
      const sens = type === 'allure' ? -evol : evol;
      blocCourbe = `<p class="resume-courbe"><b>${esc(R.LIB_RECORD[type])}</b> · ${pluriel(points.length, 'séance')} · ${esc(valeurTexte(type, premier.valeur, prog.ex))} le ${dateCourte(premier.date)} → <b>${esc(valeurTexte(type, dernier.valeur, prog.ex))}</b> le ${dateCourte(dernier.date)}${points.length > 1 ? ` <span class="etiquette ${sens > 0 ? 'vert' : sens < 0 ? 'rose' : 'sable'}">${sens > 0 ? 'mieux' : sens < 0 ? 'moins bien' : 'stable'} ${evol ? `${evol > 0 ? '+' : '−'}${Math.abs(evol)} %` : ''}</span>` : ''}</p>
        ${courbe(points, prog.ex, type)}
        ${type === 'rm' ? `<p class="aide">1RM estimé par la formule de ${esc(B.formules[E.reglages.formule].nom)} (${esc(B.formules[E.reglages.formule].texte)}), sur la meilleure série de ${E.reglages.repsMax} répétitions au plus de chaque séance. C'est une estimation, pas une charge à tenter.</p>` : ''}`;
    }
    const options = pratiques.map((p) => `<option value="${esc(p.ex)}" ${p.ex === prog.ex ? 'selected' : ''}>${esc(nomEx(p.ex))} (${pluriel(p.seances, 'séance')})</option>`).join('');
    return `${titre}
      <section><div class="titre-outils"><h2 class="titre-section">${prog.mesure === 'tonnage' ? 'Tonnage' : 'Séries'} par semaine <span>12 dernières semaines</span></h2>
        <div class="filtres" role="group" aria-label="Mesure du volume">${[['tonnage', `Tonnage (${u()})`], ['series', 'Séries']].map(([k, l]) => `<button class="filtre" data-action="prog-mesure" data-m="${k}" aria-pressed="${prog.mesure === k}">${l}</button>`).join('')}</div></div>
        ${colonnesSemaines(sem, prog.mesure)}
        <p class="aide">Tonnage = charge × répétitions, additionné sur toutes les séries avec une charge (WOD compris, sur les tours complets). Les exercices au poids du corps comptent en séries et en répétitions, sans poids de corps.</p>
      </section>
      <div class="colonnes-progres">
        <section><div class="titre-outils"><h2 class="titre-section">Séries par groupe <span>${prog.periode} derniers jours</span></h2>
          <div class="filtres" role="group" aria-label="Période">${[[7, '7 jours'], [28, '28 jours']].map(([k, l]) => `<button class="filtre" data-action="prog-periode" data-p="${k}" aria-pressed="${prog.periode === k}">${l}</button>`).join('')}</div></div>
          ${barresGroupes(vg)}
          <p class="aide">Une série d'exercice compte pour un ; un mouvement de WOD compte pour un bloc. Un groupe à zéro n'a pas été travaillé sur la période.</p>
        </section>
        <section><div class="titre-outils"><h2 class="titre-section">Courbe d'un exercice</h2>
          ${pratiques.length ? `<label class="champ choix-ex"><span class="sr-only">Exercice</span><select id="choix-ex-prog">${options}</select></label>` : ''}</div>
          ${blocCourbe}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Records ----------
  function vueRecords() {
    const titre = `<div class="vue-tete"><div><h1>Records</h1><p>Détectés automatiquement à chaque séance. Le 1RM est une <b>estimation</b> par la formule de ${esc(B.formules[E.reglages.formule].nom)}, jamais une charge à tester seul.</p></div></div>`;
    const ev = evts();
    const battus = uniques(ev.filter((x) => !x.premier));
    const pratiques = R.exercicesPratiques(E);
    if (!pratiques.length && !E.seances.some((s) => s.type === 'wod')) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun record pour l'instant</h3><p>Ta première séance pose tes références ; chaque performance meilleure ensuite devient un record, signalé à l'enregistrement.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-seance">${ICONES.plus}Noter une séance</button></div></div></div>${AVERTISSEMENT}`;
    const q = R.sansAccents(filtreRecords.q);
    const parGroupe = new Map();
    for (const p of pratiques) {
      const e = ex(p.ex);
      if (!e || (q && !R.sansAccents(e.nom).includes(q))) continue;
      if (!parGroupe.has(e.groupe)) parGroupe.set(e.groupe, []);
      parGroupe.get(e.groupe).push(p.ex);
    }
    const cartes = B.groupes.filter((g) => parGroupe.has(g.id)).map((g) => `<section class="groupe-cat"><h3 class="titre-cat">${esc(g.nom)} <span>${pluriel(parGroupe.get(g.id).length, 'exercice')}</span></h3><div class="cartes-records">${parGroupe.get(g.id).sort((a, b) => nomEx(a).localeCompare(nomEx(b), 'fr')).map(carteRecord).join('')}</div></section>`).join('');
    // WOD : meilleur score par WOD (modèle ou titre), avec le nombre de fois.
    const cles = new Map();
    for (const s of R.chronologiques(E)) if (s.type === 'wod') { const c = R.cleWod(s); if (!cles.has(c)) cles.set(c, []); cles.get(c).push(s); }
    const wods = [...cles.entries()].filter(([, l]) => !q || l.some((s) => R.sansAccents(s.titre).includes(q))).map(([c, l]) => {
      const notes = l.filter((s) => R.scoreRempli(s.wod));
      const best = notes.reduce((m, s) => (!m || R.comparerScores(s.wod.format, s.wod.score, m.wod.score) > 0 ? s : m), null);
      const der = l.at(-1);
      return `<button class="carte-record" data-action="historique-wod" data-cle="${esc(c)}"><span class="cr-nom">${esc(der.titre || R.descriptionWod(der.wod))}</span><span class="cr-val">${best ? esc(R.scoreTexte(best.wod)) : 'Pas encore de score'}</span><span class="cr-detail">${esc(R.descriptionWod(der.wod))} · ${pluriel(l.length, 'fois', 'fois')}${best ? ` · meilleur le ${dateCourte(best.date)}` : ''}</span></button>`;
    }).join('');
    return `${titre}
      <div class="outils-liste"><label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-records" type="search" placeholder="Rechercher un exercice ou un WOD" value="${esc(filtreRecords.q)}"></label><span class="resume-liste">${pluriel(battus.length, 'record battu', 'records battus')} depuis le début du carnet</span></div>
      ${battus.length && !q ? `<h2 class="titre-section">Derniers records</h2><ul class="records-recents">${battus.slice(-6).reverse().map(puceRecord).join('')}</ul>` : ''}
      ${wods ? `<h2 class="titre-section">WOD <span>meilleur score de chaque WOD refait</span></h2><div class="cartes-records">${wods}</div>` : ''}
      <h2 class="titre-section">Exercices <span>meilleures performances en séances « séries »</span></h2>
      ${cartes || '<p class="aide">Aucun exercice ne correspond à cette recherche.</p>'}
      ${AVERTISSEMENT}`;
  }

  function carteRecord(exId) {
    const e = ex(exId);
    const r = R.recordsExercice(E, IDX, E.reglages, exId, B.repsRecords);
    const t = R.PRINCIPALE[e.mesure];
    const principal = r.types[t] || r.types.charge;
    const tp = r.types[t] ? t : 'charge';
    let detail = '';
    if (e.mesure === 'charge') detail = `<span class="cr-reps">${B.repsRecords.map((n) => `<span><small>${n} rep${n > 1 ? 's' : ''}</small>${r.parReps[n] ? nombre(r.parReps[n].charge, 2) : '–'}</span>`).join('')}</span>`;
    else if (r.types.allure) detail = `<span class="cr-detail">Meilleure allure : ${esc(valeurTexte('allure', r.types.allure.valeur, exId))}</span>`;
    return `<button class="carte-record" data-action="exercice" data-id="${esc(exId)}"><span class="cr-nom">${esc(e.nom)}</span><span class="cr-val">${principal ? esc(valeurTexte(tp, principal.valeur, exId)) : '–'}<small>${esc(R.LIB_RECORD[tp])}${principal ? ` · ${dateCourte(principal.date)}` : ''}</small></span>${detail}${e.mesure === 'charge' && r.types.charge ? `<span class="cr-detail">Charge max : ${esc(valeurTexte('charge', r.types.charge.valeur, exId))} × ${r.types.charge.serie.reps}</span>` : ''}</button>`;
  }

  // ---------- Minuteur ----------
  // Fonctionne hors ligne : tout est calculé dans la page, les bips sont synthétisés (aucun fichier).
  const mn = { config: { format: 'amrap', duree: 12, cap: 15, travail: 20, repos: 10, tours: 8, intervalle: 60, prepa: 10 }, plan: null, debut: 0, pause: 0, enPause: false, enCours: false, dernier: 0, tours: 0, fin: null, brouillon: null, boucle: null, verrou: null };
  let audio = null;
  const sonActif = () => stock.lire(CLE_SON) !== 'non';
  function bip(freq = 880, duree = 0.15) {
    if (!sonActif()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; o.type = 'square';
      g.gain.setValueAtTime(0.12, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duree);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duree);
    } catch { /* son indisponible */ }
  }
  const configMinuteur = () => {
    const c = mn.config;
    return { format: c.format, duree: c.duree * 60, cap: c.cap * 60, travail: c.travail, repos: c.repos, tours: c.tours, intervalle: c.intervalle, prepa: c.prepa };
  };
  const ecouleMs = () => (mn.enCours ? (mn.enPause ? mn.pause : performance.now() - mn.debut) : 0);

  function demarrerMinuteur() {
    if (mn.enCours && mn.enPause) { mn.debut = performance.now() - mn.pause; mn.enPause = false; boucler(); majChrono(); return; }
    mn.plan = R.planMinuteur(configMinuteur());
    mn.debut = performance.now(); mn.enCours = true; mn.enPause = false; mn.tours = 0; mn.fin = null; mn.dernier = 0;
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* son indisponible */ }
    navigator.wakeLock?.request('screen').then((v) => { mn.verrou = v; }).catch(() => {});
    boucler();
    majChrono();
  }
  function pauseMinuteur() { if (!mn.enCours || mn.enPause) return; mn.pause = performance.now() - mn.debut; mn.enPause = true; majChrono(); }
  function arreterMinuteur(silencieux = false) {
    cancelAnimationFrame(mn.boucle); mn.boucle = null;
    mn.enCours = false; mn.enPause = false; mn.plan = null; mn.fin = null; mn.tours = 0;
    mn.verrou?.release?.().catch?.(() => {}); mn.verrou = null;
    if (!silencieux) majChrono();
  }
  function terminerMinuteur(raison) {
    const ms = ecouleMs();
    const et = R.etatMinuteur(mn.plan, ms);
    mn.fin = { raison, ecoule: Math.round(Math.min(et.ecoule, mn.plan.total - mn.plan.prepa) / 1000), tours: mn.tours, minutes: et.fini ? mn.plan.tours : Math.max(0, et.tour - 1) };
    cancelAnimationFrame(mn.boucle); mn.boucle = null;
    mn.enCours = false; mn.enPause = false;
    mn.verrou?.release?.().catch?.(() => {}); mn.verrou = null;
    bip(660, 0.6);
    majChrono();
  }
  function boucler() {
    cancelAnimationFrame(mn.boucle);
    const pas = () => {
      if (!mn.enCours || mn.enPause) return;
      const ms = ecouleMs();
      const b = R.bips(mn.plan, mn.dernier, ms);
      if (b === 'fin') bip(1320, 0.35); else if (b === 'compte') bip(880, 0.12);
      mn.dernier = ms;
      if (R.etatMinuteur(mn.plan, ms).fini) { terminerMinuteur('temps'); return; }
      majChrono(true);
      mn.boucle = requestAnimationFrame(pas);
    };
    mn.boucle = requestAnimationFrame(pas);
  }

  const LIB_PHASE = { prepa: 'Préparation', travail: 'Travail', repos: 'Repos', fini: 'Terminé' };
  const PARAMS = {
    amrap: [['duree', 'Durée (min)']],
    emom: [['duree', 'Durée (min)'], ['intervalle', 'Toutes les (s)']],
    fortime: [['cap', 'Temps limite (min, 0 = aucun)']],
    intervalles: [['travail', 'Travail (s)'], ['repos', 'Repos (s)'], ['tours', 'Tours']],
    chrono: [],
  };
  function vueChrono() {
    const c = mn.config;
    const verrouille = mn.enCours;
    return `<div class="vue-tete"><div><h1>Minuteur</h1><p>AMRAP, EMOM, For Time, intervalles ou simple chronomètre, avec bips. Fonctionne sans réseau.</p></div>
      <div class="actions"><button class="btn" data-action="son">${sonActif() ? 'Son activé' : 'Son coupé'}</button></div></div>
      <div class="chrono-grille">
        <section class="chrono-reglages" ${verrouille ? 'aria-disabled="true"' : ''}>
          <div class="choix-statut cinq" role="radiogroup" aria-label="Format">${[['amrap', 'AMRAP'], ['emom', 'EMOM'], ['fortime', 'For Time'], ['intervalles', 'Intervalles'], ['chrono', 'Chrono']].map(([k, l]) => `<label><input type="radio" name="mn-format" value="${k}" ${c.format === k ? 'checked' : ''} ${verrouille ? 'disabled' : ''}><span>${l}</span></label>`).join('')}</div>
          <p class="aide">${esc(c.format === 'chrono' ? 'Compte croissant sans fin : pour une séance de séries ou un temps de repos.' : B.formats[c.format].aide)}</p>
          <div class="rang-champs">${PARAMS[c.format].map(([k, l]) => `<label class="champ">${l}<input inputmode="numeric" data-mn="${k}" value="${c[k]}" ${verrouille ? 'disabled' : ''}></label>`).join('')}<label class="champ">Préparation (s)<input inputmode="numeric" data-mn="prepa" value="${c.prepa}" ${verrouille ? 'disabled' : ''}></label></div>
          ${mn.brouillon ? `<p class="aide">Lancé depuis le WOD « ${esc(mn.brouillon.titre || R.descriptionWod(mn.brouillon.wod))} » : à la fin, le score s'y reporte.</p>` : ''}
        </section>
        <section class="chrono-cadran" aria-live="off"><div id="cadran"></div></section>
      </div>
      <p class="mention avertissement">Écoute tes sensations et arrête-toi en cas de douleur ou de malaise. ${AVERTISSEMENT_TEXTE}</p>`;
  }
  function brancherChrono() {
    document.querySelectorAll('[name=mn-format]').forEach((el) => el.addEventListener('change', () => { mn.config.format = el.value; rendre(); }));
    document.querySelectorAll('[data-mn]').forEach((el) => el.addEventListener('input', () => { const n = R.lireNombre(el.value); if (n !== null) { mn.config[el.dataset.mn] = Math.round(n); majChrono(); } }));
    majChrono();
  }
  function majChrono(leger = false) {
    const el = $('#cadran');
    if (!el) return;
    const plan = mn.plan || R.planMinuteur(configMinuteur());
    const ms = ecouleMs();
    const et = mn.enCours ? R.etatMinuteur(plan, ms) : null;
    let grand, phase, sous, progres = 0;
    if (mn.fin) {
      phase = 'fini';
      grand = formatDuree(mn.fin.ecoule);
      sous = mn.config.format === 'amrap' || mn.config.format === 'fortime' ? `${pluriel(mn.fin.tours, 'tour')} compté${mn.fin.tours > 1 ? 's' : ''}` : mn.config.format === 'emom' ? `${mn.fin.minutes} / ${plan.tours} minutes` : '';
      progres = 100;
    } else if (!et) {
      phase = 'attente';
      grand = plan.croissant ? '0:00' : formatDuree((plan.total - plan.prepa) / 1000);
      sous = mn.config.format === 'chrono' ? 'Chronomètre' : `${R.descriptionWod({ ...configMinuteur(), duree: mn.config.duree, cap: mn.config.cap, format: mn.config.format })}`;
    } else {
      phase = et.phase;
      const croissant = plan.croissant && et.phase !== 'prepa';
      grand = croissant ? formatDuree(Math.floor(et.ecoule / 1000)) : formatDuree(Math.ceil(et.restant / 1000));
      const seg = plan.segments[et.indice];
      progres = Number.isFinite(seg.fin) ? (ms - seg.debut) / (seg.fin - seg.debut) * 100 : 0;
      sous = et.phase === 'prepa' ? 'C\'est parti dans…' : mn.config.format === 'emom' || mn.config.format === 'intervalles' ? `Tour ${et.tour} / ${et.tours}` : mn.config.format === 'fortime' && mn.config.cap ? `Limite ${formatDuree(mn.config.cap * 60)}` : mn.config.format === 'amrap' ? 'Le plus de tours possible' : '';
    }
    if (leger && el.dataset.phase === phase) {
      el.querySelector('.cadran-temps').textContent = grand;
      el.querySelector('.cadran-sous').textContent = sous;
      el.querySelector('.cadran-barre i').style.width = `${Math.min(100, progres).toFixed(1)}%`;
      return;
    }
    el.dataset.phase = phase;
    const compteTours = ['amrap', 'fortime'].includes(mn.config.format);
    const boutons = mn.fin
      ? `<button class="btn primaire" data-action="mn-score">Enregistrer le score</button><button class="btn" data-action="mn-reinit">Recommencer</button>`
      : !mn.enCours ? '<button class="btn primaire grand" data-action="mn-start">Démarrer</button>'
      : `${mn.enPause ? '<button class="btn primaire" data-action="mn-start">Reprendre</button>' : '<button class="btn primaire" data-action="mn-pause">Pause</button>'}${compteTours ? `<button class="btn jaune grand" data-action="mn-tour">+1 tour <b class="nb-tours">${mn.tours}</b></button>` : ''}${mn.config.format === 'fortime' || mn.config.format === 'chrono' ? '<button class="btn" data-action="mn-fini">Terminé</button>' : ''}<button class="btn" data-action="mn-reinit">Arrêter</button>`;
    el.innerHTML = `<p class="cadran-phase">${phase === 'attente' ? 'Prêt' : LIB_PHASE[phase]}${mn.enPause ? ' · en pause' : ''}</p>
      <p class="cadran-temps">${grand}</p>
      <p class="cadran-sous">${esc(sous)}</p>
      <div class="cadran-barre"><i style="width:${Math.min(100, progres).toFixed(1)}%"></i></div>
      <div class="cadran-boutons">${boutons}</div>`;
  }
  function scoreDepuisMinuteur() {
    const f = mn.fin;
    if (!f) return;
    const fmtC = mn.config.format;
    let s;
    if (mn.brouillon) { s = mn.brouillon; mn.brouillon = null; } else {
      s = R.normaliserSeance({ type: 'wod', date: auj(), titre: '', wod: { format: fmtC === 'chrono' ? 'fortime' : fmtC, duree: mn.config.duree, cap: mn.config.cap, tours: fmtC === 'intervalles' ? mn.config.tours : 1, travail: mn.config.travail, repos: mn.config.repos, intervalle: mn.config.intervalle, mouvements: [] } });
    }
    const sc = s.wod.score;
    if (s.wod.format === 'amrap') { sc.tours = f.tours; sc.reps = sc.reps ?? 0; }
    if (s.wod.format === 'fortime') { if (f.raison === 'fini') { sc.termine = true; sc.temps = f.ecoule; } else { sc.termine = false; sc.tours = f.tours; } }
    if (s.wod.format === 'emom') sc.reussies = f.minutes;
    arreterMinuteur(true);
    modaleSeance(s, { nouvelle: !seance(s.id) });
  }
  function lancerMinuteurDepuis(wod, brouillon = null) {
    if (mn.enCours) { toast('Un minuteur tourne déjà : arrête-le d\'abord.'); return; }
    const c = mn.config;
    c.format = wod.format;
    if (wod.duree) c.duree = wod.duree;
    if (wod.format === 'fortime') c.cap = wod.cap || 0;
    if (wod.format === 'emom') c.intervalle = wod.intervalle || 60;
    if (wod.format === 'intervalles') { c.travail = wod.travail || 20; c.repos = wod.repos ?? 10; c.tours = wod.tours || 8; }
    mn.brouillon = brouillon;
    mn.fin = null;
    if (modale().open) modale().close();
    changerVue('chrono');
  }

  // ---------- Bibliothèque ----------
  function vueBiblio() {
    const q = R.sansAccents(filtreBiblio.q);
    const pratiques = new Map(R.exercicesPratiques(E).map((p) => [p.ex, p.seances]));
    const tous = [...IDX.values()];
    const liste = tous.filter((e) => (!filtreBiblio.groupe || e.groupe === filtreBiblio.groupe) && (!q || R.sansAccents(e.nom).includes(q)));
    const manquants = B.modeles.filter((m) => !modele(m.id));
    const modeles = E.modeles.map((m) => `<li class="carte-modele"><div class="cm-corps"><b>${esc(m.nom)}</b><span>${m.type === 'wod' ? `${esc(R.descriptionWod(m.wod))} · ${m.wod.mouvements.map((x) => esc(nomEx(x.ex))).join(', ')}` : m.exercices.map((b) => `${esc(nomEx(b.ex))} ${b.series.length ? `<small>${b.series.length} × ${b.series[0].reps ?? b.series[0].temps ?? b.series[0].distance ?? '…'}</small>` : ''}`).join(' · ')}</span></div>
      <div class="rang">${m.type === 'wod' ? `<span class="etiquette ciel">${esc(B.formats[m.wod.format].court)}</span>` : '<span class="etiquette sable">Séries</span>'}<button class="btn petit" data-action="modifier-modele" data-id="${m.id}">Modifier</button>${m.type === 'wod' ? `<button class="btn petit" data-action="minuteur-modele" data-id="${m.id}">Minuteur</button>` : ''}<button class="btn petit primaire" data-action="utiliser-modele" data-id="${m.id}">Utiliser</button></div></li>`).join('');
    const groupes = B.groupes.filter((g) => liste.some((e) => e.groupe === g.id));
    return `<div class="vue-tete"><div><h1>Bibliothèque</h1><p>Tes modèles de séances et les ${tous.length} exercices du carnet, rangés par groupe musculaire et par famille.</p></div>
      <div class="actions"><button class="btn" data-action="nouveau-modele">${ICONES.plus}Modèle</button><button class="btn" data-action="nouvel-exercice">${ICONES.plus}Exercice</button></div></div>
      <h2 class="titre-section">Modèles <span>${pluriel(E.modeles.length, 'modèle')}</span></h2>
      ${E.modeles.length ? `<ul class="liste-modeles">${modeles}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun modèle</h3><p>Garde une séance comme modèle depuis sa fenêtre (« Enregistrer comme modèle »), ou ajoute ceux de QME.</p></div></div>'}
      ${manquants.length ? `<div class="rang" style="margin-top:12px"><button class="btn petit" data-action="ajouter-modeles-qme">Ajouter les modèles QME manquants (${manquants.length})</button></div>` : ''}
      <h2 class="titre-section">Exercices <span>${pluriel(liste.length, 'exercice')}</span></h2>
      <div class="outils-liste"><label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-biblio" type="search" placeholder="Rechercher un exercice" value="${esc(filtreBiblio.q)}"></label>
        <div class="filtres" role="group" aria-label="Groupe">${[['', 'Tous'], ...B.groupes.map((g) => [g.id, g.nom])].map(([k, l]) => `<button class="filtre" data-action="filtre-groupe" data-g="${k}" aria-pressed="${filtreBiblio.groupe === k}">${esc(l)}</button>`).join('')}</div></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h3 class="titre-cat">${esc(g.nom)} <span>${pluriel(liste.filter((e) => e.groupe === g.id).length, 'exercice')}</span></h3><ul class="liste-exercices">${liste.filter((e) => e.groupe === g.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((e) => `<li><button class="lien-ligne" data-action="exercice" data-id="${esc(e.id)}"><b>${esc(e.nom)}</b><span>${esc(B.mesures[e.mesure].nom)}${pratiques.get(e.id) ? ` · ${pluriel(pratiques.get(e.id), 'séance')}` : ''}</span></button>${e.perso ? '<span class="etiquette jaune">Perso</span>' : ''}</li>`).join('')}</ul></section>`).join('') : '<p class="aide">Aucun exercice ne correspond. Crée-le avec « Exercice ».</p>'}
      <p class="mention avertissement">Noms d'exercices génériques, rédigés pour QME ; aucun nom de marque de matériel ni de méthode. Les formats de WOD (AMRAP, EMOM, For Time, intervalles) sont des formats d'entraînement courants. ${AVERTISSEMENT_TEXTE}</p>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, classe = '') {
    const d = modale();
    d.className = `modale ${classe}`;
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  // Liste déroulante des exercices, groupés.
  function optionsExercices(choisi = '') {
    return `<option value="">Choisir un exercice…</option>${B.groupes.map((g) => `<optgroup label="${esc(g.nom)}">${[...IDX.values()].filter((e) => e.groupe === g.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((e) => `<option value="${esc(e.id)}" ${e.id === choisi ? 'selected' : ''}>${esc(e.nom)}${e.perso ? ' (perso)' : ''}</option>`).join('')}</optgroup>`).join('')}`;
  }

  // Dernière fois qu'un exercice a été fait en séries, avant une date.
  function derniereFois(exId, avant, sauf) {
    const s = R.chronologiques(E).reverse().find((x) => x.id !== sauf && x.type !== 'wod' && x.date <= avant && x.exercices.some((b) => b.ex === exId && b.series.some((y) => R.serieRemplie(y, R.mesureDe(IDX, exId)))));
    if (!s) return '';
    const b = s.exercices.find((x) => x.ex === exId);
    return `Dernière fois (${dateCourte(s.date)}) : ${b.series.filter((y) => R.serieRemplie(y, R.mesureDe(IDX, exId))).map((y) => texteSerie(y, exId)).join(' · ')}`;
  }
  function texteSerie(y, exId) {
    const m = R.mesureDe(IDX, exId);
    if (m === 'charge') return `${y.charge ? `${nombre(y.charge, 2)} × ` : ''}${y.reps}`;
    if (m === 'reps') return `${y.reps} reps`;
    if (m === 'temps') return formatDuree(y.temps);
    if (m === 'distance') return `${nombre(y.distance, 0)} m${y.temps ? ` en ${formatDuree(y.temps)}` : ''}`;
    return `${y.calories} cal${y.temps ? ` en ${formatDuree(y.temps)}` : ''}`;
  }

  // ---------- Éditeur de séance ou de modèle ----------
  // brouillon : copie de la séance (ou du modèle) modifiée en direct ; rien n'est écrit avant « Enregistrer ».
  let br = null, brMode = 'seance', brNouvelle = false;
  const CHAMPS_SERIE = {
    charge: [['charge', () => `Charge (${u()})`, 'decimal'], ['reps', () => 'Reps', 'numeric'], ['rpe', () => 'RPE', 'decimal']],
    reps: [['reps', () => 'Reps', 'numeric'], ['rpe', () => 'RPE', 'decimal']],
    temps: [['temps', () => 'Temps (min:s)', 'text'], ['rpe', () => 'RPE', 'decimal']],
    distance: [['distance', () => 'Distance (m)', 'decimal'], ['temps', () => 'Temps (min:s)', 'text']],
    calories: [['calories', () => 'Calories', 'numeric'], ['temps', () => 'Temps (min:s)', 'text']],
  };
  const CHAMPS_MOUV = {
    charge: [['reps', () => 'Reps'], ['charge', () => `Charge (${u()})`]],
    reps: [['reps', () => 'Reps']],
    temps: [['temps', () => 'Temps (min:s)']],
    distance: [['distance', () => 'Distance (m)']],
    calories: [['calories', () => 'Calories']],
  };
  const valeurChamp = (f, v) => (v === null || v === undefined ? '' : f === 'temps' ? formatDuree(v) : champNombre(v));
  const lireChamp = (f, v) => (f === 'temps' ? R.lireDuree(v) : R.lireNombre(v));

  function htmlEditeur() {
    const s = br;
    const tete = brMode === 'modele'
      ? `<label class="champ">Nom du modèle<input data-br="titre" value="${esc(s.titre)}" maxlength="80" placeholder="Ex. : Jambes du lundi"></label>`
      : `<div class="rang-champs"><label class="champ">Date<input type="date" data-br="date" value="${s.date}"></label><label class="champ">Durée (min) <small>Facultatif.</small><input inputmode="numeric" data-br="duree" value="${s.duree ?? ''}"></label></div>
         <label class="champ">Titre <small>Facultatif : sinon, les exercices ou le format.</small><input data-br="titre" value="${esc(s.titre)}" maxlength="80" placeholder="${s.type === 'wod' ? 'Ex. : AMRAP du vendredi' : 'Ex. : Haut du corps'}"></label>`;
    const type = brNouvelle ? `<fieldset class="champ"><legend>Type</legend><div class="choix-statut deux">${[['series', 'Séries'], ['wod', 'WOD (format et score)']].map(([k, l]) => `<label><input type="radio" name="br-type" value="${k}" ${s.type === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>` : '';
    const corps = s.type === 'wod' ? htmlWod(s) : htmlSeries(s);
    const note = brMode === 'modele' ? '' : `<label class="champ">Note <small>Sensations, matériel, consignes. N'y écris aucune donnée de santé.</small><textarea data-br="note" maxlength="500">${esc(s.note)}</textarea></label>`;
    return `${tete}${type}${corps}${note}<p class="erreur" role="alert"></p>`;
  }

  function htmlSeries(s) {
    const blocs = s.exercices.map((b, i) => {
      const e = ex(b.ex);
      const m = e?.mesure || 'charge';
      const champs = CHAMPS_SERIE[m];
      const df = brMode === 'seance' ? derniereFois(b.ex, s.date, s.id) : '';
      return `<div class="bloc-ex">
        <div class="bloc-tete"><b>${esc(nomEx(b.ex))}</b><span class="etiquette sable">${esc(B.mesures[m].court)}</span>
          <span class="rang bloc-actions"><button type="button" class="btn-suppr" data-action="br-monter" data-b="${i}" aria-label="Monter ${esc(nomEx(b.ex))}" ${i ? '' : 'disabled'}>↑</button><button type="button" class="btn-suppr" data-action="br-suppr-bloc" data-b="${i}" aria-label="Retirer ${esc(nomEx(b.ex))}">×</button></span></div>
        ${df ? `<p class="derniere">${esc(df)}</p>` : ''}
        <div class="series" style="--n:${champs.length}">
          <div class="serie-tete"><span>N°</span>${champs.map(([, l]) => `<span>${esc(l())}</span>`).join('')}<span></span></div>
          ${b.series.map((y, j) => `<div class="serie"><span class="serie-num">${j + 1}</span>${champs.map(([f, l, mode]) => `<input aria-label="${esc(l())}, série ${j + 1}" inputmode="${mode}" data-b="${i}" data-s="${j}" data-f="${f}" value="${valeurChamp(f, y[f])}" ${f === 'rpe' ? 'placeholder="–"' : ''}>`).join('')}<button type="button" class="btn-suppr" data-action="br-suppr-serie" data-b="${i}" data-s="${j}" aria-label="Retirer la série ${j + 1}">×</button></div>`).join('')}
        </div>
        <div class="bloc-pied"><button type="button" class="btn petit" data-action="br-serie" data-b="${i}">${ICONES.plus}Série</button><span class="montant-mini" id="rm-${i}">${texteRm(i)}</span></div>
      </div>`;
    }).join('');
    return `<div class="blocs">${blocs || '<p class="aide">Ajoute un premier exercice ci-dessous.</p>'}</div>
      <div class="ajout-ex"><label class="champ">Ajouter un exercice<select id="br-ajout">${optionsExercices()}</select></label></div>
      <p class="aide">RPE facultatif, de 1 à 10 : 10 = aucune répétition de plus possible, 8 = encore deux en réserve. Exercices au poids du corps : répétitions ou temps, sans poids de corps.</p>`;
  }

  // 1RM estimé de la séance pour un exercice, comparé au record actuel (hors cette séance).
  function texteRm(i) {
    const b = br.exercices[i];
    if (!b || R.mesureDe(IDX, b.ex) !== 'charge') return '';
    const rmSeance = Math.max(0, ...b.series.map((y) => R.un1RM(y.charge, y.reps, E.reglages.formule, E.reglages.repsMax) || 0));
    if (!rmSeance) return '';
    const record = brMode === 'seance' ? R.recordsExercice({ ...E, seances: E.seances.filter((x) => x.id !== br.id && x.date <= br.date) }, IDX, E.reglages, b.ex).types.rm?.valeur : null;
    return `1RM estimé ≈ ${nombre(rmSeance)} ${u()}${record ? ` · record ≈ ${nombre(record)} ${u()}` : ''}${record && rmSeance > record ? ' <span class="etiquette record">Record</span>' : ''}`;
  }

  function htmlWod(s) {
    const w = s.wod;
    const param = (k, l, aide = '') => `<label class="champ">${l}${aide ? ` <small>${aide}</small>` : ''}<input inputmode="numeric" data-w="${k}" value="${w[k] ?? ''}"></label>`;
    const params = {
      amrap: param('duree', 'Durée (min)'),
      emom: `${param('duree', 'Durée (min)')}<label class="champ">Toutes les<select data-w="intervalle">${[[60, '1 min'], [90, '1 min 30'], [120, '2 min'], [180, '3 min']].map(([k, l]) => `<option value="${k}" ${w.intervalle === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
      fortime: `${param('tours', 'Tours', 'Le travail prévu, répété.')}${param('cap', 'Temps limite (min)', 'Facultatif.')}`,
      intervalles: `${param('travail', 'Travail (s)')}${param('repos', 'Repos (s)')}${param('tours', 'Tours')}`,
    }[w.format];
    const mouvs = w.mouvements.map((m, i) => {
      const me = R.mesureDe(IDX, m.ex);
      return `<div class="mouvement"><b>${esc(nomEx(m.ex))}</b>${CHAMPS_MOUV[me].map(([f, l]) => `<label class="champ mini">${esc(l())}<input inputmode="${f === 'temps' ? 'text' : 'decimal'}" data-m="${i}" data-f="${f}" value="${valeurChamp(f, m[f])}" placeholder="${w.format === 'intervalles' && f === 'reps' ? 'max' : ''}"></label>`).join('')}<button type="button" class="btn-suppr" data-action="br-suppr-mouv" data-m="${i}" aria-label="Retirer ${esc(nomEx(m.ex))}">×</button></div>`;
    }).join('');
    const sc = w.score;
    const score = brMode === 'modele' ? '' : `<fieldset class="champ cadre-champs"><legend>Score <small>${esc((B.formats[w.format].aide.split('Score : ')[1] || '').replace(/^./, (c) => c.toUpperCase()))} Laisse vide si tu le saisis plus tard.</small></legend>${{
      amrap: `<div class="rang-champs"><label class="champ">Tours complets<input inputmode="numeric" data-sc="tours" value="${sc.tours ?? ''}"></label><label class="champ">Reps en plus<input inputmode="numeric" data-sc="reps" value="${sc.reps ?? ''}"></label></div>`,
      fortime: `<label class="case"><input type="checkbox" data-sc="termine" ${sc.termine ? 'checked' : ''}> Terminé avant le temps limite</label>${sc.termine ? `<label class="champ">Temps (min:s)<input inputmode="text" data-sc="temps" value="${sc.temps ? formatDuree(sc.temps) : ''}" placeholder="12:34"></label>` : `<div class="rang-champs"><label class="champ">Tours faits au temps limite<input inputmode="numeric" data-sc="tours" value="${sc.tours ?? ''}"></label><label class="champ">Reps en plus<input inputmode="numeric" data-sc="reps" value="${sc.reps ?? ''}"></label></div>`}`,
      emom: `<label class="champ">Minutes réussies <small>Sur ${R.minutesEmom(w)}.</small><input inputmode="numeric" data-sc="reussies" value="${sc.reussies ?? ''}"></label>`,
      intervalles: `<label class="champ">Répétitions au total<input inputmode="numeric" data-sc="reps" value="${sc.reps ?? ''}"></label>`,
    }[w.format]}</fieldset>`;
    return `<fieldset class="champ"><legend>Format</legend><div class="choix-statut quatre">${R.FORMATS.map((k) => `<label><input type="radio" name="br-format" value="${k}" ${w.format === k ? 'checked' : ''}><span>${esc(B.formats[k].court)}</span></label>`).join('')}</div></fieldset>
      <p class="aide">${esc(B.formats[w.format].aide)}</p>
      <div class="rang-champs">${params}</div>
      <div class="champ"><span>Mouvements <small>${w.format === 'emom' || w.format === 'intervalles' ? 'Faits à tour de rôle, un par minute ou par intervalle.' : 'Dans l\'ordre d\'un tour.'}</small></span><div class="mouvements">${mouvs || '<p class="aide">Ajoute un premier mouvement ci-dessous.</p>'}</div></div>
      <div class="ajout-ex"><label class="champ">Ajouter un mouvement<select id="br-ajout">${optionsExercices()}</select></label></div>
      ${score}
      ${brMode === 'seance' ? '<div class="rang"><button type="button" class="btn petit" data-action="br-minuteur">Lancer au minuteur</button></div>' : ''}`;
  }

  function rendreEditeur() {
    const zone = $('#editeur');
    if (!zone) return;
    const haut = modale().scrollTop;
    zone.innerHTML = htmlEditeur();
    modale().scrollTop = haut;
  }

  // Saisie en direct dans le brouillon (sans re-rendu, pour garder le curseur).
  function lireSaisie(el) {
    const d = el.dataset;
    if (d.br) {
      if (d.br === 'duree') br.duree = R.lireNombre(el.value) === null ? null : Math.round(R.lireNombre(el.value));
      else br[d.br] = el.value;
      return;
    }
    if (d.s !== undefined && d.b !== undefined) { br.exercices[d.b].series[d.s][d.f] = d.f === 'reps' || d.f === 'calories' ? (R.lireNombre(el.value) === null ? null : Math.round(R.lireNombre(el.value))) : lireChamp(d.f, el.value); return; }
    if (d.m !== undefined && d.f) { br.wod.mouvements[d.m][d.f] = lireChamp(d.f, el.value); return; }
    if (d.w) { br.wod[d.w] = R.lireNombre(el.value) === null ? null : Math.round(R.lireNombre(el.value)); return; }
    if (d.sc) {
      if (d.sc === 'termine') { br.wod.score.termine = el.checked; rendreEditeur(); return; }
      br.wod.score[d.sc] = d.sc === 'temps' ? R.lireDuree(el.value) : (R.lireNombre(el.value) === null ? null : Math.round(R.lireNombre(el.value)));
    }
  }

  function modaleSeance(s, { nouvelle = false, mode = 'seance' } = {}) {
    br = structuredClone(s); brMode = mode; brNouvelle = nouvelle;
    if (mode === 'modele') br.titre = s.nom ?? s.titre ?? '';
    const existante = mode === 'seance' && !nouvelle && seance(s.id);
    const existantModele = mode === 'modele' && modele(s.id);
    const actions = existante ? `<div class="groupe"><div class="rang"><button type="button" class="btn petit" data-action="br-en-modele">Enregistrer comme modèle</button><button type="button" class="btn petit" data-action="br-dupliquer">Refaire aujourd'hui</button><button type="button" class="btn petit danger" data-action="br-supprimer">Supprimer la séance</button></div></div>`
      : existantModele ? '<div class="groupe"><div class="rang"><button type="button" class="btn petit danger" data-action="br-supprimer-modele">Supprimer le modèle</button></div></div>' : '';
    const titre = mode === 'modele' ? (existantModele ? 'Modifier le modèle' : 'Nouveau modèle') : nouvelle ? (s.type === 'wod' ? 'Nouveau WOD' : 'Nouvelle séance') : (s.type === 'wod' ? 'WOD' : 'Séance');
    ouvrirModale(titre, `<div id="editeur">${htmlEditeur()}</div>${actions}`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', () => enregistrerBrouillon(), 'large');
    const d = modale();
    d.querySelector('form').addEventListener('input', (e) => {
      if (!e.target.matches('[data-br],[data-b],[data-m],[data-w],[data-sc]')) return;
      lireSaisie(e.target);
      if (e.target.matches('[data-b][data-f="charge"],[data-b][data-f="reps"]')) { const z = $(`#rm-${e.target.dataset.b}`); if (z) z.innerHTML = texteRm(Number(e.target.dataset.b)); }
    });
    d.querySelector('form').addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'br-ajout' && el.value) {
        const exId = el.value;
        if (br.type === 'wod') br.wod.mouvements.push(R.normaliserMouvement({ ex: exId }));
        else {
          const m = R.mesureDe(IDX, exId);
          // Reprend les séries de la dernière fois (sans RPE), sinon trois séries vides.
          const avant = R.chronologiques(E).reverse().find((x) => x.id !== br.id && x.type !== 'wod' && x.exercices.some((b) => b.ex === exId));
          const series = avant ? avant.exercices.find((b) => b.ex === exId).series.filter((y) => R.serieRemplie(y, m)).map((y) => ({ ...y, rpe: null })) : [];
          br.exercices.push(R.normaliserBloc({ ex: exId, series: series.length ? series : [{}, {}, {}] }));
        }
        rendreEditeur();
        const blocs = modale().querySelectorAll('.bloc-ex, .mouvement');
        blocs[blocs.length - 1]?.querySelector('input')?.focus({ preventScroll: true });
        blocs[blocs.length - 1]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (el.name === 'br-type') {
        br.type = el.value;
        if (br.type === 'wod' && !br.wod) br.wod = R.normaliserWod({ format: 'amrap', duree: 12 });
        if (br.type === 'series' && !br.exercices) br.exercices = [];
        rendreEditeur(); return;
      }
      if (el.name === 'br-format') {
        br.wod.format = el.value;
        const w = br.wod;
        if (w.format === 'amrap' || w.format === 'emom') w.duree = w.duree || (w.format === 'amrap' ? 12 : 10);
        if (w.format === 'fortime') w.tours = w.tours || 1;
        if (w.format === 'intervalles') { w.travail = w.travail || 20; w.repos = w.repos ?? 10; w.tours = w.tours || 8; }
        rendreEditeur(); return;
      }
      if (el.matches('select[data-w]')) { lireSaisie(el); rendreEditeur(); return; }
      if (el.matches('[data-br="date"]')) rendreEditeur(); // « dernière fois » et record à jour
    });
  }

  // Nettoie et contrôle le brouillon, puis l'écrit dans l'état.
  function enregistrerBrouillon() {
    const s = br;
    const vide = (y) => R.CHAMPS.every((f) => y[f] === null || y[f] === undefined);
    if (s.type === 'wod') {
      s.wod.mouvements = s.wod.mouvements.filter((m) => m.ex);
      const w = s.wod;
      if (!w.mouvements.length) return 'Ajoute au moins un mouvement.';
      if ((w.format === 'amrap' || w.format === 'emom') && !(w.duree > 0)) return 'Indique la durée en minutes.';
      if (w.format === 'intervalles' && !(w.travail > 0 && w.tours > 0)) return 'Indique le temps de travail et le nombre de tours.';
      if (w.format === 'fortime' && !(w.tours > 0)) w.tours = 1;
      if (w.format === 'emom' && w.score.reussies > R.minutesEmom(w)) return `Au plus ${R.minutesEmom(w)} minutes réussies.`;
      if (w.format === 'fortime' && w.score.termine && w.cap && w.score.temps > w.cap * 60) return 'Le temps dépasse le temps limite : décoche « Terminé » et saisis les tours faits.';
    } else {
      s.exercices = s.exercices.filter((b) => b.ex).map((b) => ({ ...b, series: b.series.filter((y) => !vide(y)) }));
      if (brMode === 'seance' && !s.exercices.some((b) => b.series.some((y) => R.serieRemplie(y, R.mesureDe(IDX, b.ex))))) return 'Ajoute au moins une série remplie (les répétitions, le temps ou la distance).';
      if (brMode === 'modele' && !s.exercices.length) return 'Ajoute au moins un exercice.';
      for (const b of s.exercices) for (const y of b.series) if (y.rpe !== null && (y.rpe < 1 || y.rpe > 10)) return 'Le RPE va de 1 à 10.';
    }
    if (brMode === 'modele') {
      if (!s.titre.trim()) return 'Donne un nom au modèle.';
      const m = R.normaliserModele({ ...s, nom: s.titre.trim() });
      retenir();
      const i = E.modeles.findIndex((x) => x.id === m.id);
      if (i >= 0) E.modeles[i] = m; else E.modeles.push(m);
      sauver(); rendre();
      toast('Modèle enregistré.', { libelle: 'Annuler', faire: annuler });
      return;
    }
    if (!R.estDate(s.date)) return 'Date illisible.';
    if (!s.titre.trim()) s.titre = s.type === 'wod' ? R.descriptionWod(s.wod) : s.exercices.slice(0, 2).map((b) => nomEx(b.ex)).join(' et ');
    const n = R.normaliserSeance(s);
    retenir();
    const i = E.seances.findIndex((x) => x.id === n.id);
    if (i >= 0) E.seances[i] = n; else E.seances.push(n);
    sauver();
    const r = uniques(R.recordsSeance(evts(), n.id));
    if (vue !== 'seances' && vue !== 'records' && vue !== 'progres') { vue = 'seances'; history.replaceState(null, '', '#seances'); }
    rendre();
    if (r.length) toast(`${r.length > 1 ? `${r.length} records` : 'Record'} : ${r.slice(0, 2).map((x) => x.type === 'wod' ? `score ${x.valeur}` : `${nomEx(x.ex)} (${R.LIB_RECORD[x.type]} ${valeurTexte(x.type, x.valeur, x.ex)})`).join(', ')}${r.length > 2 ? '…' : ''}`, { libelle: 'Annuler', faire: annuler });
    else toast(i >= 0 ? 'Séance modifiée.' : 'Séance enregistrée.', { libelle: 'Annuler', faire: annuler });
  }

  const nouvelleSeance = (type) => R.normaliserSeance({ type, date: auj(), titre: '', wod: type === 'wod' ? { format: 'amrap', duree: 12 } : undefined });

  function modaleChoixModele() {
    if (!E.modeles.length) { toast('Aucun modèle : ajoute-en dans la Bibliothèque.'); return; }
    const corps = `<p class="aide">Les exercices et les séries du modèle sont repris ; tu ajustes les charges pendant la séance.</p>
      <ul class="liste-choix">${E.modeles.map((m) => `<li><button type="button" class="lien-ligne" data-action="utiliser-modele" data-id="${m.id}"><b>${esc(m.nom)}</b><span>${m.type === 'wod' ? esc(R.descriptionWod(m.wod)) : m.exercices.map((b) => esc(nomEx(b.ex))).join(', ')}</span></button></li>`).join('')}</ul>`;
    ouvrirModale('Partir d\'un modèle', corps, '<button class="btn" value="annuler">Fermer</button>');
  }

  function utiliserModele(id) {
    const m = modele(id);
    if (!m) return;
    const s = R.seanceDepuisModele(m, auj());
    // Charges : reprises de la dernière séance faite avec ce modèle (sinon celles du modèle).
    const avant = R.chronologiques(E).reverse().find((x) => x.modele === id && x.type === 'series');
    if (avant && s.type === 'series') for (const b of s.exercices) { const a = avant.exercices.find((x) => x.ex === b.ex); if (a) b.series.forEach((y, j) => { const z = a.series[Math.min(j, a.series.length - 1)]; if (z && y.charge === null) y.charge = z.charge; }); }
    modaleSeance(s, { nouvelle: true });
  }

  function modaleExercice(id) {
    const e = ex(id);
    if (!e) return;
    const r = R.recordsExercice(E, IDX, E.reglages, id, B.repsRecords);
    const points = R.progression(E, IDX, E.reglages, id);
    const types = R.TYPES_RECORD[e.mesure];
    const lignes = types.filter((t) => r.types[t]).map((t) => `<div class="ligne-somme"><span>${esc(R.LIB_RECORD[t])}</span><b>${esc(valeurTexte(t, r.types[t].valeur, id))} <small>${dateCourte(r.types[t].date)}</small></b></div>`).join('');
    const parReps = e.mesure === 'charge' && Object.keys(r.parReps).length ? `<table class="tableau petit"><thead><tr><th>Au moins</th>${B.repsRecords.map((n) => `<th class="nb">${n} rep${n > 1 ? 's' : ''}</th>`).join('')}</tr></thead><tbody><tr><td>Charge (${u()})</td>${B.repsRecords.map((n) => `<td class="nb">${r.parReps[n] ? nombre(r.parReps[n].charge, 2) : '–'}</td>`).join('')}</tr></tbody></table>` : '';
    const n = R.utilisations(E, id);
    const corps = `<p><span class="etiquette sable">${esc(nomGroupe(e.groupe))}</span> <span class="etiquette ciel">${esc(B.mesures[e.mesure].nom)}</span>${e.perso ? ' <span class="etiquette jaune">Exercice perso</span>' : ''}</p>
      ${r.seances ? `<div class="bloc-detail"><h3>Records <span>${pluriel(r.seances, 'séance')}</span></h3>${lignes || '<p class="aide">Pas encore de valeur.</p>'}${parReps}${e.mesure === 'charge' && r.types.rm ? `<p class="aide">1RM estimé par la formule de ${esc(B.formules[E.reglages.formule].nom)} : une estimation, pas une charge à tenter seul.</p>` : ''}</div>
        ${points.length > 1 ? `<div class="bloc-detail"><h3>Progression</h3>${points.slice(-8).map((p) => `<div class="ligne-somme"><span>${dateCourte(p.date)}</span><b>${esc(valeurTexte(R.PRINCIPALE[e.mesure], p.valeur, id))}</b></div>`).join('')}<div class="rang"><button type="button" class="btn petit" data-action="voir-courbe" data-id="${esc(id)}">Voir la courbe</button></div></div>` : ''}`
        : '<p class="aide">Pas encore fait en séance « séries ». Ajoute-le à ta prochaine séance.</p>'}
      ${e.perso ? `<div class="groupe"><h3>Exercice personnel</h3><div class="rang"><button type="button" class="btn petit" data-action="modifier-exercice" data-id="${esc(id)}">Modifier</button><button type="button" class="btn petit danger" data-action="supprimer-exercice" data-id="${esc(id)}" ${n ? 'disabled' : ''}>Supprimer</button></div>${n ? `<p class="aide">Utilisé ${pluriel(n, 'fois', 'fois')} : il ne peut pas être supprimé.</p>` : ''}</div>` : ''}`;
    ouvrirModale(esc(e.nom), corps, '<button class="btn" value="annuler">Fermer</button>');
  }

  function modaleNouvelExercice(id) {
    const e = id ? ex(id) : null;
    const corps = `<label class="champ">Nom<input name="nom" maxlength="80" value="${esc(e?.nom || '')}" placeholder="Ex. : Développé couché avec pause"></label>
      <label class="champ">Groupe ou famille<select name="groupe">${B.groupes.map((g) => `<option value="${g.id}" ${e?.groupe === g.id ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label>
      <label class="champ">Mesure <small>${id ? 'Changer la mesure ne convertit pas les séries déjà notées.' : 'Au poids du corps : répétitions ou temps.'}</small><select name="mesure">${R.MESURES.map((m) => `<option value="${m}" ${e?.mesure === m ? 'selected' : ''}>${esc(B.mesures[m].nom)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? 'Modifier l\'exercice' : 'Nouvel exercice', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'exercice.';
      if ([...IDX.values()].some((x) => x.id !== id && R.sansAccents(x.nom) === R.sansAccents(nom))) return 'Un exercice porte déjà ce nom.';
      retenir();
      const n = R.normaliserExercice({ id: id || undefined, nom, groupe: fd.get('groupe'), mesure: fd.get('mesure') }, B.groupes.map((g) => g.id));
      const i = E.exercicesPerso.findIndex((x) => x.id === id);
      if (i >= 0) E.exercicesPerso[i] = n; else E.exercicesPerso.push(n);
      majIndex(); sauver(); rendre();
      toast(id ? 'Exercice modifié.' : 'Exercice ajouté à la bibliothèque.');
    });
  }

  function modaleHistoriqueWod(cle) {
    const l = R.historiqueWod(E, cle);
    if (!l.length) return;
    const notes = l.filter((s) => R.scoreRempli(s.wod));
    const best = notes.reduce((m, s) => (!m || R.comparerScores(s.wod.format, s.wod.score, m.wod.score) > 0 ? s : m), null);
    const corps = `<p class="aide">${esc(R.descriptionWod(l.at(-1).wod))} · ${l.at(-1).wod.mouvements.map((m) => esc(nomEx(m.ex))).join(', ')}</p>
      <ul class="liste-choix">${l.slice().reverse().map((s) => `<li><button type="button" class="lien-ligne" data-action="seance" data-id="${s.id}"><b>${esc(R.scoreTexte(s.wod))}${s === best ? ' <span class="etiquette record">Meilleur</span>' : ''}</b><span>${esc(dateLongue(s.date))}</span></button></li>`).join('')}</ul>`;
    ouvrirModale(esc(l.at(-1).titre || 'WOD'), corps, '<button class="btn" value="annuler">Fermer</button>');
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <fieldset class="champ"><legend>Unité des charges <small>Changer d'unité ne convertit pas les charges déjà notées.</small></legend><div class="choix-statut deux">${[['kg', 'Kilogrammes (kg)'], ['lb', 'Livres (lb)']].map(([k, l]) => `<label><input type="radio" name="unite" value="${k}" ${r.unite === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Formule d'estimation du 1RM</legend><div class="choix-statut deux">${Object.entries(B.formules).map(([k, f]) => `<label><input type="radio" name="formule" value="${k}" ${r.formule === k ? 'checked' : ''}><span>${esc(f.nom)}</span></label>`).join('')}</div></fieldset>
      <ul class="aide liste-formules">${Object.values(B.formules).map((f) => `<li><b>${esc(f.nom)}</b> : ${esc(f.texte)}. ${esc(f.source)}.</li>`).join('')}</ul>
      <label class="champ">Répétitions au plus pour estimer le 1RM <small>Au-delà, les formules deviennent peu fiables : la série compte pour le volume, pas pour le 1RM. 10 par défaut.</small><input name="repsMax" inputmode="numeric" value="${r.repsMax}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes tes séries et tes WOD en tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton carnet est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le carnet à ton écran d'accueil pour l'ouvrir comme une application, à la salle.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le carnet garde seulement tes performances sportives (exercices, séries, charges, répétitions, temps, scores), enregistrées en ligne avec ta clé, ni lues ni partagées par QME. Aucune donnée de santé n'est demandée : pas de poids de corps, de mensurations, de fréquence cardiaque ni de blessure. N'en écris pas dans les notes.</p></div>
      <div class="groupe"><h3>Avertissement</h3><p class="aide">${AVERTISSEMENT_TEXTE}</p></div>
      <div class="groupe"><h3>Sources</h3><ul class="champs-aide-liste">${B.sources.map(([l, s]) => `<li>${esc(l)}<br><small>${esc(s)}</small></li>`).join('')}</ul></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${B.exercices.length} exercices, formats et modèles rédigés pour QME (version ${B.version}), noms génériques, sans marque ni WOD de référence nommé. Aucune connexion à une montre, une application ou un réseau social : tu saisis toi-même.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const rm = R.lireNombre(fd.get('repsMax'));
      if (rm === null || rm < 1 || rm > 15) return 'Répétitions au plus : entre 1 et 15.';
      E.reglages = R.normaliserReglages({ unite: fd.get('unite'), formule: fd.get('formule'), repsMax: Math.round(rm) }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés : records et 1RM recalculés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.seances)) throw new Error();
        if (!confirm(`Remplacer ton carnet actuel par cette copie (${pluriel(donnees.seances.length, 'séance')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe; majIndex();
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `carnet-musculation-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, B), 'text/csv;charset=utf-8', `seances-${auj()}.csv`);

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
      <p>Enregistre ce carnet sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Le minuteur fonctionne aussi sans réseau.</p>
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
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); majIndex(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle-seance': modaleSeance(nouvelleSeance('series'), { nouvelle: true }); break;
      case 'nouveau-wod': modaleSeance(nouvelleSeance('wod'), { nouvelle: true }); break;
      case 'depuis-modele': modaleChoixModele(); break;
      case 'utiliser-modele': utiliserModele(id); break;
      case 'modifier-modele': { const m = modele(id); if (m) modaleSeance({ ...structuredClone(m), date: auj(), note: '', duree: null }, { mode: 'modele' }); break; }
      case 'nouveau-modele': modaleSeance({ ...nouvelleSeance('series'), id: R.nouvelId() }, { nouvelle: true, mode: 'modele' }); break;
      case 'minuteur-modele': { const m = modele(id); if (m?.wod) lancerMinuteurDepuis(m.wod, R.seanceDepuisModele(m, auj())); break; }
      case 'ajouter-modeles-qme': retenir(); E.modeles.push(...B.modeles.filter((m) => !modele(m.id)).map(R.modeleDeBase)); sauver(); rendre(); toast('Modèles QME ajoutés.', { libelle: 'Annuler', faire: annuler }); break;
      case 'seance': { const s = seance(id); if (s) modaleSeance(s); break; }
      case 'exercice': modaleExercice(id); break;
      case 'voir-courbe': prog.ex = id; modale().close(); changerVue('progres'); break;
      case 'nouvel-exercice': modaleNouvelExercice(null); break;
      case 'modifier-exercice': modaleNouvelExercice(id); break;
      case 'supprimer-exercice': { if (R.utilisations(E, id)) break; retenir(); E.exercicesPerso = E.exercicesPerso.filter((x) => x.id !== id); majIndex(); sauver(); rendre(); modale().close(); toast('Exercice supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'historique-wod': modaleHistoriqueWod(el.dataset.cle); break;
      case 'plus-semaines': semainesVisibles += 6; rendre(); break;
      case 'filtre-groupe': filtreBiblio.groupe = el.dataset.g; rendre(); break;
      case 'prog-mesure': prog.mesure = el.dataset.m; rendre(); break;
      case 'prog-periode': prog.periode = Number(el.dataset.p); rendre(); break;
      // Éditeur
      case 'br-serie': { const b = br.exercices[el.dataset.b]; const der = b.series.at(-1); b.series.push(R.normaliserSerie(der ? { ...der, rpe: null } : {})); rendreEditeur(); break; }
      case 'br-suppr-serie': br.exercices[el.dataset.b].series.splice(Number(el.dataset.s), 1); rendreEditeur(); break;
      case 'br-suppr-bloc': br.exercices.splice(Number(el.dataset.b), 1); rendreEditeur(); break;
      case 'br-monter': { const i = Number(el.dataset.b); if (i > 0) { const [b] = br.exercices.splice(i, 1); br.exercices.splice(i - 1, 0, b); rendreEditeur(); } break; }
      case 'br-suppr-mouv': br.wod.mouvements.splice(Number(el.dataset.m), 1); rendreEditeur(); break;
      case 'br-minuteur': {
        const w = br.wod;
        if (!w.mouvements.length) { const p = modale().querySelector('.erreur'); if (p) p.textContent = 'Ajoute d\'abord un mouvement.'; break; }
        lancerMinuteurDepuis(w, structuredClone(br));
        toast('Minuteur prêt : touche Démarrer.');
        break;
      }
      case 'br-en-modele': {
        const s = seance(br.id);
        if (!s) break;
        const nom = prompt('Nom du modèle :', s.titre);
        if (nom === null) break;
        retenir();
        E.modeles.push(R.modeleDepuisSeance(s, nom.trim() || s.titre));
        sauver(); rendre(); modale().close();
        toast('Modèle enregistré dans la Bibliothèque.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'br-dupliquer': {
        const s = seance(br.id);
        if (!s) break;
        const copie = R.normaliserSeance({ ...structuredClone(s), id: R.nouvelId(), date: auj(), note: '' });
        copie.exercices.forEach((b) => { b.id = R.nouvelId(); b.series.forEach((y) => { y.rpe = null; }); });
        if (copie.wod) copie.wod.score = R.normaliserWod({}).score;
        modaleSeance(copie, { nouvelle: true });
        break;
      }
      case 'br-supprimer': {
        const s = seance(br.id);
        if (!s || !confirm(`Supprimer la séance « ${s.titre} » du ${dateCourte(s.date)} ?`)) break;
        retenir(); E.seances = E.seances.filter((x) => x.id !== s.id); sauver(); rendre(); modale().close();
        toast('Séance supprimée.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'br-supprimer-modele': {
        const m = modele(br.id);
        if (!m || !confirm(`Supprimer le modèle « ${m.nom} » ? Les séances déjà faites restent.`)) break;
        retenir(); E.modeles = E.modeles.filter((x) => x.id !== m.id); sauver(); rendre(); modale().close();
        toast('Modèle supprimé.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      // Minuteur
      case 'mn-start': demarrerMinuteur(); break;
      case 'mn-pause': pauseMinuteur(); break;
      case 'mn-reinit': arreterMinuteur(); rendre(); break;
      case 'mn-tour': mn.tours++; bip(1100, 0.08); majChrono(); break;
      case 'mn-fini': terminerMinuteur('fini'); break;
      case 'mn-score': scoreDepuisMinuteur(); break;
      case 'son': stock.ecrire(CLE_SON, sonActif() ? 'non' : 'oui'); rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'chrono') rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeurPrec = innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(innerWidth - largeurPrec) > 40 && E && vue === 'progres') { largeurPrec = innerWidth; rendre(); } });

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
        E = normaliser(c.etat); majIndex(); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__musculation = { etat: () => E, regles: R };
  init();
})();
