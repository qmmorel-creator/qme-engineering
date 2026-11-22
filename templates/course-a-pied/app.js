// Plan d'entraînement course à pied QME : chrono de référence, objectif, allures calculées (formule de Riegel),
// plan par semaines du 10 km au marathon, séances cochées, adaptation simple, volume hebdomadaire, impression, export.
// Données synchronisées par clé de licence ou code d'accès. Aucune donnée de santé.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CRS;
  const API = '/api/templates';
  const PRODUIT = 'CRS';
  const CLE_CODE = 'qme-crs-code';
  const CLE_CACHE = 'qme-crs-cache';
  const CLE_DEMO = 'qme-crs-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-crs-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, nombre, formatDuree, formatAllure, formatMinutes, lundi, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const minuscule = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const km = (x, d = 1) => `${nombre(x, d)} km`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  let annulation = null;
  let AL = null; // allures calculées pour le rendu en cours

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  // Les règles reconstruisent l'état champ par champ : le champ est réinjecté ici.
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, B), tutorielVu: Boolean(d?.tutorielVu) });
  const P = () => E.plan;
  const ref = () => R.referenceCourante(E.references);
  const distance = () => B.distances[P().distance];
  const objectif = () => ({ km: distance().km, temps: P().tempsVise });
  const allures = () => (E.plan ? R.calculerAllures(ref(), objectif(), B, E.reglages.exposant) : null);
  const res = (s) => R.resoudre(s, P(), B, AL || allures(), E.reglages);
  const seance = (id) => P()?.seances.find((s) => s.id === id);
  const course = () => P()?.seances.find((s) => s.code === 'course');
  const dateCourse = () => P().dateCourse;
  const nomCourse = () => P().nomCourse || distance().nom;
  const fourchette = (a) => { const f = AL?.fourchettes[a]; return f ? `${formatAllure(f.rapide)}–${formatAllure(f.lent)}` : '–'; };

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
        const vu = E.tutorielVu;
        E = normaliser(corps.donnees);
        if (vu) E.tutorielVu = true;
        session.base = corps.donnees.majLe;
        cache(false);
        if (E.plan) rendre(); else ecranAccueil();
        toast('Un autre appareil a modifié le plan entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
        if (!modale().open && E.plan) rendre();
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
      if (E.plan) demarrer(); else ecranAccueil();
      envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : etatVide();
    session.base = donnees?.majLe ?? null;
    if (donnees) cache(false);
    if (E.plan) demarrer(); else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && d.plan ? normaliser(d) : donneesDemo();
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
  // Coureuse fictive qui prépare un semi-marathon dans cinq semaines (semaine 8 sur 12), 4 séances par semaine.
  // Un premier chrono de 10 km il y a trois mois, un test plus récent ; l'historique est simulé avec les vraies
  // règles (distances estimées, à ±5 %), une semaine allégée par elle, deux séances manquées, la dernière séance
  // passée encore à cocher et des séances récentes ressenties dures (l'application propose d'alléger).
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const L = lundi(t);
    const dateC = ajout(L, 7 * 4 + 6);
    const debut = ajout(L, -7 * 7);
    e.references = [
      R.normaliserReference({ id: 'ref-1', date: ajout(t, -102), km: 10, temps: 52 * 60 + 30, libelle: 'Course de quartier' }),
      R.normaliserReference({ id: 'ref-2', date: ajout(t, -33), km: 10, temps: 50 * 60 + 40, libelle: 'Test sur piste, seule' }),
    ];
    const p = { distance: 'semi', dateCourse: dateC, nomCourse: 'Semi-marathon de Ville-Exemple', tempsVise: 1 * 3600 + 52 * 60, debut, seancesSemaine: 4, jours: [1, 3, 5, 6], jourLongue: 6, volume: 'normal', semainesAllegees: [ajout(L, -7 * 3)], cree: debut };
    const g = R.genererPlan(p, B);
    e.plan = R.normaliserPlan({ ...p, seances: g.seances }, B);
    const A = R.calculerAllures(R.referenceCourante(e.references), { km: B.distances.semi.km, temps: p.tempsVise }, B, e.reglages.exposant);
    const passees = e.plan.seances.filter((s) => s.date < t);
    const derniere = passees.at(-1);
    const manquees = new Set([passees.find((s) => s.date >= ajout(L, -7 * 5) && s.code.startsWith('f'))?.id, passees.filter((s) => s.date >= ajout(L, -7) && s.date < L && s.code.startsWith('f')).at(-1)?.id]);
    passees.forEach((s, i) => {
      if (s === derniere && s.date >= L) return; // reste « à cocher »
      if (manquees.has(s.id)) { s.statut = 'manquee'; s.note = i % 2 ? 'Réunion tardive.' : ''; return; }
      const r = R.resoudre(s, e.plan, B, A, e.reglages);
      const v = 0.95 + ((i * 37) % 11) / 100;
      s.statut = 'faite';
      s.kmReel = Math.round(r.km * v * 10) / 10;
      s.dureeReel = Math.round(r.min * 60 * (0.98 + ((i * 13) % 5) / 100));
      const recente = ecart(s.date, t) <= 9;
      s.ressenti = recente ? (r.type === 'footing' ? 3 : 4) : (r.type === 'footing' || r.type === 'recup' ? 2 : 3);
    });
    const qual = passees.filter((s) => s.statut === 'faite' && ['seuil', 'frac', 'specifique'].includes(B.seances[s.code].type));
    if (qual[1]) qual[1].note = 'Dernière fraction plus lente, vent de face.';
    const longues = passees.filter((s) => s.statut === 'faite' && B.seances[s.code].type === 'longue');
    if (longues.at(-1)) longues.at(-1).note = 'Gel à 50 min, bien passé.';
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT_TEXTE = 'Ce plan n\'est ni un programme médical ni un avis médical. Demande l\'avis d\'un médecin avant de commencer, surtout si tu reprends après une longue pause. Les allures sont des estimations par formule : écoute tes sensations, et arrête-toi en cas de douleur ou de malaise.';
  const AVERTISSEMENT = `<p class="mention avertissement">${AVERTISSEMENT_TEXTE}</p>`;

  function ecranConnexion(message = '') {
    document.title = 'Plan d\'entraînement course à pied · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="250" width="520" height="12" fill="#141414"/>
          <rect x="40" y="200" width="40" height="50" fill="#1D4E89"/>
          <rect x="100" y="170" width="40" height="80" fill="#1D4E89"/>
          <rect x="160" y="130" width="40" height="120" fill="#1D4E89"/>
          <rect x="220" y="150" width="40" height="100" fill="#141414"/>
          <rect x="280" y="110" width="40" height="140" fill="#1D4E89"/>
          <rect x="340" y="190" width="40" height="60" fill="#141414"/>
          <circle cx="470" cy="90" r="56" fill="#F5B400"/>
          <path d="M420 250 L420 170 A80 80 0 0 1 500 250 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Plan d'entraînement course à pied</p>
          <h1>Tes allures et tes semaines, jusqu'au jour J.</h1>
          <p>Du 10 km au marathon : un chrono récent suffit pour calculer tes allures, ton plan se place sur tes jours de course, et tu coches chaque séance.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton plan</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton plan est enregistré en ligne et te suit sur tous tes appareils, même sans réseau au bord du stade.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon plan</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/course-a-pied/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon plan'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement et nouveau plan ----------
  const radios = (nom, options, valeur, classe = '') => `<div class="choix-statut ${classe}">${options.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${String(valeur) === String(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  const champsJours = (nom, jours) => `<div class="choix-jours">${B.jours.map((j, i) => `<label><input type="checkbox" name="${nom}" value="${i}" ${jours.includes(i) ? 'checked' : ''}><span><span class="long">${j}</span><span class="court">${j.slice(0, 3)}</span></span></label>`).join('')}</div>`;
  const JOURS_DEFAUT = { 3: [1, 3, 6], 4: [1, 3, 5, 6], 5: [1, 2, 4, 5, 6] };

  function brouillonPlan() {
    const r = E && ref();
    const t = auj();
    return {
      refDist: r ? (B.references.find(([, , k]) => Math.abs(k - r.km) < 1e-6)?.[0] || 'autre') : '10k',
      refKm: r ? r.km : 10, refTemps: r ? formatDuree(r.temps) : '', refDate: r ? r.date : ajout(t, -14),
      distance: 'semi', dateCourse: ajout(lundi(t), 7 * 12 + 6), nomCourse: '', tempsVise: '',
      seancesSemaine: 4, jours: JOURS_DEFAUT[4], jourLongue: 6, volume: 'normal',
    };
  }
  let bp = null;

  function lireBrouillon(f) {
    const fd = new FormData(f);
    bp.refDist = fd.get('refDist') || bp.refDist;
    bp.refKm = R.lireNombre(fd.get('refKm')) ?? bp.refKm;
    bp.refTemps = String(fd.get('refTemps') || '');
    bp.refDate = String(fd.get('refDate') || '');
    const avantDist = bp.distance;
    bp.distance = fd.get('distance') || bp.distance;
    bp.dateCourse = String(fd.get('dateCourse') || '');
    bp.nomCourse = String(fd.get('nomCourse') || '');
    bp.tempsVise = String(fd.get('tempsVise') || '');
    const n = Number(fd.get('seancesSemaine')) || bp.seancesSemaine;
    if (n !== bp.seancesSemaine) { bp.seancesSemaine = n; bp.jours = JOURS_DEFAUT[n]; bp.jourLongue = 6; return 'jours'; }
    bp.jours = fd.getAll('jours').map(Number);
    bp.jourLongue = Number(fd.get('jourLongue'));
    bp.volume = fd.get('volume') || bp.volume;
    return avantDist !== bp.distance ? 'distance' : '';
  }

  // Contrôle du brouillon ; renvoie { erreur } ou { reference, plan, gen }.
  function validerBrouillon() {
    const kmRef = bp.refDist === 'autre' ? bp.refKm : B.references.find(([k]) => k === bp.refDist)[2];
    const temps = R.lireDuree(bp.refTemps);
    if (!(kmRef >= 3 && kmRef <= 42.195)) return { erreur: 'Distance du chrono : entre 3 et 42,195 km.' };
    if (!temps) return { erreur: 'Saisis le temps de ton chrono de référence, par exemple 52:30 ou 1:55:00.' };
    const allureRef = temps / kmRef;
    if (allureRef < 150 || allureRef > 720) return { erreur: `Ce chrono donne une allure de ${formatAllure(allureRef)} /km : vérifie la distance et le temps (heures:minutes:secondes).` };
    if (!R.estDate(bp.refDate) || bp.refDate > auj()) return { erreur: 'Date du chrono : une date passée.' };
    if (!R.estDate(bp.dateCourse)) return { erreur: 'Saisis la date de ta course.' };
    const tv = bp.tempsVise.trim() ? R.lireDuree(bp.tempsVise) : null;
    if (bp.tempsVise.trim() && !tv) return { erreur: 'Temps visé illisible : par exemple 1:50:00.' };
    if (bp.jours.length !== bp.seancesSemaine) return { erreur: `Coche ${bp.seancesSemaine} jours de course (${bp.jours.length} cochés).` };
    const plan = { distance: bp.distance, dateCourse: bp.dateCourse, nomCourse: bp.nomCourse.trim(), tempsVise: tv, debut: auj(), seancesSemaine: bp.seancesSemaine, jours: bp.jours, jourLongue: bp.jours.includes(bp.jourLongue) ? bp.jourLongue : Math.max(...bp.jours), volume: bp.volume };
    let gen;
    try { gen = R.genererPlan(plan, B); } catch (x) { return { erreur: x.message }; }
    return { reference: { km: kmRef, temps, date: bp.refDate }, plan, gen };
  }

  function apercuBrouillon() {
    const z = $('#apercu');
    if (!z) return;
    const v = validerBrouillon();
    if (v.erreur) { z.innerHTML = `<p class="aide">${esc(v.erreur)}</p>`; return; }
    const d = B.distances[v.plan.distance];
    const A = R.calculerAllures(v.reference, { km: d.km, temps: v.plan.tempsVise }, B, E?.reglages.exposant ?? B.reglages.exposant);
    const avis = R.avisObjectif(v.plan.tempsVise, A.tempsPredit);
    const avert = R.avertissementsReference({ ...v.reference }, d.km, auj());
    z.innerHTML = `<div class="apercu-plan">
      <p><b>${esc(d.nom)}</b> le ${esc(dateLongue(v.plan.dateCourse))} · temps prédit <b>${formatDuree(A.tempsPredit)}</b> (${formatAllure(A.tempsPredit / d.km)} /km)${avis ? ` · ton objectif : <b>${formatDuree(v.plan.tempsVise)}</b> ${texteAvis(avis)}` : ''}</p>
      <p>${v.gen.semaines.length} semaines, ${pluriel(v.gen.seances.length, 'séance')}, à partir du ${esc(dateLongue(v.gen.seances[0].date))}.${v.gen.raccourci ? ` Le plan type compte ${d.semaines} semaines : tu commences à la semaine ${v.gen.raccourci + 1}.` : ''}${v.gen.attente > 6 ? ` Ta course est loin : le plan commence dans ${pluriel(v.gen.attente, 'jour')}, d'ici là cours 2 ou 3 fois par semaine en footing.` : ''}</p>
      ${avert.map((a) => `<p class="alerte-ligne">${esc(TEXTE_AVERT[a])}</p>`).join('')}
    </div>`;
  }

  const TEXTE_AVERT = {
    ancien: 'Ton chrono a plus de six mois : les allures seront moins justes. Un test récent (un 5 ou 10 km couru à fond) les rendra plus fiables.',
    extrapolation: 'Ton chrono est sur une distance très différente de ta course : la prédiction est une extrapolation lointaine, souvent trop optimiste du 5 km vers le marathon.',
  };
  const LIB_AVIS = { 'tres-ambitieux': ['rose', 'Très ambitieux'], ambitieux: ['jaune', 'Ambitieux'], realiste: ['vert', 'Réaliste'], prudent: ['ciel', 'Prudent'] };
  const texteAvis = (avis) => `<span class="etiquette ${LIB_AVIS[avis.niveau][0]}">${LIB_AVIS[avis.niveau][1]} · ${avis.ecart >= 0 ? '+' : '−'}${nombre(Math.abs(avis.ecart * 100))} %</span>`;

  function formulairePlan(premier) {
    const a = bp;
    return `<form id="form-plan" class="form-accueil" novalidate>
      <fieldset class="champ cadre-champs"><legend>Ton chrono de référence <small>Une course ou un test couru à fond, récent (moins de six mois) : c'est lui qui donne tes allures.</small></legend>
        ${radios('refDist', [...B.references.map(([k, l]) => [k, l]), ['autre', 'Autre']], a.refDist, 'cinq')}
        <div class="rang-champs">
          ${a.refDist === 'autre' ? `<label class="champ">Distance (km)<input name="refKm" inputmode="decimal" value="${String(a.refKm).replace('.', ',')}"></label>` : ''}
          <label class="champ">Temps (h:min:s)<input name="refTemps" inputmode="text" placeholder="52:30" value="${esc(a.refTemps)}"></label>
          <label class="champ">Date<input type="date" name="refDate" value="${esc(a.refDate)}" max="${auj()}"></label>
        </div>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Ta course</legend>
        ${radios('distance', Object.entries(B.distances).map(([k, d]) => [k, `${d.nom} · ${d.semaines} sem.`]), a.distance)}
        <div class="rang-champs">
          <label class="champ">Date de la course<input type="date" name="dateCourse" value="${esc(a.dateCourse)}" min="${ajout(auj(), 1)}"></label>
          <label class="champ">Temps visé <small>Facultatif</small><input name="tempsVise" inputmode="text" placeholder="1:50:00" value="${esc(a.tempsVise)}"></label>
        </div>
        <label class="champ">Nom de la course <small>Facultatif</small><input name="nomCourse" maxlength="80" placeholder="Ex. : Semi de ma ville" value="${esc(a.nomCourse)}"></label>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Ta disponibilité <small>Le plan place ses séances sur tes jours : sortie longue sur son jour, séances difficiles loin d'elle.</small></legend>
        ${radios('seancesSemaine', [[3, '3 séances'], [4, '4 séances'], [5, '5 séances']], a.seancesSemaine)}
        <p class="sous-legende">Jours de course</p>
        ${champsJours('jours', a.jours)}
        <div class="rang-champs">
          <label class="champ">Jour de la sortie longue<select name="jourLongue">${a.jours.map((j) => `<option value="${j}" ${j === a.jourLongue ? 'selected' : ''}>${B.jours[j]}</option>`).join('')}</select></label>
        </div>
        <p class="sous-legende">Volume des footings et sorties longues</p>
        ${radios('volume', Object.entries(B.volumes).map(([k, v]) => [k, v.nom]), a.volume)}
        <p class="aide">${esc(B.volumes[a.volume].texte)}</p>
      </fieldset>
      <div id="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>
      <div class="accueil-pied">${premier ? '<span></span>' : '<button class="btn" type="button" data-action="annuler-nouveau">Annuler</button>'}<button class="btn primaire" type="submit">Créer mon plan</button></div>
    </form>`;
  }

  function brancherFormulairePlan(premier) {
    const f = $('#form-plan');
    f.addEventListener('change', (e) => {
      lireBrouillon(f);
      if (['seancesSemaine', 'refDist', 'jours', 'volume'].includes(e.target.name)) { const y = scrollY; afficherFormulaire(premier); scrollTo(0, y); $(`#form-plan [name="${e.target.name}"][value="${e.target.value}"]`)?.focus({ preventScroll: true }); } else apercuBrouillon();
    });
    f.addEventListener('input', (e) => { if (e.target.matches('input:not([type=radio]):not([type=checkbox])')) { lireBrouillon(f); apercuBrouillon(); } });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      lireBrouillon(f);
      const v = validerBrouillon();
      if (v.erreur) { const p = f.querySelector('.erreur'); p.textContent = v.erreur; p.scrollIntoView({ block: 'nearest' }); return; }
      creerPlan(v);
    });
    apercuBrouillon();
  }

  function afficherFormulaire(premier) {
    const z = $('#zone-plan');
    z.innerHTML = formulairePlan(premier);
    brancherFormulairePlan(premier);
  }

  function ecranAccueil(premier = true) {
    if (!E) E = etatVide();
    bp = bp || brouillonPlan();
    document.body.classList.remove('app');
    document.title = 'Nouveau plan · Course à pied';
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">${premier ? 'Bienvenue' : 'Nouveau plan'}</p>
      <h1>${premier ? 'On prépare ton plan.' : 'Prépare ta prochaine course.'}</h1>
      <p class="intro">Trois choses suffisent : un chrono récent, ta course, et les jours où tu peux courir. Les allures se calculent, le plan se place jusqu'au jour J. Rien sur ta santé n'est demandé : ni poids, ni fréquence cardiaque.</p>
      <div id="zone-plan"></div>
      ${premier ? `<ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>` : ''}
      <p class="aide" style="margin-top:20px;max-width:760px">${AVERTISSEMENT_TEXTE}</p>
    </div>`;
    afficherFormulaire(premier);
  }

  function creerPlan(v) {
    retenir();
    const existe = E.references.some((r) => r.date === v.reference.date && Math.abs(r.km - v.reference.km) < 1e-6 && r.temps === v.reference.temps);
    if (!existe) E.references.push(R.normaliserReference(v.reference));
    if (E.plan) E.archives.push(E.plan);
    E.plan = R.normaliserPlan({ ...v.plan, seances: v.gen.seances, cree: auj() }, B);
    bp = null;
    vue = 'semaine';
    sauver();
    demarrer();
    toast(`Ton plan est prêt : ${pluriel(E.plan.seances.length, 'séance')} jusqu'au ${dateLongue(E.plan.dateCourse)}.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12V3A9 9 0 0 1 21 12Z" fill="currentColor"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    allures: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="14" width="4" height="7" fill="currentColor"/><rect x="10" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="4" width="4" height="17" fill="currentColor"/></svg>',
    objectif: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const ONGLETS = [['semaine', 'Semaine'], ['plan', 'Plan'], ['allures', 'Allures'], ['volume', 'Volume'], ['objectif', 'Objectif']];

  function demarrer() {
    if (!E.plan) { ecranAccueil(); return; }
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Plan<br>course à pied</span>
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
    if (!E || !E.plan || !$('#vue')) return;
    AL = allures();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Plan course à pied`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, plan: vuePlan, allures: vueAllures, volume: vueVolume, objectif: vueObjectif }[vue]();
    brancherInfobulles();
    if (vue === 'objectif') brancherObjectif();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const LIB_SITUATION = { faite: ['vert', 'Faite'], manquee: ['rose', 'Manquée'], aujourdhui: ['jaune', 'Aujourd\'hui'], 'a-cocher': ['jaune', 'À cocher'], 'a-venir': ['', ''] };
  const etiquetteType = (type) => `<span class="etiquette ${B.types[type].couleur}">${esc(B.types[type].court)}</span>`;

  function resumeSeance(r) {
    if (r.statut === 'faite') {
      const k = r.kmReel ?? null;
      const al = k && r.dureeReel ? ` · ${formatAllure(r.dureeReel / k)} /km` : '';
      return `${k !== null ? km(k) : `≈ ${km(r.km)}`}${r.dureeReel ? ` en ${formatDuree(r.dureeReel)}` : ''}${al}${r.ressenti ? ` · ${B.ressentis[r.ressenti - 1][1].toLowerCase()}` : ''}`;
    }
    return `≈ ${formatMinutes(r.min)} · ${km(r.km)}${r.allegee ? ' · allégée' : ''}`;
  }

  function carteSeance(s, { bouton = true } = {}) {
    const r = res(s);
    if (!r) return '';
    const t = auj();
    const sit = R.situation(s, t);
    const d = versDate(s.date);
    const [cl, lib] = LIB_SITUATION[sit];
    const cocher = bouton && (sit === 'aujourdhui' || sit === 'a-cocher') ? `<button class="btn petit coche" data-action="cocher" data-id="${s.id}" aria-label="Cocher « ${esc(r.titre)} » comme faite">${ICONES.check}Fait</button>` : '';
    return `<li class="carte-seance st-${sit} type-${r.type}">
      <span class="date-pastille ${s.date === t ? 'auj' : ''}"><b>${d.getDate()}</b>${fmt(s.date, { weekday: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="seance" data-id="${s.id}"><b>${esc(r.titre)}</b><span>${resumeSeance(r)}</span><span class="detail-impression">${r.blocs.map((b) => esc(R.texteBloc(b, AL, B))).join(' · ')}</span></button>
      <span class="cs-etiquettes">${etiquetteType(r.type)}${lib ? `<span class="etiquette ${cl}">${lib}</span>` : ''}${cocher}</span>
    </li>`;
  }

  function enteteCourse() {
    const t = auj();
    const j = ecart(t, dateCourse());
    const quand = j > 0 ? `J-${j}` : j === 0 ? 'Jour J' : 'Course passée';
    return `${quand} · ${esc(nomCourse())} · ${esc(dateLongue(dateCourse()))}`;
  }

  function semaineCourante(bilan, t) {
    const l = lundi(t);
    return bilan.find((w) => w.lundi === l) || null;
  }

  // ---------- Semaine ----------
  function vueSemaine() {
    const t = auj();
    const bilan = R.bilanSemaines(P(), B, AL, E.reglages);
    const w = semaineCourante(bilan, t);
    const N = bilan.length ? B.plans[P().distance].length : 0;
    const passee = t > dateCourse();
    const titre = `<div class="vue-tete"><div><p class="surtitre">${enteteCourse()}</p><h1>${passee ? 'Course terminée' : w ? `Semaine ${w.numero} sur ${N}` : 'Avant le plan'}</h1><p>${w ? `${esc(B.phases[w.phase].nom)} : ${esc(minuscule(B.phases[w.phase].texte))}` : passee ? 'Ton plan est arrivé à son terme.' : `Ton plan commence le ${esc(dateLongue(P().seances[0]?.date || dateCourse()))}. D'ici là, cours 2 ou 3 fois par semaine en footing.`}</p></div>
      <div class="actions">${w && !w.seances.some((s) => s.code === 'course') && !(!w.allegee && R.suggestions(P(), B, t).some((x) => x.lundi === w.lundi && (x.type === 'fatigue' || x.proposer))) ? `<button class="btn" data-action="alleger" data-lundi="${w.lundi}">${w.allegee ? 'Annuler l\'allègement' : 'Alléger cette semaine'}</button>` : ''}</div></div>`;
    if (passee) return `${titre}${blocFin()}${AVERTISSEMENT}`;
    const sugg = R.suggestions(P(), B, t);
    const html = [];
    for (const sg of sugg) {
      const qui = sg.lundi === lundi(t) ? 'cette semaine' : 'la semaine prochaine';
      if (sg.type === 'fatigue') html.push(`<div class="suggestion"><div><b>${sg.durs} de tes dernières séances ont été dures.</b><span>C'est souvent le signe d'une fatigue qui s'accumule. Alléger ${qui} réduit les footings, les sorties longues et les fractions d'environ un tiers, sans rien supprimer.</span></div><button class="btn petit" data-action="alleger" data-lundi="${sg.lundi}">Alléger ${qui}</button></div>`);
      if (sg.type === 'manquees') html.push(`<div class="suggestion"><div><b>${sg.nombre} séances manquées en une semaine.</b><span>Ne les rattrape pas en doublant : reprends le plan là où il en est. Si c'était de la fatigue, allège ${qui}.</span></div>${sg.proposer ? `<button class="btn petit" data-action="alleger" data-lundi="${sg.lundi}">Alléger ${qui}</button>` : ''}</div>`);
    }
    const aCocher = P().seances.filter((s) => R.situation(s, t) === 'a-cocher' && (!w || s.date < w.lundi));
    const prochaine = P().seances.find((s) => s.date >= t && s.statut === 'prevue');
    const tuiles = w ? [
      ['Kilomètres', nombre(w.kmFait, 0), `faits sur ≈ ${nombre(w.kmPrevu, 0)} prévus${w.allegee ? ' · allégée' : ''}`, 'var(--bleu)', 'rond'],
      ['Séances', `${w.faites}/${w.seances.length}`, `faites cette semaine${w.manquees ? ` · ${w.manquees} manquée${w.manquees > 1 ? 's' : ''}` : ''}`, 'var(--jaune)', ''],
      ['Allure visée', formatAllure(AL.bases.objectif), `/km · ${P().tempsVise ? `objectif ${formatDuree(P().tempsVise)}` : 'temps prédit'}`, 'var(--rouge)', ''],
      ['Course', String(Math.max(0, ecart(t, dateCourse()))), `jours · ${esc(distance().nom.toLowerCase())}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('') : '';
    return `${titre}
      ${html.join('')}
      ${tuiles ? `<div class="tuiles">${tuiles}</div>` : ''}
      ${prochaine ? blocProchaine(prochaine) : ''}
      ${aCocher.length ? `<h2 class="titre-section">À cocher <span>${pluriel(aCocher.length, 'séance passée', 'séances passées')} sans réponse</span></h2><ul class="liste-seances">${aCocher.slice(-5).map((s) => carteSeance(s)).join('')}</ul>` : ''}
      ${w ? `<h2 class="titre-section">Cette semaine <span>${esc(dateCourte(w.lundi))} au ${esc(dateCourte(ajout(w.lundi, 6)))}</span></h2><ul class="liste-seances">${w.seances.map((s) => carteSeance(s)).join('') || '<li class="aide">Aucune séance cette semaine.</li>'}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  function blocProchaine(s) {
    const r = res(s);
    const t = auj();
    const quand = s.date === t ? 'Aujourd\'hui' : s.date === ajout(t, 1) ? 'Demain' : majuscule(dateLongue(s.date));
    return `<section class="prochaine type-${r.type}"><div class="pr-tete"><p class="surtitre">${quand} · prochaine séance</p>${etiquetteType(r.type)}${r.allegee ? '<span class="etiquette sable">Allégée</span>' : ''}</div>
      <h2>${esc(r.titre)}</h2>
      <ul class="blocs-seance">${r.blocs.map((b) => `<li>${esc(R.texteBloc(b, AL, B))}</li>`).join('')}</ul>
      <p class="consigne">${esc(r.def.consigne)}</p>
      <p class="estimation">≈ ${formatMinutes(r.min)} · ${km(r.km)} <small>estimés d'après tes allures</small></p>
      <div class="rang">${s.date <= t ? `<button class="btn primaire" data-action="cocher" data-id="${s.id}">${ICONES.check}C'est fait</button><button class="btn" data-action="manquee" data-id="${s.id}">Manquée</button>` : ''}<button class="btn" data-action="seance" data-id="${s.id}">Détail${s.code !== 'course' ? ' et déplacer' : ''}</button></div>
    </section>`;
  }

  function blocFin() {
    const c = course();
    const bilan = R.bilanSemaines(P(), B, AL, E.reglages);
    const faites = P().seances.filter((s) => s.statut === 'faite');
    const kmT = bilan.reduce((t, w) => t + w.kmFait, 0);
    return `<div class="vide-etat">${FORME_VIDE}<div><h3>${c?.statut === 'faite' && c.dureeReel ? `${esc(nomCourse())} en ${formatDuree(c.dureeReel)}` : esc(nomCourse())}</h3>
      <p>${pluriel(faites.length, 'séance faite', 'séances faites')} sur ${P().seances.length}, ${km(kmT, 0)} courus pendant la préparation.${c && c.statut === 'prevue' ? ' Coche la course pour garder ton temps : il peut devenir ton nouveau chrono de référence.' : ''}</p>
      <div class="actions">${c && c.statut === 'prevue' ? `<button class="btn primaire" data-action="cocher" data-id="${c.id}">Saisir mon temps</button>` : ''}<button class="btn ${c && c.statut === 'prevue' ? '' : 'primaire'}" data-action="nouveau-plan">Préparer une nouvelle course</button></div></div></div>`;
  }

  // ---------- Plan ----------
  function vuePlan() {
    const t = auj();
    const bilan = R.bilanSemaines(P(), B, AL, E.reglages);
    const total = bilan.reduce((x, w) => x + w.kmPrevu, 0);
    const titre = `<div class="vue-tete"><div><p class="surtitre">${enteteCourse()}</p><h1>Le plan</h1><p>${esc(distance().nom)} · ${pluriel(P().seancesSemaine, 'séance')} par semaine · ${pluriel(P().seances.length, 'séance')}, ≈ ${km(total, 0)} au total. Touche une séance pour son détail, la cocher ou la déplacer.</p></div>
      <div class="actions"><button class="btn" data-action="imprimer">Imprimer le plan</button><button class="btn" data-action="ics">Ajouter à mon agenda</button></div></div>`;
    let phase = null;
    const sections = bilan.filter((w) => w.seances.length).map((w) => {
      const tete = w.phase !== phase ? `<h2 class="titre-phase">${esc(B.phases[w.phase].nom)} <span>${esc(B.phases[w.phase].texte)}</span></h2>` : '';
      phase = w.phase;
      const encours = w.lundi === lundi(t);
      return `${tete}<section class="semaine ${encours ? 'en-cours' : ''} ${w.lundi < lundi(t) ? 'passee' : ''}"><h3 class="titre-section">Semaine ${w.numero}${encours ? ' · en cours' : ''} <span>du ${esc(dateCourte(w.lundi))} · ≈ ${km(w.kmPrevu, 0)}${w.faites ? ` · ${km(w.kmFait, 0)} faits` : ''}${w.allegeePlan ? ' · assimilation' : ''}${w.allegee ? ' · allégée' : ''}</span></h3>
        <ul class="liste-seances">${w.seances.map((s) => carteSeance(s, { bouton: false })).join('')}</ul>
        ${w.lundi >= lundi(t) && !w.seances.some((s) => s.code === 'course') ? `<div class="rang"><button class="btn lien" data-action="alleger" data-lundi="${w.lundi}">${w.allegee ? 'Annuler l\'allègement' : 'Alléger cette semaine'}</button></div>` : ''}
      </section>`;
    }).join('');
    const impression = `<div class="entete-impression"><b>Plan d'entraînement · ${esc(nomCourse())} · ${esc(dateLongue(dateCourse()))}</b><span>Allures : footing ${fourchette('footing')} · sortie longue ${fourchette('longue')} · seuil ${fourchette('seuil')} · fractionné ${fourchette('frac')} · spécifique ${fourchette('specifique')} /km</span></div>`;
    return `${titre}${impression}${sections}${AVERTISSEMENT}`;
  }

  // ---------- Allures ----------
  function vueAllures() {
    const r = ref();
    const t = auj();
    const d = distance();
    const avis = R.avisObjectif(P().tempsVise, AL.tempsPredit);
    const avert = R.avertissementsReference(r, d.km, t);
    const lignes = B.ordreAllures.map((code) => {
      const a = B.allures[code];
      const f = AL.fourchettes[code];
      return `<tr><th scope="row"><span class="pastille-allure ${a.couleur}"></span>${esc(a.nom)}</th><td class="nb fort">${formatAllure(f.rapide)}–${formatAllure(f.lent)}</td><td class="nb">${nombre(R.vitesse(f.lent))}–${nombre(R.vitesse(f.rapide))}</td><td>${esc(a.sensation)}</td></tr>`;
    }).join('');
    const preds = R.predictions(r, B.predictions, E.reglages.exposant);
    const texteNiveau = {
      'tres-ambitieux': 'Ton objectif est nettement plus rapide que ce que prédit ton chrono. Garde-le si tu progresses vite, mais prévois un plan B à l\'allure prédite.',
      ambitieux: 'Un peu plus rapide que la prédiction : atteignable si la préparation se passe bien.',
      realiste: 'Cohérent avec ton chrono de référence.',
      prudent: 'Plus lent que la prédiction : une marge de sécurité, utile pour un premier marathon ou un parcours difficile.',
    };
    return `<div class="vue-tete"><div><h1>Allures</h1><p>Calculées depuis ton chrono de référence. Ce sont des <b>estimations</b> : ajuste-les à tes sensations, au terrain et à la météo.</p></div>
      <div class="actions"><button class="btn" data-action="nouveau-chrono">Nouveau chrono</button></div></div>
      <div class="colonnes-allures">
        <section class="carte-ref"><p class="surtitre">Chrono de référence</p><b>${km(r.km, 3).replace(',000', '')} en ${formatDuree(r.temps)}</b><span>${esc(dateLongue(r.date))}${r.libelle ? ` · ${esc(r.libelle)}` : ''} · ${formatAllure(r.temps / r.km)} /km</span>
          ${avert.map((a) => `<p class="alerte-ligne">${esc(TEXTE_AVERT[a])}</p>`).join('')}
          ${E.references.length > 1 ? `<details class="tableau-details"><summary>Chronos précédents (${E.references.length - 1})</summary><ul class="liste-refs">${E.references.filter((x) => x.id !== r.id).sort((a, b) => (a.date < b.date ? 1 : -1)).map((x) => `<li><span>${esc(dateCourte(x.date))} · ${km(x.km, 3).replace(',000', '')} en ${formatDuree(x.temps)}${x.libelle ? ` · ${esc(x.libelle)}` : ''}</span><button class="btn-suppr" data-action="suppr-ref" data-id="${x.id}" aria-label="Supprimer ce chrono">×</button></li>`).join('')}</ul></details>` : ''}
        </section>
        <section class="carte-ref objectif-carte"><p class="surtitre">${esc(d.nom)} · ${esc(dateCourte(dateCourse()))}</p><b>${formatDuree(AL.tempsPredit)} <small>prédit</small></b>
          <span>${P().tempsVise ? `Ton objectif : <b>${formatDuree(P().tempsVise)}</b> (${formatAllure(P().tempsVise / d.km)} /km) ${avis ? texteAvis(avis) : ''}` : `Pas de temps visé : l'allure spécifique est l'allure prédite (${formatAllure(AL.tempsPredit / d.km)} /km).`}</span>
          ${avis ? `<p class="aide">${esc(texteNiveau[avis.niveau])}</p>` : ''}
        </section>
      </div>
      <h2 class="titre-section">Tes allures d'entraînement <span>min:s par km · km/h</span></h2>
      <div class="defile"><table class="tableau allures"><thead><tr><th>Allure</th><th class="nb">/km</th><th class="nb">km/h</th><th>Sensation</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <h2 class="titre-section">Temps prédits <span>formule de Riegel, exposant ${nombre(E.reglages.exposant, 2)}</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Distance</th><th class="nb">Temps</th><th class="nb">Allure /km</th></tr></thead><tbody>${preds.map((p) => `<tr${p.reference ? ' class="ligne-ref"' : ''}><td>${esc(p.nom)}${p.reference ? ' <small>(ton chrono)</small>' : ''}</td><td class="nb">${formatDuree(p.temps)}</td><td class="nb">${formatAllure(p.allure)}</td></tr>`).join('')}</tbody></table></div>
      <div class="explication">
        <p><b>Comment c'est calculé.</b> Le temps sur une autre distance est estimé par la formule de Riegel : T2 = T1 × (D2 ÷ D1)^${nombre(E.reglages.exposant, 2)}. Le seuil est l'allure d'une course d'environ une heure ; le fractionné, l'allure 5 km ; footing, sortie longue et récupération sont des fourchettes autour de l'allure marathon prédite (repères QME). L'allure spécifique est celle de ton temps visé.</p>
        <p class="aide">Source : ${esc(B.sources[0][1])}. La prédiction suppose une préparation adaptée à la distance : du 5 ou 10 km vers le marathon, elle est souvent trop optimiste pour un coureur amateur. L'exposant se règle dans les réglages.</p>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Volume ----------
  const COUL_PREVU = '#C98A12', COUL_FAIT = '#2F65B0';
  function vueVolume() {
    const t = auj();
    const bilan = R.bilanSemaines(P(), B, AL, E.reglages).filter((w) => w.seances.length);
    const passees = bilan.filter((w) => w.lundi <= lundi(t));
    const kmFait = bilan.reduce((x, w) => x + w.kmFait, 0);
    const kmPrevuPasse = passees.reduce((x, w) => x + w.kmPrevu, 0);
    const toutes = P().seances.filter((s) => s.date <= t && s.code !== 'course');
    const faites = toutes.filter((s) => s.statut === 'faite');
    const notes = faites.filter((s) => s.ressenti);
    const max = bilan.reduce((m, w) => (w.kmPrevu > m.kmPrevu ? w : m), bilan[0]);
    const tuiles = [
      ['Courus', nombre(kmFait, 0), `km depuis le début · ≈ ${nombre(kmPrevuPasse, 0)} prévus`, 'var(--bleu)', 'rond'],
      ['Régularité', toutes.length ? `${Math.round(faites.length / toutes.length * 100)} %` : '–', `${faites.length} séances faites sur ${toutes.length} passées`, 'var(--jaune)', ''],
      ['Ressenti moyen', notes.length ? nombre(notes.reduce((x, s) => x + s.ressenti, 0) / notes.length) : '–', 'sur 5 (1 très facile, 5 très dur)', 'var(--rouge)', ''],
      ['Plus grosse semaine', max ? nombre(max.kmPrevu, 0) : '–', max ? `km prévus · semaine ${max.numero}` : '', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `<div class="vue-tete"><div><h1>Volume</h1><p>Les kilomètres de chaque semaine : prévus par le plan (estimés d'après tes allures) et réellement courus. La montée est progressive, l'affûtage la fait redescendre avant la course.</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Kilomètres par semaine <span>${bilan.length} semaines</span></h2>
      ${graphiqueVolume(bilan, t)}
      <p class="aide">Distance faite = distance saisie quand tu coches la séance (sinon la distance estimée). Une semaine allégée réduit les footings, les sorties longues et les fractions.</p>
      ${AVERTISSEMENT}`;
  }

  // Deux séries côte à côte (prévu, fait), légende, infobulle au survol et au clavier, tableau accessible.
  // Palette validée par le script du skill dataviz (contraste du prévu < 3:1 compensé par légende, valeurs et tableau).
  function graphiqueVolume(bilan, t) {
    const max = Math.max(1, ...bilan.map((w) => Math.max(w.kmPrevu, w.kmFait)));
    const l = lundi(t);
    const cols = bilan.map((w) => {
      const hp = w.kmPrevu / max * 100, hf = w.kmFait / max * 100;
      const futur = w.lundi > l;
      return `<div class="col-vol ${w.lundi === l ? 'actif' : ''}" tabindex="0" data-info="<b>Semaine ${w.numero} · ${esc(dateCourte(w.lundi))}</b>${esc(B.phases[w.phase].nom)}${w.allegee ? ' · allégée' : ''}<br>Prévu ≈ ${esc(km(w.kmPrevu))}${futur ? '' : `<br>Fait : ${esc(km(w.kmFait))} · ${w.faites}/${w.seances.length} séances`}">
        <span class="cv-val">${futur ? '' : nombre(w.kmFait, 0)}</span>
        <span class="cv-zone"><span class="cv-barre prevu" style="height:${hp.toFixed(1)}%"></span><span class="cv-barre fait" style="height:${futur ? 0 : hf.toFixed(1)}%"></span></span>
        <span class="cv-lib">${!estTel() || w.numero % 2 === bilan.at(-1).numero % 2 ? `S${w.numero}` : '&nbsp;'}</span></div>`;
    }).join('');
    const table = `<table class="tableau petit"><thead><tr><th>Semaine</th><th>Phase</th><th class="nb">Prévu (km)</th><th class="nb">Fait (km)</th><th class="nb">Séances</th><th class="nb">Ressenti</th></tr></thead><tbody>${bilan.map((w) => `<tr><td>${w.numero} · ${esc(dateCourte(w.lundi))}</td><td>${esc(B.phases[w.phase].nom)}${w.allegee ? ' (allégée)' : ''}</td><td class="nb">${nombre(w.kmPrevu)}</td><td class="nb">${w.lundi > l ? '' : nombre(w.kmFait)}</td><td class="nb">${w.lundi > l ? '' : `${w.faites}/${w.seances.length}`}</td><td class="nb">${w.ressentiMoyen ? nombre(w.ressentiMoyen) : ''}</td></tr>`).join('')}</tbody></table>`;
    return `<figure class="graphique volume" style="--prevu:${COUL_PREVU};--fait:${COUL_FAIT}">
      <div class="legende"><span><i class="prevu"></i>Prévu</span><span><i class="fait"></i>Fait</span></div>
      <div class="colonnes-vol" role="img" aria-label="Kilomètres prévus et faits par semaine, sur ${bilan.length} semaines" style="--n:${bilan.length}">${cols}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile">${table}</div></details></figure>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      if (fig.dataset.branche) return;
      fig.dataset.branche = '1';
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight + 30;
        if (y < 4) y = 4;
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

  // ---------- Objectif ----------
  function vueObjectif() {
    const p = P();
    const d = distance();
    return `<div class="vue-tete"><div><h1>Objectif</h1><p>Ta course et ta disponibilité. Changer la date, la distance ou les jours recalcule les séances à venir ; celles que tu as cochées restent.</p></div>
      <div class="actions"><button class="btn" data-action="nouveau-plan">Nouveau plan</button></div></div>
      <form id="form-objectif" class="form-objectif" novalidate>
        <fieldset class="champ cadre-champs"><legend>Ta course</legend>
          ${radios('distance', Object.entries(B.distances).map(([k, x]) => [k, x.nom]), p.distance)}
          <div class="rang-champs">
            <label class="champ">Date de la course<input type="date" name="dateCourse" value="${p.dateCourse}"></label>
            <label class="champ">Temps visé <small>Facultatif</small><input name="tempsVise" inputmode="text" placeholder="1:50:00" value="${p.tempsVise ? formatDuree(p.tempsVise) : ''}"></label>
          </div>
          <label class="champ">Nom de la course <small>Facultatif</small><input name="nomCourse" maxlength="80" value="${esc(p.nomCourse)}"></label>
        </fieldset>
        <fieldset class="champ cadre-champs"><legend>Ta disponibilité</legend>
          ${radios('seancesSemaine', [[3, '3 séances'], [4, '4 séances'], [5, '5 séances']], p.seancesSemaine)}
          <p class="sous-legende">Jours de course</p>
          ${champsJours('jours', p.jours)}
          <div class="rang-champs"><label class="champ">Jour de la sortie longue<select name="jourLongue">${B.jours.map((j, i) => `<option value="${i}" ${i === p.jourLongue ? 'selected' : ''}>${j}</option>`).join('')}</select></label></div>
          <p class="sous-legende">Volume des footings et sorties longues <small>(appliqué tout de suite, sans recalcul)</small></p>
          ${radios('volume', Object.entries(B.volumes).map(([k, v]) => [k, v.nom]), p.volume)}
        </fieldset>
        <p class="erreur" role="alert"></p>
        <div class="rang"><button class="btn primaire" type="submit">Enregistrer</button></div>
      </form>
      <h2 class="titre-section">Plan en cours <span>créé le ${esc(dateCourte(p.cree))}</span></h2>
      <p class="aide">${esc(d.nom)}, plan type de ${d.semaines} semaines : ${Object.entries(B.phases).map(([k, ph]) => (B.plans[p.distance].some((w) => w.phase === k) ? `${ph.nom.toLowerCase()} (${B.plans[p.distance].filter((w) => w.phase === k).length} sem.)` : '')).filter(Boolean).join(', ')}. Une semaine d'assimilation, plus légère, toutes les trois à quatre semaines.</p>
      ${E.archives.length ? `<h2 class="titre-section">Plans précédents <span>${E.archives.length}</span></h2><ul class="liste-simple archives">${E.archives.slice().reverse().map((a) => { const c = a.seances.find((s) => s.code === 'course'); return `<li><b>${esc(a.nomCourse || B.distances[a.distance].nom)}</b> · ${esc(dateLongue(a.dateCourse))} · ${a.seances.filter((s) => s.statut === 'faite').length}/${a.seances.length} séances${c?.statut === 'faite' && c.dureeReel ? ` · course en ${formatDuree(c.dureeReel)}` : ''}</li>`; }).join('')}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  function brancherObjectif() {
    const f = $('#form-objectif');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const p = P();
      const err = f.querySelector('.erreur');
      const tvS = String(fd.get('tempsVise') || '').trim();
      const tv = tvS ? R.lireDuree(tvS) : null;
      if (tvS && !tv) { err.textContent = 'Temps visé illisible : par exemple 1:50:00.'; return; }
      const n = Number(fd.get('seancesSemaine'));
      const jours = fd.getAll('jours').map(Number);
      if (jours.length !== n) { err.textContent = `Coche ${n} jours de course (${jours.length} cochés).`; return; }
      const jourLongue = Number(fd.get('jourLongue'));
      if (!jours.includes(jourLongue)) { err.textContent = 'Le jour de la sortie longue doit être un de tes jours de course.'; return; }
      const nouveau = { ...p, distance: fd.get('distance'), dateCourse: String(fd.get('dateCourse')), nomCourse: String(fd.get('nomCourse') || '').trim(), tempsVise: tv, seancesSemaine: n, jours, jourLongue, volume: fd.get('volume') };
      const structure = ['distance', 'dateCourse', 'seancesSemaine', 'jourLongue'].some((k) => nouveau[k] !== p[k]) || nouveau.jours.join() !== p.jours.join();
      let plan = nouveau;
      if (structure) {
        try { plan = R.regenerer(nouveau, B, auj()); } catch (x) { err.textContent = x.message; return; }
        if (!confirm('Recalculer les séances à venir ? Les séances passées et celles déjà cochées sont gardées.')) return;
      }
      retenir();
      E.plan = R.normaliserPlan(plan, B);
      sauver(); rendre();
      toast(structure ? 'Objectif enregistré : séances à venir recalculées.' : 'Objectif enregistré.', { libelle: 'Annuler', faire: annuler });
    });
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
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const TEXTE_DEPL = {
    'meme-jour': 'Une autre séance est déjà prévue ce jour-là.',
    'qualite-voisine': 'Séance difficile la veille ou le lendemain d\'une autre séance difficile : garde un jour facile entre les deux si tu peux.',
    'veille-longue': 'Veille de la sortie longue : tu risques de la commencer fatigué.',
    'autre-semaine': 'Hors de sa semaine : le volume de la semaine change.',
  };

  function modaleSeance(id, preset = null) {
    const s = seance(id);
    if (!s) return;
    const r = res(s);
    const t = auj();
    const estCourse = r.type === 'course';
    const statut = preset || s.statut;
    const libres = estCourse ? [] : R.joursLibres(P(), s, t);
    const w = R.semainesDuPlan(P(), B).find((x) => x.lundi === lundi(s.date));
    const corps = `<p class="rang">${etiquetteType(r.type)}${w ? `<span class="etiquette sable">Semaine ${w.numero} · ${esc(B.phases[w.phase].nom)}</span>` : ''}${r.allegee ? '<span class="etiquette sable">Allégée</span>' : ''}</p>
      <p><b>${esc(majuscule(dateLongue(s.date)))}</b></p>
      <div class="bloc-detail"><h3>Au programme</h3><ul class="blocs-seance">${r.blocs.map((b) => `<li>${esc(R.texteBloc(b, AL, B))}</li>`).join('')}</ul><p class="consigne">${esc(r.def.consigne)}</p><p class="estimation">≈ ${formatMinutes(r.min)} · ${km(r.km)} <small>estimés</small></p></div>
      <fieldset class="champ"><legend>Statut</legend>${radios('statut', [['prevue', 'Prévue'], ['faite', estCourse ? 'Courue' : 'Faite'], ['manquee', 'Manquée']], statut)}</fieldset>
      <div class="champs-faite" ${statut === 'faite' ? '' : 'hidden'}>
        <div class="rang-champs"><label class="champ">Distance réelle (km)<input name="kmReel" inputmode="decimal" placeholder="${nombre(r.km)}" value="${s.kmReel !== null ? String(s.kmReel).replace('.', ',') : ''}"></label>
        <label class="champ">${estCourse ? 'Temps officiel' : 'Durée'} (h:min:s)<input name="dureeReel" inputmode="text" placeholder="${formatDuree(Math.round(r.min) * 60)}" value="${s.dureeReel ? formatDuree(s.dureeReel) : ''}"></label></div>
        <fieldset class="champ"><legend>Ressenti <small>L'effort perçu, pas ta santé.</small></legend>${radios('ressenti', B.ressentis, s.ressenti ?? '', 'cinq')}</fieldset>
        ${estCourse ? '<label class="case"><input type="checkbox" name="commeRef" checked> Garder ce temps comme nouveau chrono de référence</label>' : ''}
      </div>
      <label class="champ">Note <small>Facultative : parcours, météo, sensations. N'y écris aucune donnée de santé.</small><textarea name="note" maxlength="500">${esc(s.note)}</textarea></label>
      ${estCourse ? '' : `<div class="groupe"><h3>Déplacer</h3>
        ${libres.length ? `<label class="champ">Nouveau jour<select name="deplacer"><option value="">Garder le ${esc(dateCourte(s.date))}</option>${libres.map((d) => `<option value="${d}">${esc(majuscule(dateLongue(d)))}</option>`).join('')}<option value="autre">Autre date…</option></select></label>` : `<label class="champ">Nouveau jour<select name="deplacer"><option value="">Garder le ${esc(dateCourte(s.date))}</option><option value="autre">Autre date…</option></select></label><p class="aide">Aucun jour libre dans cette semaine. Une séance manquée ne se rattrape pas en doublant.</p>`}
        <label class="champ" hidden data-autre>Date<input type="date" name="autreDate" min="${t}" max="${ajout(dateCourse(), -1)}"></label>
        <p class="alerte-ligne" data-avert hidden></p></div>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(r.titre), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const st = fd.get('statut');
      const kmS = String(fd.get('kmReel') || '').trim();
      const kmR = kmS ? R.lireNombre(kmS) : null;
      if (kmS && (kmR === null || kmR > 300)) return 'Distance illisible : par exemple 8,5.';
      const duS = String(fd.get('dureeReel') || '').trim();
      const du = duS ? R.lireDuree(duS) : null;
      if (duS && !du) return 'Durée illisible : par exemple 45:30 ou 1:52:10.';
      if (st === 'faite' && kmR && du && (du / kmR < 120 || du / kmR > 1200)) return `Allure de ${formatAllure(du / kmR)} /km : vérifie la distance et la durée.`;
      let date = s.date;
      const dep = fd.get('deplacer');
      if (dep === 'autre') date = String(fd.get('autreDate') || '');
      else if (dep) date = dep;
      if (date !== s.date) {
        const v = R.verifierDeplacement(P(), s, date, B);
        if (v.erreur) return v.erreur;
      }
      retenir();
      const x = seance(id);
      x.statut = st; x.note = String(fd.get('note') || '').trim().slice(0, 500); x.date = date;
      if (st === 'faite') { x.kmReel = kmR; x.dureeReel = du; x.ressenti = Number(fd.get('ressenti')) || null; } else { x.kmReel = null; x.dureeReel = null; x.ressenti = null; }
      P().seances.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      let msg = st === 'faite' ? (estCourse ? 'Course enregistrée. Bravo !' : 'Séance cochée.') : st === 'manquee' ? 'Séance notée manquée. Ne la rattrape pas en doublant : reprends le plan.' : date !== s.date ? `Séance déplacée au ${dateLongue(date)}.` : 'Séance enregistrée.';
      if (estCourse && st === 'faite' && du && fd.get('commeRef')) {
        E.references.push(R.normaliserReference({ date: x.date, km: distance().km, temps: du, libelle: nomCourse() }));
        msg = 'Course enregistrée : ton temps devient ton chrono de référence.';
      }
      sauver(); rendre();
      toast(msg, { libelle: 'Annuler', faire: annuler });
    }, 'large');
    const d = modale();
    d.querySelectorAll('[name=statut]').forEach((el) => el.addEventListener('change', () => { d.querySelector('.champs-faite').hidden = el.value !== 'faite' || !el.checked; }));
    const sel = d.querySelector('[name=deplacer]');
    const avert = () => {
      const zone = d.querySelector('[data-avert]');
      const v = sel.value === 'autre' ? d.querySelector('[name=autreDate]').value : sel.value;
      d.querySelector('[data-autre]').hidden = sel.value !== 'autre';
      if (!v) { zone.hidden = true; return; }
      const c = R.verifierDeplacement(P(), s, v, B);
      const l = c.erreur ? [c.erreur] : c.avertissements.map((a) => TEXTE_DEPL[a]);
      zone.textContent = l.join(' ');
      zone.hidden = !l.length;
    };
    sel?.addEventListener('change', avert);
    d.querySelector('[name=autreDate]')?.addEventListener('change', avert);
    if (preset === 'faite') d.querySelector('[name=kmReel]')?.focus();
  }

  function marquerManquee(id) {
    const s = seance(id);
    if (!s) return;
    retenir();
    s.statut = 'manquee'; s.kmReel = null; s.dureeReel = null; s.ressenti = null;
    sauver(); rendre();
    toast('Séance notée manquée. Ne la rattrape pas en doublant : reprends le plan.', { libelle: 'Annuler', faire: annuler });
  }

  function basculerAllegement(l) {
    retenir();
    const a = P().semainesAllegees;
    const i = a.indexOf(l);
    if (i >= 0) a.splice(i, 1); else a.push(l);
    sauver(); rendre();
    toast(i >= 0 ? 'Allègement annulé.' : 'Semaine allégée : footings, sorties longues et fractions réduits d\'environ un tiers.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleChrono() {
    const corps = `<p class="aide">Une course ou un test couru à fond (5 ou 10 km par exemple). Toutes tes allures sont recalculées depuis le chrono le plus récent.</p>
      ${radios('refDist', [...B.references.map(([k, l]) => [k, l]), ['autre', 'Autre']], '10k', 'cinq')}
      <div class="rang-champs"><label class="champ" data-km hidden>Distance (km)<input name="refKm" inputmode="decimal"></label>
      <label class="champ">Temps (h:min:s)<input name="refTemps" inputmode="text" placeholder="49:50"></label>
      <label class="champ">Date<input type="date" name="refDate" value="${auj()}" max="${auj()}"></label></div>
      <label class="champ">Où <small>Facultatif</small><input name="libelle" maxlength="80" placeholder="Ex. : 10 km de ma ville"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouveau chrono de référence', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const dist = fd.get('refDist');
      const k = dist === 'autre' ? R.lireNombre(fd.get('refKm')) : B.references.find(([x]) => x === dist)[2];
      const tps = R.lireDuree(fd.get('refTemps'));
      const date = String(fd.get('refDate') || '');
      if (!(k >= 3 && k <= 42.195)) return 'Distance : entre 3 et 42,195 km.';
      if (!tps) return 'Temps illisible : par exemple 49:50 ou 1:48:30.';
      if (tps / k < 150 || tps / k > 720) return `Allure de ${formatAllure(tps / k)} /km : vérifie la distance et le temps.`;
      if (!R.estDate(date) || date > auj()) return 'Date : aujourd\'hui ou avant.';
      const avant = AL;
      retenir();
      E.references.push(R.normaliserReference({ km: k, temps: tps, date, libelle: String(fd.get('libelle') || '').trim() }));
      sauver(); rendre();
      const apres = AL;
      const diff = avant && apres ? Math.round(apres.fourchettes.seuil.milieu - avant.fourchettes.seuil.milieu) : 0;
      toast(`Chrono enregistré : allures recalculées${diff ? ` (seuil ${diff < 0 ? 'plus rapide' : 'plus lent'} de ${Math.abs(diff)} s/km)` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=refDist]').forEach((el) => el.addEventListener('change', () => { d.querySelector('[data-km]').hidden = el.value !== 'autre'; }));
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <label class="champ">Exposant de la formule de Riegel <small>1,06 par défaut (Riegel, 1981). Plus grand = prédictions plus prudentes sur les longues distances (1,08 ou 1,10 si le marathon te paraît trop optimiste).</small><input name="exposant" inputmode="decimal" value="${String(r.exposant).replace('.', ',')}"></label>
      <label class="champ">Réduction d'une semaine allégée (%) <small>Part retirée des footings et sorties longues ; les fractions perdent environ 40 %. 30 % par défaut.</small><input name="allegement" inputmode="numeric" value="${Math.round((1 - r.allegement) * 100)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tes séances en tableur (CSV) ou dans ton agenda (fichier .ics, une journée par séance, avec le détail et les allures).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button><button class="btn petit" type="button" data-action="ics">Exporter vers l'agenda</button><button class="btn petit" type="button" data-action="imprimer">Imprimer le plan</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton plan est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du plan, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le plan à ton écran d'accueil pour l'ouvrir comme une application et cocher ta séance en rentrant.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le plan garde tes chronos, ta course, tes jours de course et tes séances (distance, durée, ressenti de l'effort, notes), enregistrés en ligne avec ta clé, ni lus ni partagés par QME. Aucune donnée de santé n'est demandée : ni poids, ni fréquence cardiaque, ni blessure. N'en écris pas dans les notes. Aucune montre ni application n'est connectée : tu saisis toi-même.</p></div>
      <div class="groupe"><h3>Avertissement</h3><p class="aide">${AVERTISSEMENT_TEXTE} Pour t'inscrire à une course, renseigne-toi auprès de l'organisateur sur les conditions demandées.</p></div>
      <div class="groupe"><h3>Sources</h3><ul class="champs-aide-liste">${B.sources.map(([l, s]) => `<li>${esc(l)}<br><small>${esc(s)}</small></li>`).join('')}</ul></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Plans types de 8, 12 et 16 semaines et ${Object.keys(B.seances).length} séances rédigés pour QME (version ${B.version}), sans reprise d'un plan publié ni d'une méthode commerciale.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ex = R.lireNombre(fd.get('exposant'));
      if (ex === null || ex < 1 || ex > 1.2) return 'Exposant : entre 1 et 1,2.';
      const al = R.lireNombre(fd.get('allegement'));
      if (al === null || al < 5 || al > 60) return 'Réduction : entre 5 et 60 %.';
      E.reglages = R.normaliserReglages({ exposant: ex, allegement: 1 - al / 100 }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés : allures et volumes recalculés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!donnees.plan || !Array.isArray(donnees.references)) throw new Error();
        if (!confirm('Remplacer ton plan actuel par cette copie ?')) return;
        const vu = E.tutorielVu; E = normaliser(donnees); delete E.majLe; if (vu) E.tutorielVu = true;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du plan.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `plan-course-a-pied-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(P(), B, allures(), E.reglages), 'text/csv;charset=utf-8', `seances-course-a-pied-${auj()}.csv`);
  const exporterIcs = () => { telecharger(R.versIcs(P(), B, allures(), E.reglages, new Date().toISOString()), 'text/calendar;charset=utf-8', `plan-course-a-pied-${auj()}.ics`); toast('Fichier d\'agenda téléchargé : ouvre-le pour ajouter les séances à ton agenda.'); };
  function imprimer() {
    if (modale().open) modale().close();
    if (vue !== 'plan') changerVue('plan');
    setTimeout(() => window.print(), 60);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const reduction = Math.round((1 - E.reglages.allegement) * 100);
    const blocs = [
      ['rose', 'Tes allures viennent d\'un chrono', `Footing, seuil, fractionné, allure course&nbsp;: toutes tes allures se calculent à partir de ton chrono de référence le plus récent. Ce sont des estimations, à ajuster à tes sensations. Un nouveau chrono, sur une course ou un test, les recalcule toutes&nbsp;: ajoute-le dans <b>Allures</b>.`],
      ['beurre', 'Un plan par phases', `Foncier, développement, spécifique, affûtage, puis la semaine de la course. Chaque semaine, la sortie longue tombe sur son jour et les séances de qualité sur les jours les plus éloignés d'elle. Certaines semaines sont allégées pour assimiler le travail.`],
      ['ciel', 'Coche chaque séance', `Après avoir couru, coche la séance comme faite et note la distance, la durée et ton ressenti. Une séance passée sans réponse reste <b>À&nbsp;cocher</b>. Une séance manquée ne se rattrape pas&nbsp;: déplace-la dans sa semaine si un jour est libre, sinon passe à la suivante.`],
      ['sable', 'Le plan s\'adapte, sur ta décision', `Si tes séances récentes sont jugées dures ou si deux séances sont manquées en une semaine, l'application te propose d'alléger une semaine&nbsp;: rien ne change sans toi. Une semaine allégée retire ${reduction}&nbsp;% des footings et des sorties longues, et environ 40&nbsp;% des fractions.`],
    ];
    const corps = `
      <p>Le plan place tes séances jusqu'au jour de la course et calcule tes allures. Ton rôle&nbsp;: courir, puis cocher chaque séance avec ce que tu as fait et ton ressenti.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Plan</b> montre toutes les semaines jusqu'à la course, <b>Volume</b> le prévu et le réalisé semaine par semaine, <b>Objectif</b> ta course et tes jours de course&nbsp;: les changer recalcule les séances à venir, sans toucher à celles que tu as cochées. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const pied = `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied);
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
      <p>Enregistre ce plan sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Pratique pour cocher ta séance en rentrant.</p>
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'ics': exporterIcs(); break;
      case 'imprimer': imprimer(); break;
      case 'fermer': modale().close(); break;
      case 'seance': modaleSeance(id); break;
      case 'cocher': modaleSeance(id, 'faite'); break;
      case 'manquee': marquerManquee(id); break;
      case 'alleger': basculerAllegement(el.dataset.lundi); break;
      case 'nouveau-chrono': modaleChrono(); break;
      case 'suppr-ref': { if (E.references.length < 2) break; retenir(); E.references = E.references.filter((r) => r.id !== id); sauver(); rendre(); toast('Chrono supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'nouveau-plan': if (modale().open) modale().close(); bp = brouillonPlan(); ecranAccueil(false); window.scrollTo({ top: 0 }); break;
      case 'annuler-nouveau': bp = null; demarrer(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E || !E.plan) return;
    rafraichir();
    if (!modale().open && $('#vue')) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeurPrec = innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(innerWidth - largeurPrec) > 40 && E?.plan && $('#vue') && vue === 'volume') { largeurPrec = innerWidth; rendre(); } });

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
        if (E.plan) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__course = { etat: () => E, regles: R };
  init();
})();
