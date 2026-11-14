// Tableau de bord annuel et roue de vie QME : roue de vie notée par questions, objectifs et résultats clés
// par domaine, actions trimestrielles, revue guidée, évolution dans le temps ; données synchronisées par
// clé de licence. Aucune connexion à une autre application.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RDV;
  const API = '/api/templates';
  const PRODUIT = 'RDV';
  const CLE_CODE = 'qme-rdv-code';
  const CLE_CACHE = 'qme-rdv-cache';
  const CLE_DEMO = 'qme-rdv-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rdv-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'long' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const nbTexte = R.nombreTexte;
  const note10 = (n) => (n === null || n === undefined ? '–' : nbTexte(n));
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const ORDINAL = ['', '1er', '2e', '3e', '4e'];
  const nomTrim = (t) => `${ORDINAL[t]} trimestre`;

  const teinte = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[0];
  const domaine = (id) => E.domaines.find((d) => d.id === id);
  const styleDom = (id) => { const c = teinte(domaine(id)?.couleur); return `--c:${c.hex};--t:${c.texte};--p:${c.teinte}`; };
  const objectif = (id) => E.objectifs.find((o) => o.id === id);
  const action = (id) => E.actions.find((x) => x.id === id);
  const actifs = () => R.domainesActifs(E);
  const LIB_STATUT_OBJ = { atteint: 'Atteint', bonnevoie: 'Dans les temps', surveiller: 'À surveiller', retard: 'En retard', nonatteint: 'Non atteint', apreciser: 'À préciser' };
  const LIB_STATUT_ACT = { afaire: 'À faire', encours: 'En cours', fait: 'Fait', abandon: 'Abandonnée' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let anneeVue = R.anneeDe(auj());
  let trimVue = { annee: R.anneeDe(auj()), trimestre: R.trimestreDe(auj()) };
  let annulation = null;

  const etatVide = () => R.normaliserEtat(null, auj(), B);
  const normaliser = (d) => R.normaliserEtat(d, auj(), B);

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
        toast('Un autre appareil a modifié ton tableau entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (RDV-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Personne fictive. Cinq revues relatives à aujourd'hui (point de départ puis les quatre trimestres
  // écoulés, dont un bilan annuel), objectifs de l'année dans tous les états (atteint, dans les temps, à
  // surveiller, en retard, réduction d'une dépense), objectifs de l'an dernier dont un non atteint à reprendre,
  // actions du trimestre dans tous les états et une action restée ouverte au trimestre précédent.
  function donneesDemo() {
    const e = etatVide();
    e.prenom = 'Camille';
    const t = auj();
    const a = R.anneeDe(t), tc = R.trimestreDe(t);
    R.ajouterDomaines(e, B.domaines.filter((d) => d.defaut).map((d) => d.id), B);
    const trims = [-4, -3, -2, -1].map((k) => R.trimestreSuivant(a, tc, k));
    // Notes de chaque domaine aux cinq revues (départ, puis les quatre trimestres).
    const courbes = { sante: [4, 5, 6, 6, 7], travail: [6, 5, 5, 6, 6], argent: [3, 4, 5, 5, 6], famille: [7, 7, 8, 7, 8], couple: [6, 6, 5, 6, 7], amis: [5, 5, 4, 5, 6], developpement: [4, 5, 6, 7, 7], loisirs: [3, 3, 4, 5, 4] };
    const decal = [[0, 1, -1], [1, 0, 0], [-1, 1, 0], [0, -1, 1], [1, 1, -1]];
    const notes = (i) => Object.fromEntries(Object.entries(courbes).map(([id, v], k) => [id, decal[(i + k) % 5].map((d) => Math.max(0, Math.min(10, v[i] + d)))]));

    // Objectifs de l'an dernier (pour le bilan annuel et la reprise d'un objectif non atteint).
    const an1 = trims[0].annee;
    const obj = (annee, dom, titre, resultats, pourquoi = '') => ({ id: R.nouvelId(), annee, domaine: dom, titre, pourquoi, resultats: resultats.map((r) => R.normaliserResultat({ id: R.nouvelId(), ...r })) });
    if (an1 < a) {
      e.objectifs.push(
        obj(an1, 'travail', 'Changer d\'équipe', [{ titre: 'Entretiens internes passés', type: 'nombre', depart: 0, cible: 2, actuel: 2, unite: 'entretiens' }, { titre: 'Nouveau poste obtenu', type: 'case', fait: true }]),
        obj(an1, 'cadre', 'Désencombrer mon logement', [{ titre: 'Pièces triées', type: 'nombre', depart: 0, cible: 6, actuel: 4, unite: 'pièces' }, { titre: 'Objets donnés ou vendus', type: 'nombre', depart: 0, cible: 50, actuel: 31, unite: 'objets' }]),
      );
    }
    // Objectifs de l'année, avancement proportionné à la part de l'année écoulée.
    const p = R.partAnnee(a, t);
    const r1 = (x) => Math.round(x);
    e.objectifs.push(
      obj(a, 'sante', 'Retrouver la forme', [
        { titre: 'Séances de sport par semaine, en moyenne', type: 'nombre', depart: 1, cible: 3, actuel: r1((1 + 2 * Math.min(1, p * 1.05)) * 2) / 2, unite: 'séances' },
        { titre: 'Une course de 10 km terminée', type: 'case', fait: p > 0.5 },
        { titre: 'Jours à 8 000 pas ou plus', type: 'nombre', depart: 0, cible: 200, actuel: r1(200 * p * 0.95), unite: 'jours' }], 'Avoir de l\'énergie pour le reste.'),
      obj(a, 'sante', 'Faire le point sur ma santé', [{ titre: 'Bilan chez le médecin traitant fait', type: 'case', fait: true }, { titre: 'Rendez-vous chez le dentiste fait', type: 'case', fait: true }]),
      obj(a, 'argent', 'Constituer une épargne de précaution', [{ titre: 'Mois de dépenses mis de côté', type: 'nombre', depart: 0.5, cible: 3, actuel: Math.round((0.5 + 2.5 * p * 0.92) * 10) / 10, unite: 'mois' }, { titre: 'Virement automatique mis en place le jour de la paie', type: 'case', fait: true }], 'Ne plus angoisser au moindre imprévu.'),
      obj(a, 'argent', 'Dépenser moins sans me priver', [{ titre: 'Dépenses mensuelles moyennes', type: 'nombre', depart: 2400, cible: 2100, actuel: r1((2400 - 300 * p * 0.7) / 10) * 10, unite: '€' }, { titre: 'Abonnements inutiles résiliés', type: 'nombre', depart: 0, cible: 3, actuel: 2, unite: 'abonnements' }]),
      obj(a, 'developpement', 'Lire davantage', [{ titre: 'Livres lus', type: 'nombre', depart: 0, cible: 12, actuel: Math.min(12, r1(12 * p * 1.1)), unite: 'livres' }]),
      obj(a, 'loisirs', 'Reprendre la musique', [{ titre: 'Séances de pratique', type: 'nombre', depart: 0, cible: 30, actuel: r1(30 * p * 0.35), unite: 'séances' }, { titre: 'Un morceau joué en entier devant des amis', type: 'case', fait: false }]),
      obj(a, 'amis', 'Voir mes amis plus souvent', [{ titre: 'Moments avec des amis par mois', type: 'nombre', depart: 2, cible: 4, actuel: 3, unite: 'fois' }, { titre: 'Un week-end entre amis', type: 'case', fait: false }]),
      obj(a, 'couple', 'Prendre du temps à deux', [{ titre: 'Soirées à deux par mois', type: 'nombre', depart: 1, cible: 2, actuel: 2, unite: 'soirées' }, { titre: 'Un week-end à deux', type: 'case', fait: p > 0.3 }]),
    );
    // Revues : point de départ au début du premier trimestre, puis une revue à la fin de chaque trimestre.
    const bilans = [
      { reussites: 'J\'ai tenu deux séances de sport par semaine presque tout le trimestre.', difficultes: 'Trop de soirées de travail en fin de trimestre.', arreter: 'Les e-mails après 21 h.', continuer: 'Le sport du mardi et du samedi.', commencer: 'Un budget au début de chaque mois.' },
      { reussites: 'Épargne lancée avec un virement automatique.', difficultes: 'Peu de temps avec les amis.', arreter: 'Dire oui à toutes les réunions du soir.', continuer: 'Le virement d\'épargne.', commencer: 'Un dîner entre amis par mois.' },
      { reussites: 'Six livres lus depuis janvier, la course de 10 km terminée.', difficultes: 'La musique est restée au placard.', arreter: 'Les séries le soir en semaine.', continuer: 'La lecture avant de dormir.', commencer: 'Vingt minutes de musique le dimanche.' },
      { reussites: 'Vacances vraiment coupées, bilan de santé fait.', difficultes: 'Dépenses de rentrée plus fortes que prévu.', arreter: 'Les achats en ligne le soir.', continuer: 'Les soirées à deux.', commencer: 'Un week-end entre amis avant la fin de l\'année.' },
    ];
    const annuel = { fierte: 'Avoir changé d\'équipe sans lâcher le sport.', lecon: 'Un objectif sans date n\'avance pas : je découpe par trimestre.', mot: 'Équilibre' };
    const objsAn = (annee) => e.objectifs.filter((o) => o.annee === annee);
    const photo = (annee, facteur) => Object.fromEntries(objsAn(annee).map((o) => [o.id, Math.round(Math.min(1, (R.avancementObjectif(o) ?? 0) * facteur) * 1000) / 1000]));
    e.revues.push({ id: R.nouvelId(), date: ajout(R.debutTrimestre(trims[0].annee, trims[0].trimestre), 4), annee: trims[0].annee, trimestre: trims[0].trimestre, type: 'initiale', notes: notes(0), bilan: {}, priorites: ['loisirs', 'argent', 'sante'], avancement: {} });
    trims.forEach((q, i) => {
      const date = ajout(R.finTrimestre(q.annee, q.trimestre), -3);
      const type = q.trimestre === 4 ? 'annuelle' : 'trimestrielle';
      const part = q.annee === a ? R.partAnnee(a, date) / Math.max(p, 0.01) : 1;
      e.revues.push({ id: R.nouvelId(), date, annee: q.annee, trimestre: q.trimestre, type, notes: notes(i + 1), bilan: { ...bilans[i], ...(type === 'annuelle' ? annuel : {}) }, priorites: R.domainesFaibles(e, { notes: notes(i + 1) }, null, 3), avancement: photo(q.annee, part) });
    });
    // Actions : quatre par trimestre passé, sept pour le trimestre en cours, une restée ouverte.
    const act = (q, dom, titre, statut, objectifTitre, reports = 0) => e.actions.push({ id: R.nouvelId(), annee: q.annee, trimestre: q.trimestre, domaine: dom, objectif: e.objectifs.find((o) => o.titre === objectifTitre && o.annee === q.annee)?.id || null, titre, statut, reports });
    trims.forEach((q, i) => {
      act(q, 'sante', i % 2 ? 'Caler 3 créneaux de sport dans l\'agenda' : 'S\'inscrire au club de course', 'fait', 'Retrouver la forme');
      act(q, 'argent', i < 2 ? 'Mettre en place un virement d\'épargne' : 'Faire le bilan des dépenses du trimestre', 'fait', 'Constituer une épargne de précaution');
      act(q, 'famille', 'Organiser un repas de famille', i === 2 ? 'abandon' : 'fait');
      act(q, 'developpement', 'Choisir les 3 prochains livres', 'fait', 'Lire davantage');
    });
    const prec = trims[3];
    act(prec, 'loisirs', 'Ressortir la guitare et changer les cordes', 'afaire', 'Reprendre la musique', 1);
    const q0 = { annee: a, trimestre: tc };
    act(q0, 'amis', 'Réserver le week-end entre amis', 'encours', 'Voir mes amis plus souvent');
    act(q0, 'amis', 'Organiser un dîner à la maison', 'fait', 'Voir mes amis plus souvent');
    act(q0, 'loisirs', 'Bloquer 20 minutes de musique le dimanche', 'afaire', 'Reprendre la musique');
    act(q0, 'sante', 'Préparer un programme de 3 séances par semaine', 'fait', 'Retrouver la forme');
    act(q0, 'argent', 'Trier les abonnements', 'encours', 'Dépenser moins sans me priver');
    act(q0, 'couple', 'Réserver une soirée à deux', 'afaire', 'Prendre du temps à deux');
    act(q0, 'travail', 'Préparer l\'entretien annuel', 'afaire');
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Tableau de bord annuel · QME';
    // Roue décorative : huit parts de tailles différentes.
    const parts = [0.9, 0.6, 0.75, 0.5, 0.85, 0.65, 0.8, 0.45].map((k, i) => {
      const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2, r = 90 * k;
      const c = ['#1D4E89', '#D9302A', '#F5B400'][i % 3];
      return `<path d="M100 100 L${100 + r * Math.cos(a0)} ${100 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${100 + r * Math.cos(a1)} ${100 + r * Math.sin(a1)} Z" fill="${c}" stroke="#D8E4F0" stroke-width="3"/>`;
    }).join('');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 200" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <g transform="translate(0 0)"><circle cx="100" cy="100" r="92" fill="none" stroke="#2E5A88" stroke-width="3" stroke-dasharray="6 5"/>${parts}</g>
          <rect x="250" y="40" width="120" height="120" rx="18" fill="#F5B400"/>
          <circle cx="470" cy="100" r="70" fill="#141414"/>
          <path d="M470 100 L470 30 A70 70 0 0 1 540 100 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Tableau de bord annuel · roue de vie</p>
          <h1>Ton année, domaine par domaine.</h1>
          <p>Note ta roue de vie, fixe des objectifs mesurables, découpe-les en actions trimestrielles et fais le point chaque trimestre : tu vois ce qui avance et ce qui décroche.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton tableau de bord</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton tableau est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon tableau</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de tableau ? <a href="/catalogue/tableau-annuel/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon tableau'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { prenom: '', choix: new Set(B.domaines.filter((d) => d.defaut).map((d) => d.id)) };

  function ecranAccueil() {
    const a = accueil;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On prépare ta roue de vie.</h1>
      <p class="intro">Choisis les domaines de ta vie que tu veux suivre cette année : de 4 à ${R.MAX_DOMAINES}. Chacun arrive avec trois questions pour le noter de 0 à 10, des objectifs modèles et des idées d'actions. Tout reste modifiable.</p>
      <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
        <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
      </label>
      <h2 class="titre-section">Domaines de vie <span id="compte-domaines">${pluriel(a.choix.size, 'domaine choisi', 'domaines choisis')} sur ${R.MAX_DOMAINES} au plus</span></h2>
      <div class="types">${B.domaines.map((d) => `<button type="button" class="type" data-action="choix-domaine" data-id="${d.id}" aria-pressed="${a.choix.has(d.id)}"><b>${esc(d.nom)}</b><span>${esc(d.questions[0])}</span><small>3 questions · ${pluriel((B.objectifs[d.id] || []).length, 'objectif modèle', 'objectifs modèles')}</small></button>`).join('')}</div>
      <p class="erreur" id="erreur-accueil" role="alert"></p>
      <div class="accueil-pied"><span class="aide-pied">Ensuite : ton point de départ, la roue notée en 5 minutes. Tu peux aussi le faire plus tard.</span><button class="btn primaire" data-action="accueil-fin">Créer mon tableau</button></div>
    </div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
  }

  function terminerAccueil() {
    if (accueil.choix.size < 4) { $('#erreur-accueil').textContent = 'Choisis au moins 4 domaines : une roue a besoin de plusieurs parts.'; return; }
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    R.ajouterDomaines(E, B.domaines.map((d) => d.id).filter((id) => accueil.choix.has(id)), B);
    accueil = { prenom: '', choix: new Set(B.domaines.filter((d) => d.defaut).map((d) => d.id)) };
    commencerRevue();
    sauver();
    demarrer();
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12V2.5A9.5 9.5 0 0 1 21.5 12Z" fill="currentColor"/><path d="M12 12 5.3 18.7A9.5 9.5 0 0 1 2.5 12Z" fill="currentColor"/></svg>',
    objectifs: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    trimestre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    evolution: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 11l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M3 21h18" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    demi: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg>',
    points: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau'], ['objectifs', 'Objectifs'], ['trimestre', 'Trimestre'], ['evolution', 'Évolution']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (E.brouillon && !E.revues.length) vue = 'revue';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/tableau-annuel/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Tableau<br>annuel</span>
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
    if (vue === 'revue' && !E.brouillon) vue = 'tableau';
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { tableau: 'Tableau de bord', objectifs: 'Objectifs', trimestre: 'Trimestre', evolution: 'Évolution', revue: 'Revue' };
    document.title = `${titres[vue]} · Tableau de bord annuel`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, objectifs: vueObjectifs, trimestre: vueTrimestre, evolution: vueEvolution, revue: vueRevue }[vue]();
    brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', v === 'revue' ? location.pathname : `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const largeurVue = () => Math.min(($('#vue')?.clientWidth || window.innerWidth) - 24, 1180);

  // ---------- Graphique : la roue ----------
  // Une part par domaine, rayon proportionnel à la note (0 au centre, 10 au bord). La revue précédente est
  // tracée en pointillés sur chaque part. Noms et notes écrits à côté : la couleur n'est jamais seule.
  function couper(nom, max = 13) {
    if (nom.length <= max) return [nom];
    const mots = nom.split(' ');
    let l1 = '';
    while (mots.length && (l1 + ' ' + mots[0]).trim().length <= max) l1 = (l1 + ' ' + mots.shift()).trim();
    if (!l1) l1 = mots.shift();
    return [l1, mots.join(' ')].filter(Boolean);
  }
  function roueSvg(revue, precedente, largeur) {
    const ds = actifs();
    const n = ds.length;
    const W = Math.max(300, Math.min(560, largeur));
    const marge = W < 420 ? 62 : 84;
    const Rm = W / 2 - marge;
    const H = Rm * 2 + 96;
    const cx = W / 2, cy = H / 2;
    const pt = (ang, r) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)].map((x) => Math.round(x * 10) / 10);
    const part = (i, r) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n, a1 = a0 + (Math.PI * 2) / n;
      const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
      return { a0, a1, d: `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`, arc: `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}` };
    };
    const grille = [2, 4, 6, 8, 10].map((k) => `<circle cx="${cx}" cy="${cy}" r="${(Rm * k) / 10}" fill="none" stroke="var(--trait)" stroke-width="1"/>`).join('')
      + ds.map((_, i) => { const [x, y] = pt(part(i, Rm).a0, Rm); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--trait)" stroke-width="1"/>`; }).join('')
      + `<text x="${cx + 4}" y="${cy - Rm / 2 + 12}" class="r-echelle">5</text><text x="${cx + 4}" y="${cy - Rm + 12}" class="r-echelle">10</text>`;
    const fs = W < 420 ? 12 : 13;
    const parts = ds.map((d, i) => {
      const c = teinte(d.couleur);
      const note = revue ? R.noteDomaine(revue.notes?.[d.id]) : null;
      const avant = precedente ? R.noteDomaine(precedente.notes?.[d.id]) : null;
      const g = part(i, Rm);
      const plein = note === null ? '' : `<path d="${part(i, Math.max(2, (Rm * note) / 10)).d}" fill="${c.hex}" stroke="var(--surface)" stroke-width="2" stroke-linejoin="round"/>`;
      const prec = avant === null ? '' : `<path d="${part(i, Math.max(2, (Rm * avant) / 10)).arc}" fill="none" stroke="var(--encre)" stroke-width="2" stroke-dasharray="4 3"/>`;
      const milieu = (g.a0 + g.a1) / 2;
      const [lx, ly] = pt(milieu, Rm + 12);
      const cos = Math.cos(milieu);
      const ancre = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
      const lignes = couper(d.nom, W < 420 ? 11 : 14);
      const sin = Math.sin(milieu);
      const y0 = ly + (sin > 0.3 ? fs : sin < -0.3 ? -(lignes.length) * (fs + 2) : -((lignes.length + 1) * (fs + 2)) / 2 + fs);
      const texte = `<text x="${lx}" y="${y0}" text-anchor="${ancre}" class="r-nom" font-size="${fs}">${lignes.map((l, k) => `<tspan x="${lx}" dy="${k ? fs + 2 : 0}">${esc(l)}</tspan>`).join('')}<tspan x="${lx}" dy="${fs + 3}" class="r-note">${note10(note)}${note === null ? '' : '/10'}</tspan></text>`;
      const delta = note !== null && avant !== null ? note - avant : null;
      const info = `<b>${esc(d.nom)}</b>${note === null ? 'Pas noté' : `${note10(note)}/10`}${avant !== null ? `<br>Revue précédente : ${note10(avant)}/10${delta ? ` (${delta > 0 ? '+' : ''}${nbTexte(R.arrondi1(delta))})` : ''}` : ''}`;
      const cible = `<path d="${g.d}" fill="transparent" class="r-cible" tabindex="0" data-info="${esc(info)}" aria-label="${esc(`${d.nom} : ${note === null ? 'pas noté' : `${note10(note)} sur 10`}`)}"/>`;
      return { fond: plein + prec, texte, cible };
    });
    return `<svg class="roue" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Roue de vie : ${esc(ds.map((d) => `${d.nom} ${note10(revue ? R.noteDomaine(revue.notes?.[d.id]) : null)}`).join(', '))}">${grille}${parts.map((p) => p.fond).join('')}${parts.map((p) => p.texte).join('')}${parts.map((p) => p.cible).join('')}</svg>`;
  }

  // ---------- Graphique : courbe (une seule série, échelle fixe) ----------
  function courbeSvg(points, { min = 0, max = 10, largeur = 600, hauteur = 220, couleur = 'var(--bleu)', unite = '', graduations = [0, 5, 10], mini = false } = {}) {
    const W = Math.max(240, largeur), H = hauteur;
    const g = mini ? { h: 6, b: 8, gch: 6, d: 6 } : { h: 16, b: 34, gch: 34, d: 16 };
    const n = points.length;
    const x = (i) => g.gch + (n <= 1 ? (W - g.gch - g.d) / 2 : (i * (W - g.gch - g.d)) / (n - 1));
    const y = (v) => g.h + (1 - (v - min) / (max - min)) * (H - g.h - g.b);
    const lignesGrille = mini ? `<line x1="${g.gch}" x2="${W - g.d}" y1="${y(min)}" y2="${y(min)}" stroke="var(--trait)"/>` : graduations.map((v) => `<line x1="${g.gch}" x2="${W - g.d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--trait)"/><text x="${g.gch - 8}" y="${y(v) + 4}" text-anchor="end" class="c-axe">${v}${unite}</text>`).join('');
    // Étiquettes de l'axe des revues comptées depuis la fin : jamais plus d'une tous les 64 px.
    const pas = Math.max(1, Math.ceil((n * 64) / Math.max(1, W - g.gch - g.d)));
    const etiquettes = mini ? '' : points.map((p, i) => ((n - 1 - i) % pas === 0 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="c-axe">${esc(p.x)}</text>` : '')).join('');
    let trace = '', seg = [];
    const segments = [];
    points.forEach((p, i) => { if (p.y === null || p.y === undefined) { if (seg.length) segments.push(seg); seg = []; } else seg.push([x(i), y(p.y)]); });
    if (seg.length) segments.push(seg);
    trace = segments.map((s) => `<path d="M${s.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L')}" fill="none" stroke="${couleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const marques = points.map((p, i) => (p.y === null || p.y === undefined ? '' : `<circle cx="${x(i)}" cy="${y(p.y)}" r="${mini ? 3 : 4.5}" fill="${couleur}" stroke="var(--surface)" stroke-width="2"/>`)).join('');
    const derniere = [...points].reverse().find((p) => p.y !== null && p.y !== undefined);
    const iDer = points.lastIndexOf(derniere);
    const etiquetteFin = !mini && derniere ? `<text x="${Math.min(W - g.d, x(iDer))}" y="${y(derniere.y) - 12}" text-anchor="${iDer === n - 1 ? 'end' : 'middle'}" class="c-valeur">${nbTexte(derniere.y)}${unite}</text>` : '';
    const cibles = mini ? '' : points.map((p, i) => {
      const l = n <= 1 ? W - g.gch - g.d : (W - g.gch - g.d) / (n - 1);
      return `<rect x="${Math.max(0, x(i) - l / 2)}" y="0" width="${l}" height="${H - g.b + 6}" fill="transparent" class="c-cible" tabindex="0" data-info="${esc(p.info || '')}" data-x="${x(i)}"/>`;
    }).join('');
    return `<svg class="courbe" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${lignesGrille}${etiquettes}${trace}${marques}${etiquetteFin}${cibles}</svg>`;
  }

  // Barre d'avancement avec repère « attendu à date » (trait vertical).
  const barre = (taux, attendu, cls = '') => `<span class="barre-av ${cls}"><span style="width:${Math.max(0, Math.min(100, taux ?? 0))}%"></span>${attendu !== undefined && attendu !== null ? `<i style="left:${attendu}%" title="Attendu à date : ${attendu} %"></i>` : ''}</span>`;

  // ---------- Tableau de bord ----------
  function bandeauRevue() {
    const t = auj();
    if (E.brouillon) return `<div class="bandeau-revue"><div><b>Ta revue est commencée.</b><span>Reprends là où tu t'étais arrêté(e) : rien n'est perdu.</span></div><button class="btn primaire" data-action="revue-reprendre">Reprendre ma revue</button></div>`;
    const p = R.prochaineRevue(E, t);
    if (p.premiere) return `<div class="bandeau-revue"><div><b>Fais ton point de départ.</b><span>Note les domaines de ta roue : 3 questions chacun, 5 minutes en tout.</span></div><button class="btn primaire" data-action="revue">Noter ma roue</button></div>`;
    if (p.enRetard > 0) return `<div class="bandeau-revue retard"><div><b>Revue du ${nomTrim(p.trimestre)} ${p.annee} à faire</b><span>Le trimestre s'est terminé le ${fmt(p.date)} : fais le point maintenant, puis prépare le suivant.</span></div><button class="btn primaire" data-action="revue">Faire ma revue</button></div>`;
    if (p.due) return `<div class="bandeau-revue"><div><b>C'est le moment de ta revue du ${nomTrim(p.trimestre)}${p.trimestre === 4 ? ', le bilan de ton année' : ''}.</b><span>À faire d'ici le ${fmt(p.date)} : 20 à 30 minutes.</span></div><button class="btn primaire" data-action="revue">Faire ma revue</button></div>`;
    return '';
  }

  function vueTableau() {
    const t = auj();
    const a = R.anneeDe(t), tc = R.trimestreDe(t);
    const der = R.derniereRevue(E);
    const prec = R.revuePrecedente(E, der);
    const eq = R.equilibre(E, der), eqAvant = R.equilibre(E, prec);
    const sc = R.scoreAnnee(E, a), att = R.scoreAttendu(a, t);
    const av = R.avancementActions(E, a, tc);
    const p = R.prochaineRevue(E, t);
    const delta = eq !== null && eqAvant !== null ? R.arrondi1(eq - eqAvant) : null;
    const tuiles = [
      ['Équilibre de la roue', eq === null ? '–' : `${nbTexte(eq)}<small>/10</small>`, der ? `${delta === null ? 'moyenne des domaines' : `${delta > 0 ? '+' : ''}${nbTexte(delta)} depuis la revue précédente`}` : 'pas encore notée', 'var(--bleu)', 'rond'],
      [`Objectifs ${a}`, sc === null ? '–' : `${sc}<small>%</small>`, sc === null ? 'aucun objectif mesurable' : `attendu à date : ${att} %`, 'var(--rouge)', ''],
      [`Actions du ${ORDINAL[tc]} trimestre`, av.total ? `${av.faites}<small>/${av.total}</small>` : '–', av.total ? `${av.taux} % faites` : 'aucune action prévue', 'var(--jaune)', ''],
      ['Prochaine revue', p.premiere ? 'Maintenant' : p.enRetard > 0 ? 'En retard' : majuscule(fmt(p.date, { day: 'numeric', month: 'short' })), p.premiere ? 'point de départ' : `${nomTrim(p.trimestre)} ${p.annee}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');

    const vars = R.variations(E, der, prec);
    const lignesDom = actifs().map((d) => {
      const nt = der ? R.noteDomaine(der.notes?.[d.id]) : null;
      const v = vars[d.id];
      const objs = R.objectifsDe(E, a).filter((o) => o.domaine === d.id);
      const avg = objs.map(R.avancementObjectif).filter((x) => x !== null);
      return `<tr style="${styleDom(d.id)}"><td><span class="nom-dom"><i></i>${esc(d.nom)}</span></td><td class="nb"><b>${note10(nt)}</b></td><td class="nb ${v > 0 ? 'hausse' : v < 0 ? 'baisse' : ''}">${v === null ? '' : v > 0 ? `▲ ${nbTexte(v)}` : v < 0 ? `▼ ${nbTexte(-v)}` : '='}</td><td class="nb discret">${objs.length ? `${pluriel(objs.length, 'objectif')} · ${avg.length ? R.pourcent(avg.reduce((s, x) => s + x, 0) / avg.length) : 0} %` : '—'}</td></tr>`;
    }).join('');

    const aSurveiller = R.objectifsDe(E, a).map((o) => ({ o, s: R.statutObjectif(o, t), av: R.pourcent(R.avancementObjectif(o)) })).filter((x) => x.s === 'retard' || x.s === 'surveiller').slice(0, 4);
    const ouvertes = R.actionsDu(E, a, tc).filter(R.ouverte);
    const retard = R.actionsEnRetard(E, t);
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    return `
      <section class="jour">
        <p class="surtitre">Année ${a} · ${nomTrim(tc)}</p>
        <h1>${salut}${der ? `Ta roue est à <mark>${nbTexte(eq)}/10</mark>.` : 'Ta roue t\'attend.'}</h1>
      </section>
      ${bandeauRevue()}
      <div class="tuiles">${tuiles}</div>
      <div class="deux-colonnes">
        <div class="graphique">
          <div class="graphique-tete"><h2>Roue de vie</h2><span class="discret">${der ? `${esc(R.libelleRevue(der))} · ${fmt(der.date, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'pas encore notée'}</span></div>
          ${der ? roueSvg(der, prec, Math.min(560, estTel() ? largeurVue() - 34 : 520)) : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune note pour l'instant</h3><p>Ton point de départ prend 5 minutes : trois questions par domaine.</p><div class="actions"><button class="btn primaire" data-action="${E.brouillon ? 'revue-reprendre' : 'revue'}">Noter ma roue</button></div></div></div>`}
          ${der && prec ? `<p class="legende-roue"><span><i class="plein"></i>${esc(R.libelleRevue(der))}</span><span><i class="pointille"></i>${esc(R.libelleRevue(prec))}</span></p>` : ''}
        </div>
        <div>
          <h2 class="titre-section" style="margin-top:0">Domaines <span>note sur 10, évolution, objectifs ${a}</span></h2>
          <div class="defile"><table class="tableau tableau-dom"><thead><tr><th>Domaine</th><th class="nb">Note</th><th class="nb">Évol.</th><th class="nb">Objectifs</th></tr></thead><tbody>${lignesDom}</tbody></table></div>
          <div class="rang-actions"><button class="btn" data-action="${E.brouillon ? 'revue-reprendre' : 'revue'}">${E.brouillon ? 'Reprendre ma revue' : p.due ? 'Faire ma revue' : 'Faire ma revue en avance'}</button><button class="btn lien" data-action="vue" data-vue="evolution">Voir l'évolution</button></div>
        </div>
      </div>
      <div class="deux-colonnes">
        <section>
          <h2 class="titre-section">Objectifs à surveiller <span>en retard sur le rythme de l'année</span></h2>
          ${aSurveiller.length ? `<ul class="liste-cartes">${aSurveiller.map(({ o, s, av: x }) => `<li style="${styleDom(o.domaine)}"><button class="carte-ligne" data-action="objectif-maj" data-id="${o.id}"><span class="nom-dom"><i></i><span><b>${esc(o.titre)}</b><small>${esc(domaine(o.domaine)?.nom || '')}</small></span></span><span class="pastille st-${s}">${LIB_STATUT_OBJ[s]}</span>${barre(x, att)}<span class="discret">${x} % · attendu ${att} %</span></button></li>`).join('')}</ul>` : `<p class="aide">${R.objectifsDe(E, a).length ? 'Tous tes objectifs suivent le rythme de l\'année. Bravo.' : 'Aucun objectif pour cette année : choisis-en dans les modèles de chaque domaine.'}</p>`}
          <button class="btn lien" data-action="vue" data-vue="objectifs">Tous les objectifs</button>
        </section>
        <section>
          <h2 class="titre-section">Ce trimestre <span>${pluriel(ouvertes.length, 'action ouverte', 'actions ouvertes')}${retard.length ? `, ${retard.length} en retard` : ''}</span></h2>
          ${ouvertes.length ? `<ul class="actions-liste">${ouvertes.slice(0, 6).map(ligneAction).join('')}</ul>` : '<p class="aide">Aucune action ouverte ce trimestre.</p>'}
          <button class="btn lien" data-action="vue" data-vue="trimestre">Toutes les actions</button>
        </section>
      </div>`;
  }

  // ---------- Objectifs ----------
  function vueObjectifs() {
    const t = auj();
    const a = anneeVue;
    const objs = R.objectifsDe(E, a);
    const sc = R.scoreAnnee(E, a);
    const att = R.scoreAttendu(a, t);
    const aReprendre = R.objectifsDe(E, a - 1).filter((o) => (R.avancementObjectif(o) ?? 0) < 1 && !objs.some((x) => x.repris === o.id)).length;
    const parDom = actifs().map((d) => ({ d, liste: objs.filter((o) => o.domaine === d.id) }));
    const sansDom = objs.filter((o) => !actifs().some((d) => d.id === o.domaine));
    const carte = (o) => {
      const s = R.statutObjectif(o, t);
      const x = R.pourcent(R.avancementObjectif(o));
      return `<article class="objectif" style="${styleDom(o.domaine)}">
        <div class="objectif-tete"><div><h3>${esc(o.titre)}</h3>${o.pourquoi ? `<p class="discret">${esc(o.pourquoi)}</p>` : ''}</div><span class="pastille st-${s}">${LIB_STATUT_OBJ[s]}</span></div>
        <div class="objectif-av">${barre(x, a === R.anneeDe(t) ? att : undefined)}<b>${x ?? '–'} %</b></div>
        <ul class="resultats">${o.resultats.map((r) => {
          const ar = R.pourcent(R.avancementResultat(r));
          return `<li><span class="rc-etat ${ar >= 100 ? 'ok' : ''}" aria-hidden="true">${ar >= 100 ? ICONES.coche : ''}</span><span class="rc-nom">${esc(r.titre)}<small>${r.type === 'case' ? (r.fait ? 'fait' : 'pas encore') : `${nbTexte(r.actuel)} ${esc(r.unite)} · départ ${nbTexte(r.depart)}, cible ${nbTexte(r.cible)}`}</small></span><span class="rc-pct">${ar} %</span></li>`;
        }).join('') || '<li class="discret">Aucun résultat clé : ajoute un chiffre ou un fait vérifiable.</li>'}</ul>
        <div class="objectif-pied"><button class="btn petit primaire" data-action="objectif-maj" data-id="${o.id}">Mettre à jour</button><button class="btn petit" data-action="objectif" data-id="${o.id}">Modifier</button><button class="btn petit lien" data-action="action-nouvelle" data-objectif="${o.id}">${ICONES.plus}Action</button></div>
      </article>`;
    };
    return `
      <div class="vue-tete"><div><h1>Objectifs ${a}</h1><p>${sc === null ? 'Fixe 1 à 3 objectifs par domaine prioritaire, chacun avec des résultats clés mesurables.' : `Score de l'année : <b>${sc} %</b>${a === R.anneeDe(t) ? ` · attendu à date : ${att} %` : ''} · ${pluriel(objs.length, 'objectif')}`}</p></div>
        <div class="actions">
          <div class="nav-mois"><button class="btn-icone" data-action="annee-prec" aria-label="Année précédente">${ICONES.gauche}</button><button class="btn petit" data-action="annee-auj">${R.anneeDe(t)}</button><button class="btn-icone" data-action="annee-suiv" aria-label="Année suivante">${ICONES.droite}</button></div>
          <button class="btn primaire" data-action="objectif-nouveau">${ICONES.plus}Objectif</button>
        </div></div>
      ${aReprendre ? `<div class="bandeau-revue doux"><div><b>${pluriel(aReprendre, 'objectif non atteint', 'objectifs non atteints')} en ${a - 1}.</b><span>Reprends-les en ${a}, en partant de là où tu en étais.</span></div><button class="btn" data-action="reprendre">Reprendre en ${a}</button></div>` : ''}
      <details class="methode"><summary>La méthode en deux phrases</summary><p>${esc(B.methode.okr)}</p><p>Le repère « attendu à date » est la part de l'année écoulée : un objectif au-dessus est dans les temps.</p></details>
      ${objs.length ? parDom.filter((x) => x.liste.length).map(({ d, liste }) => `<section class="groupe-dom" style="${styleDom(d.id)}"><h2 class="theme-titre"><i></i>${esc(d.nom)}<small>${pluriel(liste.length, 'objectif')}</small></h2><div class="objectifs">${liste.map(carte).join('')}</div></section>`).join('')
        + (sansDom.length ? `<section class="groupe-dom"><h2 class="theme-titre">Domaines retirés</h2><div class="objectifs">${sansDom.map(carte).join('')}</div></section>` : '')
        + `<h2 class="titre-section">Domaines sans objectif <span>ajoute un objectif modèle en un geste</span></h2><div class="puces">${parDom.filter((x) => !x.liste.length).map(({ d }) => `<button class="puce" style="${styleDom(d.id)}" data-action="objectif-nouveau" data-domaine="${d.id}"><i></i>${esc(d.nom)}</button>`).join('') || '<span class="discret">Tous tes domaines ont un objectif.</span>'}</div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun objectif en ${a}</h3><p>Commence par les domaines les plus bas de ta roue. Chaque domaine propose des objectifs modèles avec leurs résultats clés.</p><div class="actions"><button class="btn primaire" data-action="objectif-nouveau">${ICONES.plus}Choisir un objectif</button></div></div></div>`}`;
  }

  // ---------- Trimestre ----------
  function ligneAction(x) {
    const d = domaine(x.domaine);
    const o = x.objectif ? objectif(x.objectif) : null;
    const icone = { afaire: '', encours: ICONES.demi, fait: ICONES.coche, abandon: '✕' }[x.statut];
    const sous = [d?.nom, o?.titre, x.reports ? `reportée ${pluriel(x.reports, 'fois', 'fois')}` : ''].filter(Boolean).join(' · ');
    return `<li class="ligne act-${x.statut}" style="${d ? styleDom(d.id) : ''}">
      <button class="cocher" data-action="action-statut" data-id="${x.id}" aria-label="${esc(x.titre)} : ${LIB_STATUT_ACT[x.statut]}. Changer l'état"><span class="pastille-etat" aria-hidden="true">${icone}</span><span class="ligne-nom"><b>${esc(x.titre)}</b>${sous ? `<span>${esc(sous)}</span>` : ''}</span><span class="etat-texte">${LIB_STATUT_ACT[x.statut]}</span></button>
      <button class="btn-icone petit" data-action="action" data-id="${x.id}" aria-label="Modifier « ${esc(x.titre)} »">${ICONES.points}</button></li>`;
  }

  function vueTrimestre() {
    const t = auj();
    const { annee, trimestre } = trimVue;
    const liste = R.actionsDu(E, annee, trimestre);
    const av = R.avancementActions(E, annee, trimestre);
    const courant = annee === R.anneeDe(t) && trimestre === R.trimestreDe(t);
    const retard = courant ? R.actionsEnRetard(E, t) : [];
    const planif = E.revues.find((r) => { const s = R.trimestreSuivant(r.annee, r.trimestre); return (r.type === 'initiale' ? r.annee === annee && r.trimestre === trimestre : s.annee === annee && s.trimestre === trimestre) && r.priorites?.length; });
    const prios = (planif?.priorites || []).filter((id) => domaine(id));
    const groupes = [...actifs().map((d) => ({ d, l: liste.filter((x) => x.domaine === d.id) })), { d: null, l: liste.filter((x) => !domaine(x.domaine)) }].filter((g) => g.l.length);
    const ordre = (l) => [...l].sort((a, b) => R.STATUTS.indexOf(a.statut) - R.STATUTS.indexOf(b.statut));
    return `
      <div class="vue-tete"><div><h1>${majuscule(nomTrim(trimestre))} ${annee}</h1><p>Du ${fmt(R.debutTrimestre(annee, trimestre))} au ${fmt(R.finTrimestre(annee, trimestre), { day: 'numeric', month: 'long', year: 'numeric' })}${av.total ? ` · ${av.faites} sur ${av.total} actions faites` : ''}</p></div>
        <div class="actions">
          <div class="nav-mois"><button class="btn-icone" data-action="trim-prec" aria-label="Trimestre précédent">${ICONES.gauche}</button><button class="btn petit" data-action="trim-auj">Ce trimestre</button><button class="btn-icone" data-action="trim-suiv" aria-label="Trimestre suivant">${ICONES.droite}</button></div>
          <button class="btn primaire" data-action="action-nouvelle">${ICONES.plus}Action</button>
          <button class="btn" data-action="idees">Idées d'actions</button>
        </div></div>
      ${av.total ? `<div class="jauge" aria-hidden="true"><i style="width:${av.taux}%"></i></div>` : ''}
      ${prios.length ? `<p class="priorites"><span class="discret">Priorités choisies à la revue :</span> ${prios.map((id) => `<span class="puce statique" style="${styleDom(id)}"><i></i>${esc(domaine(id).nom)}</span>`).join('')}</p>` : ''}
      ${retard.length ? `<section class="bloc-retard"><h2 class="theme-titre">Restées ouvertes aux trimestres précédents <small>${pluriel(retard.length, 'action')}</small></h2><ul class="actions-liste">${retard.map((x) => `<li class="ligne act-retard" style="${domaine(x.domaine) ? styleDom(x.domaine) : ''}"><span class="ligne-nom" style="padding-left:12px"><b>${esc(x.titre)}</b><span>${esc(`T${x.trimestre} ${x.annee}`)}${domaine(x.domaine) ? ` · ${esc(domaine(x.domaine).nom)}` : ''}</span></span><button class="btn petit" data-action="reporter-ici" data-id="${x.id}">Reporter ici</button><button class="btn petit lien" data-action="abandonner" data-id="${x.id}">Abandonner</button></li>`).join('')}</ul></section>` : ''}
      ${groupes.length ? groupes.map(({ d, l }) => `<section class="theme-jour" style="${d ? styleDom(d.id) : ''}"><h2 class="theme-titre"><i></i>${d ? esc(d.nom) : 'Sans domaine'}</h2><ul class="actions-liste">${ordre(l).map(ligneAction).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune action ce trimestre</h3><p>Trois à huit actions concrètes suffisent : une ou deux par domaine prioritaire.</p><div class="actions"><button class="btn primaire" data-action="action-nouvelle">${ICONES.plus}Ajouter une action</button><button class="btn" data-action="idees">Idées d'actions</button></div></div></div>`}
      <p class="astuce">Touche une action pour la faire passer de « à faire » à « en cours » puis « fait ». Le bouton ··· permet de la modifier, de la reporter au trimestre suivant ou de l'abandonner.</p>`;
  }

  // ---------- Évolution ----------
  function vueEvolution() {
    const ev = R.evolution(E);
    if (!ev.length) return `<div class="vue-tete"><div><h1>Évolution</h1><p>Ta roue, revue après revue.</p></div></div><div class="vide-etat">${FORME_VIDE}<div><h3>Pas encore de revue</h3><p>Note ta roue une première fois : c'est ton point de départ. Chaque revue trimestrielle ajoute un point.</p><div class="actions"><button class="btn primaire" data-action="${E.brouillon ? 'revue-reprendre' : 'revue'}">Noter ma roue</button></div></div></div>`;
    const W = Math.min(largeurVue() - 34, 1100);
    const points = ev.map((l) => ({ x: l.type === 'initiale' ? 'Départ' : `T${l.trimestre} ${String(l.annee).slice(2)}`, y: l.equilibre, info: `<b>${esc(l.libelle)}</b>${fmt(l.date, { day: 'numeric', month: 'long', year: 'numeric' })}<br>Moyenne : ${note10(l.equilibre)}/10${l.score !== null ? `<br>Objectifs : ${l.score} %` : ''}` }));
    const ds = actifs();
    const larMini = estTel() ? Math.max(140, (W - 10) / 2 - 24) : 220;
    const multiples = ds.map((d) => {
      const c = teinte(d.couleur);
      const vals = ev.map((l) => ({ x: '', y: l.notes[d.id] }));
      const notees = vals.filter((v) => v.y !== null);
      const der = notees.at(-1)?.y ?? null, prem = notees[0]?.y ?? null;
      const dlt = der !== null && prem !== null && notees.length > 1 ? R.arrondi1(der - prem) : null;
      return `<div class="mini" style="${styleDom(d.id)}"><div class="mini-tete"><span class="nom-dom"><i></i>${esc(d.nom)}</span><b>${note10(der)}</b></div>${courbeSvg(vals, { largeur: larMini, hauteur: 64, couleur: c.hex, mini: true })}<span class="discret">${dlt === null ? 'une seule note' : `${dlt > 0 ? '+' : ''}${nbTexte(dlt)} depuis le départ`}</span></div>`;
    }).join('');
    const scores = ev.filter((l) => l.score !== null && l.annee === anneeVue);
    const tableau = `<table class="tableau tableau-evo"><thead><tr><th>Revue</th>${ds.map((d) => `<th class="nb">${esc(d.nom)}</th>`).join('')}<th class="nb">Moyenne</th><th class="nb">Objectifs</th></tr></thead><tbody>${ev.map((l) => `<tr><td>${esc(l.libelle)}<small class="discret"> ${fmt(l.date, { day: 'numeric', month: 'short', year: 'numeric' })}</small></td>${ds.map((d) => `<td class="nb">${note10(l.notes[d.id])}</td>`).join('')}<td class="nb"><b>${note10(l.equilibre)}</b></td><td class="nb">${l.score === null ? '–' : `${l.score} %`}</td></tr>`).join('')}</tbody></table>`;
    const revues = [...R.revuesTriees(E)].reverse();
    return `
      <div class="vue-tete"><div><h1>Évolution</h1><p>Ta roue de vie, revue après revue : la moyenne, puis chaque domaine sur la même échelle de 0 à 10.</p></div>
        <div class="actions"><button class="btn" data-action="copier-bilan">Copier le bilan ${anneeVue}</button><button class="btn" data-action="csv">Export CSV</button><button class="btn" data-action="imprimer">Imprimer</button></div></div>
      <div class="graphique">
        <div class="graphique-tete"><h2>Moyenne de la roue</h2><span class="discret">sur 10, ${pluriel(ev.length, 'revue')}</span></div>
        ${courbeSvg(points, { largeur: W, hauteur: estTel() ? 190 : 230 })}
      </div>
      <h2 class="titre-section">Par domaine <span>même échelle de 0 à 10 pour tous</span></h2>
      <div class="multiples">${multiples}</div>
      ${scores.length > 1 ? `<div class="graphique" style="margin-top:20px"><div class="graphique-tete"><h2>Avancement des objectifs ${anneeVue}</h2><span class="discret">moyenne, à chaque revue</span></div>${courbeSvg(scores.map((l) => ({ x: `T${l.trimestre}`, y: l.score, info: `<b>${esc(l.libelle)}</b>Objectifs : ${l.score} %` })), { largeur: W, hauteur: 180, min: 0, max: 100, unite: ' %', graduations: [0, 50, 100], couleur: 'var(--rouge)' })}</div>` : ''}
      <details class="donnees"><summary>Voir les données en tableau</summary><div class="defile">${tableau}</div></details>
      <h2 class="titre-section">Revues <span>bilans écrits et priorités choisies</span></h2>
      <ul class="liste-revues">${revues.map((r) => `<li><button class="carte-ligne" data-action="voir-revue" data-id="${r.id}"><span><b>${esc(R.libelleRevue(r))}</b><small>${fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small></span><span class="discret">${note10(R.equilibre(E, r))}/10</span></button></li>`).join('')}</ul>`;
  }

  function modaleRevue(id) {
    const r = E.revues.find((x) => x.id === id);
    if (!r) return;
    const prec = R.revuePrecedente(E, r);
    const questions = [...B.bilan.trimestrielle, ...B.bilan.annuelle].filter(([k]) => r.bilan?.[k]);
    const corps = `
      <p>${majuscule(fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · moyenne ${note10(R.equilibre(E, r))}/10</p>
      <div class="roue-modale">${roueSvg(r, prec, estTel() ? largeurVue() - 20 : 480)}</div>
      ${r.priorites?.length ? `<p><b>Priorités choisies :</b> ${r.priorites.map((p) => esc(domaine(p)?.nom || '')).filter(Boolean).join(', ')}</p>` : ''}
      ${questions.length ? `<dl class="bilan-lu">${questions.map(([k, q]) => `<dt>${esc(q)}</dt><dd>${esc(r.bilan[k])}</dd>`).join('')}</dl>` : '<p class="discret">Pas de bilan écrit pour cette revue.</p>'}`;
    ouvrirModale(esc(R.libelleRevue(r)), corps, '<button class="btn primaire" value="ok">Fermer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (_, b) => {
      if (b !== 'supprimer') return;
      if (!confirm(`Supprimer la revue « ${R.libelleRevue(r)} » et ses notes ?`)) return '';
      retenir(); E.revues = E.revues.filter((x) => x.id !== r.id); sauver(); rendre();
      toast('Revue supprimée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Revue guidée ----------
  // Étapes : un domaine à la fois (3 questions), résultats clés, bilan écrit, priorités et actions, fin.
  function commencerRevue() {
    const t = auj();
    const per = R.periodeRevue(E, t);
    const type = R.typeRevue(E, per);
    const der = R.derniereRevue(E);
    // Notes reprises de la dernière revue : on ajuste plutôt que repartir de zéro.
    const notes = Object.fromEntries(actifs().map((d) => [d.id, der?.notes?.[d.id] ? [...der.notes[d.id]] : [null, null, null]]));
    E.brouillon = { id: R.nouvelId(), date: t, annee: per.annee, trimestre: per.trimestre, type, notes, reprises: Boolean(der), bilan: {}, priorites: [], actions: [], etape: 0 };
  }
  const etapesRevue = (b) => {
    const l = actifs().map((d) => ({ id: `dom:${d.id}`, nom: d.nom }));
    if (b.type !== 'initiale' && R.objectifsDe(E, b.annee).length) l.push({ id: 'resultats', nom: 'Résultats clés' });
    if (b.type !== 'initiale') l.push({ id: 'bilan', nom: 'Bilan' });
    l.push({ id: 'priorites', nom: 'Priorités' });
    l.push({ id: 'fin', nom: 'Fin' });
    return l;
  };
  const trimCible = (b) => (b.type === 'initiale' ? { annee: b.annee, trimestre: b.trimestre } : R.trimestreSuivant(b.annee, b.trimestre));

  function vueRevue() {
    const b = E.brouillon;
    const etapes = etapesRevue(b);
    b.etape = Math.max(0, Math.min(b.etape, etapes.length - 1));
    const et = etapes[b.etape];
    const titre = b.type === 'initiale' ? 'Point de départ' : b.type === 'annuelle' ? `Bilan de l'année ${b.annee}` : `Revue du ${nomTrim(b.trimestre)} ${b.annee}`;
    const prog = `<div class="etapes-revue" aria-label="Étape ${b.etape + 1} sur ${etapes.length}">${etapes.map((x, i) => `<span class="${i < b.etape ? 'fait' : i === b.etape ? 'actif' : ''}" title="${esc(x.nom)}"></span>`).join('')}</div>`;
    const der = R.derniereRevue(E);
    let corps = '';
    if (et.id.startsWith('dom:')) {
      const d = domaine(et.id.slice(4));
      const n = b.notes[d.id] || [null, null, null];
      const avant = der?.notes?.[d.id];
      corps = `<div class="etape-dom" style="${styleDom(d.id)}">
        <p class="surtitre">Domaine ${b.etape + 1} sur ${actifs().length}</p>
        <h1 class="titre-dom"><i></i>${esc(d.nom)}</h1>
        <p class="intro">Note chaque phrase de 0 (pas du tout) à 10 (tout à fait), pour les trois derniers mois. ${b.reprises ? 'Les notes de ta dernière revue sont reprises : ajuste-les.' : ''}</p>
        <div class="questions">${d.questions.map((q, k) => `<fieldset class="question">
          <legend>${esc(q)}</legend>
          <div class="echelle" role="radiogroup" aria-label="${esc(q)}">${Array.from({ length: 11 }, (_, v) => `<button type="button" role="radio" aria-checked="${n[k] === v}" data-action="note" data-dom="${d.id}" data-q="${k}" data-v="${v}">${v}</button>`).join('')}</div>
          <p class="echelle-bornes"><span>Pas du tout</span>${avant && R.noteValide(avant[k]) ? `<span class="discret">dernière fois : ${avant[k]}</span>` : ''}<span>Tout à fait</span></p>
        </fieldset>`).join('')}</div>
        <p class="note-dom">Note du domaine : <b>${note10(R.noteDomaine(n))}</b>/10 <button class="btn lien" data-action="note-passer" data-dom="${d.id}">Je ne note pas ce domaine</button></p>
      </div>`;
    } else if (et.id === 'resultats') {
      const objs = R.objectifsDe(E, b.annee);
      corps = `<p class="surtitre">Objectifs ${b.annee}</p><h1>Où en sont tes résultats clés ?</h1>
        <p class="intro">Mets à jour les chiffres atteints et coche ce qui est fait. Le score de l'année se recalcule.</p>
        <div class="objectifs">${objs.map((o) => `<article class="objectif" style="${styleDom(o.domaine)}"><div class="objectif-tete"><h3>${esc(o.titre)}</h3><b>${R.pourcent(R.avancementObjectif(o)) ?? '–'} %</b></div>
          ${o.resultats.map((r) => r.type === 'case'
            ? `<label class="case"><input type="checkbox" data-action="rc-case" data-obj="${o.id}" data-rc="${r.id}" ${r.fait ? 'checked' : ''}> ${esc(r.titre)}</label>`
            : `<label class="champ rc-champ">${esc(r.titre)} <small>départ ${nbTexte(r.depart)}, cible ${nbTexte(r.cible)} ${esc(r.unite)}</small><input inputmode="decimal" data-rc-valeur data-obj="${o.id}" data-rc="${r.id}" value="${nbTexte(r.actuel)}"></label>`).join('')}
        </article>`).join('')}</div>`;
    } else if (et.id === 'bilan') {
      const qs = [...B.bilan.trimestrielle, ...(b.type === 'annuelle' ? B.bilan.annuelle : [])];
      corps = `<p class="surtitre">${b.type === 'annuelle' ? 'Bilan de l\'année' : 'Bilan du trimestre'}</p><h1>Qu'est-ce que ce trimestre t'a appris ?</h1>
        <p class="intro">Quelques mots suffisent. Tu relis ces réponses à la revue suivante.</p>
        <div class="bilan-champs">${qs.map(([k, q, aide]) => `<label class="champ">${esc(q)} <small>${esc(aide)}</small><textarea rows="2" data-bilan="${k}" maxlength="600">${esc(b.bilan[k] || '')}</textarea></label>`).join('')}</div>`;
    } else if (et.id === 'priorites') {
      const cible = trimCible(b);
      const faibles = R.domainesFaibles(E, b, der && der.id !== b.id ? der : null, 3);
      const ordre = [...faibles, ...actifs().map((d) => d.id).filter((id) => !faibles.includes(id))];
      corps = `<p class="surtitre">${majuscule(nomTrim(cible.trimestre))} ${cible.annee}</p><h1>Sur quoi mettre ton énergie ?</h1>
        <p class="intro">Choisis 1 à 3 domaines prioritaires pour le trimestre ${b.type === 'initiale' ? 'en cours' : 'qui vient'}, puis ajoute quelques actions concrètes. Les domaines les plus bas de ta roue sont proposés en premier.</p>
        <div class="puces" role="group" aria-label="Domaines prioritaires">${ordre.map((id) => { const d = domaine(id); const nt = R.noteDomaine(b.notes[id]); return `<button class="puce" style="${styleDom(id)}" aria-pressed="${b.priorites.includes(id)}" data-action="priorite" data-id="${id}"><i></i>${esc(d.nom)} <small>${note10(nt)}/10</small>${faibles.includes(id) ? ' <small class="etiquette">suggéré</small>' : ''}</button>`; }).join('')}</div>
        ${b.priorites.map((id) => { const d = domaine(id); const deja = b.actions.filter((x) => x.domaine === id); return `<section class="prio" style="${styleDom(id)}"><h2 class="theme-titre"><i></i>${esc(d.nom)}</h2>
          ${deja.length ? `<ul class="prio-actions">${deja.map((x) => `<li>${esc(x.titre)} <button class="btn petit lien" data-action="prio-retirer" data-id="${x.id}">Retirer</button></li>`).join('')}</ul>` : ''}
          <div class="routines-rapides">${(B.actions[d.modele] || []).filter((s) => !deja.some((x) => x.titre === s)).map((s) => `<button type="button" class="btn petit" data-action="prio-ajouter" data-dom="${id}" data-titre="${esc(s)}">${ICONES.plus}${esc(s)}</button>`).join('')}</div>
          <form class="ajout-rapide" data-dom="${id}"><label class="sr-only" for="prio-${id}">Autre action pour ${esc(d.nom)}</label><input id="prio-${id}" maxlength="90" placeholder="Une autre action…" autocomplete="off"><button class="btn petit" type="submit">Ajouter</button></form></section>`; }).join('')}`;
    } else {
      const eq = R.equilibre(E, b);
      const cible = trimCible(b);
      corps = `<p class="surtitre">Dernière étape</p><h1>Ta roue est à <mark>${note10(eq)}/10</mark>.</h1>
        <div class="deux-colonnes"><div class="graphique">${roueSvg(b, der && der.id !== b.id ? der : null, Math.min(520, estTel() ? largeurVue() - 34 : 480))}${der ? `<p class="legende-roue"><span><i class="plein"></i>Cette revue</span><span><i class="pointille"></i>${esc(R.libelleRevue(der))}</span></p>` : ''}</div>
        <div><ul class="resume">
          <li><b>${actifs().filter((d) => R.noteDomaine(b.notes[d.id]) !== null).length}</b> domaines notés sur ${actifs().length}</li>
          <li><b>${b.priorites.length}</b> ${b.priorites.length > 1 ? 'domaines prioritaires' : 'domaine prioritaire'}${b.priorites.length ? ` : ${b.priorites.map((id) => esc(domaine(id).nom)).join(', ')}` : ''}</li>
          <li><b>${b.actions.length}</b> ${b.actions.length > 1 ? 'actions ajoutées' : 'action ajoutée'} au ${nomTrim(cible.trimestre)} ${cible.annee}</li>
          ${b.type !== 'initiale' ? `<li><b>${Object.values(b.bilan).filter((v) => String(v).trim()).length}</b> réponses au bilan</li>` : ''}
        </ul><p class="aide">${esc(B.methode.revue)}</p></div></div>`;
    }
    const derniere = b.etape === etapes.length - 1;
    return `<div class="revue">
      <div class="revue-tete"><div><p class="surtitre">${esc(titre)}</p>${prog}</div><button class="btn petit" data-action="revue-quitter">Continuer plus tard</button></div>
      ${corps}
      <p class="erreur" id="erreur-revue" role="alert"></p>
      <div class="accueil-pied">
        ${b.etape ? '<button class="btn" data-action="revue-prec">Retour</button>' : `<button class="btn lien" data-action="revue-abandon">${E.revues.length ? 'Abandonner cette revue' : 'Plus tard'}</button>`}
        ${derniere ? '<button class="btn primaire" data-action="revue-fin">Enregistrer la revue</button>' : `<button class="btn primaire" data-action="revue-suiv">${et.id.startsWith('dom:') && R.noteDomaine(b.notes[et.id.slice(4)]) === null ? 'Passer' : 'Continuer'}</button>`}
      </div></div>`;
  }

  function lireChampsRevue() {
    const b = E.brouillon;
    if (!b) return;
    document.querySelectorAll('[data-bilan]').forEach((el) => { b.bilan[el.dataset.bilan] = el.value; });
    document.querySelectorAll('[data-rc-valeur]').forEach((el) => {
      const r = objectif(el.dataset.obj)?.resultats.find((x) => x.id === el.dataset.rc);
      const v = R.lireNombre(el.value);
      if (r && v !== null) r.actuel = v;
    });
  }

  function terminerRevue() {
    lireChampsRevue();
    const b = E.brouillon;
    if (R.equilibre(E, b) === null) { $('#erreur-revue').textContent = 'Note au moins un domaine pour enregistrer la revue.'; return; }
    retenir();
    const cible = trimCible(b);
    const revue = { id: b.id, date: auj(), annee: b.annee, trimestre: b.trimestre, type: b.type, notes: b.notes, bilan: Object.fromEntries(Object.entries(b.bilan).filter(([, v]) => String(v).trim())), priorites: b.priorites, avancement: R.photoAvancement(E, b.annee) };
    E.revues.push(revue);
    for (const x of b.actions) E.actions.push({ id: x.id, annee: cible.annee, trimestre: cible.trimestre, domaine: x.domaine, objectif: null, titre: x.titre, statut: 'afaire', reports: 0 });
    E.brouillon = null;
    trimVue = { ...cible };
    sauver();
    changerVue('tableau');
    toast(`Revue enregistrée : ${R.libelleRevue(revue)}. Ta roue est à jour.`, { libelle: 'Annuler', faire: annuler });
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const optionsDomaines = (sel, vide = false) => `${vide ? '<option value="">Sans domaine</option>' : ''}${actifs().map((d) => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}`;

  function ligneRc(r, i) {
    const x = r || { titre: '', type: 'nombre', depart: '', cible: '', unite: '' };
    return `<fieldset class="rc-ligne" data-i="${i}"><legend>Résultat clé ${i + 1}${i ? ' <small>facultatif</small>' : ''}</legend>
      <input type="hidden" name="rc-id-${i}" value="${esc(r?.id || '')}">
      <label class="champ">Intitulé<input name="rc-titre-${i}" maxlength="90" value="${esc(x.titre)}" placeholder="Ex. : livres lus"></label>
      <div class="rang-champs">
        <label class="champ">Mesure<select name="rc-type-${i}"><option value="nombre" ${x.type !== 'case' ? 'selected' : ''}>Un chiffre</option><option value="case" ${x.type === 'case' ? 'selected' : ''}>Fait / pas fait</option></select></label>
        <label class="champ rc-num">Départ<input name="rc-depart-${i}" inputmode="decimal" value="${x.type === 'case' ? '' : nbTexte(x.depart)}"></label>
        <label class="champ rc-num">Cible<input name="rc-cible-${i}" inputmode="decimal" value="${x.type === 'case' ? '' : nbTexte(x.cible)}"></label>
        <label class="champ rc-num">Unité<input name="rc-unite-${i}" list="unites" maxlength="16" value="${esc(x.unite || '')}"></label>
      </div></fieldset>`;
  }

  function modaleObjectif(id, defaut = {}) {
    const o = id ? objectif(id) : null;
    const dom = o?.domaine || defaut.domaine || actifs()[0]?.id;
    const x = o || { titre: '', pourquoi: '', resultats: [] };
    const modeles = (idDom) => (B.objectifs[domaine(idDom)?.modele] || []);
    const corps = `
      <label class="champ">Domaine<select name="domaine" id="obj-domaine">${optionsDomaines(dom)}</select></label>
      ${o ? '' : `<div class="modeles" id="obj-modeles"></div>`}
      <label class="champ">Objectif <small>ce que tu veux, en mots qui motivent</small><input name="titre" maxlength="90" value="${esc(x.titre)}" required placeholder="Ex. : retrouver la forme"></label>
      <label class="champ">Pourquoi <small>facultatif, pour t'en souvenir les jours sans</small><input name="pourquoi" maxlength="140" value="${esc(x.pourquoi)}"></label>
      <div id="obj-rc">${[0, 1, 2].map((i) => ligneRc(x.resultats[i], i)).join('')}</div>
      <datalist id="unites">${B.unites.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
      <p class="aide">Une cible plus basse que le départ se lit « réduire à » (dépenses, temps d'écran…). Les valeurs atteintes se mettent à jour ensuite avec « Mettre à jour ».</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${o ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(o ? 'Modifier l\'objectif' : `Nouvel objectif ${anneeVue}`, corps, pied, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (!confirm(`Supprimer l'objectif « ${o.titre} » ? Les actions liées sont gardées, sans lien.`)) return '';
        retenir();
        E.objectifs = E.objectifs.filter((y) => y.id !== o.id);
        E.actions.forEach((a) => { if (a.objectif === o.id) a.objectif = null; });
        sauver(); rendre(); toast('Objectif supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const resultats = [0, 1, 2].map((i) => {
        const titre = String(f.get(`rc-titre-${i}`) || '').trim();
        if (!titre) return null;
        const type = f.get(`rc-type-${i}`) === 'case' ? 'case' : 'nombre';
        const ancien = o?.resultats.find((r) => r.id === f.get(`rc-id-${i}`));
        if (type === 'case') return { id: ancien?.id || R.nouvelId(), titre, type, fait: ancien?.type === 'case' ? ancien.fait : false };
        const depart = R.lireNombre(f.get(`rc-depart-${i}`)), cible = R.lireNombre(f.get(`rc-cible-${i}`));
        return { id: ancien?.id || R.nouvelId(), titre, type, depart: depart ?? NaN, cible: cible ?? NaN, actuel: ancien?.type === 'nombre' ? ancien.actuel : depart, unite: String(f.get(`rc-unite-${i}`) || '').trim() };
      }).filter(Boolean);
      const brut = { titre: String(f.get('titre') || '').trim(), pourquoi: String(f.get('pourquoi') || '').trim(), domaine: f.get('domaine'), resultats };
      const err = R.verifierObjectif(brut);
      if (err) return err;
      if (!resultats.length) return 'Ajoute au moins un résultat clé : un chiffre ou un fait qui dit que tu as réussi.';
      retenir();
      brut.resultats = brut.resultats.map(R.normaliserResultat);
      if (o) Object.assign(o, brut); else E.objectifs.push({ id: R.nouvelId(), annee: anneeVue, ...brut });
      sauver(); rendre(); toast('Objectif enregistré.', { libelle: 'Annuler', faire: annuler });
    });
    if (o) return;
    const form = modale().querySelector('form');
    const majModeles = () => {
      const l = modeles(form.domaine.value);
      $('#obj-modeles').innerHTML = l.length ? `<p class="mini-titre">Partir d'un modèle</p><div class="routines-rapides">${l.map((m, i) => `<button type="button" class="btn petit" data-action="modele" data-i="${i}">${esc(m.titre)}</button>`).join('')}</div>` : '';
    };
    form.domaine.addEventListener('change', majModeles);
    majModeles();
    form.addEventListener('click', (e) => {
      const bt = e.target.closest('[data-action="modele"]');
      if (!bt) return;
      e.stopPropagation();
      const m = modeles(form.domaine.value)[Number(bt.dataset.i)];
      form.titre.value = m.titre; form.pourquoi.value = m.pourquoi || '';
      $('#obj-rc').innerHTML = [0, 1, 2].map((i) => ligneRc(m.resultats[i] ? { ...m.resultats[i], id: '' } : null, i)).join('');
      form.querySelectorAll('.routines-rapides .btn').forEach((y) => y.removeAttribute('aria-pressed'));
      bt.setAttribute('aria-pressed', 'true');
    });
  }

  function modaleMaj(id) {
    const o = objectif(id);
    if (!o) return;
    const corps = `<p class="discret">${esc(domaine(o.domaine)?.nom || '')} · avancement ${R.pourcent(R.avancementObjectif(o)) ?? '–'} %</p>
      ${o.resultats.map((r) => r.type === 'case'
        ? `<label class="case"><input type="checkbox" name="rc-${r.id}" ${r.fait ? 'checked' : ''}> ${esc(r.titre)}</label>`
        : `<label class="champ">${esc(r.titre)} <small>départ ${nbTexte(r.depart)}, cible ${nbTexte(r.cible)} ${esc(r.unite)}</small><input name="rc-${r.id}" inputmode="decimal" value="${nbTexte(r.actuel)}"></label>`).join('') || '<p>Cet objectif n\'a pas encore de résultat clé : modifie-le pour en ajouter.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(o.titre), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      for (const r of o.resultats) if (r.type === 'nombre' && R.lireNombre(f.get(`rc-${r.id}`)) === null) return `« ${r.titre} » : saisis un nombre, par exemple 12 ou 2,5.`;
      retenir();
      for (const r of o.resultats) { if (r.type === 'case') r.fait = f.get(`rc-${r.id}`) === 'on'; else r.actuel = R.lireNombre(f.get(`rc-${r.id}`)); }
      sauver(); rendre();
      const av = R.pourcent(R.avancementObjectif(o));
      toast(av >= 100 ? `« ${o.titre} » : objectif atteint.` : `« ${o.titre} » : ${av} %.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleAction(id, defaut = {}) {
    const x = id ? action(id) : null;
    const o = defaut.objectif ? objectif(defaut.objectif) : null;
    const v = x || { titre: '', domaine: o?.domaine || defaut.domaine || actifs()[0]?.id || '', objectif: o?.id || null, statut: 'afaire', annee: trimVue.annee, trimestre: trimVue.trimestre };
    const objs = E.objectifs.filter((y) => y.annee === v.annee);
    const corps = `
      <label class="champ">Action <small>concrète, faisable dans le trimestre</small><input name="titre" maxlength="90" value="${esc(v.titre)}" required placeholder="Ex. : réserver un week-end à deux"></label>
      <div class="rang-champs"><label class="champ">Domaine<select name="domaine">${optionsDomaines(v.domaine, true)}</select></label>
      <label class="champ">Objectif lié<select name="objectif"><option value="">Aucun</option>${objs.map((y) => `<option value="${y.id}" ${y.id === v.objectif ? 'selected' : ''}>${esc(y.titre)}</option>`).join('')}</select></label></div>
      ${x ? `<fieldset class="champ"><legend>État</legend><div class="choix-radio ligne-radio">${R.STATUTS.map((s) => `<label class="case"><input type="radio" name="statut" value="${s}" ${x.statut === s ? 'checked' : ''}> ${LIB_STATUT_ACT[s]}</label>`).join('')}</div></fieldset>` : ''}
      <p class="aide">${x ? `Prévue au ${nomTrim(x.trimestre)} ${x.annee}${x.reports ? `, reportée ${pluriel(x.reports, 'fois', 'fois')}` : ''}.` : `Ajoutée au ${nomTrim(v.trimestre)} ${v.annee}.`}</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn gauche" value="reporter">Reporter au trimestre suivant</button><button class="btn danger" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(x ? 'Modifier l\'action' : 'Nouvelle action', corps, pied, (f, bouton) => {
      if (bouton === 'supprimer') { retenir(); E.actions = E.actions.filter((y) => y.id !== x.id); sauver(); rendre(); toast('Action supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      if (bouton === 'reporter') { retenir(); R.reporter(x); sauver(); rendre(); toast(`Reportée au ${nomTrim(x.trimestre)} ${x.annee}.`, { libelle: 'Annuler', faire: annuler }); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Décris l\'action en quelques mots.';
      const brut = { titre, domaine: f.get('domaine') || null, objectif: f.get('objectif') || null };
      const obj = brut.objectif ? objectif(brut.objectif) : null;
      if (obj && !brut.domaine) brut.domaine = obj.domaine;
      retenir();
      if (x) Object.assign(x, brut, { statut: f.get('statut') || x.statut });
      else E.actions.push({ id: R.nouvelId(), annee: v.annee, trimestre: v.trimestre, statut: 'afaire', reports: 0, ...brut });
      sauver(); rendre(); toast('Action enregistrée.');
    });
  }

  function modaleIdees() {
    const corps = `<p>Touche une idée pour l'ajouter au ${nomTrim(trimVue.trimestre)} ${trimVue.annee}.</p>
      ${actifs().map((d) => `<fieldset class="choix-theme" style="${styleDom(d.id)}"><legend><i></i>${esc(d.nom)}</legend><div class="routines-rapides">${(B.actions[d.modele] || []).map((s) => `<button type="button" class="btn petit" data-action="idee-ajouter" data-dom="${d.id}" data-titre="${esc(s)}">${ICONES.plus}${esc(s)}</button>`).join('') || '<span class="discret">Pas d\'idée type pour ce domaine personnel.</span>'}</div></fieldset>`).join('')}`;
    ouvrirModale('Idées d\'actions', corps, '<button class="btn primaire" value="ok">Fermer</button>');
  }

  function modaleDomaine(id) {
    const d = id ? domaine(id) : null;
    const prises = new Set(actifs().filter((x) => x.id !== id).map((x) => x.couleur));
    const libre = R.couleurLibre(E, B);
    if (!d && !libre) { toast(`${R.MAX_DOMAINES} domaines au plus, une couleur chacun : retire un domaine avant d'en ajouter un.`); return; }
    const x = d || { nom: '', couleur: libre, questions: ['', '', ''] };
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="40" value="${esc(x.nom)}" required placeholder="Ex. : Spiritualité"></label>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${esc(c.nom)}"><input type="radio" name="couleur" value="${c.id}" ${c.id === x.couleur ? 'checked' : ''} ${prises.has(c.id) ? 'disabled' : ''}><span class="${prises.has(c.id) ? 'prise' : ''}" style="--c:${c.hex}"></span><span class="sr-only">${esc(c.nom)}${prises.has(c.id) ? ' (déjà prise)' : ''}</span></label>`).join('')}</div></fieldset>
      ${[0, 1, 2].map((k) => `<label class="champ">Question ${k + 1} <small>notée de 0 à 10 ; 10 = la situation que tu souhaites</small><input name="q${k}" maxlength="140" value="${esc(x.questions[k] || '')}"></label>`).join('')}
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${d ? '<button class="btn danger gauche" value="retirer">Retirer de la roue</button>' : ''}`;
    ouvrirModale(d ? 'Modifier le domaine' : 'Nouveau domaine', corps, pied, (f, bouton) => {
      if (bouton === 'retirer') {
        if (actifs().length <= 3) return 'Garde au moins 3 domaines dans ta roue.';
        if (!confirm(`Retirer « ${d.nom} » de la roue ? Ses notes passées et ses objectifs sont gardés.`)) return '';
        retenir(); d.archive = true; sauver(); modaleReglages(); rendre(); toast(`« ${d.nom} » retiré de la roue.`, { libelle: 'Annuler', faire: annuler }); return '';
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au domaine.';
      const questions = [0, 1, 2].map((k) => String(f.get(`q${k}`) || '').trim()).filter(Boolean);
      if (!questions.length) return 'Écris au moins une question pour noter ce domaine.';
      retenir();
      if (d) Object.assign(d, { nom, couleur: f.get('couleur') || d.couleur, questions });
      else E.domaines.push({ id: R.nouvelId(), modele: null, nom, couleur: f.get('couleur') || libre, questions, archive: false });
      sauver(); rendre(); modaleReglages(); return '';
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const absents = B.domaines.filter((m) => !actifs().some((d) => d.modele === m.id));
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Domaines de la roue <small class="discret">${actifs().length} sur ${R.MAX_DOMAINES} au plus</small></h3>
        <ul class="liste-domaines">${actifs().map((d) => `<li style="${styleDom(d.id)}"><button type="button" class="ligne-gestion" data-action="domaine" data-id="${d.id}"><span class="nom-dom"><i></i><b>${esc(d.nom)}</b></span><span>${pluriel(d.questions.length, 'question')}</span></button></li>`).join('')}</ul>
        <div class="rang">${actifs().length < R.MAX_DOMAINES ? `<button class="btn petit" type="button" data-action="domaine-nouveau">${ICONES.plus}Domaine personnel</button>${absents.length ? `<select id="ajout-domaine" aria-label="Ajouter un domaine de la base"><option value="">Ajouter un domaine type…</option>${absents.map((m) => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select>` : ''}` : '<span class="discret">Roue complète : retire un domaine pour en ajouter un.</span>'}</div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie (JSON)</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Notes en CSV</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(B.methode.roue)} Outil de réflexion personnelle : il ne remplace pas l'accompagnement d'un professionnel (coach, médecin, psychologue) si tu traverses une période difficile.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#ajout-domaine')?.addEventListener('change', (e) => {
      if (!e.target.value) return;
      retenir(); R.ajouterDomaines(E, [e.target.value], B); sauver(); rendre(); modaleReglages();
      toast('Domaine ajouté : il sera noté à ta prochaine revue.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.domaines) || !Array.isArray(d.revues) || !Array.isArray(d.objectifs)) throw new Error();
        if (!confirm(`Remplacer ton tableau actuel par cette copie (${pluriel(d.revues.length, 'revue')}, ${pluriel(d.objectifs.length, 'objectif')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du tableau de bord annuel.'); }
    });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `tableau-annuel-${auj()}.json`);
  const exporterCsv = () => telecharger('﻿' + R.versCsv(E), 'text/csv;charset=utf-8', `roue-de-vie-${auj()}.csv`);

  // ---------- Infobulles des graphiques ----------
  let infobulle = null;
  function brancherInfobulles() {
    document.querySelectorAll('.graphique, .roue-modale').forEach((zone) => {
      const montrer = (el) => {
        document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol'));
        el.classList.add('survol');
        if (!infobulle) { infobulle = document.createElement('div'); infobulle.className = 'infobulle'; infobulle.setAttribute('role', 'tooltip'); }
        zone.appendChild(infobulle);
        infobulle.innerHTML = el.dataset.info;
        const rz = zone.getBoundingClientRect(), re = el.getBoundingClientRect();
        const cx = re.left - rz.left + re.width / 2;
        const x = Math.min(rz.width - infobulle.offsetWidth - 8, Math.max(8, cx - infobulle.offsetWidth / 2));
        infobulle.style.left = `${x}px`;
        infobulle.style.top = `${Math.max(8, re.top - rz.top + re.height / 2 - infobulle.offsetHeight - 16)}px`;
      };
      const cacher = () => { infobulle?.remove(); document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      zone.querySelectorAll('[data-info]').forEach((el) => {
        if (!el.dataset.info) return;
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('pointerleave', cacher);
        el.addEventListener('blur', cacher);
      });
    });
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
      <p>Enregistre ton tableau de bord sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  function toast(texte, act) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${act ? `<button type="button">${esc(act.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (act) el.querySelector('button').onclick = () => { el.hidden = true; act.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, act ? 7000 : 5000);
  }

  // ---------- Actions ----------
  const trimDecaler = (k) => { trimVue = R.trimestreSuivant(trimVue.annee, trimVue.trimestre, k); rendre(); };
  function ajouterAction(dom, titre, message = true) {
    retenir();
    E.actions.push({ id: R.nouvelId(), annee: trimVue.annee, trimestre: trimVue.trimestre, domaine: dom, objectif: null, titre, statut: 'afaire', reports: 0 });
    sauver(); rendre();
    if (message) toast(`« ${titre} » ajoutée au ${nomTrim(trimVue.trimestre)}.`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    const b = E?.brouillon;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); vue = 'tableau'; rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'choix-domaine': {
        if (accueil.choix.has(id)) accueil.choix.delete(id);
        else if (accueil.choix.size >= R.MAX_DOMAINES) { $('#erreur-accueil').textContent = `${R.MAX_DOMAINES} domaines au plus : retire-en un avant d'en ajouter un autre.`; break; }
        else accueil.choix.add(id);
        el.setAttribute('aria-pressed', String(accueil.choix.has(id)));
        $('#compte-domaines').textContent = `${pluriel(accueil.choix.size, 'domaine choisi', 'domaines choisis')} sur ${R.MAX_DOMAINES} au plus`;
        $('#erreur-accueil').textContent = '';
        break;
      }
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); if (vue === 'revue') lireChampsRevue(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      // Revue guidée
      case 'revue': commencerRevue(); sauver(); changerVue('revue'); break;
      case 'revue-reprendre': changerVue('revue'); break;
      case 'revue-suiv': lireChampsRevue(); b.etape++; sauver(); rendre(); window.scrollTo({ top: 0 }); break;
      case 'revue-prec': lireChampsRevue(); b.etape--; sauver(); rendre(); window.scrollTo({ top: 0 }); break;
      case 'revue-quitter': lireChampsRevue(); sauver(); changerVue('tableau'); toast('Revue gardée : reprends-la quand tu veux depuis le tableau de bord.'); break;
      case 'revue-abandon': if (!E.revues.length || confirm('Abandonner cette revue ? Les notes saisies seront perdues.')) { E.brouillon = null; sauver(); changerVue('tableau'); } break;
      case 'revue-fin': terminerRevue(); break;
      case 'note': {
        const l = b.notes[el.dataset.dom] || (b.notes[el.dataset.dom] = [null, null, null]);
        const v = Number(el.dataset.v), k = Number(el.dataset.q);
        l[k] = l[k] === v ? null : v;
        sauver(); lireChampsRevue(); rendre();
        document.querySelector(`[data-action="note"][data-dom="${el.dataset.dom}"][data-q="${k}"][data-v="${v}"]`)?.focus({ preventScroll: true });
        break;
      }
      case 'note-passer': b.notes[el.dataset.dom] = [null, null, null]; b.etape++; sauver(); rendre(); window.scrollTo({ top: 0 }); break;
      case 'rc-case': { const r = objectif(el.dataset.obj)?.resultats.find((x) => x.id === el.dataset.rc); if (r) { r.fait = el.checked; lireChampsRevue(); sauver(); rendre(); } break; }
      case 'priorite': {
        lireChampsRevue();
        if (b.priorites.includes(id)) { b.priorites = b.priorites.filter((x) => x !== id); b.actions = b.actions.filter((x) => x.domaine !== id); }
        else if (b.priorites.length >= 3) { $('#erreur-revue').textContent = 'Trois domaines prioritaires au plus : c\'est ce qui les rend prioritaires.'; break; }
        else b.priorites.push(id);
        sauver(); rendre(); break;
      }
      case 'prio-ajouter': b.actions.push({ id: R.nouvelId(), domaine: el.dataset.dom, titre: el.dataset.titre }); sauver(); rendre(); break;
      case 'prio-retirer': b.actions = b.actions.filter((x) => x.id !== id); sauver(); rendre(); break;
      // Objectifs
      case 'annee-prec': anneeVue--; rendre(); break;
      case 'annee-suiv': anneeVue++; rendre(); break;
      case 'annee-auj': anneeVue = R.anneeDe(auj()); rendre(); break;
      case 'objectif-nouveau': modaleObjectif(null, { domaine: el.dataset.domaine }); break;
      case 'objectif': modaleObjectif(id); break;
      case 'objectif-maj': modaleMaj(id); break;
      case 'reprendre': { retenir(); const n = R.reprendreObjectifs(E, anneeVue - 1, anneeVue); sauver(); rendre(); toast(`${pluriel(n, 'objectif repris', 'objectifs repris')} en ${anneeVue}, depuis les valeurs atteintes.`, { libelle: 'Annuler', faire: annuler }); break; }
      // Actions
      case 'trim-prec': trimDecaler(-1); break;
      case 'trim-suiv': trimDecaler(1); break;
      case 'trim-auj': trimVue = { annee: R.anneeDe(auj()), trimestre: R.trimestreDe(auj()) }; rendre(); break;
      case 'action-nouvelle': modaleAction(null, { objectif: el.dataset.objectif }); break;
      case 'action': modaleAction(id); break;
      case 'action-statut': {
        const x = action(id); if (!x) break;
        retenir(); x.statut = R.statutSuivant(x.statut); sauver(); rendre();
        if (x.statut === 'afaire') toast(`« ${x.titre} » : à faire.`, { libelle: 'Annuler', faire: annuler });
        document.querySelector(`[data-action="action-statut"][data-id="${id}"]`)?.focus({ preventScroll: true });
        break;
      }
      case 'reporter-ici': { const x = action(id); if (x) { retenir(); R.reporter(x, trimVue); sauver(); rendre(); toast(`« ${x.titre} » reportée à ce trimestre.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'abandonner': { const x = action(id); if (x) { retenir(); x.statut = 'abandon'; sauver(); rendre(); toast(`« ${x.titre} » abandonnée.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'idees': modaleIdees(); break;
      case 'idee-ajouter': ajouterAction(el.dataset.dom, el.dataset.titre); el.disabled = true; el.textContent = 'Ajoutée'; break;
      // Domaines
      case 'domaine': modaleDomaine(id); break;
      case 'domaine-nouveau': modaleDomaine(); break;
      // Évolution
      case 'voir-revue': modaleRevue(id); break;
      case 'copier-bilan': {
        const texte = R.texteBilan(E, B, anneeVue, auj());
        (navigator.clipboard?.writeText(texte) || Promise.reject()).then(() => toast('Bilan copié : colle-le où tu veux.'), () => ouvrirModale('Bilan à copier', `<label class="champ">Sélectionne et copie ce texte<textarea rows="12" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>'));
        break;
      }
      default: break;
    }
  });

  // Ajout rapide d'une action pendant la revue (étape Priorités).
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('.ajout-rapide');
    if (!f || !E?.brouillon) return;
    e.preventDefault();
    const titre = f.querySelector('input').value.trim();
    if (!titre) return;
    lireChampsRevue();
    E.brouillon.actions.push({ id: R.nouvelId(), domaine: f.dataset.dom, titre });
    sauver(); rendre();
    $(`#prio-${f.dataset.dom}`)?.focus();
  });
  // Les textes du bilan et les chiffres atteints sont gardés au fil de la saisie (sans re-rendu).
  let minuterieSaisie = null;
  document.addEventListener('input', (e) => {
    if (!E?.brouillon || !e.target.closest('.revue')) return;
    clearTimeout(minuterieSaisie);
    minuterieSaisie = setTimeout(() => { lireChampsRevue(); sauver(); }, 500);
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  let largeurAvant = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeurAvant) > 40 && E && $('#vue') && !modale().open && vue !== 'revue') { largeurAvant = window.innerWidth; rendre(); } });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'revue') rendre();
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
  window.__tableauAnnuel = { etat: () => E, regles: R };
  init();
})();
