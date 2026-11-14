// Planning de mémoire ou de thèse QME : projet (type, dates de rendu et de soutenance, mots visés), plan hiérarchique
// (parties, chapitres, sections) avec statut et mots saisis, rétroplanning calculé depuis la date de rendu (jalons
// types modifiables), rythme nécessaire en mots par jour, courbe d'avancement, rendez-vous avec le directeur (points
// abordés, actions), bibliographie simple (export texte auteur-date), journal de travail, impression.
// Données synchronisées par clé de licence ou code d'accès. Aucun fichier du mémoire n'est lu ni envoyé : les mots se
// recopient depuis le traitement de texte. Aucune règle d'établissement intégrée.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MMR;
  const API = '/api/templates';
  const PRODUIT = 'MMR';
  const CLE_CODE = 'qme-mmr-code';
  const CLE_CACHE = 'qme-mmr-cache';
  const CLE_DEMO = 'qme-mmr-demo';
  const CLE_PREF = 'qme-mmr-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-mmr-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const N = R.nombreTexte;
  const pluriel = (n, s, p) => `${N(n)} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateMoy = (d) => (d ? `${R.versDate(d).getDate()} ${MOIS_C[R.versDate(d).getMonth()]}${d.slice(0, 4) !== auj().slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}` : '');
  const dateCourte = (d) => R.versDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const majuscule = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
  const dans = (d) => { const n = R.ecart(auj(), d); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${pluriel(n, 'jour')}` : `il y a ${pluriel(-n, 'jour')}`; };
  function lireDuree(v) {
    const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return 0;
    if (/^\d+$/.test(s)) return Number(s);
    const m = s.match(/^(\d+)(?:h|:)(\d{0,2})(?:min|m)?$/);
    if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
    const m2 = s.match(/^(\d+)(?:min|m)$/);
    return m2 ? Number(m2[1]) : null;
  }
  const dureeSaisie = (min) => (min ? `${Math.floor(min / 60)}h${R.deux(min % 60)}` : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const pref = stock.lire(CLE_PREF) || {};
  const filtre = { biblio: ['tous', 'alire', 'encours', 'lu'].includes(pref.biblio) ? pref.biblio : 'tous', q: '', journal: 30 };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const section = (id) => E.sections.find((s) => s.id === id);
  const typeNom = () => B.types[E.projet.type].nom;
  function sauverPref() { stock.ecrire(CLE_PREF, { biblio: filtre.biblio }); }

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
        toast('Un autre appareil a modifié ton planning entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte une copie, puis retire les séances anciennes du journal (Réglages).');
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
  // Étudiante fictive en master 2 (sujet, établissement, directrice et références inventés), à des dates relatives à
  // aujourd'hui. Couvre chaque état : jalons faits, un jalon en retard, un proche, des sections à chaque statut, une
  // partie sans mots, des relevés avec une pause de deux semaines, des actions du directeur faites, en retard et à
  // venir, un rendez-vous prévu, des références lues, en cours et à lire, des séances de travail.
  function donneesDemo() {
    const t = auj();
    const j = (n) => R.ajout(t, n);
    let graine = 11;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    let e = etatVide();
    e.projet = R.normaliserProjet({
      type: 'master', titre: 'Parler en îlots : la participation orale des élèves de cinquième en travail de groupe',
      discipline: 'Master 2 · Sciences de l\'éducation', etablissement: 'Université fictive de Valbrune', directeur: 'Mme R. Valette (directrice fictive)',
      debut: j(-110), rendu: j(75), soutenance: j(92), objectifMots: 20000, motsParPage: 300, joursTravail: [1, 2, 3, 4, 5],
    }, B);
    e.sections = R.genererPlan(B, 'master', 20000);
    const par = (debutTitre) => e.sections.find((s) => s.titre.startsWith(debutTitre));
    const maj = (titre, champs) => { e = R.modifierSection(e, par(titre).id, champs); };
    const sous = (titre, liste) => { const p = par(titre); liste.forEach(([nom, statut, mots, objectif]) => { e = R.ajouterSection(e, { id: uid(), parent: p.id, titre: nom, statut, mots, objectif }); }); e = R.modifierSection(e, p.id, { objectif: 0 }); };
    maj('Introduction', { statut: 'brouillon', mots: 900, note: 'À reprendre une fois les résultats écrits : annoncer le plan.' });
    sous('Chapitre 1', [['1.1 Le travail de groupe au collège', 'final', 1900, 1300], ['1.2 Ce que recouvre la participation orale', 'relu', 1500, 1300], ['1.3 Le rôle de l\'enseignant pendant le travail de groupe', 'brouillon', 900, 1000]]);
    maj('Chapitre 2', { statut: 'relu', mots: 1750 });
    maj('Chapitre 3', { statut: 'brouillon', mots: 2100, note: 'Ajouter le tableau des classes observées (anonymisé).' });
    sous('Chapitre 4', [['4.1 Observations en classe', 'brouillon', 1200, 1600], ['4.2 Entretiens avec les élèves', 'aecrire', 0, 1500], ['4.3 Questionnaires', 'aecrire', 0, 1300]]);
    maj('Bibliographie', { statut: 'brouillon', mots: 350 });
    const total = R.totalMots(e);
    // Relevés : un par jour de travail depuis le début, pause de deux semaines il y a sept semaines.
    const jours = [];
    for (let d = j(-100); d <= t; d = R.ajout(d, 1)) if ([1, 2, 3, 4, 5].includes(R.versDate(d).getDay()) && !(d > j(-56) && d < j(-41)) && alea() > 0.2) jours.push(d);
    const poids = jours.map((d, i) => (0.4 + alea()) * (i < jours.length / 3 ? 0.6 : 1.1));
    const somme = poids.reduce((x, y) => x + y, 0);
    let cumul = 0;
    e.releves = jours.map((d, i) => { cumul = i === jours.length - 1 ? total : Math.min(total, cumul + Math.round((total * poids[i]) / somme)); return { date: d, mots: cumul }; });
    // Jalons : modèle du master, trois faits, un en retard ; un jalon personnel proche.
    e.jalons = R.genererJalons(B, 'master');
    const rp = R.retroplanning(e).jalons;
    e.jalons = e.jalons.map((x) => { const q = rp.find((y) => y.id === x.id).quand; return q < j(-6) ? { ...x, fait: R.ajout(q, Math.round(alea() * 4) - 2) } : x; });
    e.jalons.push(R.normaliserJalon({ id: uid(), nom: 'Fin des entretiens avec les élèves', ancre: 'date', date: j(6), note: 'Deux entretiens restent à caler avec le collège.' }));
    // Rendez-vous avec la directrice.
    const A = (texte, echeance, faite) => ({ id: uid(), texte, echeance, faite });
    e.rdv = [
      { id: uid(), date: j(-100), mode: 'presentiel', points: 'Choix du sujet et premières lectures.\nTerrain possible dans deux classes de cinquième.', notes: 'Sujet accepté. Resserrer la question sur l\'oral, pas sur les apprentissages en général.', actions: [A('Rédiger une problématique en une page', j(-86), j(-88)), A('Lire les trois références conseillées', j(-80), j(-79))] },
      { id: uid(), date: j(-70), mode: 'visio', points: 'Plan détaillé.\nGrille d\'observation.', notes: 'Plan validé avec une partie théorique plus courte. La grille doit compter les prises de parole par élève et par minute.', actions: [A('Simplifier la grille d\'observation', j(-60), j(-58)), A('Demander l\'accord du collège pour les observations', j(-62), j(-63))] },
      { id: uid(), date: j(-38), mode: 'presentiel', points: 'Relecture du chapitre 1.', notes: 'Chapitre 1 solide. Section 1.3 encore descriptive : l\'appuyer sur deux études.', actions: [A('Reprendre la section 1.3 avec deux études empiriques', j(-10), ''), A('Préparer le guide d\'entretien', j(-25), j(-24))] },
      { id: uid(), date: j(-12), mode: 'visio', points: 'Méthodologie.\nCalendrier des entretiens.', notes: 'Bien expliquer comment les élèves ont été choisis. Prévoir l\'anonymisation dès la transcription.', actions: [A('Anonymiser les transcriptions déjà faites', j(4), ''), A('Envoyer le chapitre 3 relu', j(10), ''), A('Ajouter le formulaire d\'information des familles en annexe', j(-3), '')] },
      { id: uid(), date: j(9), mode: 'presentiel', points: 'Premiers résultats des observations.\nFaut-il garder les questionnaires dans le corps du texte ?\nDate de dépôt à confirmer avec le secrétariat.', notes: '', actions: [] },
    ];
    // Bibliographie (références inventées).
    const sec = (titre) => par(titre)?.id || e.sections.find((s) => s.titre.startsWith(titre))?.id;
    e.refs = [
      ['Arnoux, Hélène', '2019', 'Le travail de groupe au collège : un état des lieux', 'Revue fictive des pratiques scolaires, 14(2), 33-58', 'Article', 'lu', 'Distingue groupe de travail et travail de groupe. Utile pour la définition en 1.1.', ['1.1']],
      ['Arnoux, Hélène; Belfort, Simon', '2021', 'Parler pour apprendre en classe de cinquième', 'Presses fictives de Valbrune', 'Ouvrage', 'lu', 'Chapitre 3 sur les tours de parole : cité dans 1.2.', ['1.2']],
      ['Belfort, Simon', '2021', 'Mesurer la participation orale : méthodes d\'observation', 'Cahiers fictifs de didactique, 8, 101-124', 'Article', 'lu', 'Grille reprise et simplifiée pour la méthodologie.', ['Chapitre 3']],
      ['Belfort, Simon', '2021', 'Les élèves silencieux en travail de groupe', 'Revue fictive des pratiques scolaires, 16(1), 9-27', 'Article', 'encours', '', ['4.1']],
      ['Carrel, Nadia; Duprat, Léo; Esnault, Paule', '2017', 'L\'enseignant pendant le travail de groupe : circuler, écouter, relancer', 'Recherches fictives en éducation, 22, 45-70', 'Article', 'lu', 'Trois postures de l\'enseignant. À relier aux observations.', ['1.3']],
      ['Duprat, Léo', '2015', 'Interactions entre pairs et apprentissages', 'Thèse de doctorat fictive, Université de Montclair', 'Thèse ou mémoire', 'encours', 'Lire surtout la partie 2.', ['1.1']],
      ['Observatoire fictif de la vie scolaire', '2023', 'Enquête sur les pratiques de classe en cycle 4', 'Rapport fictif', 'Rapport', 'lu', 'Chiffres de contexte pour l\'introduction (à citer avec prudence).', ['Introduction']],
      ['Fabre, Claire', '2020', 'Conduire un entretien avec un élève', 'Dans S. Belfort (dir.), Enquêter à l\'école (p. 77-95). Presses fictives de Valbrune', 'Chapitre d\'ouvrage', 'lu', 'Guide d\'entretien.', ['Chapitre 3']],
      ['Gauthier, Inès', '2022', 'Îlots et disposition de la classe', 'Journal fictif de l\'enseignement secondaire, 5(3), 12-30', 'Article', 'alire', '', []],
      ['Hamon, Victor', '2018', 'Prendre la parole devant ses pairs à 12 ans', 'Revue fictive de psychologie scolaire, 31, 201-219', 'Article', 'alire', 'Conseillé par la directrice le jour du 3e rendez-vous.', ['4.2']],
      ['Ivanov, Marta; Arnoux, Hélène', '2024', 'Anonymiser des données d\'élèves : guide pratique', 'https://www.example.org/guide-anonymisation', 'Page web', 'encours', '', ['Chapitre 3'], j(-12)],
      ['Joly, Bastien', '2016', 'Questionnaires en classe : pièges et bonnes pratiques', 'Éditions fictives du Pré', 'Ouvrage', 'alire', '', ['4.3']],
      ['Klein, Sarah', '2020', 'Évaluer l\'oral au collège', 'Cahiers fictifs de didactique, 6, 55-80', 'Article', 'alire', '', ['Chapitre 5']],
    ].map(([auteurs, annee, titre, source, type, statut, notes, secs, consulte], i) => {
      const web = source.startsWith('http');
      return R.normaliserRef({ id: uid(), auteurs, annee, titre, source: web ? '' : source, url: web ? source : '', consulte, type, statut, notes, sections: secs.map(sec).filter(Boolean), ajoute: j(-100 + i * 7) });
    });
    // Journal : séances des quatre dernières semaines.
    const lieux = [par('4.1'), par('Chapitre 3'), par('1.3'), par('Introduction'), par('4.2')].map((s) => s.id);
    const notes = ['Transcription de deux observations.', 'Relecture de la méthodologie.', 'Lecture d\'Arnoux et Belfort.', '', 'Mise au propre du tableau des classes.', ''];
    for (let k = 28; k >= 0; k--) {
      const d = j(-k);
      if (![1, 2, 3, 4, 5].includes(R.versDate(d).getDay()) || alea() < 0.25) continue;
      const rel = R.valeurAu(e.releves, d), avant = R.valeurAu(e.releves, R.ajout(d, -1));
      e.seances.push(R.normaliserSeance({ id: uid(), date: d, minutes: 45 + Math.round(alea() * 9) * 15, mots: rel && avant ? rel.mots - avant.mots : 0, section: lieux[Math.floor(alea() * lieux.length)], note: notes[Math.floor(alea() * notes.length)] }));
    }
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planning de mémoire · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="30" width="200" height="250" rx="12" fill="#F0EDE6"/>
          <rect x="44" y="64" width="150" height="16" rx="8" fill="#1D4E89"/>
          <rect x="44" y="100" width="110" height="12" rx="6" fill="#141414"/>
          <rect x="64" y="128" width="120" height="12" rx="6" fill="#141414"/>
          <rect x="64" y="156" width="96" height="12" rx="6" fill="#141414"/>
          <rect x="44" y="192" width="130" height="12" rx="6" fill="#141414"/>
          <rect x="64" y="220" width="88" height="12" rx="6" fill="#F5B400"/>
          <circle cx="400" cy="110" r="80" fill="#D9302A"/>
          <path d="M300 282 L300 200 A82 82 0 0 1 382 282 Z" fill="#1D4E89"/>
          <rect x="420" y="214" width="68" height="68" rx="10" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planning de mémoire ou de thèse</p>
          <h1>Le plan, le rythme, la date.</h1>
          <p>Ton plan avec le statut de chaque section, le rétroplanning depuis la date de rendu, les mots par jour qu'il reste à écrire, tes rendez-vous avec ton directeur et ta bibliographie.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planning de mémoire</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton planning est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon planning</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/memoire/">Voir le planning de mémoire</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon planning'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, type: 'master', titre: '', debut: auj(), rendu: '', soutenance: '', mots: String(B.types.master.mots), plan: 'type' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton mémoire, chapitre par chapitre, jusqu'au rendu.</h1>
        <p class="intro">Tu poses ta date de rendu et le nombre de mots demandé, tu construis ton plan, et tu notes de temps en temps où tu en es. Le planning calcule le rétroplanning, les mots qu'il te reste à écrire chaque jour et ton avancement. Ton texte reste dans ton traitement de texte : rien n'est importé ni envoyé.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton projet</h1>
        <p class="intro">Tout se modifie ensuite dans « Projet ». Les dates et le nombre de mots viennent des consignes de ton établissement.</p>
        <div class="form-accueil">
          <fieldset class="cadre-champs"><legend>Type de travail</legend>
            <div class="choix-statut deux">${Object.entries(B.types).map(([c, t]) => `<label><input type="radio" name="a-type" value="${c}" ${c === a.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div>
          </fieldset>
          <label class="champ">Titre ou sujet <small>facultatif</small><input id="a-titre" value="${esc(a.titre)}" maxlength="200"></label>
          <div class="rang-champs">
            <label class="champ">Date de début<input id="a-debut" type="date" value="${esc(a.debut)}"></label>
            <label class="champ">Date de rendu<input id="a-rendu" type="date" value="${esc(a.rendu)}"></label>
            <label class="champ">Soutenance <small>facultatif</small><input id="a-soutenance" type="date" value="${esc(a.soutenance)}"></label>
          </div>
          <label class="champ">Nombre de mots visé <small>valeur de départ à remplacer par la consigne de ton établissement</small><input id="a-mots" inputmode="numeric" value="${esc(a.mots)}" maxlength="7"></label>
          <fieldset class="cadre-champs"><legend>Plan de départ</legend>
            <div class="choix-statut deux"><label><input type="radio" name="a-plan" value="type" ${a.plan === 'type' ? 'checked' : ''}><span>Plan type du ${esc(B.types[a.type].court.toLowerCase())}</span></label><label><input type="radio" name="a-plan" value="vide" ${a.plan === 'vide' ? 'checked' : ''}><span>Plan vide</span></label></div>
          </fieldset>
          <p class="aide">Le rétroplanning reprend les jalons types du ${esc(B.types[a.type].nom.toLowerCase())}, placés à partir de ta date de rendu. Ce sont des repères indicatifs, sans valeur officielle : modifie-les d'après le calendrier de ton établissement${a.type === 'these' ? ' et de ton école doctorale' : ''}.</p>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['titre', 'debut', 'rendu', 'soutenance', 'mots']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    document.querySelectorAll('[name=a-type]').forEach((r) => r.addEventListener('change', (e) => {
      const ancien = B.types[accueil.type].mots;
      accueil.type = e.target.value;
      if (!accueil.mots || Number(accueil.mots) === ancien) accueil.mots = String(B.types[accueil.type].mots);
      ecranAccueil();
    }));
    document.querySelectorAll('[name=a-plan]').forEach((r) => r.addEventListener('change', (e) => { accueil.plan = e.target.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    const mots = String(a.mots).replace(/\s/g, '');
    if (mots && !/^\d+$/.test(mots)) return ecranAccueil('Le nombre de mots doit être un nombre entier.');
    if (!R.estDate(a.rendu)) return ecranAccueil('Indique ta date de rendu : le rétroplanning en part.');
    if (a.debut && a.debut >= a.rendu) return ecranAccueil('La date de début doit précéder la date de rendu.');
    if (a.soutenance && a.soutenance < a.rendu) return ecranAccueil('La soutenance a lieu après le rendu.');
    E = etatVide();
    E.projet = R.normaliserProjet({ type: a.type, titre: a.titre, debut: a.debut, rendu: a.rendu, soutenance: a.soutenance, objectifMots: Number(mots || 0) }, B);
    if (a.plan === 'type') E.sections = R.genererPlan(B, a.type, E.projet.objectifMots);
    E.jalons = R.genererJalons(B, a.type);
    E = R.noterReleve(E, auj());
    accueil = accueilVide();
    vue = 'bord';
    sauver();
    demarrer();
    toast(E.sections.length ? 'Ton planning est prêt : adapte le plan à ton sujet.' : 'Ton planning est prêt : construis ton plan.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="currentColor"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="3" rx="1.5" fill="currentColor"/><rect x="7" y="10.5" width="14" height="3" rx="1.5" fill="currentColor"/><rect x="7" y="17" width="10" height="3" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="5" rx="2" fill="currentColor"/><path d="M7 16 L17 16" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="16" r="2.2" fill="currentColor"/></svg>',
    directeur: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.5" fill="currentColor"/><path d="M2 20c0-4 3-6 6-6s6 2 6 6Z" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 20c.3-3 1.6-5 4-5s3.5 2 4 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    biblio: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="9" y="7" width="4" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 6.5 3.6-1 3.4 13.5-3.6 1Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Suivi'], ['plan', 'Plan'], ['planning', 'Planning'], ['directeur', 'Directeur'], ['biblio', 'Biblio']];
  const NOMS_VUES = { ...Object.fromEntries(ONGLETS), imprimer: 'Impression' };
  const AVERTISSEMENT = '<p class="mention avertissement">Les calculs (rétroplanning, rythme, avancement) sont faits à partir de ce que tu saisis. Les jalons types et le nombre de mots proposé sont des repères indicatifs, sans valeur officielle : les consignes de ton établissement et de ton directeur priment. Ton texte n\'est jamais lu ni importé.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="6" width="56" height="84" rx="8" fill="#F0EDE6"/><rect x="10" y="20" width="36" height="8" rx="4" fill="#1D4E89"/><rect x="10" y="38" width="28" height="6" rx="3" fill="#141414"/><rect x="16" y="52" width="26" height="6" rx="3" fill="#141414"/><circle cx="74" cy="40" r="22" fill="#D9302A"/><rect x="62" y="70" width="24" height="20" rx="4" fill="#F5B400"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${petit ? '' : FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ST_ETIQ = { aecrire: 'sable', brouillon: 'jaune', relu: 'ciel', final: 'vert' };
  const etiquetteStatut = (st) => `<span class="etiquette ${ST_ETIQ[st]}">${R.STATUTS[st]}</span>`;
  const JAL_ETIQ = { fait: ['vert', 'Fait'], retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], avenir: ['sable', 'À venir'], sansdate: ['sable', 'Sans date'] };
  const etiquetteJalon = (st) => `<span class="etiquette ${JAL_ETIQ[st][0]}">${JAL_ETIQ[st][1]}</span>`;
  const LEC_ETIQ = { alire: 'sable', encours: 'jaune', lu: 'vert' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/memoire/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Étudiante fictive, sujet et références inventés, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planning<br>de mémoire</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    if (!E.releves.length || E.releves.at(-1).mots !== R.totalMots(E)) { E = R.noterReleve(E, auj()); if (session.demo) cache(); else sauver(); }
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${NOMS_VUES[vue]} · Planning de mémoire`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, plan: vuePlan, planning: vuePlanning, directeur: vueDirecteur, biblio: vueBiblio, imprimer: vueImpression }[vue]();
    brancherVue();
  }
  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', v === 'imprimer' ? location.pathname : `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  function brancherVue() {
    $('#recherche')?.addEventListener('input', (e) => { filtre.q = e.target.value; const p = e.target.selectionStart; rendre(); const c = $('#recherche'); c.focus(); c.setSelectionRange(p, p); });
    brancherInfobulles();
    brancherCourbe();
  }

  // ---------- Graphiques ----------
  // Courbe d'avancement : mots relevés (trait plein bleu) et rythme nécessaire jusqu'à la fin de la rédaction
  // (tirets rouges), objectif en ligne de repère. Palette validée par le skill dataviz (#2E62A8 / #B84A34, fond blanc).
  const C_REEL = '#2E62A8', C_BESOIN = '#B84A34';
  function courbeAvancement() {
    const t = auj();
    const pts = R.courbe(E, t);
    const ry = R.rythme(E, t);
    const tel = estTel();
    const W = tel ? 360 : 760, H = tel ? 230 : 260, g = tel ? 40 : 54, d = tel ? 14 : 24, h = 18, b = 30;
    const debut = [E.projet.debut, pts[0].date].filter(Boolean).sort()[0];
    const finAxe = [ry.echeance?.date, t].filter(Boolean).sort().at(-1);
    const fin = finAxe > debut ? finAxe : R.ajout(debut, 30);
    const jours = Math.max(1, R.ecart(debut, fin));
    const maxY = Math.max(100, E.projet.objectifMots, ...pts.map((p) => p.mots)) * 1.08;
    const X = (dt) => g + (R.ecart(debut, dt) / jours) * (W - g - d);
    const Y = (v) => H - b - (v / maxY) * (H - b - h);
    const pas = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000].find((p) => maxY / p <= 4) || 100000;
    const grille = [];
    for (let v = 0; v <= maxY; v += pas) grille.push(`<line x1="${g}" x2="${W - d}" y1="${Y(v)}" y2="${Y(v)}" class="grille"/><text x="${g - 6}" y="${Y(v) + 4}" text-anchor="end" class="axe">${v >= 1000 ? `${N(v / 1000, 1)} k` : N(v)}</text>`);
    // Graduations : premier de chaque mois, une sur deux sur téléphone si l'axe est long.
    const mois = [];
    for (let m = R.iso(new Date(R.versDate(debut).getFullYear(), R.versDate(debut).getMonth() + 1, 1)); m <= fin; m = R.iso(new Date(R.versDate(m).getFullYear(), R.versDate(m).getMonth() + 1, 1))) mois.push(m);
    const saut = Math.ceil(mois.length / (tel ? 5 : 9));
    const ticks = mois.filter((_, i) => (mois.length - 1 - i) % saut === 0).map((m) => `<line x1="${X(m)}" x2="${X(m)}" y1="${H - b}" y2="${H - b + 4}" class="trait-axe"/><text x="${X(m)}" y="${H - b + 17}" text-anchor="middle" class="axe">${MOIS_C[R.versDate(m).getMonth()]}${m.slice(5, 7) === '01' ? ` ${m.slice(2, 4)}` : ''}</text>`);
    const ligne = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.mots).toFixed(1)}`).join(' ');
    const der = pts.at(-1);
    const besoin = ry.echeance && ry.restants && ry.echeance.date > t ? `<path d="M${X(t)},${Y(der.mots)} L${X(ry.echeance.date)},${Y(E.projet.objectifMots)}" class="besoin" stroke="${C_BESOIN}"/><circle cx="${X(ry.echeance.date)}" cy="${Y(E.projet.objectifMots)}" r="4.5" fill="${C_BESOIN}" stroke="#fff" stroke-width="2"/>` : '';
    const objectif = E.projet.objectifMots ? `<line x1="${g}" x2="${W - d}" y1="${Y(E.projet.objectifMots)}" y2="${Y(E.projet.objectifMots)}" class="repere-obj"/><text x="${g + 4}" y="${Y(E.projet.objectifMots) - 6}" class="axe fort">Objectif ${N(E.projet.objectifMots)} mots</text>` : '';
    // Valeur du jour écrite au-dessus du dernier point, du côté où il reste de la place.
    const aDroite = X(der.date) < W * 0.35;
    const valeur = `<text x="${X(der.date) + (aDroite ? 8 : -8)}" y="${Math.max(h + 12, Y(der.mots) - 12)}" text-anchor="${aDroite ? 'start' : 'end'}" class="axe fort valeur">${N(der.mots)}</text>`;
    const donnees = JSON.stringify(pts.map((p) => [p.date, p.mots]));
    return `<figure class="graphique courbe" data-courbe='${esc(donnees)}' data-debut="${debut}" data-jours="${jours}" data-g="${g}" data-d="${d}" data-w="${W}">
      <div class="legende-courbe"><span><i class="lg-ligne" style="--c:${C_REEL}"></i>Mots écrits</span>${besoin ? `<span><i class="lg-tirets" style="--c:${C_BESOIN}"></i>Rythme nécessaire jusqu'au ${esc(dateMoy(ry.echeance.date))}</span>` : ''}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mots écrits en cumul : ${N(der.mots)} aujourd'hui${E.projet.objectifMots ? ` sur ${N(E.projet.objectifMots)}` : ''}">
        ${grille.join('')}${objectif}
        <line x1="${g}" x2="${W - d}" y1="${H - b}" y2="${H - b}" class="trait-axe"/>${ticks.join('')}
        <line x1="${X(t)}" x2="${X(t)}" y1="${h}" y2="${H - b}" class="auj"/>
        ${besoin}
        <path d="${ligne}" class="reel" stroke="${C_REEL}"/>
        <circle cx="${X(der.date)}" cy="${Y(der.mots)}" r="5" fill="${C_REEL}" stroke="#fff" stroke-width="2"/>${valeur}
        <line class="viseur" x1="0" x2="0" y1="${h}" y2="${H - b}" hidden/><circle class="point-viseur" r="5" fill="${C_REEL}" stroke="#fff" stroke-width="2" hidden/>
        <rect class="zone-survol" x="${g}" y="${h}" width="${W - g - d}" height="${H - b - h}" fill="transparent"/>
      </svg>
      <div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir les relevés en tableau</summary><div class="defile"><table class="tableau petit"><caption class="sr-only">Mots écrits en cumul par date de relevé</caption><thead><tr><th>Date</th><th class="nb">Mots</th></tr></thead><tbody>${pts.slice(-30).reverse().map((p) => `<tr><td>${esc(R.dateFr(p.date))}</td><td class="nb">${N(p.mots)}</td></tr>`).join('')}</tbody></table></div>${pts.length > 30 ? '<p class="mention">Les 30 derniers relevés ; tous sont dans la copie exportée.</p>' : ''}</details>
    </figure>`;
  }
  function brancherCourbe() {
    document.querySelectorAll('.graphique.courbe').forEach((fig) => {
      const svg = fig.querySelector('svg'), bulle = fig.querySelector('.infobulle'), zone = fig.querySelector('.zone-survol');
      const pts = JSON.parse(fig.dataset.courbe), debut = fig.dataset.debut, jours = Number(fig.dataset.jours);
      const g = Number(fig.dataset.g), d = Number(fig.dataset.d), W = Number(fig.dataset.w);
      const viseur = fig.querySelector('.viseur'), point = fig.querySelector('.point-viseur');
      const montrer = (ev) => {
        const r = svg.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width) * W;
        const dt = R.ajout(debut, Math.round(((x - g) / (W - g - d)) * jours));
        let p = pts[0];
        for (const q of pts) if (Math.abs(R.ecart(q[0], dt)) < Math.abs(R.ecart(p[0], dt))) p = q;
        const px = g + (R.ecart(debut, p[0]) / jours) * (W - g - d);
        const circ = svg.querySelector('path.reel');
        if (!circ) return;
        viseur.setAttribute('x1', px); viseur.setAttribute('x2', px); viseur.hidden = false;
        const H = svg.viewBox.baseVal.height;
        const yMax = Number(svg.querySelector('.zone-survol').getAttribute('y'));
        const maxY = Math.max(100, E.projet.objectifMots, ...pts.map((q) => q[1])) * 1.08;
        point.setAttribute('cx', px); point.setAttribute('cy', H - 30 - (p[1] / maxY) * (H - 30 - yMax)); point.hidden = false;
        bulle.innerHTML = `<b>${esc(majuscule(dateCourte(p[0])))}</b>${pluriel(p[1], 'mot')}${E.projet.objectifMots ? ` · ${Math.floor((p[1] / E.projet.objectifMots) * 100)} %` : ''}`;
        bulle.hidden = false;
        const rf = fig.getBoundingClientRect();
        let bx = r.left - rf.left + (px / W) * r.width + 12;
        if (bx + bulle.offsetWidth > rf.width - 8) bx = Math.max(8, bx - bulle.offsetWidth - 24);
        bulle.style.left = `${bx}px`;
        bulle.style.top = `${Math.max(8, r.top - rf.top + 20)}px`;
      };
      const cacher = () => { bulle.hidden = true; viseur.hidden = true; point.hidden = true; };
      zone.addEventListener('pointermove', montrer);
      zone.addEventListener('pointerdown', montrer);
      zone.addEventListener('pointerleave', cacher);
    });
  }
  // Barres empilées horizontales : mots de chaque élément de premier niveau, par statut, sur la piste des mots visés.
  function barresPlan() {
    const racine = R.enfants(E, '');
    if (!racine.length) return '';
    const lignes = racine.map((s) => ({ s, parts: R.motsParStatut(E, s.id), mots: R.motsSection(E, s.id), obj: R.objectifSection(E, s.id) }));
    const max = Math.max(1, ...lignes.map((x) => Math.max(x.mots, x.obj)));
    const legende = `<p class="legende-statuts">${R.ORDRE_STATUTS.slice().reverse().map((st) => `<span><i style="background:${B.couleursStatut[st]}"></i>${R.STATUTS[st]}</span>`).join('')}<span><i class="piste-leg"></i>Mots visés</span></p>`;
    return `<figure class="graphique">${legende}<div class="barres-cats">${lignes.map((x) => {
      const info = `<b>${esc(x.s.titre)}</b>${pluriel(x.mots, 'mot')}${x.obj ? ` sur ${N(x.obj)} visés` : ''}${R.ORDRE_STATUTS.filter((st) => x.parts[st]).map((st) => `<br>${R.STATUTS[st]} : ${N(x.parts[st])}`).join('')}`;
      return `<div class="barre-cat" tabindex="0" data-info="${esc(info)}">
        <span class="bc-nom">${esc(x.s.titre)}</span>
        <span class="bc-piste empile">${x.obj ? `<span class="bc-visee" style="width:${(x.obj / max) * 100}%"></span>` : ''}${R.ORDRE_STATUTS.slice().reverse().filter((st) => x.parts[st]).map((st) => `<span class="seg" style="width:${(x.parts[st] / max) * 100}%;background:${B.couleursStatut[st]}"></span>`).join('')}</span>
        <span class="bc-val"><b>${N(x.mots)}</b>${x.obj ? ` <small>/ ${N(x.obj)}</small>` : ''}</span></div>`;
    }).join('')}</div>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>Mots par élément du plan et par statut</caption><thead><tr><th>Élément</th>${R.ORDRE_STATUTS.map((st) => `<th>${R.STATUTS[st]}</th>`).join('')}<th>Visés</th></tr></thead><tbody>${lignes.map((x) => `<tr><th>${esc(x.s.titre)}</th>${R.ORDRE_STATUTS.map((st) => `<td>${N(x.parts[st])}</td>`).join('')}<td>${N(x.obj)}</td></tr>`).join('')}</tbody></table></div></figure>`;
  }
  function brancherInfobulles() {
    document.querySelectorAll('.graphique:not(.courbe)').forEach((fig) => {
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
  const barreProgres = (part, label) => `<div class="progres" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(1, part) * 100)}" aria-label="${esc(label)}"><span style="width:${Math.min(100, part * 100)}%"></span></div>`;

  // ---------- Tableau de bord ----------
  function texteRythme(ry) {
    if (!E.projet.objectifMots) return 'Fixe un nombre de mots visé (Projet) pour calculer ton rythme.';
    if (ry.atteint) return `Objectif de mots atteint${ry.total > ry.objectif ? `, dépassé de ${N(ry.total - ry.objectif)}` : ''}. Place aux relectures.`;
    if (!ry.echeance) return 'Indique ta date de rendu (Projet) pour calculer ton rythme.';
    if (ry.depasse) return `Échéance de rédaction dépassée (${esc(ry.echeance.nom)}, ${esc(dateMoy(ry.echeance.date))}) : il reste ${pluriel(ry.restants, 'mot')}. Recale le jalon ou la date dans le Planning.`;
    return `<b>${N(ry.parJour)} mots par jour de travail</b> pour finir d'ici le ${esc(R.dateFr(ry.echeance.date))} (${esc(ry.echeance.nom.toLowerCase())}), sur ${pluriel(ry.jours, 'jour')} de travail.`;
  }
  function texteReel(ry) {
    if (ry.reel === null) return 'Pas encore assez de relevés pour mesurer ton rythme réel : il apparaît après quelques jours.';
    if (!ry.reel) return 'Aucun mot ajouté ces 14 derniers jours.';
    const r = `Ton rythme sur 14 jours : <b>${N(ry.reel, ry.reel < 10 ? 1 : 0)} mots par jour de travail</b>`;
    if (!ry.projection || ry.atteint) return `${r}.`;
    return `${r} : à ce rythme, objectif atteint le <b>${esc(R.dateFr(ry.projection))}</b>${ry.echeance ? (ry.enRetard ? `, soit ${pluriel(R.ecart(ry.echeance.date, ry.projection), 'jour')} après l'échéance.` : ', avant l\'échéance.') : '.'}`;
  }
  function vueBord() {
    const t = auj(), p = E.projet;
    const ry = R.rythme(E, t);
    const av = R.avancement(E);
    const { jalons } = R.retroplanning(E);
    const suivant = jalons.find((j) => !j.fait && j.quand && j.quand >= t);
    const retards = jalons.filter((j) => R.statutJalon(j, t) === 'retard');
    const actions = R.actionsOuvertes(E, t);
    const prochain = R.prochainRdv(E, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(majuscule(R.dateFrLongue(t)))}</p><h1>${esc(p.titre || typeNom())}</h1>${p.titre ? `<p class="sous-titre">${esc([typeNom(), p.discipline].filter(Boolean).join(' · '))}</p>` : ''}</div>
      <div class="actions"><button class="btn" data-action="projet">Projet</button><button class="btn" data-action="mots">Mots écrits</button><button class="btn primaire" data-action="seance">${ICONES.plus}Séance</button></div></div>`;
    const reste = (d) => (d ? (d >= t ? `J−${N(R.ecart(t, d))}` : 'passé') : '–');
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Mots écrits</p><b>${N(ry.total)}</b><span>${p.objectifMots ? `sur ${N(p.objectifMots)} · ${N(Math.floor((ry.part || 0) * 100))} % · ${N(ry.pages, 0)} p.` : `${N(ry.pages, 0)} pages environ`}</span></div>
      <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Rythme nécessaire</p><b>${ry.parJour ? `${N(ry.parJour)}/j` : ry.atteint ? 'Atteint' : '–'}</b><span>${ry.parJour ? `mots par jour de travail · ${pluriel(ry.jours, 'jour')}` : ry.echeance ? (ry.depasse ? 'échéance dépassée' : 'rien à rattraper') : 'date de rendu à saisir'}</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Plan</p><b>${N(Math.round(av.part * 100))} %</b><span>${av.nb ? `${pluriel(av.parStatut.final, 'final', 'finals')} · ${N(av.parStatut.relu)} relu${av.parStatut.relu > 1 ? 's' : ''} · ${N(av.parStatut.brouillon)} brouillon${av.parStatut.brouillon > 1 ? 's' : ''}` : 'plan vide'}</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Rendu</p><b>${reste(p.rendu)}</b><span>${p.rendu ? `le ${esc(dateMoy(p.rendu))}` : 'date à saisir'}${p.soutenance ? ` · soutenance ${esc(dateMoy(p.soutenance))}` : ''}</span></div>
    </div>`;
    const alertes = [
      ...retards.map((j) => `<li class="al-retard"><span class="etiquette rouge">Jalon en retard</span><button class="lien-ligne" data-action="jalon" data-id="${j.id}"><b>${esc(j.nom)}</b><span>prévu le ${esc(dateMoy(j.quand))}, ${esc(dans(j.quand))}</span></button><button class="btn petit" data-action="jalon-fait" data-id="${j.id}">Fait</button></li>`),
      ...actions.filter((a) => a.retard).map((a) => `<li class="al-retard"><span class="etiquette rose">Action en retard</span><button class="lien-ligne" data-action="vue" data-vue="directeur"><b>${esc(a.texte)}</b><span>pour le ${esc(dateMoy(a.echeance))} · rendez-vous du ${esc(dateMoy(a.dateRdv))}</span></button><button class="btn petit" data-action="action-faite" data-rdv="${a.rdv}" data-id="${a.id}">Faite</button></li>`),
      suivant ? `<li><span class="etiquette ${R.statutJalon(suivant, t) === 'proche' ? 'jaune' : 'sable'}">Prochain jalon</span><button class="lien-ligne" data-action="jalon" data-id="${suivant.id}"><b>${esc(suivant.nom)}</b><span>le ${esc(dateMoy(suivant.quand))}, ${esc(dans(suivant.quand))}</span></button><button class="btn petit" data-action="jalon-fait" data-id="${suivant.id}">Fait</button></li>` : '',
      prochain ? `<li><span class="etiquette ciel">Rendez-vous</span><button class="lien-ligne" data-action="rdv" data-id="${prochain.id}"><b>Avec ${esc(p.directeur || 'ton directeur')}</b><span>le ${esc(dateMoy(prochain.date))}, ${esc(dans(prochain.date))} · ${esc(R.MODES[prochain.mode].toLowerCase())}</span></button><button class="btn petit" data-action="ordre-du-jour">Préparer</button></li>` : '',
    ].filter(Boolean);
    const blocAlertes = `<h2 class="titre-section">À suivre <span>${retards.length + actions.filter((a) => a.retard).length ? 'des retards à rattraper' : 'rien en retard'}</span></h2>${alertes.length ? `<ul class="alertes-liste">${alertes.join('')}</ul>` : videEtat('Rien à signaler', 'Aucun jalon ni rendez-vous à venir. Ajoute-les dans le Planning et l\'onglet Directeur.', '', true)}`;
    const seances = E.seances.slice(-4).reverse();
    const b = R.bilanSeances(E, t);
    const blocJournal = `<h2 class="titre-section">Dernières séances <span>${R.dureeTexte(b.semaine)} sur 7 jours</span></h2>${seances.length ? `<ul class="mini-liste">${seances.map(ligneSeance).join('')}</ul><p style="margin-top:10px"><button class="btn lien" data-action="vue" data-vue="planning">Tout le journal</button></p>` : videEtat('Journal vide', 'Note chaque séance de travail : durée, section travaillée, mots écrits. Tu verras où passe ton temps.', '<button class="btn" data-action="seance">Noter une séance</button>', true)}`;
    return `${tete}${tuiles}
      <section class="bloc-rythme"><h2 class="titre-section">Avancement <span>mots écrits en cumul</span></h2>
        <div class="rythme-textes"><p>${texteRythme(ry)}</p><p class="mention">${texteReel(ry)}</p></div>
        ${courbeAvancement()}</section>
      <div class="colonnes-apercu"><section>${blocAlertes}</section><section>${blocJournal}</section></div>
      <h2 class="titre-section">Plan <span>mots par élément et par statut</span></h2>${barresPlan() || videEtat('Plan vide', 'Ajoute tes parties et chapitres dans l\'onglet Plan.', '<button class="btn" data-action="vue" data-vue="plan">Construire le plan</button>', true)}
      <p class="rang" style="margin-top:20px"><button class="btn" data-action="imprimer">Imprimer la synthèse</button><button class="btn" data-action="ordre-du-jour">Préparer le prochain rendez-vous</button></p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Plan ----------
  // Élément qui en contient d'autres : « Relu au moins » quand tous ses éléments ont atteint ce statut, « En cours »
  // quand certains sont encore à écrire et d'autres commencés.
  function etiquetteParent(id, st) {
    if (st !== 'aecrire') return `<span class="etiquette ${ST_ETIQ[st]}" title="Tous ses éléments ont au moins ce statut">${R.STATUTS[st]} au moins</span>`;
    const commence = R.descendants(E, id).some((x) => x.statut !== 'aecrire' && !E.sections.some((y) => y.parent === x.id));
    return commence ? '<span class="etiquette jaune" title="Certains éléments sont commencés, d\'autres encore à écrire">En cours</span>' : etiquetteStatut('aecrire');
  }
  function lignePlan({ s, prof, nbEnfants }, freres, i) {
    const st = nbEnfants ? R.statutAgrege(E, s.id) : s.statut;
    const mots = R.motsSection(E, s.id), obj = R.objectifSection(E, s.id);
    const part = obj ? mots / obj : null;
    return `<li class="ligne-plan niv-${s.niveau}" style="--prof:${prof}">
      <button type="button" class="ligne-info" data-action="section" data-id="${s.id}"><span class="niv">${R.NIVEAUX[s.niveau]}</span><b>${esc(s.titre)}</b>
        <span class="ligne-etiquettes">${nbEnfants ? etiquetteParent(s.id, st) : etiquetteStatut(st)}${s.note ? '<span class="etiquette sable">Note</span>' : ''}</span></button>
      <div class="ligne-mots">${part !== null ? barreProgres(part, `Mots de ${s.titre}`) : ''}<span class="nb"><b>${N(mots)}</b>${obj ? ` / ${N(obj)}` : ''} mots</span></div>
      <div class="ligne-droite"><span class="rang deplacer"><button class="btn-suppr" data-action="monter" data-id="${s.id}" aria-label="Monter ${esc(s.titre)}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn-suppr" data-action="descendre" data-id="${s.id}" aria-label="Descendre ${esc(s.titre)}" ${i === freres - 1 ? 'disabled' : ''}>↓</button></span>${s.niveau < 3 ? `<button class="btn petit" data-action="section-nouvelle" data-parent="${s.id}" aria-label="Ajouter dans ${esc(s.titre)}">${ICONES.plus}${s.niveau === 1 ? 'Chapitre' : 'Section'}</button>` : ''}</div></li>`;
  }
  function vuePlan() {
    const t = auj();
    const ry = R.rythme(E, t);
    const av = R.avancement(E);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.sections.length, 'élément')} · ${N(ry.total)} mots · ${N(ry.pages, 0)} pages environ</p><h1>Plan</h1></div><div class="actions"><button class="btn" data-action="csv-plan">CSV</button><button class="btn" data-action="mots">Mots écrits</button><button class="btn primaire" data-action="section-nouvelle">${ICONES.plus}Élément</button></div></div>`;
    if (!E.sections.length) return `${tete}${videEtat('Ton plan est vide', 'Ajoute tes parties, chapitres et sections, ou pars du plan type de ton travail et adapte-le à ton sujet.', `<button class="btn primaire" data-action="plan-type">Partir du plan type</button><button class="btn" data-action="section-nouvelle">Ajouter un chapitre</button>`)}${AVERTISSEMENT}`;
    const a = R.arbre(E);
    const lignes = a.map((x) => { const freres = R.enfants(E, x.s.parent); return lignePlan(x, freres.length, freres.findIndex((f) => f.id === x.s.id)); });
    const resume = `<div class="resume-plan">
      <div><p class="surtitre">Avancement par statut</p><p><b>${N(Math.round(av.part * 100))} %</b> ${av.pondere ? 'pondéré par les mots visés' : 'à parts égales (indique des mots visés pour pondérer)'}</p>
      <div class="barre-statuts" role="img" aria-label="${esc(R.ORDRE_STATUTS.map((st) => `${R.STATUTS[st]} : ${av.parStatut[st]}`).join(', '))}">${R.ORDRE_STATUTS.slice().reverse().filter((st) => av.parStatut[st]).map((st) => `<span style="flex:${av.parStatut[st]};background:${B.couleursStatut[st]}" title="${R.STATUTS[st]} : ${av.parStatut[st]}"></span>`).join('')}</div>
      <p class="legende-statuts">${R.ORDRE_STATUTS.slice().reverse().map((st) => `<span><i style="background:${B.couleursStatut[st]}"></i>${R.STATUTS[st]} ${N(av.parStatut[st])}</span>`).join('')}</p></div>
      <p class="mention">Poids : à écrire 0, brouillon 50 %, relu 80 %, final 100 %. Les mots se recopient depuis ton traitement de texte (compteur de mots), élément par élément.</p></div>`;
    return `${tete}${resume}<ul class="lignes-plan">${lignes.join('')}</ul>${AVERTISSEMENT}`;
  }

  // ---------- Planning : rétroplanning, rythme, journal ----------
  function ligneSeance(s) {
    const sec = section(s.section);
    return `<li><span><b>${esc(majuscule(dateCourte(s.date)))}</b><span class="mention">${esc([sec?.titre, s.note].filter(Boolean).join(' · ') || 'Séance')}</span></span><span class="nb">${s.minutes ? R.dureeTexte(s.minutes) : ''}${s.mots ? ` · ${s.mots > 0 ? '+' : ''}${N(s.mots)} mots` : ''}</span><button class="btn petit" data-action="seance-modif" data-id="${s.id}" aria-label="Modifier la séance">Modifier</button></li>`;
  }
  function vuePlanning() {
    const t = auj(), p = E.projet;
    const rp = R.retroplanning(E);
    const ry = R.rythme(E, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${p.rendu ? `Rendu le ${esc(R.dateFr(p.rendu))}${p.soutenance ? ` · soutenance le ${esc(R.dateFr(p.soutenance))}` : ''}` : 'Date de rendu à saisir'}</p><h1>Planning</h1></div><div class="actions"><button class="btn" data-action="projet">Dates du projet</button><button class="btn primaire" data-action="jalon">${ICONES.plus}Jalon</button></div></div>`;
    const resserre = rp.facteur < 1 ? `<p class="alerte-note">Le modèle de jalons couvre ${pluriel(rp.span, 'jour')}, mais il n'en reste que ${N(rp.dispo)} entre ta date de début et le rendu : les jalons ancrés au rendu sont resserrés à ${N(Math.round(rp.facteur * 100))} %. Ajuste-les si besoin.</p>` : '';
    const jalons = rp.jalons.length ? `<ol class="frise">${rp.jalons.map((j) => {
      const st = R.statutJalon(j, t);
      const origine = j.ancre === 'date' ? 'date fixée' : `${j.decalage === 0 ? 'jour' : `${j.decalage < 0 ? 'J−' : 'J+'}${N(Math.abs(Math.round(j.decalage * (j.ancre === 'rendu' && j.decalage < 0 ? rp.facteur : 1))))}`} ${j.ancre === 'rendu' ? 'du rendu' : 'de la soutenance'}`;
      return `<li class="jalon st-${st} ${j.quand === p.rendu && j.ancre === 'rendu' && j.decalage === 0 ? 'cle' : ''}">
        <span class="frise-date">${j.quand ? `<b>${R.versDate(j.quand).getDate()}</b>${MOIS_C[R.versDate(j.quand).getMonth()]}${j.quand.slice(0, 4) !== t.slice(0, 4) ? ` ${j.quand.slice(0, 4)}` : ''}` : '<b>?</b>'}</span>
        <button type="button" class="lien-ligne" data-action="jalon" data-id="${j.id}"><b>${esc(j.nom)}</b><span>${esc(origine)}${j.quand && !j.fait ? ` · ${esc(dans(j.quand))}` : ''}${j.fait ? ` · fait le ${esc(dateMoy(j.fait))}` : ''}${j.fin ? ' · fin de la rédaction' : ''}${!j.quand && j.ancre === 'soutenance' ? ' · date de soutenance à saisir' : ''}</span></button>
        <span class="jalon-droite">${etiquetteJalon(st)}<button class="btn petit" data-action="${j.fait ? 'jalon-refaire' : 'jalon-fait'}" data-id="${j.id}">${j.fait ? 'Rouvrir' : 'Fait'}</button></span></li>`;
    }).join('')}</ol>` : videEtat('Aucun jalon', 'Reprends les jalons types de ton travail, ou ajoute les tiens.', '<button class="btn primaire" data-action="jalons-type">Jalons types</button>', true);
    const jt = p.joursTravail.map((d) => R.JOURS[d].slice(0, 3)).join(', ');
    const rythme = `<div class="bloc-detail rythme-detail">
      <div class="chiffres-rythme">
        <div><span>Mots restants</span><b>${N(ry.restants)}</b></div>
        <div><span>Jours de travail</span><b>${N(ry.jours)}</b></div>
        <div><span>Par jour</span><b>${ry.parJour ? N(ry.parJour) : '–'}</b></div>
        <div><span>Rythme réel</span><b>${ry.reel === null ? '–' : N(ry.reel, ry.reel < 10 ? 1 : 0)}</b></div>
      </div>
      <p>${texteRythme(ry)}</p><p class="mention">${texteReel(ry)} Jours de travail : ${esc(jt)} (modifiable dans Projet).</p></div>`;
    const b = R.bilanSeances(E, t);
    const tri = E.seances.slice().reverse();
    const visibles = tri.slice(0, filtre.journal);
    const journal = `<div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">7 derniers jours</p><b>${R.dureeTexte(b.semaine)}</b><span>${pluriel(b.seancesSemaine, 'séance')}${b.motsSemaine ? ` · ${b.motsSemaine > 0 ? '+' : ''}${N(b.motsSemaine)} mots` : ''}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Depuis le début</p><b>${R.dureeTexte(b.minutes)}</b><span>${pluriel(b.nb, 'séance')}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Section la plus travaillée</p><b class="petit-texte">${esc(section(b.parSection[0]?.id)?.titre || '–')}</b><span>${b.parSection[0] ? R.dureeTexte(b.parSection[0].minutes) : 'aucune section notée'}</span></div></div>
      ${tri.length ? `<ul class="mini-liste journal-liste">${visibles.map(ligneSeance).join('')}</ul>${tri.length > visibles.length ? `<p style="margin-top:12px"><button class="btn" data-action="journal-plus">Séances plus anciennes (${N(tri.length - visibles.length)})</button></p>` : ''}` : videEtat('Aucune séance notée', 'Après chaque séance de travail, note sa durée, la section travaillée et, si tu veux, les mots écrits (ils peuvent s\'ajouter à la section).', '<button class="btn primaire" data-action="seance">Noter une séance</button>', true)}`;
    return `${tete}${resserre}
      <div class="colonnes-planning"><section><h2 class="titre-section">Rétroplanning <span>depuis la date de rendu · repères indicatifs</span></h2>${jalons}
      <p class="rang" style="margin-top:12px"><button class="btn petit" data-action="jalons-type">Rétablir les jalons types</button></p></section>
      <section><h2 class="titre-section">Rythme <span>jusqu'à la fin de la rédaction</span></h2>${rythme}</section></div>
      <h2 class="titre-section">Journal de travail <span><button class="btn petit primaire" data-action="seance">${ICONES.plus}Séance</button> <button class="btn petit" data-action="csv-seances">CSV</button></span></h2>${journal}
      ${AVERTISSEMENT}`;
  }

  // ---------- Directeur ----------
  function ligneAction(a, r) {
    const retard = !a.faite && a.echeance && a.echeance < auj();
    return `<li class="action ${a.faite ? 'faite' : ''} ${retard ? 'retard' : ''}"><label class="case"><input type="checkbox" data-action="action-cocher" data-rdv="${r.id}" data-id="${a.id}" ${a.faite ? 'checked' : ''}><span>${esc(a.texte)}</span></label><span class="mention">${a.faite ? `faite le ${esc(dateMoy(a.faite))}` : a.echeance ? `${retard ? 'en retard · ' : ''}pour le ${esc(dateMoy(a.echeance))}` : 'sans échéance'}</span></li>`;
  }
  function carteRdv(r, avenir) {
    return `<article class="carte-rdv ${avenir ? 'avenir' : ''}">
      <div class="cr-tete"><div><p class="surtitre">${avenir ? 'Prévu' : 'Rendez-vous'} · ${esc(R.MODES[r.mode])}</p><h3>${esc(majuscule(R.dateFrLongue(r.date)))}</h3></div><button class="btn petit" data-action="rdv" data-id="${r.id}">Modifier</button></div>
      ${r.points ? `<div class="cr-bloc"><h4>${avenir ? 'Points à aborder' : 'Points abordés'}</h4><ul class="puces-texte">${r.points.split('\n').filter((x) => x.trim()).map((x) => `<li>${esc(x.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul></div>` : ''}
      ${r.notes ? `<div class="cr-bloc"><h4>Ce qui a été dit</h4><p>${esc(r.notes).replace(/\n/g, '<br>')}</p></div>` : ''}
      ${r.actions.length ? `<div class="cr-bloc"><h4>Actions à faire <span>${r.actions.filter((a) => a.faite).length} / ${r.actions.length} faites</span></h4><ul class="liste-actions">${r.actions.map((a) => ligneAction(a, r)).join('')}</ul></div>` : avenir ? '' : '<p class="mention">Aucune action notée.</p>'}
    </article>`;
  }
  function vueDirecteur() {
    const t = auj(), p = E.projet;
    const passes = R.rdvPasses(E, t).slice().reverse();
    const avenir = E.rdv.filter((r) => r.date > t);
    const ouvertes = R.actionsOuvertes(E, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(p.directeur || 'Ton directeur ou ta directrice')} · ${pluriel(passes.length, 'rendez-vous', 'rendez-vous')}</p><h1>Directeur</h1></div><div class="actions"><button class="btn" data-action="csv-actions">Actions (CSV)</button><button class="btn" data-action="ordre-du-jour">Préparer le prochain</button><button class="btn primaire" data-action="rdv">${ICONES.plus}Rendez-vous</button></div></div>`;
    if (!E.rdv.length) return `${tete}${videEtat('Aucun rendez-vous', 'Note chaque rendez-vous avec ton directeur : les points abordés, ce qui a été dit et les actions à faire. Avant le suivant, le template prépare l\'ordre du jour avec ton avancement.', '<button class="btn primaire" data-action="rdv">Noter un rendez-vous</button>')}${AVERTISSEMENT}`;
    const blocOuvertes = `<h2 class="titre-section">Actions ouvertes <span>${pluriel(ouvertes.length, 'action')}${ouvertes.filter((a) => a.retard).length ? ` dont ${N(ouvertes.filter((a) => a.retard).length)} en retard` : ''}</span></h2>${ouvertes.length ? `<ul class="liste-actions encadre">${ouvertes.map((a) => ligneAction(a, { id: a.rdv })).join('')}</ul>` : videEtat('Tout est fait', 'Aucune action en attente.', '', true)}`;
    return `${tete}${blocOuvertes}
      ${avenir.length ? `<h2 class="titre-section">À venir</h2><div class="cartes-rdv">${avenir.map((r) => carteRdv(r, true)).join('')}</div>` : ''}
      <h2 class="titre-section">Historique <span>du plus récent au plus ancien</span></h2><div class="cartes-rdv">${passes.map((r) => carteRdv(r, false)).join('') || '<p class="mention">Aucun rendez-vous passé.</p>'}</div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Bibliographie ----------
  function vueBiblio() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.refs.length, 'référence')} · ${N(E.refs.filter((r) => r.statut === 'lu').length)} lue${E.refs.filter((r) => r.statut === 'lu').length > 1 ? 's' : ''}</p><h1>Bibliographie</h1></div><div class="actions"><button class="btn" data-action="biblio-texte">Exporter en texte</button><button class="btn" data-action="csv-biblio">CSV</button><button class="btn primaire" data-action="ref">${ICONES.plus}Référence</button></div></div>`;
    if (!E.refs.length) return `${tete}${videEtat('Aucune référence', 'Note les articles, ouvrages et rapports que tu lis ou veux lire, avec tes notes et les sections où tu les cites. L\'export texte donne une liste auteur-date simple, à adapter à la norme demandée.', '<button class="btn primaire" data-action="ref">Ajouter une référence</button>')}${AVERTISSEMENT}`;
    const nb = (s) => E.refs.filter((r) => s === 'tous' || r.statut === s).length;
    const outils = `<div class="outils-liste">
      <div class="filtres" role="group" aria-label="Lecture">${[['tous', 'Toutes'], ['alire', 'À lire'], ['encours', 'En cours'], ['lu', 'Lues']].map(([f, nom]) => `<button type="button" class="filtre" data-action="filtre-biblio" data-f="${f}" aria-pressed="${filtre.biblio === f}">${nom} <small>${nb(f)}</small></button>`).join('')}</div>
      <label class="champ recherche"><span class="sr-only">Chercher un auteur, un titre, une note</span><input id="recherche" type="search" placeholder="Auteur, titre, note" value="${esc(filtre.q)}"></label></div>`;
    const q = R.plat(filtre.q.trim());
    const nomSection = new Map(E.sections.map((s) => [s.id, s.titre]));
    const liste = R.bibliographie(E.refs).filter(({ ref: r }) => (filtre.biblio === 'tous' || r.statut === filtre.biblio) && (!q || R.plat(`${r.auteurs} ${r.titre} ${r.source} ${r.notes} ${r.annee}`).includes(q)));
    const corps = liste.length ? `<ul class="lignes-abs refs">${liste.map(({ ref: r, texte, citation }) => `<li class="ligne-abs ligne-ref">
        <button type="button" class="ligne-info" data-action="ref" data-id="${r.id}"><b>${esc(texte)}</b>
          <span class="ligne-etiquettes"><span class="etiquette ${LEC_ETIQ[r.statut]}">${R.LECTURE[r.statut]}</span><span class="etiquette sable">${esc(r.type)}</span><span class="citation-ex">${esc(citation)}</span></span>
          ${r.notes ? `<span class="ligne-detail">${esc(r.notes.length > 160 ? `${r.notes.slice(0, 158)}…` : r.notes)}</span>` : ''}
          ${r.sections.length ? `<span class="ligne-detail">Cité dans : ${esc(r.sections.map((x) => nomSection.get(x)).filter(Boolean).join(', '))}</span>` : ''}</button>
        <div class="ligne-droite">${r.statut !== 'lu' ? `<button class="btn petit" data-action="ref-lu" data-id="${r.id}">${r.statut === 'alire' ? 'Commencer' : 'Marquer lue'}</button>` : ''}</div></li>`).join('')}</ul>` : videEtat('Aucune référence ici', 'Aucune référence ne correspond à ce filtre.', '', true);
    return `${tete}${outils}<p class="resume-liste">Classées par auteur puis par année. Format auteur-date simple, sans prétention à respecter une norme précise : vérifie les consignes de ton établissement.</p>${corps}${AVERTISSEMENT}`;
  }

  // ---------- Impression ----------
  function vueImpression() {
    const t = auj(), p = E.projet;
    const ry = R.rythme(E, t);
    const rp = R.retroplanning(E);
    const ouvertes = R.actionsOuvertes(E, t);
    return `<div class="vue-tete pas-impression"><div><p class="surtitre">Aperçu avant impression</p><h1>Synthèse</h1></div><div class="actions"><button class="btn" data-action="vue" data-vue="bord">Retour</button><button class="btn primaire" data-action="lancer-impression">Imprimer</button></div></div>
      <article class="feuille">
        <header><p class="surtitre">${esc(typeNom())}${p.discipline ? ` · ${esc(p.discipline)}` : ''}</p><h1>${esc(p.titre || 'Mon mémoire')}</h1>
        <p>${[p.etablissement, p.directeur ? `Direction : ${p.directeur}` : '', p.rendu ? `Rendu le ${R.dateFr(p.rendu)}` : '', p.soutenance ? `soutenance le ${R.dateFr(p.soutenance)}` : ''].filter(Boolean).map(esc).join(' · ')}</p>
        <p>Au ${esc(R.dateFr(t))} : <b>${N(ry.total)} mots</b>${p.objectifMots ? ` sur ${N(p.objectifMots)} (${N(Math.floor((ry.part || 0) * 100))} %)` : ''}, environ ${N(ry.pages, 0)} pages. ${ry.parJour ? `Rythme nécessaire : ${N(ry.parJour)} mots par jour de travail jusqu'au ${esc(R.dateFr(ry.echeance.date))}.` : ''}</p></header>
        <h2>Plan</h2><table class="tableau petit"><thead><tr><th>Élément</th><th>Statut</th><th class="nb">Mots</th><th class="nb">Visés</th></tr></thead><tbody>${R.arbre(E).map(({ s, prof, nbEnfants }) => `<tr><td style="padding-left:${14 + prof * 18}px">${prof ? '' : '<b>'}${esc(s.titre)}${prof ? '' : '</b>'}</td><td>${R.STATUTS[nbEnfants ? R.statutAgrege(E, s.id) : s.statut]}</td><td class="nb">${N(R.motsSection(E, s.id))}</td><td class="nb">${R.objectifSection(E, s.id) ? N(R.objectifSection(E, s.id)) : ''}</td></tr>`).join('')}</tbody></table>
        <h2>Rétroplanning</h2><table class="tableau petit"><thead><tr><th>Date</th><th>Jalon</th><th>État</th></tr></thead><tbody>${rp.jalons.map((j) => `<tr><td>${j.quand ? esc(R.dateNum(j.quand)) : '–'}</td><td>${esc(j.nom)}</td><td>${JAL_ETIQ[R.statutJalon(j, t)][1]}</td></tr>`).join('')}</tbody></table>
        ${ouvertes.length ? `<h2>Actions ouvertes</h2><ul class="puces-texte">${ouvertes.map((a) => `<li>${esc(a.texte)}${a.echeance ? ` (pour le ${esc(R.dateNum(a.echeance))})` : ''}</li>`).join('')}</ul>` : ''}
        ${E.refs.length ? `<h2>Bibliographie</h2><ol class="biblio-imprimee">${R.bibliographie(E.refs).map((x) => `<li>${esc(x.texte)}</li>`).join('')}</ol>` : ''}
        <p class="mention">Planning de mémoire QME · imprimé le ${esc(R.dateNum(t))} · repères indicatifs, sans valeur officielle.</p>
      </article>`;
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
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const entier = (v) => { const s = String(v ?? '').trim().replace(/\s/g, ''); return s === '' ? 0 : /^\d+$/.test(s) ? Number(s) : null; };
  const d2 = (f) => setTimeout(f, 30);

  function modifier(fn, message) {
    retenir();
    E = R.noterReleve(fn(E), auj());
    sauver(); rendre();
    if (message) toast(message, { libelle: 'Annuler', faire: annuler });
  }

  function modaleProjet() {
    const p = E.projet;
    const corps = `
      <fieldset class="champ"><legend>Type de travail</legend><div class="choix-statut deux">${Object.entries(B.types).map(([c, t]) => `<label><input type="radio" name="type" value="${c}" ${c === p.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Titre ou sujet<input name="titre" value="${esc(p.titre)}" maxlength="200"></label>
      <div class="rang-champs"><label class="champ">Formation ou discipline<input name="discipline" value="${esc(p.discipline)}" maxlength="120"></label><label class="champ">Établissement<input name="etablissement" value="${esc(p.etablissement)}" maxlength="120"></label></div>
      <label class="champ">Directeur, directrice ou tuteur<input name="directeur" value="${esc(p.directeur)}" maxlength="100"></label>
      <div class="rang-champs"><label class="champ">Début<input type="date" name="debut" value="${p.debut}"></label><label class="champ">Rendu<input type="date" name="rendu" value="${p.rendu}"></label><label class="champ">Soutenance<input type="date" name="soutenance" value="${p.soutenance}"></label></div>
      <div class="rang-champs"><label class="champ">Mots visés <small>consigne de l'établissement</small><input name="objectifMots" inputmode="numeric" value="${p.objectifMots || ''}" maxlength="8"></label><label class="champ">Mots par page <small>pour l'estimation en pages</small><input name="motsParPage" inputmode="numeric" value="${p.motsParPage}" maxlength="4"></label></div>
      <fieldset class="champ"><legend>Jours de travail <small>pour le rythme en mots par jour</small></legend><div class="jours-travail">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="jour" value="${d}" ${p.joursTravail.includes(d) ? 'checked' : ''}><span>${R.JOURS[d].slice(0, 3)}</span></label>`).join('')}</div></fieldset>
      <p class="aide">Changer le type ne touche ni au plan ni aux jalons : pour reprendre les jalons types du nouveau type, utilise « Rétablir les jalons types » dans le Planning.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Projet', corps, PIED(false), (fd) => {
      const objectifMots = entier(fd.get('objectifMots')), motsParPage = entier(fd.get('motsParPage'));
      if (objectifMots === null || motsParPage === null) return 'Indique des nombres entiers.';
      if (motsParPage && (motsParPage < 50 || motsParPage > 2000)) return 'Mots par page : entre 50 et 2 000.';
      const debut = fd.get('debut'), rendu = fd.get('rendu'), soutenance = fd.get('soutenance');
      if (debut && rendu && debut >= rendu) return 'Le début doit précéder le rendu.';
      if (soutenance && rendu && soutenance < rendu) return 'La soutenance a lieu après le rendu.';
      const jours = fd.getAll('jour').map(Number);
      if (!jours.length) return 'Choisis au moins un jour de travail.';
      modifier((e) => ({ ...e, projet: R.normaliserProjet({ ...e.projet, type: fd.get('type'), titre: fd.get('titre'), discipline: fd.get('discipline'), etablissement: fd.get('etablissement'), directeur: fd.get('directeur'), debut, rendu, soutenance, objectifMots, motsParPage: motsParPage || B.motsParPage, joursTravail: jours }, B) }), 'Projet enregistré.');
      return undefined;
    });
  }

  function optionsParents(exclure) {
    const interdits = new Set(exclure ? [exclure, ...R.descendants(E, exclure).map((x) => x.id)] : []);
    return R.arbre(E).filter(({ s }) => s.niveau < 3 && !interdits.has(s.id)).map(({ s, prof }) => ({ id: s.id, nom: `${'  '.repeat(prof)}${R.NIVEAUX[s.niveau]} · ${s.titre}` }));
  }
  function modaleSection(id, parentDefaut = '') {
    const s0 = id ? section(id) : null;
    const s = s0 || R.normaliserSection({ parent: parentDefaut, niveau: parentDefaut ? Math.min(3, section(parentDefaut).niveau + 1) : 2 });
    const aEnfants = s0 && E.sections.some((x) => x.parent === s0.id);
    const parents = optionsParents(s0?.id);
    const corps = `
      <label class="champ">Titre<input name="titre" value="${s0 ? esc(s.titre) : ''}" maxlength="160" required placeholder="Chapitre 2 · Problématique"></label>
      <div class="rang-champs">
        <label class="champ">Place dans le plan<select name="parent"><option value="">À la racine du plan</option>${parents.map((x) => `<option value="${x.id}" ${x.id === s.parent ? 'selected' : ''}>Dans ${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ" data-si-racine>Niveau<select name="niveau"><option value="1" ${s.niveau === 1 ? 'selected' : ''}>Partie</option><option value="2" ${s.niveau !== 1 ? 'selected' : ''}>Chapitre</option></select></label>
      </div>
      ${aEnfants ? `<p class="aide">Cet élément contient ${pluriel(R.enfants(E, s0.id).length, 'élément')} : son statut est celui du moins avancé (${R.STATUTS[R.statutAgrege(E, s0.id)].toLowerCase()}), ses mots s'ajoutent aux leurs (${N(R.motsSection(E, s0.id))} au total).</p>` : `<fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${R.ORDRE_STATUTS.map((st) => `<label><input type="radio" name="statut" value="${st}" ${st === s.statut ? 'checked' : ''}><span>${R.STATUTS[st]}</span></label>`).join('')}</div></fieldset>`}
      <div class="rang-champs">
        <label class="champ">${aEnfants ? 'Mots propres <small>introduction de la partie, par exemple</small>' : 'Mots écrits <small>compteur du traitement de texte</small>'}<input name="mots" inputmode="numeric" value="${s.mots || ''}" maxlength="8"></label>
        <label class="champ">Mots visés <small>${aEnfants ? 'vide = somme des éléments' : 'facultatif'}</small><input name="objectif" inputmode="numeric" value="${s.objectif || ''}" maxlength="8"></label>
      </div>
      <label class="champ">Note <small>ce qu'il reste à faire, idées</small><textarea name="note" maxlength="2000">${esc(s.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s0 ? 'Modifier l\'élément' : 'Nouvel élément du plan', corps, PIED(!!s0), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = R.descendants(E, s0.id).length;
        if (!confirm(`Supprimer « ${s0.titre} »${n ? ` et ses ${pluriel(n, 'élément')}` : ''} ?`)) return '';
        modifier((e) => R.supprimerSection(e, s0.id), 'Élément supprimé.');
        return undefined;
      }
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Indique le titre.';
      const mots = entier(fd.get('mots')), objectif = entier(fd.get('objectif'));
      if (mots === null || objectif === null) return 'Les mots se comptent en nombres entiers.';
      const champs = { titre, parent: fd.get('parent') || '', niveau: Number(fd.get('niveau') || 2), mots, objectif, note: fd.get('note'), ...(fd.get('statut') ? { statut: fd.get('statut') } : {}) };
      if (s0) modifier((e) => R.modifierSection(e, s0.id, champs), 'Élément modifié.');
      else modifier((e) => R.ajouterSection(e, { id: uid(), ...champs }), `« ${titre} » ajouté au plan.`);
      return undefined;
    });
    const d = modale();
    const maj = () => { d.querySelector('[data-si-racine]').hidden = !!d.querySelector('[name=parent]').value; };
    d.querySelector('[name=parent]').addEventListener('change', maj);
    maj();
  }

  // Mise à jour rapide des mots de tous les éléments (recopiés du traitement de texte).
  function modaleMots() {
    if (!E.sections.length) { toast('Ajoute d\'abord des éléments au plan.'); return; }
    const a = R.arbre(E);
    const corps = `<p class="aide">Recopie le nombre de mots de chaque élément (compteur de mots de ton traitement de texte, sur la sélection). Les éléments qui en contiennent d'autres totalisent seuls les leurs : saisis seulement leurs mots propres.</p>
      <ul class="saisie-mots">${a.map(({ s, prof, nbEnfants }) => `<li style="--prof:${prof}" ${nbEnfants ? 'class="sans-statut"' : ''}><label><span>${esc(s.titre)}${nbEnfants ? ' <small>mots propres</small>' : ''}</span><input name="m-${s.id}" inputmode="numeric" value="${s.mots || ''}" maxlength="8" aria-label="Mots de ${esc(s.titre)}"></label>${nbEnfants ? '' : `<select name="s-${s.id}" aria-label="Statut de ${esc(s.titre)}">${R.ORDRE_STATUTS.map((st) => `<option value="${st}" ${st === s.statut ? 'selected' : ''}>${R.STATUTS[st]}</option>`).join('')}</select>`}</li>`).join('')}</ul>
      <p class="apercu-session" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Mettre à jour les mots', corps, PIED(false), (fd) => {
      const valeurs = {};
      for (const { s } of a) { const v = entier(fd.get(`m-${s.id}`)); if (v === null) return `Mots de « ${s.titre} » : un nombre entier.`; valeurs[s.id] = { mots: v, statut: fd.get(`s-${s.id}`) || s.statut }; }
      const avant = R.totalMots(E);
      modifier((e) => ({ ...e, sections: e.sections.map((s) => (valeurs[s.id] ? { ...s, ...valeurs[s.id] } : s)) }), '');
      const apres = R.totalMots(E);
      toast(`Mots enregistrés : ${N(apres)} au total (${apres - avant >= 0 ? '+' : ''}${N(apres - avant)}).`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const d = modale();
    const maj = () => {
      let total = 0;
      for (const { s } of a) total += entier(d.querySelector(`[name="m-${s.id}"]`).value) || 0;
      d.querySelector('.apercu-session').innerHTML = `Total : <b>${N(total)} mots</b>${E.projet.objectifMots ? ` sur ${N(E.projet.objectifMots)}` : ''} (aujourd'hui : ${N(R.totalMots(E))}).`;
    };
    d.querySelectorAll('.saisie-mots input').forEach((x) => x.addEventListener('input', maj));
    maj();
  }

  function modaleJalon(id) {
    const j0 = id ? E.jalons.find((x) => x.id === id) : null;
    const j = j0 || R.normaliserJalon({ nom: '', ancre: 'date', date: R.ajout(auj(), 14) });
    const calc = j0 ? R.retroplanning(E).jalons.find((x) => x.id === id)?.quand : '';
    const corps = `
      <label class="champ">Jalon<input name="nom" value="${j0 ? esc(j.nom) : ''}" maxlength="140" required></label>
      <fieldset class="champ"><legend>Date</legend><div class="choix-statut trois">${[['rendu', 'Avant ou après le rendu'], ['soutenance', 'Avant la soutenance'], ['date', 'Date fixée']].map(([a, n]) => `<label><input type="radio" name="ancre" value="${a}" ${a === j.ancre ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ" data-si="rendu soutenance">Jours avant <small>0 = le jour même</small><input name="avant" inputmode="numeric" value="${Math.max(0, -j.decalage)}" maxlength="5"></label>
        <label class="champ" data-si="date">Date<input type="date" name="date" value="${j.date || calc || ''}"></label>
      </div>
      ${calc ? `<p class="aide">Date calculée aujourd'hui : ${esc(R.dateFr(calc))}.</p>` : ''}
      <label class="case"><input type="checkbox" name="fin" ${j.fin ? 'checked' : ''}> Fin de la rédaction (échéance du rythme en mots par jour)</label>
      <div class="rang-champs"><label class="champ">Fait le <small>vide = pas encore</small><input type="date" name="fait" value="${j.fait}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="1000">${esc(j.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(j0 ? 'Modifier le jalon' : 'Nouveau jalon', corps, PIED(!!j0), (fd, choix) => {
      if (choix === 'supprimer') { modifier((e) => ({ ...e, jalons: e.jalons.filter((x) => x.id !== j0.id) }), 'Jalon supprimé.'); return undefined; }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Nomme le jalon.';
      const ancre = fd.get('ancre');
      const avant = entier(fd.get('avant'));
      if (ancre !== 'date' && avant === null) return 'Indique un nombre de jours.';
      if (ancre === 'date' && !R.estDate(fd.get('date'))) return 'Choisis la date.';
      if (ancre === 'soutenance' && !E.projet.soutenance) toast('Saisis la date de soutenance dans Projet pour dater ce jalon.');
      const fin = !!fd.get('fin');
      const n = R.normaliserJalon({ ...j, nom, ancre, decalage: ancre === 'date' ? j.decalage : -avant, date: ancre === 'date' ? fd.get('date') : '', fin, fait: fd.get('fait'), note: fd.get('note') });
      modifier((e) => ({ ...e, jalons: (j0 ? e.jalons.map((x) => (x.id === n.id ? n : x)) : e.jalons.concat([n])).map((x) => (fin && x.id !== n.id ? { ...x, fin: false } : x)) }), j0 ? 'Jalon modifié.' : 'Jalon ajouté.');
      return undefined;
    });
    const d = modale();
    const maj = () => { const a = d.querySelector('[name=ancre]:checked').value; d.querySelectorAll('[data-si]').forEach((x) => { x.hidden = !x.dataset.si.split(' ').includes(a); }); };
    d.querySelectorAll('[name=ancre]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  function modaleSeance(id) {
    const s0 = id ? E.seances.find((x) => x.id === id) : null;
    const s = s0 || R.normaliserSeance({ date: auj(), minutes: 0 });
    const opts = R.arbre(E).map(({ s: x, prof }) => `<option value="${x.id}" ${x.id === s.section ? 'selected' : ''}>${'  '.repeat(prof)}${esc(x.titre)}</option>`).join('');
    const corps = `
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${s.date}" max="${R.ajout(auj(), 1)}"></label><label class="champ">Durée <small>45, 1h30 ou 1:30</small><input name="duree" value="${dureeSaisie(s.minutes)}" maxlength="8" autocomplete="off"></label></div>
      <label class="champ">Section travaillée <small>facultatif</small><select name="section"><option value="">Aucune en particulier</option>${opts}</select></label>
      <label class="champ">Mots écrits pendant la séance <small>facultatif, négatif si tu as coupé</small><input name="mots" inputmode="numeric" value="${s.mots || ''}" maxlength="8"></label>
      ${s0 ? '' : '<label class="case"><input type="checkbox" name="ajouter" checked> Ajouter ces mots à la section travaillée</label>'}
      <label class="champ">Note <small>ce que tu as fait, la suite</small><textarea name="note" maxlength="1000">${esc(s.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s0 ? 'Modifier la séance' : 'Noter une séance', corps, PIED(!!s0), (fd, choix) => {
      if (choix === 'supprimer') { modifier((e) => ({ ...e, seances: e.seances.filter((x) => x.id !== s0.id) }), 'Séance supprimée.'); return undefined; }
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Choisis une date.';
      const minutes = lireDuree(fd.get('duree'));
      if (minutes === null) return 'Durée illisible : écris par exemple 45, 1h30 ou 1:30.';
      const brut = String(fd.get('mots') || '').trim().replace(/\s/g, '').replace('−', '-');
      if (brut && !/^-?\d+$/.test(brut)) return 'Les mots se comptent en nombre entier.';
      const mots = Number(brut || 0);
      if (!minutes && !mots && !String(fd.get('note') || '').trim()) return 'Indique au moins une durée, des mots ou une note.';
      const ajouter = !s0 && !!fd.get('ajouter') && !!fd.get('section');
      modifier((e) => R.ajouterSeance(e, { id: s0?.id || uid(), date, minutes, mots, section: fd.get('section'), note: fd.get('note') }, ajouter), s0 ? 'Séance modifiée.' : `Séance notée${ajouter && mots ? ` : ${mots > 0 ? '+' : ''}${N(mots)} mots ajoutés à la section` : ''}.`);
      return undefined;
    });
  }

  function modaleRdv(id) {
    const r0 = id ? E.rdv.find((x) => x.id === id) : null;
    const r = r0 || R.normaliserRdv({ date: auj() });
    const corps = `
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${r.date}"></label><label class="champ">Forme<select name="mode">${Object.entries(R.MODES).map(([c, n]) => `<option value="${c}" ${c === r.mode ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <label class="champ">Points abordés ou à aborder <small>un par ligne</small><textarea name="points" maxlength="4000">${esc(r.points)}</textarea></label>
      <label class="champ">Ce qui a été dit <small>remarques, décisions</small><textarea name="notes" maxlength="4000">${esc(r.notes)}</textarea></label>
      <fieldset class="champ"><legend>Actions à faire</legend>
        <ul class="actions-saisie">${r.actions.map((a) => ligneSaisieAction(a)).join('')}</ul>
        <button type="button" class="btn petit" data-action="action-ajout">${ICONES.plus}Action</button></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r0 ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', corps, PIED(!!r0), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer ce rendez-vous et ses actions ?')) return ''; modifier((e) => ({ ...e, rdv: e.rdv.filter((x) => x.id !== r0.id) }), 'Rendez-vous supprimé.'); return undefined; }
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Choisis la date du rendez-vous.';
      const actions = [...modale().querySelectorAll('.actions-saisie li')].map((li) => ({ id: li.dataset.id, texte: li.querySelector('[data-c=texte]').value.trim(), echeance: li.querySelector('[data-c=echeance]').value, faite: li.querySelector('[data-c=faite]').checked ? (r.actions.find((a) => a.id === li.dataset.id)?.faite || auj()) : '' })).filter((a) => a.texte);
      const n = R.normaliserRdv({ ...r, date, mode: fd.get('mode'), points: fd.get('points'), notes: fd.get('notes'), actions });
      modifier((e) => ({ ...e, rdv: (r0 ? e.rdv.map((x) => (x.id === n.id ? n : x)) : e.rdv.concat([n])).sort((a, b) => a.date.localeCompare(b.date)) }), r0 ? 'Rendez-vous modifié.' : 'Rendez-vous noté.');
      return undefined;
    });
    if (!r.actions.length && !r0) ajouterLigneAction();
  }
  const ligneSaisieAction = (a) => `<li data-id="${a.id}"><label class="champ"><span class="sr-only">Action</span><input data-c="texte" value="${esc(a.texte)}" maxlength="300" placeholder="Ce qu'il faut faire"></label><label class="champ"><span class="sr-only">Échéance</span><input type="date" data-c="echeance" value="${a.echeance}" aria-label="Échéance"></label><label class="case"><input type="checkbox" data-c="faite" ${a.faite ? 'checked' : ''}> Faite</label><button type="button" class="btn-suppr" data-action="action-retirer" aria-label="Retirer l'action">×</button></li>`;
  function ajouterLigneAction() {
    const ul = modale().querySelector('.actions-saisie');
    ul.insertAdjacentHTML('beforeend', ligneSaisieAction({ id: uid(), texte: '', echeance: '', faite: '' }));
    if (!estTel()) ul.lastElementChild.querySelector('input').focus();
  }

  function modaleOrdreDuJour() {
    const texte = R.ordreDuJour(E, auj());
    const corps = `<p class="aide">À copier dans un e-mail à ${esc(E.projet.directeur || 'ton directeur')} avant le rendez-vous. Ajoute les points à aborder dans le rendez-vous prévu (onglet Directeur) : ils apparaissent ici.</p>
      <label class="champ"><span class="sr-only">Ordre du jour</span><textarea class="texte-copie" rows="14" readonly>${esc(texte)}</textarea></label>`;
    ouvrirModale('Préparer le rendez-vous', corps, '<button class="btn primaire" value="copier">Copier</button><button class="btn" value="annuler">Fermer</button>', (_, v) => { if (v === 'copier') { copier(texte); modale().dataset.garder = '1'; } return undefined; });
  }
  async function copier(texte) {
    try { await navigator.clipboard.writeText(texte); toast('Texte copié.'); } catch { const z = modale().querySelector('.texte-copie'); z?.select(); toast('Sélectionne le texte et copie-le.'); }
  }

  function modaleRef(id) {
    const r0 = id ? E.refs.find((x) => x.id === id) : null;
    const r = r0 || R.normaliserRef({ statut: 'alire', ajoute: auj() });
    const corps = `
      <label class="champ">Auteurs <small>« Nom, Prénom ; Nom, Prénom » ; une organisation : son nom seul</small><input name="auteurs" value="${esc(r.auteurs)}" maxlength="400" placeholder="Martin, Claire ; Dubois, Paul"></label>
      <div class="rang-champs"><label class="champ">Année<input name="annee" value="${esc(r.annee)}" maxlength="12" inputmode="numeric"></label><label class="champ">Type<select name="type">${[...new Set(B.typesReference.concat([r.type]))].map((t) => `<option ${t === r.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
      <label class="champ">Titre<input name="titre" value="${r0 ? esc(r.titre) : ''}" maxlength="400" required></label>
      <label class="champ">Source <small>revue, volume, pages ; éditeur ; établissement</small><input name="source" value="${esc(r.source)}" maxlength="300"></label>
      <div class="rang-champs"><label class="champ">Adresse web <small>facultatif</small><input name="url" type="url" value="${esc(r.url)}" maxlength="500" placeholder="https://"></label><label class="champ">Consulté le<input type="date" name="consulte" value="${r.consulte}"></label></div>
      <fieldset class="champ"><legend>Lecture</legend><div class="choix-statut trois">${Object.entries(R.LECTURE).map(([c, n]) => `<label><input type="radio" name="statut" value="${c}" ${c === r.statut ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Notes de lecture<textarea name="notes" maxlength="4000">${esc(r.notes)}</textarea></label>
      ${E.sections.length ? `<fieldset class="champ"><legend>Citée dans <small>facultatif</small></legend><div class="cases-sections">${R.arbre(E).map(({ s, prof }) => `<label class="case" style="--prof:${prof}"><input type="checkbox" name="sec" value="${s.id}" ${r.sections.includes(s.id) ? 'checked' : ''}> ${esc(s.titre)}</label>`).join('')}</div></fieldset>` : ''}
      <p class="apercu-session apercu-ref" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r0 ? 'Modifier la référence' : 'Nouvelle référence', corps, PIED(!!r0), (fd, choix) => {
      if (choix === 'supprimer') { modifier((e) => ({ ...e, refs: e.refs.filter((x) => x.id !== r0.id) }), 'Référence supprimée.'); return undefined; }
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Indique le titre.';
      const url = String(fd.get('url') || '').trim();
      if (url && !/^https?:\/\/\S+$/i.test(url)) return 'L\'adresse web commence par https:// ou http://.';
      const n = R.normaliserRef({ ...r, auteurs: fd.get('auteurs'), annee: fd.get('annee'), type: fd.get('type'), titre, source: fd.get('source'), url, consulte: fd.get('consulte'), statut: fd.get('statut'), notes: fd.get('notes'), sections: fd.getAll('sec') });
      modifier((e) => ({ ...e, refs: r0 ? e.refs.map((x) => (x.id === n.id ? n : x)) : e.refs.concat([n]) }), r0 ? 'Référence modifiée.' : 'Référence ajoutée.');
      return undefined;
    });
    const d = modale();
    const maj = () => {
      const x = R.normaliserRef({ auteurs: d.querySelector('[name=auteurs]').value, annee: d.querySelector('[name=annee]').value, titre: d.querySelector('[name=titre]').value || 'Titre', source: d.querySelector('[name=source]').value, url: d.querySelector('[name=url]').value, consulte: d.querySelector('[name=consulte]').value });
      d.querySelector('.apercu-ref').innerHTML = `Aperçu : ${esc(R.referenceTexte(x))}<br>Dans le texte : <b>${esc(R.citation(x))}</b>`;
    };
    d.querySelectorAll('[name=auteurs],[name=annee],[name=titre],[name=source],[name=url],[name=consulte]').forEach((x) => x.addEventListener('input', maj));
    maj();
  }

  function modaleBiblioTexte() {
    const corps = `<fieldset class="champ"><legend>Références</legend><div class="choix-statut deux"><label><input type="radio" name="quoi" value="lu" checked><span>Lues seulement</span></label><label><input type="radio" name="quoi" value="tous"><span>Toutes</span></label></div></fieldset>
      <label class="champ"><span class="sr-only">Bibliographie</span><textarea class="texte-copie" rows="14" readonly></textarea></label>
      <p class="aide">Format auteur-date simple : Nom, initiales (année). Titre. Source. Il ne respecte pas une norme précise (APA, ISO 690 ou autre) : adapte la mise en forme (italiques, ponctuation) à ce que demande ton établissement.</p>`;
    ouvrirModale('Exporter la bibliographie', corps, '<button class="btn primaire" value="copier">Copier</button><button class="btn" value="telecharger">Télécharger (.txt)</button><button class="btn" value="annuler">Fermer</button>', (_, v) => {
      const t = texteChoisi();
      if (v === 'copier') { copier(t); modale().dataset.garder = '1'; }
      if (v === 'telecharger') { telecharger(t, 'text/plain;charset=utf-8', `bibliographie-${auj()}.txt`); modale().dataset.garder = '1'; }
      return undefined;
    });
    const d = modale();
    function texteChoisi() { const q = d.querySelector('[name=quoi]:checked').value; const refs = E.refs.filter((r) => q === 'tous' || r.statut === 'lu'); return refs.length ? R.bibliographieTexte(refs) : ''; }
    const maj = () => { d.querySelector('.texte-copie').value = texteChoisi() || 'Aucune référence lue pour l\'instant.'; };
    d.querySelectorAll('[name=quoi]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const corps = `
      <div class="groupe"><h3>Projet</h3><p class="aide">Type de travail, titre, dates de rendu et de soutenance, mots visés, jours de travail.</p><div class="rang"><button class="btn petit" type="button" data-action="projet">Modifier le projet</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule) ou en texte pour la bibliographie. L'impression donne une synthèse (plan, rétroplanning, actions, bibliographie).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-plan">Plan</button><button class="btn petit" type="button" data-action="csv-biblio">Bibliographie</button><button class="btn petit" type="button" data-action="csv-seances">Journal</button><button class="btn petit" type="button" data-action="csv-actions">Actions</button><button class="btn petit" type="button" data-action="imprimer">Imprimer la synthèse</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton planning est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${N(Math.round(t / 1000))} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte une copie, puis retire les séances anciennes.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer les séances du journal avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le planning à ton écran d'accueil pour noter une séance ou un rendez-vous d'un geste, en sortant de la bibliothèque.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ton planning est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Le texte de ton mémoire n'est jamais demandé : seuls les titres, statuts et nombres de mots que tu saisis sont gardés. Évite d'y noter des données personnelles de personnes enquêtées.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Jalons types et plans de départ : repères indicatifs écrits pour ce template, sans valeur réglementaire ; aucune règle d'établissement ni d'école doctorale intégrée. Bibliographie : format auteur-date simple, qui ne prétend respecter aucune norme précise. Rythme : mots restants divisés par les jours de travail jusqu'à la fin de la rédaction ; rythme réel mesuré sur les relevés des 14 derniers jours.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>', () => undefined);
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.sections) || !donnees.projet) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.sections.length, 'élément')} de plan, ${pluriel((donnees.refs || []).length, 'référence')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning de mémoire.'); }
    });
  }
  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.seances.filter((s) => s.date < d).length;
    if (!n) { toast('Aucune séance avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'séance')} antérieure${n > 1 ? 's' : ''} au ${R.dateFrLongue(d)} ? Pense à exporter une copie avant.`)) return;
    retenir();
    E = { ...E, seances: E.seances.filter((s) => s.date >= d) };
    modale().close(); sauver(); rendre();
    toast(`${pluriel(n, 'séance retirée', 'séances retirées')}.`, { libelle: 'Annuler', faire: annuler });
  }
  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const CSV = 'text/csv;charset=utf-8';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `planning-memoire-${auj()}.json`);

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
      <p>Enregistre ton planning de mémoire sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  function basculerAction(rdvId, actionId, faite) {
    modifier((e) => ({ ...e, rdv: e.rdv.map((r) => (r.id === rdvId ? { ...r, actions: r.actions.map((a) => (a.id === actionId ? { ...a, faite: faite ? auj() : '' } : a)) } : r)) }), faite ? 'Action faite.' : 'Action rouverte.');
  }
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="action-cocher"]');
    if (el) basculerAction(el.dataset.rdv, el.dataset.id, el.checked);
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.dataset.action === 'action-cocher') return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'projet': if (modale().open) modale().close(); d2(modaleProjet); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-plan': telecharger(R.csvPlan(E), CSV, `plan-memoire-${auj()}.csv`); break;
      case 'csv-biblio': telecharger(R.csvBiblio(E), CSV, `bibliographie-${auj()}.csv`); break;
      case 'csv-seances': telecharger(R.csvSeances(E), CSV, `journal-memoire-${auj()}.csv`); break;
      case 'csv-actions': telecharger(R.csvActions(E), CSV, `actions-directeur-${auj()}.csv`); break;
      case 'purger': purger(); break;
      case 'fermer': modale().close(); break;
      case 'mots': modaleMots(); break;
      case 'section': modaleSection(id); break;
      case 'section-nouvelle': modaleSection(null, el.dataset.parent || ''); break;
      case 'monter': modifier((x) => R.deplacerSection(x, id, -1), ''); break;
      case 'descendre': modifier((x) => R.deplacerSection(x, id, 1), ''); break;
      case 'plan-type': modifier((x) => ({ ...x, sections: R.genererPlan(B, x.projet.type, x.projet.objectifMots) }), 'Plan type ajouté : renomme et adapte chaque élément.'); break;
      case 'jalon': modaleJalon(id || null); break;
      case 'jalon-fait': modifier((x) => ({ ...x, jalons: x.jalons.map((j) => (j.id === id ? { ...j, fait: auj() } : j)) }), 'Jalon fait.'); break;
      case 'jalon-refaire': modifier((x) => ({ ...x, jalons: x.jalons.map((j) => (j.id === id ? { ...j, fait: '' } : j)) }), 'Jalon rouvert.'); break;
      case 'jalons-type': {
        if (E.jalons.length && !confirm(`Remplacer les jalons actuels par les jalons types du ${B.types[E.projet.type].nom.toLowerCase()} ? Les jalons faits sont gardés.`)) break;
        modifier((x) => { const faits = x.jalons.filter((j) => j.fait); const noms = new Set(faits.map((j) => R.plat(j.nom))); return { ...x, jalons: faits.concat(R.genererJalons(B, x.projet.type).filter((j) => !noms.has(R.plat(j.nom)))) }; }, 'Jalons types rétablis.');
        break;
      }
      case 'seance': modaleSeance(null); break;
      case 'seance-modif': modaleSeance(id); break;
      case 'journal-plus': filtre.journal += 30; rendre(); break;
      case 'rdv': modaleRdv(id || null); break;
      case 'action-ajout': ajouterLigneAction(); break;
      case 'action-retirer': el.closest('li').remove(); break;
      case 'action-faite': basculerAction(el.dataset.rdv, id, true); break;
      case 'ordre-du-jour': modaleOrdreDuJour(); break;
      case 'ref': modaleRef(id || null); break;
      case 'ref-lu': { const r = E.refs.find((x) => x.id === id); if (r) modifier((x) => ({ ...x, refs: x.refs.map((y) => (y.id === id ? { ...y, statut: y.statut === 'alire' ? 'encours' : 'lu' } : y)) }), r.statut === 'alire' ? 'Lecture commencée.' : 'Référence lue.'); break; }
      case 'filtre-biblio': filtre.biblio = el.dataset.f; sauverPref(); rendre(); break;
      case 'biblio-texte': modaleBiblioTexte(); break;
      case 'imprimer': if (modale().open) modale().close(); changerVue('imprimer'); break;
      case 'lancer-impression': window.print(); break;
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
  MQ_TEL.addEventListener('change', () => { if (E && !modale().open) rendre(); });

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
  window.__mmr = { etat: () => E, regles: R };
  init();
})();
