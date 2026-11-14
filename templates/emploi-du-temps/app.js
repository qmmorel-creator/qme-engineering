// Emploi du temps d'établissement QME : groupes, formateurs, salles, modules, séances placées à la main sur
// une grille semaine, conflits détectés en direct, vues par groupe, formateur et salle, heures prévues,
// placées et réalisées, duplication de semaine, impression A4 paysage et export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucune optimisation automatique, aucune
// connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.EDT;
  const API = '/api/templates';
  const PRODUIT = 'EDT';
  const CLE_CODE = 'qme-edt-code';
  const CLE_CACHE = 'qme-edt-cache';
  const CLE_DEMO = 'qme-edt-demo';
  const CLE_PREF = 'qme-edt-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-edt-ecran-accueil';

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
  const deux = R.deux;
  const auj = () => R.iso(new Date());
  const maintenant = () => { const d = new Date(); return { date: R.iso(d), heure: `${deux(d.getHours())}:${deux(d.getMinutes())}` }; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const hT = R.heuresTexte;
  const jourCourt = (d) => `${R.JOURS_COURTS[R.jourSem(d)]} ${R.versDate(d).getDate()}`;
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const moisCourt = (d) => MOIS_C[R.versDate(d).getMonth()];
  const dateCourte = (d) => R.versDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'planning';
  const pref = stock.lire(CLE_PREF) || {};
  const plan = { type: ['groupe', 'formateur', 'salle'].includes(pref.type) ? pref.type : 'groupe', id: pref.id || '', lundi: '', jour: '' };
  const filtre = { conflits: 'avenir', typeConflit: '', heures: '', ressources: 'groupes' };
  let annulation = null;
  let C = { liste: [], parSeance: new Map() }; // conflits, recalculés à chaque rendu
  let SEM = []; // semaines de l'année

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const trouver = (l, id) => (E[l] || []).find((x) => x.id === id);
  const groupe = (id) => trouver('groupes', id);
  const formateur = (id) => trouver('formateurs', id);
  const salle = (id) => trouver('salles', id);
  const module_ = (id) => trouver('modules', id);
  const nomG = (id) => groupe(id)?.nom || '';
  const nomF = (id) => formateur(id)?.nom || '';
  const nomS = (id) => salle(id)?.nom || '';
  const groupeSeance = (s) => module_(s.module)?.groupe || '';
  const couleur = (m) => B.couleurs[(m?.couleur || 0) % B.couleurs.length];
  const LISTE_TYPE = { groupe: 'groupes', formateur: 'formateurs', salle: 'salles' };
  const NOM_TYPE = { groupe: 'Groupe', formateur: 'Formateur', salle: 'Salle' };
  function sauverPref() { stock.ecrire(CLE_PREF, { type: plan.type, id: plan.id }); }
  // Semaine affichée par défaut : celle d'aujourd'hui, ou la suivante si aujourd'hui n'est pas travaillé.
  function lundiParDefaut() {
    const d = auj();
    const jours = E?.reglages.jours || [1, 2, 3, 4, 5];
    return jours.includes(R.jourSem(d)) || R.jourSem(d) < Math.max(...jours) ? R.lundi(d) : R.ajout(R.lundi(d), 7);
  }

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
        toast('Un autre appareil a modifié l\'emploi du temps entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte puis retire les semaines passées (Réglages).');
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
  // Code interne (EDT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Organisme de formation fictif : cinq groupes, six formateurs (prénom et initiale inventés), cinq salles,
  // une année entière placée en semaines A et B à partir d'aujourd'hui (séances passées = réalisées).
  // La semaine affichée à l'ouverture contient au moins un conflit de chaque sorte : formateur, salle et
  // groupe en double, salle trop petite, équipement manquant, formateur indisponible ou absent, séance
  // sans formateur, séance annulée ; un module et un formateur dépassent leur volume ou leur quota ; un
  // module n'a encore aucune séance.
  function donneesDemo() {
    const an = R.anneeProposee(auj());
    const e = etatVide();
    const cr = B.grilles.find((x) => x.code === 'J5').creneaux.map(([debut, fin], i) => ({ id: `c${i + 1}`, debut, fin }));
    e.reglages = R.normaliserReglages({ etablissement: 'Centre de formation des Tilleuls (fictif)', jours: [1, 2, 3, 4, 5], creneaux: cr, alternance: true, debut: an.debut, fin: an.fin, equipements: B.equipements }, B);
    const a0 = Number(an.debut.slice(0, 4));
    const asc = R.ajout(R.paques(a0 + 1), 39);
    e.fermetures = [
      { id: uid(), nom: 'Fermeture de fin d\'année', debut: `${a0}-12-21`, fin: `${a0 + 1}-01-01` },
      { id: uid(), nom: 'Semaine de pause pédagogique', debut: R.lundi(`${a0 + 1}-02-17`), fin: R.ajout(R.lundi(`${a0 + 1}-02-17`), 4) },
      { id: uid(), nom: 'Pont de l\'Ascension', debut: R.ajout(asc, 1), fin: R.ajout(asc, 1) },
    ].map(R.normaliserFermeture);
    const G = (id, nom, effectif) => e.groupes.push(R.normaliserGroupe({ id, nom, effectif }));
    G('g1', 'Comptabilité · promo 1', 16); G('g2', 'Assistant de direction', 12); G('g3', 'Développement web', 18); G('g4', 'Anglais professionnel (soir)', 10); G('g5', 'Bureautique (inter-entreprises)', 8);
    const tous = (j) => cr.map((c) => `${j}-${c.id}`);
    const F = (id, nom, x = {}) => e.formateurs.push(R.normaliserFormateur({ id, nom, ...x }));
    F('f1', 'Claire M.'); F('f2', 'Hugo L.', { indispos: ['5-c3', '5-c4', '5-c5'] }); F('f3', 'Nadia K.', { indispos: tous(3) }); F('f4', 'Thomas R.'); F('f5', 'Inès B.'); F('f6', 'Marc V.', { indispos: tous(1).concat(tous(2)) });
    const S = (id, nom, capacite, equipements) => e.salles.push(R.normaliserSalle({ id, nom, capacite, equipements }));
    S('s1', 'Salle 101', 20, ['Vidéoprojecteur', 'Tableau blanc']); S('s2', 'Salle 102', 14, ['Vidéoprojecteur']); S('s3', 'Salle informatique', 18, ['Postes informatiques', 'Vidéoprojecteur']);
    S('s4', 'Salle 201', 24, ['Écran interactif', 'Matériel de visioconférence', 'Accès fauteuil roulant']); S('s5', 'Petite salle', 10, ['Tableau blanc']);
    const M = (id, nom, groupe, formateur, couleur, equipement = '') => e.modules.push(R.normaliserModule({ id, nom, groupe, formateur, couleur, equipement }));
    M('cg', 'Comptabilité générale', 'g1', 'f1', 0); M('fi', 'Fiscalité', 'g1', 'f1', 1); M('tb', 'Tableur', 'g1', 'f2', 3, 'Postes informatiques'); M('pa', 'Paie', 'g1', 'f4', 2); M('dt', 'Droit du travail', 'g1', '', 5);
    M('ce', 'Communication écrite', 'g2', 'f5', 4); M('oa', 'Organisation et agenda', 'g2', 'f5', 6); M('bu', 'Bureautique', 'g2', 'f2', 3, 'Postes informatiques'); M('an', 'Anglais', 'g2', 'f3', 7);
    M('hc', 'HTML et CSS', 'g3', 'f2', 0, 'Postes informatiques'); M('js', 'JavaScript', 'g3', 'f2', 1, 'Postes informatiques'); M('gp', 'Gestion de projet', 'g3', 'f1', 2); M('at', 'Anglais technique', 'g3', 'f3', 7); M('ex', 'Préparation à l\'examen', 'g3', '', 5);
    M('b1', 'Anglais niveau B1', 'g4', 'f3', 7); M('ta', 'Tableur avancé', 'g5', 'f4', 3, 'Postes informatiques');
    // Semaine type : [jour, créneau (1-5), module, salle] ; « B » ajoute ou remplace en semaine B.
    const A = [
      [1, 1, 'cg', 's1'], [1, 1, 'hc', 's3'], [1, 1, 'ce', 's2'], [1, 2, 'cg', 's1'], [1, 2, 'hc', 's3'], [1, 2, 'oa', 's2'], [1, 3, 'tb', 's3'], [1, 3, 'gp', 's4'], [1, 3, 'an', 's2'], [1, 4, 'fi', 's1'], [1, 4, 'at', 's4'], [1, 5, 'b1', 's5'],
      [2, 1, 'js', 's3'], [2, 1, 'ce', 's2'], [2, 1, 'pa', 's1'], [2, 2, 'js', 's3'], [2, 2, 'ce', 's2'], [2, 2, 'fi', 's1'], [2, 3, 'js', 's3'], [2, 3, 'cg', 's1'], [2, 3, 'oa', 's2'],
      [3, 1, 'cg', 's1'], [3, 1, 'hc', 's3'], [3, 2, 'tb', 's3'], [3, 2, 'gp', 's4'], [3, 3, 'ce', 's2'],
      [4, 1, 'hc', 's3'], [4, 1, 'fi', 's1'], [4, 1, 'an', 's2'], [4, 2, 'hc', 's3'], [4, 2, 'cg', 's1'], [4, 2, 'oa', 's2'], [4, 3, 'js', 's3'], [4, 3, 'pa', 's1'], [4, 3, 'ce', 's2'], [4, 4, 'js', 's3'], [4, 5, 'b1', 's5'],
      [5, 1, 'js', 's3'], [5, 1, 'cg', 's1'], [5, 1, 'ce', 's2'], [5, 2, 'bu', 's3'], [5, 2, 'fi', 's1'], [5, 2, 'at', 's4'],
    ];
    const Bsem = A.filter(([j, c]) => !(j === 5 && c === 2)).concat([[5, 2, 'tb', 's3'], [5, 2, 'oa', 's2'], [2, 4, 'bu', 's3'], [3, 3, 'ta', 's3']]);
    const formDe = Object.fromEntries(e.modules.map((m) => [m.id, m.formateur]));
    let ta = 0;
    for (const w of R.semainesAnnee(e)) {
      if (w.fermee) continue;
      for (const [j, c, m, s] of (w.type === 'B' ? Bsem : A)) {
        const date = R.ajout(w.lundi, j - 1);
        if (R.fermeture(e, date)) continue;
        if (m === 'ta' && ++ta > 15) continue; // stage court : 15 séances
        e.seances.push({ id: uid(), date, debut: cr[c - 1].debut, fin: cr[c - 1].fin, module: m, formateur: formDe[m], salle: s });
      }
    }
    // Volumes et quotas cohérents avec ce qui est placé (+ 5 à 10 %), sauf Paie, Tableur avancé et Thomas R.
    const placeM = (id) => e.seances.filter((s) => s.module === id).reduce((t, s) => t + R.duree(s), 0) / 60;
    e.modules.forEach((m, i) => { const p = placeM(m.id); m.volume = m.id === 'dt' ? 30 : m.id === 'ex' ? 12 : m.id === 'pa' ? p - 3 : m.id === 'ta' ? 21 : Math.ceil(p * (1.05 + (i % 3) * 0.025)); });
    e.formateurs.forEach((f) => { const p = e.seances.filter((s) => s.formateur === f.id).reduce((t, s) => t + R.duree(s), 0) / 60; f.quota = f.id === 'f4' ? Math.max(0, p - 4.5) : f.id === 'f6' ? 0 : Math.ceil(p * 1.08 / 10) * 10; });
    // Semaine affichée : conflits forcés sur des jours ouverts.
    const l0 = lundiParDefaut();
    const ouverts = [1, 2, 3, 4, 5].map((j) => R.ajout(l0, j - 1)).filter((d) => !R.fermeture(e, d));
    const de = (d, c) => e.seances.filter((s) => s.date === d && s.debut === cr[c - 1].debut);
    const libre = (d, c, x) => !de(d, c).some((s) => (x.salle && s.salle === x.salle) || (x.formateur && s.formateur === x.formateur) || (x.groupe && formDe[s.module] !== undefined && e.modules.find((m) => m.id === s.module).groupe === x.groupe));
    const ajouter = (d, c, module, formateur, salleId, x = {}) => e.seances.push({ id: uid(), date: d, debut: cr[c - 1].debut, fin: cr[c - 1].fin, module, formateur, salle: salleId, ...x });
    if (ouverts.length) {
      const d1 = ouverts[0], d2 = ouverts[Math.min(1, ouverts.length - 1)], dn = ouverts[ouverts.length - 1];
      // Formateur en double : Claire M. remplace en même temps en Assistant de direction (créneau 4, Petite salle).
      if (libre(d1, 4, { salle: 's5', groupe: 'g2' })) ajouter(d1, 4, 'oa', 'f1', 's5', { note: 'Remplacement à confirmer' });
      // Salle en double : Tableur avancé dans une salle déjà occupée, au créneau 2 du 2e jour.
      if (libre(d2, 2, { formateur: 'f4', groupe: 'g5' })) ajouter(d2, 2, 'ta', 'f4', de(d2, 2)[0]?.salle || 's1');
      // Salle trop petite : Développement web (18) en Salle 102 (14) au créneau 4 du dernier jour.
      ajouter(dn, 4, 'gp', 'f1', 's2');
      // Équipement manquant : Tableur placé en Salle 101.
      const tb = e.seances.find((s) => s.module === 'tb' && s.date >= l0 && s.date <= R.ajout(l0, 6) && libre(s.date, cr.findIndex((c) => c.debut === s.debut) + 1, { salle: 's1' }));
      if (tb) tb.salle = 's1';
      // Formateur indisponible : Nadia K. un mercredi (ou au 3e jour ouvert).
      const mer = ouverts.find((d) => R.jourSem(d) === 3) || ouverts[Math.min(2, ouverts.length - 1)];
      if (libre(mer, 4, { salle: 's2', groupe: 'g2' })) ajouter(mer, 4, 'an', 'f3', 's2');
      // Groupe en double et séance incomplète : Droit du travail sans formateur ni salle.
      ajouter(d1, 2, 'dt', '', '');
      // Séance annulée.
      const an1 = e.seances.find((s) => s.date === dn && s.module === 'ce');
      if (an1) { an1.annulee = true; an1.note = 'Formatrice absente, à rattraper'; }
    }
    // Absence datée la semaine suivante : ses séances de ce jour deviennent à remplacer.
    const absent = R.ajout(l0, 8);
    e.formateurs.find((f) => f.id === 'f5').absences = [{ debut: absent, fin: absent }];
    plan.type = 'groupe'; plan.id = 'g1'; plan.lundi = l0; plan.jour = '';
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Emploi du temps · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="110" height="60" rx="14" fill="#1D4E89"/>
          <rect x="140" y="20" width="110" height="60" rx="14" fill="#F0EDE6"/>
          <rect x="260" y="20" width="110" height="130" rx="14" fill="#F5B400"/>
          <rect x="20" y="90" width="110" height="60" rx="14" fill="#F0EDE6"/>
          <rect x="140" y="90" width="110" height="60" rx="14" fill="#D9302A"/>
          <rect x="20" y="160" width="230" height="60" rx="14" fill="#1D4E89"/>
          <rect x="260" y="160" width="110" height="60" rx="14" fill="#F0EDE6"/>
          <circle cx="470" cy="110" r="70" fill="#D9302A"/>
          <path d="M400 290 L470 220 L540 290 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Emploi du temps d'établissement</p>
          <h1>Ton planning, sans conflit.</h1>
          <p>Groupes, formateurs, salles et modules placés à la main sur une grille semaine, les conflits signalés tout de suite, et les heures prévues, placées et réalisées.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton emploi du temps</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton planning est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon emploi du temps</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/emploi-du-temps/">Voir l'emploi du temps d'établissement</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon emploi du temps'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => { const an = R.anneeProposee(auj()); return { etape: 1, nom: '', debut: an.debut, fin: an.fin, samedi: false, grille: 'J4', alternance: false }; };
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>L'emploi du temps de ton établissement, sans conflit.</h1>
        <p class="intro">Tu places les séances à la main sur une grille semaine. L'outil vérifie tout de suite qu'aucun formateur, aucune salle et aucun groupe n'est pris deux fois, que la salle est assez grande et équipée, que le formateur est disponible et que les volumes prévus sont tenus. Il ne place rien à ta place.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton année et tes créneaux</h1>
        <p class="intro">Tout se modifie ensuite dans l'onglet Calendrier.</p>
        <div class="form-accueil">
          <label class="champ">Nom de l'établissement <small>facultatif, affiché sur les impressions</small><input id="a-nom" value="${esc(a.nom)}" maxlength="80"></label>
          <div class="rang-champs">
            <label class="champ">Début de l'année<input id="a-debut" type="date" value="${a.debut}"></label>
            <label class="champ">Fin de l'année<input id="a-fin" type="date" value="${a.fin}"></label>
          </div>
          <fieldset><legend>Créneaux de la journée</legend>
            <div class="modeles-choix">${B.grilles.map((x) => `<label class="modele-choix"><input type="radio" name="a-grille" value="${x.code}" ${x.code === a.grille ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.detail)}</small></span></label>`).join('')}</div>
          </fieldset>
          <div class="cases">
            <label class="case"><input type="checkbox" id="a-samedi" ${a.samedi ? 'checked' : ''}> Cours le samedi</label>
            <label class="case"><input type="checkbox" id="a-alternance" ${a.alternance ? 'checked' : ''}> Semaines A et B</label>
          </div>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon emploi du temps</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle, prop = 'value') => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target[prop]; });
    lier('#a-nom', 'nom'); lier('#a-debut', 'debut'); lier('#a-fin', 'fin'); lier('#a-samedi', 'samedi', 'checked'); lier('#a-alternance', 'alternance', 'checked');
    document.querySelectorAll('[name=a-grille]').forEach((r) => r.addEventListener('change', (e) => { accueil.grille = e.target.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    if (!R.estDate(a.debut) || !R.estDate(a.fin) || a.fin <= a.debut) return ecranAccueil('Indique le début et la fin de l\'année (la fin après le début).');
    const g = B.grilles.find((x) => x.code === a.grille) || B.grilles[0];
    E = etatVide();
    E.reglages = R.normaliserReglages({ etablissement: a.nom, debut: a.debut, fin: a.fin, jours: a.samedi ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5], alternance: a.alternance, creneaux: g.creneaux.map(([debut, fin]) => ({ id: uid(), debut, fin })), equipements: B.equipements }, B);
    accueil = accueilVide();
    vue = 'ressources';
    sauver();
    demarrer();
    toast('Ton emploi du temps est prêt : ajoute tes groupes, formateurs, salles et modules.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    conflits: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    heures: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    ressources: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 21a6 6 0 0 1 12 0Z" fill="currentColor"/><path d="M14 21a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="5" rx="2" fill="currentColor"/><circle cx="12" cy="15.5" r="2.5" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['planning', 'Planning'], ['conflits', 'Conflits'], ['heures', 'Heures'], ['ressources', 'Ressources'], ['calendrier', 'Calendrier']];
  const RGPD = '<div class="rgpd"><h2>Données personnelles</h2><p>Note seulement le nom (ou le prénom et l\'initiale) des formateurs et le nom des groupes. <b>Aucun nom d\'apprenant</b> : l\'effectif suffit pour vérifier les salles. Les absences des formateurs se notent sans motif. Efface ce qui ne sert plus en fin d\'année.</p></div>';
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la construction de l\'emploi du temps : il signale les conflits à partir de ce que tu saisis, il ne place rien automatiquement. Les obligations de ton établissement (contrats, conventions, référentiels de formation, règles d\'accueil du public) priment.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" rx="10" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const GRAV = { rouge: ['rouge', 'Bloquant'], jaune: ['jaune', 'À vérifier'], info: ['sable', 'Incomplet'] };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (!plan.lundi) plan.lundi = lundiParDefaut();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/emploi-du-temps/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Organisme fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Emploi<br>du temps</span>
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
    C = R.conflits(E);
    SEM = R.semainesAnnee(E);
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const nb = C.liste.filter((c) => c.gravite === 'rouge' && c.date >= auj()).length;
    const og = $('.onglet[data-vue="conflits"]');
    if (og) og.querySelector('em')?.remove();
    if (og && nb) og.insertAdjacentHTML('beforeend', `<em class="pastille-nb" aria-label="${nb} conflits bloquants à venir">${nb > 99 ? '99+' : nb}</em>`);
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Emploi du temps`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { planning: vuePlanning, conflits: vueConflits, heures: vueHeures, ressources: vueRessources, calendrier: vueCalendrier }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Branchements propres à une vue (sélecteurs).
  function brancherVue() {
    $('#choix-ressource')?.addEventListener('change', (e) => { plan.id = e.target.value; sauverPref(); rendre(); });
    $('#choix-semaine')?.addEventListener('change', (e) => { if (R.estDate(e.target.value)) { plan.lundi = R.lundi(e.target.value); plan.jour = ''; rendre(); } });
    $('#filtre-heures')?.addEventListener('change', (e) => { filtre.heures = e.target.value; rendre(); });
    $('#form-annee')?.addEventListener('submit', (e) => { e.preventDefault(); enregistrerAnnee(new FormData(e.target)); });
  }

  // ---------- Planning ----------
  const semaineInfo = (l) => SEM.find((x) => x.lundi === l);
  function libelleSemaine(l) {
    const w = semaineInfo(l);
    const fin = R.ajout(l, Math.max(...E.reglages.jours) - 1);
    const meme = l.slice(5, 7) === fin.slice(5, 7);
    const debutTxt = meme ? String(R.versDate(l).getDate()) : R.dateFr(l);
    return `Semaine du ${debutTxt} au ${R.dateFr(fin)} ${fin.slice(0, 4)} · S${R.numeroSemaine(l)}${w?.type ? ` · semaine ${w.type}` : ''}${w?.fermee ? ' · fermée' : ''}${!w ? ' · hors année' : ''}`;
  }
  // Ressource affichée : celle choisie si elle existe, sinon la première de la liste.
  function ressourceCourante() {
    const l = E[LISTE_TYPE[plan.type]];
    if (!l.length) return null;
    const r = l.find((x) => x.id === plan.id) || l[0];
    plan.id = r.id;
    return r;
  }
  // Lignes d'une carte de séance selon la vue (on n'y répète pas la ressource affichée).
  function detailSeance(s) {
    const g = nomG(groupeSeance(s)) || 'Groupe ?', f = s.formateur ? nomF(s.formateur) : '<i class="manque">formateur à désigner</i>', sa = s.salle ? nomS(s.salle) : '<i class="manque">salle à désigner</i>';
    const l = plan.type === 'groupe' ? [f, sa] : plan.type === 'formateur' ? [esc(g), sa] : [esc(g), f];
    return l.map((x) => (x.startsWith('<i') ? x : esc(x))).join(' · ');
  }
  function carteSeance(s) {
    const m = module_(s.module), col = couleur(m);
    const cf = s.annulee ? [] : (C.parSeance.get(s.id) || []);
    const gmax = R.graviteMax(cf);
    const titre = [`${s.debut}–${s.fin} · ${m?.nom || 'Module supprimé'}`, ...cf.map((c) => `⚠ ${c.texte}`), s.annulee ? 'Séance annulée' : '', s.note ? `Note : ${s.note}` : ''].filter(Boolean).join('\n');
    return `<button type="button" class="seance ${s.annulee ? 'annulee' : ''} ${gmax ? `cf-${gmax}` : ''}" data-action="seance" data-id="${s.id}" style="--f:${col.fond};--b:${col.bord};--t:${col.texte}" title="${esc(titre)}">
      <span class="se-haut"><span class="se-heure">${s.debut}–${s.fin}</span>${cf.length ? `<span class="se-alerte ${gmax}" aria-label="${pluriel(cf.length, 'conflit')}">${cf.length > 1 ? cf.length : gmax === 'info' ? '?' : '!'}</span>` : ''}${s.annulee ? '<span class="se-annulee">Annulée</span>' : ''}</span>
      <b>${esc(m?.nom || 'Module supprimé')}</b><span class="se-detail">${detailSeance(s)}</span></button>`;
  }

  function vuePlanning() {
    const r = E.reglages;
    const tete = (actions = '') => `<div class="vue-tete"><div><p class="surtitre">${esc(r.etablissement || 'Emploi du temps')}</p><h1>Planning</h1></div>${actions}</div>`;
    if (!E.groupes.length || !E.modules.length) return `${tete()}${videEtat('Commence par les ressources', 'Ajoute au moins un groupe et un module (avec son volume d\'heures prévu), puis tes formateurs et tes salles. Tu pourras ensuite placer les séances sur la grille.', '<button class="btn primaire" data-action="vue" data-vue="ressources">Ouvrir les ressources</button>')}${RGPD}${AVERTISSEMENT}`;
    if (!r.creneaux.length) return `${tete()}${videEtat('Aucun créneau', 'Définis les créneaux de la journée dans l\'onglet Calendrier.', '<button class="btn primaire" data-action="vue" data-vue="calendrier">Ouvrir le calendrier</button>')}`;
    const res = ressourceCourante();
    const liste = E[LISTE_TYPE[plan.type]];
    const l = plan.lundi;
    const jours = R.joursDeSemaine(E, l);
    const seances = res ? R.seancesDe(E, plan.type, res.id, l, R.ajout(l, 6)) : [];
    const act = seances.filter((s) => !s.annulee);
    const cfSem = C.liste.filter((c) => c.seances.some((id) => seances.some((s) => s.id === id)));
    const outils = `<div class="barre-planning">
        <div class="segments" role="group" aria-label="Vue par">${['groupe', 'formateur', 'salle'].map((t) => `<button type="button" class="segment" data-action="mode" data-type="${t}" aria-pressed="${plan.type === t}">${NOM_TYPE[t]}</button>`).join('')}</div>
        ${liste.length ? `<label class="champ choix-ressource"><span class="sr-only">${NOM_TYPE[plan.type]}</span><select id="choix-ressource">${liste.map((x) => `<option value="${x.id}" ${x.id === res?.id ? 'selected' : ''}>${esc(x.nom)}${plan.type === 'groupe' ? ` · ${x.effectif} pers.` : plan.type === 'salle' ? ` · ${x.capacite} places` : ''}</option>`).join('')}</select></label>` : ''}
        <div class="nav-semaine"><button class="btn-icone" data-action="semaine" data-sens="-1" aria-label="Semaine précédente">‹</button><label class="champ"><span class="sr-only">Aller à la semaine du</span><input id="choix-semaine" type="date" value="${l}"></label><button class="btn-icone" data-action="semaine" data-sens="1" aria-label="Semaine suivante">›</button><button class="btn petit" data-action="semaine" data-sens="0">Cette semaine</button></div>
      </div>`;
    const actions = `<div class="actions"><button class="btn" data-action="dupliquer">Dupliquer la semaine</button><button class="btn" data-action="imprimer">Imprimer</button><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Séance</button></div>`;
    if (!res) return `${tete(actions)}${outils}${videEtat(`Aucun ${NOM_TYPE[plan.type].toLowerCase()}`, `Ajoute-en un dans l'onglet Ressources.`, '<button class="btn primaire" data-action="vue" data-vue="ressources">Ouvrir les ressources</button>')}`;
    const resume = `<p class="resume-semaine"><b>${esc(libelleSemaine(l))}</b><span>${pluriel(act.length, 'séance')} · ${hT(R.totalMinutes(act))}${cfSem.length ? ` · <span class="negatif">${pluriel(cfSem.length, 'conflit')}</span>` : ' · aucun conflit'}</span></p>`;
    const corps = estTel() ? grilleTel(jours, seances) : grille(jours, seances);
    const listeCf = cfSem.length ? `<section><h2 class="titre-section">Conflits de la semaine <span>${esc(res.nom)}</span></h2>${listeConflits(cfSem, false)}</section>` : '';
    return `${tete(actions)}${outils}${resume}${corps}${listeCf}${AVERTISSEMENT}`;
  }

  // En-tête d'un jour : nom, date, fermeture éventuelle.
  function enteteJour(d) {
    const fe = R.fermeture(E, d);
    return `<span class="gj-nom">${jourCourt(d)}${d === auj() ? ' <em>aujourd\'hui</em>' : ''}</span>${fe ? `<span class="gj-ferme">${esc(fe.nom)}</span>` : ''}`;
  }
  // Grille ordinateur : une colonne par jour, une ligne par créneau ; les séances qui se recouvrent
  // dans une même colonne sont empilées (c'est un conflit visible).
  function grille(jours, seances) {
    const cr = E.reglages.creneaux;
    const hors = seances.filter((s) => !R.creneauxCouverts(s, cr).length);
    const rangs = cr.length + (hors.length ? 1 : 0);
    let h = `<div class="grille" style="--jours:${jours.length};--rangs:${rangs}" role="grid" aria-label="Grille de la semaine"><div class="g-coin"></div>`;
    jours.forEach((d, i) => { h += `<div class="g-jour ${R.fermeture(E, d) ? 'ferme' : ''} ${d === auj() ? 'auj' : ''}" style="grid-column:${i + 2};grid-row:1">${enteteJour(d)}</div>`; });
    cr.forEach((c, k) => { h += `<div class="g-heure" style="grid-row:${k + 2}"><b>${c.debut}</b><span>${c.fin}</span></div>`; });
    if (hors.length) h += `<div class="g-heure" style="grid-row:${cr.length + 2}"><b>Autres</b><span>horaires</span></div>`;
    jours.forEach((d, i) => {
      const fe = R.fermeture(E, d);
      cr.forEach((c, k) => {
        h += fe ? `<div class="g-case ferme" style="grid-column:${i + 2};grid-row:${k + 2}"></div>`
          : `<button type="button" class="g-case" data-action="nouvelle" data-date="${d}" data-c="${c.id}" style="grid-column:${i + 2};grid-row:${k + 2}"><span class="sr-only">Ajouter une séance le ${R.dateFrLongue(d)} de ${c.debut} à ${c.fin}</span></button>`;
      });
      // Piles : séances regroupées quand leurs créneaux se recouvrent.
      const l = seances.filter((s) => s.date === d).map((s) => ({ s, k: R.creneauxCouverts(s, cr) })).filter((x) => x.k.length).sort((a, b) => a.k[0] - b.k[0] || a.s.debut.localeCompare(b.s.debut));
      const piles = [];
      for (const x of l) {
        const p = piles[piles.length - 1];
        const a = x.k[0], b = x.k[x.k.length - 1];
        if (p && a <= p.b) { p.l.push(x.s); p.b = Math.max(p.b, b); } else piles.push({ a, b, l: [x.s] });
      }
      for (const p of piles) h += `<div class="g-pile ${p.l.length > 1 ? 'multiple' : ''}" style="grid-column:${i + 2};grid-row:${p.a + 2} / ${p.b + 3}">${p.l.map(carteSeance).join('')}</div>`;
      const hj = hors.filter((s) => s.date === d);
      if (hj.length) h += `<div class="g-pile" style="grid-column:${i + 2};grid-row:${cr.length + 2}">${hj.map(carteSeance).join('')}</div>`;
    });
    return `${h}</div>`;
  }
  // Téléphone : un jour à la fois, créneau par créneau.
  function grilleTel(jours, seances) {
    const cr = E.reglages.creneaux;
    if (!jours.includes(plan.jour)) plan.jour = jours.includes(auj()) ? auj() : jours.find((d) => !R.fermeture(E, d)) || jours[0];
    const d = plan.jour;
    const puces = `<div class="jours-tel" role="group" aria-label="Jour">${jours.map((x) => {
      const n = seances.filter((s) => s.date === x && !s.annulee).length;
      const cf = seances.some((s) => s.date === x && !s.annulee && C.parSeance.get(s.id)?.some((c) => c.gravite !== 'info'));
      return `<button type="button" class="jour-tel ${R.fermeture(E, x) ? 'ferme' : ''}" data-action="jour" data-date="${x}" aria-pressed="${x === d}"><b>${R.JOURS_COURTS[R.jourSem(x)]}</b><span>${R.versDate(x).getDate()}</span><small>${n || '·'}${cf ? '<i aria-label="conflit"></i>' : ''}</small></button>`;
    }).join('')}</div>`;
    const fe = R.fermeture(E, d);
    const duJour = seances.filter((s) => s.date === d);
    const lignes = cr.map((c, k) => {
      const ici = duJour.filter((s) => R.creneauxCouverts(s, cr)[0] === k);
      const suite = !ici.length && duJour.some((s) => R.creneauxCouverts(s, cr).includes(k));
      return `<li><span class="heure-pastille">${c.debut}<small>${c.fin}</small></span><div class="lj-corps">${ici.map(carteSeance).join('')}${!ici.length && !suite && !fe ? `<button type="button" class="libre" data-action="nouvelle" data-date="${d}" data-c="${c.id}">Libre · ajouter une séance</button>` : ''}${suite ? '<span class="libre suite">Suite de la séance</span>' : ''}${!ici.length && !suite && fe ? '<span class="libre suite">Fermé</span>' : ''}</div></li>`;
    }).join('');
    const hors = duJour.filter((s) => !R.creneauxCouverts(s, cr).length);
    return `${puces}<p class="jour-titre">${esc(R.dateFrLongue(d))}${fe ? ` · <span class="gj-ferme">${esc(fe.nom)}</span>` : ''}</p><ul class="liste-jour">${lignes}${hors.length ? `<li><span class="heure-pastille">Autre</span><div class="lj-corps">${hors.map(carteSeance).join('')}</div></li>` : ''}</ul>`;
  }

  // ---------- Conflits ----------
  function ressourceDuConflit(c) {
    const s = trouver('seances', c.seances[0]);
    if (!s) return { type: plan.type, id: plan.id };
    if (['formateur', 'indispo', 'quota'].includes(c.type) && s.formateur) return { type: 'formateur', id: s.formateur };
    if (['salle', 'capacite', 'equipement'].includes(c.type) && s.salle) return { type: 'salle', id: s.salle };
    return { type: 'groupe', id: groupeSeance(s) };
  }
  function listeConflits(l, avecDate = true, max = 200) {
    const items = l.slice(0, max).map((c) => {
      const s = trouver('seances', c.seances[0]);
      return `<li class="${c.gravite}"><span class="date-pastille ${c.gravite === 'rouge' ? 'alerte' : ''}">${avecDate ? `<b>${R.versDate(c.date).getDate()}</b>${moisCourt(c.date)}` : `<b>${R.JOURS_COURTS[R.jourSem(c.date)]}</b>${c.debut}`}</span>
        <div class="lien-ligne"><b>${esc(c.texte)}</b><span>${esc(R.TYPES_CONFLIT[c.type].nom)} · ${esc(dateCourte(c.date))} ${s ? `${s.debut}–${s.fin}` : ''}${c.seances.length > 1 ? ` · ${pluriel(c.seances.length, 'séance')}` : ''}</span></div>
        <div class="alerte-droite"><span class="etiquette ${GRAV[c.gravite][0]}">${GRAV[c.gravite][1]}</span><button class="btn petit" data-action="voir-conflit" data-type="${c.type}" data-id="${c.seances[0]}">${avecDate ? 'Voir' : 'Modifier'}</button></div></li>`;
    }).join('');
    return `<ul class="alertes-edt">${items}</ul>${l.length > max ? `<p class="aide">Et ${pluriel(l.length - max, 'autre')} : affine avec les filtres.</p>` : ''}`;
  }

  function vueConflits() {
    const tous = C.liste;
    const a = auj();
    const base = filtre.conflits === 'avenir' ? tous.filter((c) => c.date >= R.lundi(a)) : tous;
    const l = filtre.typeConflit ? base.filter((c) => c.type === filtre.typeConflit) : base;
    const n = (g) => base.filter((c) => c.gravite === g).length;
    const lc = lundiParDefaut();
    const semaine = tous.filter((c) => R.lundi(c.date) === lc).length;
    const tuiles = [['Bloquants', n('rouge'), 'double réservation ou jour fermé', 'var(--rouge)', 'rond'], ['À vérifier', n('jaune'), 'capacité, équipement, disponibilité, volumes', 'var(--jaune)', ''], ['Incomplets', n('info'), 'sans formateur ou sans salle', 'var(--sable)', ''], [lc === R.lundi(a) ? 'Cette semaine' : 'Semaine prochaine', semaine, libelleSemaine(lc).split(' · ')[0].replace('Semaine du ', 'du '), 'var(--bleu)', 'rond']]
      .map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
    const types = Object.entries(R.TYPES_CONFLIT).map(([t, x]) => [t, x.nom, base.filter((c) => c.type === t).length]).filter(([, , k]) => k);
    const filtres = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Période">${[['avenir', 'À partir de cette semaine'], ['tout', 'Toute l\'année']].map(([f, nom]) => `<button class="filtre" data-action="filtre-conflits" data-f="${f}" aria-pressed="${filtre.conflits === f}">${nom}</button>`).join('')}</div>
      <div class="filtres" role="group" aria-label="Type"><button class="filtre" data-action="filtre-type" data-f="" aria-pressed="${!filtre.typeConflit}">Tous <small>${base.length}</small></button>${types.map(([t, nom, k]) => `<button class="filtre" data-action="filtre-type" data-f="${t}" aria-pressed="${filtre.typeConflit === t}">${esc(nom)} <small>${k}</small></button>`).join('')}</div></div>`;
    // Groupés par semaine.
    const parSemaine = new Map();
    l.forEach((c, i) => { const k = R.lundi(c.date); if (!parSemaine.has(k)) parSemaine.set(k, []); parSemaine.get(k).push({ ...c, i }); });
    let reste = 200;
    const blocs = [...parSemaine.entries()].map(([k, cs]) => {
      if (reste <= 0) return '';
      const part = cs.slice(0, reste); reste -= part.length;
      return `<section class="groupe-cat"><h2 class="titre-cat">${esc(libelleSemaine(k))} <span>${pluriel(cs.length, 'conflit')}</span></h2>${listeConflits(part)}</section>`;
    }).join('');
    const vide = videEtat('Aucun conflit', filtre.conflits === 'avenir' ? 'Rien à signaler à partir de cette semaine : aucune double réservation, aucune salle trop petite, aucun volume dépassé.' : 'Rien à signaler sur l\'année.');
    return `<div class="vue-tete"><div><h1>Conflits</h1><p>Tout ce qui empêche une séance d'avoir lieu telle qu'elle est placée, ou qui mérite une vérification. Ils se recalculent à chaque modification.</p></div></div>
      <div class="tuiles">${tuiles}</div>${filtres}${l.length ? blocs : vide}${l.length > 200 ? `<p class="aide">Les 200 premiers sont affichés : filtre par type pour voir les autres.</p>` : ''}${AVERTISSEMENT}`;
  }

  // ---------- Heures ----------
  function barre(realise, place, cible, etiquette) {
    const max = Math.max(cible, place, 1);
    const pR = (realise / max) * 100, pP = ((place - realise) / max) * 100, pC = (cible / max) * 100;
    return `<div class="piste-h" role="img" aria-label="${esc(etiquette)}"><span class="ph-realise" style="width:${pR}%"></span><span class="ph-place" style="width:${pP}%"></span>${cible ? `<i class="ph-cible" style="left:${Math.min(100, pC)}%"></i>` : ''}</div>`;
  }
  function ligneHeures(nom, sous, x, cible, libCible, action) {
    const ecartTxt = cible ? (x.place > cible ? `<span class="etiquette rose">+${hT(x.place - cible)}</span>` : x.place < cible ? `<span class="etiquette ciel">${hT(cible - x.place)} à placer</span>` : '<span class="etiquette vert">Complet</span>') : '<span class="etiquette sable">Sans cible</span>';
    const lib = `${nom} : ${hT(x.realise)} réalisées, ${hT(x.place)} placées${cible ? `, ${hT(cible)} ${libCible}` : ''}`;
    return `<li class="ligne-h"><div class="lh-nom">${action}<span>${esc(sous)}</span></div>${barre(x.realise, x.place, cible, lib)}<div class="lh-val"><b>${hT(x.realise)}</b> / ${hT(x.place)}${cible ? ` / ${hT(cible)}` : ''} ${ecartTxt}</div></li>`;
  }
  function vueHeures() {
    if (!E.modules.length && !E.formateurs.length) return `<div class="vue-tete"><div><h1>Heures</h1></div></div>${videEtat('Rien à compter', 'Ajoute des modules avec leur volume prévu et des formateurs avec leur quota, puis place des séances.', '<button class="btn primaire" data-action="vue" data-vue="ressources">Ouvrir les ressources</button>')}`;
    const h = R.heures(E, maintenant());
    const gSel = E.groupes.some((g) => g.id === filtre.heures) ? filtre.heures : '';
    const mods = h.parModule.filter((m) => !gSel || m.groupe === gSel);
    const tot = (k) => mods.reduce((t, m) => t + m[k], 0);
    const depasses = mods.filter((m) => m.depasse).length;
    const tuiles = [['Réalisé', hT(tot('realise')), 'séances passées', 'var(--bleu)', 'rond'], ['Placé', hT(tot('place')), `${pluriel(mods.reduce((t, m) => t + m.seances, 0), 'séance')} non annulées`, 'var(--ciel)', ''], ['Prévu', hT(tot('prevu')), 'somme des volumes des modules', 'var(--encre)', ''], ['Volumes dépassés', depasses, depasses ? 'modules à revoir' : 'aucun module', depasses ? 'var(--rouge)' : 'var(--vert)', 'rond']]
      .map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
    const legende = '<p class="legende"><i class="lg-realise"></i>Réalisé <i class="lg-place"></i>Placé, à venir <i class="lg-cible"></i>Volume prévu ou quota</p>';
    const parGroupe = E.groupes.filter((g) => !gSel || g.id === gSel).map((g) => {
      const ms = mods.filter((m) => m.groupe === g.id);
      if (!ms.length) return '';
      const tg = h.parGroupe.find((x) => x.id === g.id);
      return `<section class="groupe-cat"><h3 class="titre-cat"><span class="tc-nom">${esc(g.nom)}</span><span>${hT(tg.realise)} réalisées · ${hT(tg.place)} placées · ${hT(tg.prevu)} prévues</span></h3><ul class="lignes-h">${ms.map((x) => {
        const m = module_(x.id);
        return ligneHeures(m.nom, `${m.formateur ? nomF(m.formateur) : 'formateur à désigner'} · ${pluriel(x.seances, 'séance')}`, x, x.prevu, 'prévues', `<button class="lien-ligne" data-action="module" data-id="${m.id}"><b>${esc(m.nom)}</b></button>`);
      }).join('')}</ul></section>`;
    }).join('');
    const forms = h.parFormateur.map((x) => { const f = formateur(x.id); return ligneHeures(f.nom, `${pluriel(x.seances, 'séance')}${f.quota ? '' : ' · pas de quota saisi'}`, x, x.quota, 'de quota', `<button class="lien-ligne" data-action="formateur" data-id="${f.id}"><b>${esc(f.nom)}</b></button>`); }).join('');
    const tableau = `<details class="tableau-details"><summary>Voir en tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Module</th><th>Groupe</th><th class="nb">Réalisé</th><th class="nb">Placé</th><th class="nb">Prévu</th><th class="nb">Reste à placer</th></tr></thead><tbody>${mods.map((x) => `<tr><td>${esc(module_(x.id).nom)}</td><td>${esc(nomG(x.groupe))}</td><td class="nb">${hT(x.realise)}</td><td class="nb">${hT(x.place)}</td><td class="nb">${x.prevu ? hT(x.prevu) : '–'}</td><td class="nb ${x.reste < 0 ? 'negatif' : ''}">${x.prevu ? (x.reste < 0 ? `−${hT(-x.reste)}` : hT(x.reste)) : '–'}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<div class="vue-tete"><div><h1>Heures</h1><p>Réalisé (séances passées), placé (toutes les séances non annulées) et prévu (volume du module ou quota du formateur).</p></div>
        <div class="actions"><label class="champ choix-ressource"><span class="sr-only">Groupe</span><select id="filtre-heures"><option value="">Tous les groupes</option>${E.groupes.map((g) => `<option value="${g.id}" ${g.id === gSel ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label><button class="btn" data-action="csv-heures">Exporter en CSV</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Par module <span>réalisé / placé / prévu</span></h2>${legende}<div class="graphique">${parGroupe || '<p>Aucun module pour ce groupe.</p>'}</div>${tableau}
      ${gSel ? '' : `<h2 class="titre-section">Par formateur <span>réalisé / placé / quota</span></h2><div class="graphique"><ul class="lignes-h">${forms || '<li>Aucun formateur.</li>'}</ul></div>`}${AVERTISSEMENT}`;
  }

  // ---------- Ressources ----------
  function indisposTexte(f) {
    const cr = E.reglages.creneaux;
    return E.reglages.jours.map((j) => {
      const l = cr.filter((c) => f.indispos.includes(`${j}-${c.id}`));
      if (!l.length) return '';
      return `${R.JOURS_COURTS[j].toLowerCase()}. ${l.length === cr.length ? '(journée)' : l.map((c) => c.debut).join(', ')}`;
    }).filter(Boolean).join(' · ');
  }
  function vueRessources() {
    const h = R.heures(E, maintenant());
    const sous = [['groupes', 'Groupes', E.groupes.length], ['formateurs', 'Formateurs', E.formateurs.length], ['salles', 'Salles', E.salles.length], ['modules', 'Modules', E.modules.length]];
    const f = filtre.ressources;
    const puces = `<div class="filtres" role="group" aria-label="Ressources">${sous.map(([k, nom, n]) => `<button class="filtre" data-action="filtre-ressources" data-f="${k}" aria-pressed="${f === k}">${nom} <small>${n}</small></button>`).join('')}</div>`;
    const ajout = { groupes: ['groupe', 'Groupe'], formateurs: ['formateur', 'Formateur'], salles: ['salle', 'Salle'], modules: ['module', 'Module'] }[f];
    let corps = '';
    const planningBtn = (type, id) => `<button class="btn petit" data-action="planning-de" data-type="${type}" data-id="${id}">Planning</button>`;
    if (f === 'groupes') {
      corps = E.groupes.length ? `<ul class="cartes-res">${E.groupes.map((g) => { const ms = E.modules.filter((m) => m.groupe === g.id); const tg = h.parGroupe.find((x) => x.id === g.id); return `<li class="carte-res"><button class="lien-ligne" data-action="groupe" data-id="${g.id}"><b>${esc(g.nom)}</b><span>${pluriel(g.effectif, 'personne')} · ${pluriel(ms.length, 'module')} · ${hT(tg.prevu)} prévues</span></button><div class="rang">${planningBtn('groupe', g.id)}<button class="btn petit" data-action="groupe" data-id="${g.id}">Modifier</button></div></li>`; }).join('')}</ul>` : videEtat('Aucun groupe', 'Une classe, une promotion, un groupe de stagiaires : son nom et son effectif (un nombre, aucun nom d\'apprenant).');
    } else if (f === 'formateurs') {
      corps = E.formateurs.length ? `<ul class="cartes-res">${E.formateurs.map((x) => { const hf = h.parFormateur.find((y) => y.id === x.id); const ind = indisposTexte(x); return `<li class="carte-res"><button class="lien-ligne" data-action="formateur" data-id="${x.id}"><b>${esc(x.nom)}</b><span>${hT(hf.place)} placées${x.quota ? ` sur ${hT(x.quota * 60)} de quota` : ''}${hf.depasse ? ' · <b class="negatif">quota dépassé</b>' : ''}</span>${ind ? `<span>Indisponible : ${esc(ind)}</span>` : ''}${x.absences.length ? `<span>${pluriel(x.absences.length, 'absence')} notée${x.absences.length > 1 ? 's' : ''}</span>` : ''}</button><div class="rang">${planningBtn('formateur', x.id)}<button class="btn petit" data-action="formateur" data-id="${x.id}">Modifier</button></div></li>`; }).join('')}</ul>` : videEtat('Aucun formateur', 'Son nom (ou prénom et initiale), son quota d\'heures si tu en as un, et les créneaux où il n\'est pas disponible.');
    } else if (f === 'salles') {
      corps = E.salles.length ? `<ul class="cartes-res">${E.salles.map((x) => `<li class="carte-res"><button class="lien-ligne" data-action="salle" data-id="${x.id}"><b>${esc(x.nom)}</b><span>${x.capacite ? pluriel(x.capacite, 'place') : 'capacité non renseignée'}</span>${x.equipements.length ? `<span>${esc(x.equipements.join(' · '))}</span>` : ''}</button><div class="rang">${planningBtn('salle', x.id)}<button class="btn petit" data-action="salle" data-id="${x.id}">Modifier</button></div></li>`).join('')}</ul>` : videEtat('Aucune salle', 'Son nom, sa capacité et ses équipements : les conflits de capacité et d\'équipement en dépendent.');
    } else {
      corps = E.modules.length ? E.groupes.map((g) => {
        const ms = E.modules.filter((m) => m.groupe === g.id);
        if (!ms.length) return '';
        return `<section class="groupe-cat"><h3 class="titre-cat"><span class="tc-nom">${esc(g.nom)}</span><span>${pluriel(ms.length, 'module')}</span></h3><ul class="cartes-res">${ms.map((m) => { const x = h.parModule.find((y) => y.id === m.id); const col = couleur(m); return `<li class="carte-res" style="border-left:8px solid ${col.bord}"><button class="lien-ligne" data-action="module" data-id="${m.id}"><b>${esc(m.nom)}</b><span>${m.formateur ? esc(nomF(m.formateur)) : '<i class="manque">formateur à désigner</i>'} · ${m.volume ? `${hT(m.volume * 60)} prévues` : 'volume non renseigné'} · ${hT(x.place)} placées</span>${m.equipement ? `<span>Demande : ${esc(m.equipement)}</span>` : ''}</button><div class="rang"><button class="btn petit" data-action="module" data-id="${m.id}">Modifier</button></div></li>`; }).join('')}</ul></section>`;
      }).join('') : videEtat('Aucun module', E.groupes.length ? 'Un module (ou une matière) appartient à un groupe : son volume d\'heures prévu, son formateur habituel, l\'équipement qu\'il demande.' : 'Ajoute d\'abord un groupe : chaque module lui appartient.');
    }
    return `<div class="vue-tete"><div><h1>Ressources</h1><p>Ce que la grille sait vérifier vient d'ici : effectifs, disponibilités, quotas, capacités, équipements et volumes prévus.</p></div>
        <div class="actions"><button class="btn primaire" data-action="${ajout[0]}" ${f === 'modules' && !E.groupes.length ? 'disabled' : ''}>${ICONES.plus}${ajout[1]}</button></div></div>
      ${puces}<div style="margin-top:18px">${corps}</div>${RGPD}${AVERTISSEMENT}`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const r = E.reglages;
    const annee = `<form id="form-annee" class="graphique form-annee" novalidate>
        <div class="rang-champs"><label class="champ">Début de l'année<input name="debut" type="date" value="${r.debut}"></label><label class="champ">Fin de l'année<input name="fin" type="date" value="${r.fin}"></label></div>
        <fieldset class="champ"><legend>Jours de cours</legend><div class="cases">${[1, 2, 3, 4, 5, 6].map((j) => `<label class="case"><input type="checkbox" name="jour" value="${j}" ${r.jours.includes(j) ? 'checked' : ''}> ${R.JOURS[j % 7]}</label>`).join('')}</div></fieldset>
        <div class="cases"><label class="case"><input type="checkbox" name="alternance" ${r.alternance ? 'checked' : ''}> Semaines A et B</label><label class="case"><input type="checkbox" name="alsace" ${r.alsaceMoselle ? 'checked' : ''}> Alsace-Moselle (Vendredi saint, 26 décembre)</label></div>
        <p class="erreur" role="alert"></p>
        <div class="rang"><button class="btn primaire" type="submit">Enregistrer</button></div></form>`;
    const creneaux = `<ul class="mini-liste">${r.creneaux.map((c) => `<li><span><b>${c.debut} – ${c.fin}</b> · ${R.dureeTexte(R.hMin(c.fin) - R.hMin(c.debut))}</span><button class="btn petit" data-action="creneau" data-id="${c.id}">Modifier</button></li>`).join('') || '<li>Aucun créneau.</li>'}</ul>`;
    const fermetures = `<ul class="mini-liste">${[...E.fermetures].sort((a, b) => a.debut.localeCompare(b.debut)).map((f) => `<li><span><b>${esc(f.nom)}</b> · ${f.debut === f.fin ? esc(dateCourte(f.debut)) : `${esc(dateCourte(f.debut))} → ${esc(dateCourte(f.fin))}`}</span><button class="btn petit" data-action="fermeture" data-id="${f.id}">Modifier</button></li>`).join('') || '<li>Aucune fermeture saisie.</li>'}</ul>`;
    const fe = R.estDate(r.debut) && R.estDate(r.fin) ? R.feriesEntre(r.debut, r.fin, r.alsaceMoselle) : [];
    const feries = `<ul class="feries-liste">${fe.map((x) => `<li><span class="date-pastille"><b>${R.versDate(x.date).getDate()}</b>${moisCourt(x.date)}</span><span><b>${esc(x.nom)}</b><small>${R.JOURS[R.versDate(x.date).getDay()]}${r.jours.includes(R.jourSem(x.date)) ? '' : ' · jour sans cours'}</small></span></li>`).join('') || '<li>Indique les dates de l\'année.</li>'}</ul>`;
    const semaines = SEM.length ? `<div class="semaines">${SEM.map((w) => `<button class="semaine-puce ${w.fermee ? 'fermee' : ''} ${w.type ? `t${w.type}` : ''} ${w.lundi === R.lundi(auj()) ? 'courante' : ''}" data-action="aller-semaine" data-date="${w.lundi}" title="${esc(libelleSemaine(w.lundi))}"><b>S${w.numero}</b><span>${w.fermee ? 'fermée' : w.type || R.dateFr(w.lundi)}</span></button>`).join('')}</div>` : '';
    return `<div class="vue-tete"><div><h1>Calendrier</h1><p>L'année, les jours de cours, les créneaux de la journée, les fermetures et les jours fériés (calculés pour la France).</p></div></div>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Année</h2>${annee}</section>
        <section><h2 class="titre-section">Créneaux <button class="btn petit" data-action="creneau">${ICONES.plus}Créneau</button></h2>${creneaux}
          <h2 class="titre-section">Fermetures <button class="btn petit" data-action="fermeture">${ICONES.plus}Fermeture</button></h2><p class="aide">Vacances, ponts, fermeture de l'établissement : aucune séance n'est recopiée sur ces jours, et une séance placée dessus est signalée.</p>${fermetures}</section>
      </div>
      <h2 class="titre-section">Jours fériés <span>${pluriel(fe.length, 'jour')} dans l'année</span></h2>${feries}
      ${semaines ? `<h2 class="titre-section">Semaines <span>${r.alternance ? 'type A ou B ; une semaine fermée ne compte pas dans l\'alternance' : 'touche une semaine pour l\'ouvrir'}</span></h2>${semaines}` : ''}
      <p class="mention avertissement">Jours fériés : les 11 fêtes légales de l'article L3133-1 du Code du travail, dates de Pâques calculées (algorithme grégorien), plus Vendredi saint et 26 décembre en Alsace-Moselle si coché. Que l'établissement soit fermé ces jours-là dépend de ton organisation : une séance placée un jour férié est signalée, tu peux la garder.</p>`;
  }
  function enregistrerAnnee(fd) {
    const debut = String(fd.get('debut')), fin = String(fd.get('fin'));
    const jours = fd.getAll('jour').map(Number);
    const err = $('#form-annee .erreur');
    if (!R.estDate(debut) || !R.estDate(fin) || fin <= debut) { err.textContent = 'Indique le début et la fin de l\'année (la fin après le début).'; return; }
    if (!jours.length) { err.textContent = 'Coche au moins un jour de cours.'; return; }
    retenir();
    E.reglages = R.normaliserReglages({ ...E.reglages, debut, fin, jours, alternance: fd.get('alternance') === 'on', alsaceMoselle: fd.get('alsace') === 'on' }, B);
    sauver(); rendre();
    toast('Calendrier enregistré.', { libelle: 'Annuler', faire: annuler });
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
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const options = (l, val, vide, lib = (x) => x.nom) => `${vide !== null ? `<option value="">${esc(vide)}</option>` : ''}${l.map((x) => `<option value="${x.id}" ${x.id === val ? 'selected' : ''}>${esc(lib(x))}</option>`).join('')}`;
  const nombre = (v) => { const n = Number(String(v ?? '').trim().replace(',', '.')); return String(v ?? '').trim() === '' ? 0 : Number.isFinite(n) && n >= 0 ? n : null; };

  function enregistrer(liste, objet, message) {
    retenir();
    const i = E[liste].findIndex((x) => x.id === objet.id);
    if (i >= 0) E[liste][i] = objet; else E[liste].push(objet);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function supprimer(type, id, nom) {
    const imp = R.impactSuppression(E, type, id);
    const detail = type === 'groupe' ? `ses ${pluriel(imp.modules, 'module')} et ${pluriel(imp.seances, 'séance')}` : type === 'module' ? pluriel(imp.seances, 'séance') : imp.seances ? `${pluriel(imp.seances, 'séance')} restera « à désigner »` : '';
    if (!confirm(`Supprimer « ${nom} »${detail ? ` (${detail})` : ''} ?`)) return false;
    retenir();
    E = R.supprimerRessource(E, type, id);
    sauver(); rendre();
    toast(`${NOM_TYPE[type] || 'Module'} supprimé.`, { libelle: 'Annuler', faire: annuler });
    return true;
  }

  // Séance : création (depuis une case ou le bouton) ou modification, avec aperçu des conflits.
  function modaleSeance(id, prerempli = {}) {
    const s0 = id ? trouver('seances', id) : null;
    const cr = E.reglages.creneaux;
    const c0 = cr.find((c) => c.id === prerempli.c) || cr[0];
    const res = ressourceCourante();
    // Préremplissage selon la vue : le groupe, le formateur ou la salle affichés.
    const modDefaut = plan.type === 'groupe' ? E.modules.find((m) => m.groupe === res?.id) : plan.type === 'formateur' ? E.modules.find((m) => m.formateur === res?.id) : null;
    const s = s0 ? { ...s0 } : {
      date: prerempli.date || (plan.jour && R.lundi(plan.jour) === plan.lundi ? plan.jour : R.joursDeSemaine(E, plan.lundi).find((d) => !R.fermeture(E, d)) || plan.lundi), debut: c0?.debut || '08:00', fin: c0?.fin || '09:00',
      module: modDefaut?.id || E.modules[0]?.id || '', formateur: plan.type === 'formateur' ? res?.id : (modDefaut?.formateur || ''), salle: plan.type === 'salle' ? res?.id : '',
    };
    const optMods = E.groupes.map((g) => { const ms = E.modules.filter((m) => m.groupe === g.id); return ms.length ? `<optgroup label="${esc(g.nom)} · ${g.effectif} pers.">${ms.map((m) => `<option value="${m.id}" ${m.id === s.module ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</optgroup>` : ''; }).join('');
    const optCr = (val, cle) => `<option value="">Créneau…</option>${cr.map((c) => `<option value="${c.id}" ${c[cle] === val ? 'selected' : ''}>${c.debut} – ${c.fin}</option>`).join('')}`;
    const corps = `
      <label class="champ">Module <small>il donne le groupe</small><select name="module" id="m-module">${optMods}</select></label>
      <div class="rang-champs"><label class="champ">Jour<input name="date" type="date" value="${s.date}"></label></div>
      <div class="rang-champs"><label class="champ">Du créneau<select id="m-cr-debut">${optCr(s.debut, 'debut')}</select></label><label class="champ">Au créneau<select id="m-cr-fin">${optCr(s.fin, 'fin')}</select></label></div>
      <div class="rang-champs"><label class="champ">Début<input name="debut" type="time" value="${s.debut}" step="300"></label><label class="champ">Fin<input name="fin" type="time" value="${s.fin}" step="300"></label></div>
      <label class="champ">Formateur<select name="formateur" id="m-formateur">${options(E.formateurs, s.formateur, 'À désigner')}</select></label>
      <label class="champ">Salle<select name="salle">${options(E.salles, s.salle, 'À désigner', (x) => `${x.nom}${x.capacite ? ` · ${x.capacite} places` : ''}`)}</select></label>
      <label class="champ">Note <small>facultatif (aucune donnée personnelle)</small><input name="note" value="${esc(s.note || '')}" maxlength="200"></label>
      ${s0 ? `<label class="case"><input type="checkbox" name="annulee" ${s.annulee ? 'checked' : ''}> Séance annulée (gardée pour mémoire, hors heures et hors conflits)</label>` : ''}
      <div class="apercu" id="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s0 ? 'Modifier la séance' : 'Nouvelle séance', corps, PIED(!!s0), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.seances = E.seances.filter((x) => x.id !== s0.id); sauver(); rendre(); toast('Séance supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      const n = lire(fd);
      const err = R.validerSeance(E, n);
      if (err) return err;
      enregistrer('seances', n, s0 ? 'Séance modifiée.' : 'Séance ajoutée.');
      return undefined;
    });
    const f = modale().querySelector('form');
    function lire(fd) { return R.normaliserSeance({ ...(s0 || {}), id: s0?.id || uid(), date: fd.get('date'), debut: fd.get('debut'), fin: fd.get('fin'), module: fd.get('module'), formateur: fd.get('formateur'), salle: fd.get('salle'), note: fd.get('note'), annulee: fd.get('annulee') === 'on' }); }
    const apercu = () => {
      const fd = new FormData(f);
      const n = lire(fd);
      const el = $('#apercu');
      const err = R.validerSeance(E, n);
      if (err || n.annulee) { el.innerHTML = ''; return; }
      const essai = { ...E, seances: E.seances.filter((x) => x.id !== n.id).concat(n) };
      const cf = R.conflits(essai).parSeance.get(n.id) || [];
      const m = module_(n.module);
      el.innerHTML = `<p>${esc(nomG(m?.groupe))} · ${R.dureeTexte(R.duree(n))}${typeSemaineTxt(n.date)}</p>${cf.length ? cf.map((c) => `<p class="cd-alerte ${c.gravite}">⚠ ${esc(c.texte)}</p>`).join('') : '<p class="cd-ok">Aucun conflit.</p>'}`;
    };
    f.addEventListener('input', apercu);
    $('#m-module').addEventListener('change', (e) => { const m = module_(e.target.value); if (m?.formateur && (!s0 || !f.formateur.value)) f.formateur.value = m.formateur; apercu(); });
    $('#m-cr-debut').addEventListener('change', (e) => { const c = cr.find((x) => x.id === e.target.value); if (!c) return; f.debut.value = c.debut; if (R.hMin(f.fin.value) <= R.hMin(c.debut)) { f.fin.value = c.fin; $('#m-cr-fin').value = c.id; } apercu(); });
    $('#m-cr-fin').addEventListener('change', (e) => { const c = cr.find((x) => x.id === e.target.value); if (!c) return; f.fin.value = c.fin; apercu(); });
    apercu();
  }
  const typeSemaineTxt = (d) => { const w = semaineInfo(R.lundi(d)); return w?.type ? ` · semaine ${w.type}` : ''; };

  function modaleGroupe(id) {
    const g = id ? groupe(id) : null;
    const corps = `<label class="champ">Nom du groupe<small>classe, promotion, groupe de stagiaires</small><input name="nom" value="${esc(g?.nom || '')}" maxlength="60" required></label>
      <label class="champ">Effectif<small>un nombre : aucun nom d'apprenant n'est demandé</small><input name="effectif" inputmode="numeric" value="${g ? g.effectif : ''}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(g ? 'Modifier le groupe' : 'Nouveau groupe', corps, PIED(!!g), (fd, v) => {
      if (v === 'supprimer') { supprimer('groupe', g.id, g.nom); return undefined; }
      const nom = String(fd.get('nom')).trim();
      const eff = nombre(fd.get('effectif'));
      if (!nom) return 'Donne un nom au groupe.';
      if (eff === null || !Number.isInteger(eff) || eff > 999) return 'L\'effectif est un nombre entier (999 au plus).';
      enregistrer('groupes', R.normaliserGroupe({ ...(g || {}), id: g?.id || uid(), nom, effectif: eff }), g ? 'Groupe modifié.' : 'Groupe ajouté.');
      return undefined;
    });
  }

  function modaleFormateur(id) {
    const x = id ? formateur(id) : null;
    const r = E.reglages;
    const dispo = `<fieldset class="champ cadre-champs"><legend>Disponibilités chaque semaine<small>décoche les créneaux où le formateur n'est pas disponible</small></legend>
      <div class="defile"><table class="tableau petit dispos"><thead><tr><th></th>${r.jours.map((j) => `<th>${R.JOURS_COURTS[j]}</th>`).join('')}</tr></thead><tbody>${r.creneaux.map((c) => `<tr><th>${c.debut}</th>${r.jours.map((j) => `<td><label><input type="checkbox" name="dispo" value="${j}-${c.id}" ${x?.indispos.includes(`${j}-${c.id}`) ? '' : 'checked'}><span class="sr-only">${R.JOURS[j % 7]} ${c.debut}</span></label></td>`).join('')}</tr>`).join('')}</tbody></table></div></fieldset>`;
    const abs = (x?.absences || []).map((a, i) => `<li><span>${a.debut === a.fin ? esc(dateCourte(a.debut)) : `${esc(dateCourte(a.debut))} → ${esc(dateCourte(a.fin))}`}</span><label class="case"><input type="checkbox" name="garder-abs" value="${i}" checked> garder</label></li>`).join('');
    const corps = `<label class="champ">Nom<small>nom, ou prénom et initiale</small><input name="nom" value="${esc(x?.nom || '')}" maxlength="60" required></label>
      <label class="champ">Quota d'heures sur l'année<small>facultatif : heures au plus (contrat, convention) ; au-delà, les séances sont signalées</small><input name="quota" inputmode="decimal" value="${x?.quota || ''}"></label>
      ${r.creneaux.length ? dispo : ''}
      <fieldset class="champ cadre-champs"><legend>Absences datées<small>sans motif : seules les dates comptent</small></legend>
        ${abs ? `<ul class="mini-liste">${abs}</ul>` : ''}
        <div class="rang-champs"><label class="champ">Du<input name="abs-debut" type="date"></label><label class="champ">Au<input name="abs-fin" type="date"></label></div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier le formateur' : 'Nouveau formateur', corps, PIED(!!x), (fd, v) => {
      if (v === 'supprimer') { supprimer('formateur', x.id, x.nom); return undefined; }
      const nom = String(fd.get('nom')).trim();
      const quota = nombre(fd.get('quota'));
      if (!nom) return 'Indique le nom du formateur.';
      if (quota === null) return 'Le quota est un nombre d\'heures (ou laisse vide).';
      const dispo2 = new Set(fd.getAll('dispo'));
      const indispos = r.jours.flatMap((j) => r.creneaux.map((c) => `${j}-${c.id}`)).filter((k) => !dispo2.has(k));
      const garder = new Set(fd.getAll('garder-abs').map(Number));
      const absences = (x?.absences || []).filter((_, i) => garder.has(i));
      const d1 = String(fd.get('abs-debut')), d2 = String(fd.get('abs-fin'));
      if (R.estDate(d1)) { if (R.estDate(d2) && d2 < d1) return 'La fin de l\'absence doit être après son début.'; absences.push({ debut: d1, fin: R.estDate(d2) ? d2 : d1 }); }
      enregistrer('formateurs', R.normaliserFormateur({ ...(x || {}), id: x?.id || uid(), nom, quota, indispos, absences }), x ? 'Formateur modifié.' : 'Formateur ajouté.');
      return undefined;
    });
  }

  function modaleSalle(id) {
    const x = id ? salle(id) : null;
    const eqs = [...new Set(E.reglages.equipements.concat(x?.equipements || []))];
    const corps = `<label class="champ">Nom de la salle<input name="nom" value="${esc(x?.nom || '')}" maxlength="60" required></label>
      <label class="champ">Capacité<small>nombre de places</small><input name="capacite" inputmode="numeric" value="${x ? x.capacite : ''}"></label>
      <fieldset class="champ"><legend>Équipements</legend><div class="cases">${eqs.map((q) => `<label class="case"><input type="checkbox" name="eq" value="${esc(q)}" ${x?.equipements.includes(q) ? 'checked' : ''}> ${esc(q)}</label>`).join('')}</div></fieldset>
      <label class="champ">Autre équipement<small>ajouté aussi à la liste commune</small><input name="autre" maxlength="40"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier la salle' : 'Nouvelle salle', corps, PIED(!!x), (fd, v) => {
      if (v === 'supprimer') { supprimer('salle', x.id, x.nom); return undefined; }
      const nom = String(fd.get('nom')).trim();
      const cap = nombre(fd.get('capacite'));
      if (!nom) return 'Donne un nom à la salle.';
      if (cap === null || !Number.isInteger(cap)) return 'La capacité est un nombre entier de places.';
      const eq = fd.getAll('eq').map(String);
      const autre = String(fd.get('autre')).trim();
      if (autre) { eq.push(autre); if (!E.reglages.equipements.includes(autre)) E.reglages.equipements.push(autre); }
      enregistrer('salles', R.normaliserSalle({ ...(x || {}), id: x?.id || uid(), nom, capacite: cap, equipements: eq }), x ? 'Salle modifiée.' : 'Salle ajoutée.');
      return undefined;
    });
  }

  function modaleModule(id) {
    const m = id ? module_(id) : null;
    const gDefaut = m?.groupe || (filtre.heures || (plan.type === 'groupe' ? plan.id : '')) || E.groupes[0]?.id;
    const coul = m ? m.couleur : E.modules.length % B.couleurs.length;
    const corps = `<label class="champ">Nom du module<small>matière, unité de formation, cours</small><input name="nom" value="${esc(m?.nom || '')}" maxlength="80" required></label>
      <label class="champ">Groupe<select name="groupe">${options(E.groupes, gDefaut, null)}</select></label>
      <div class="rang-champs"><label class="champ">Volume prévu (heures)<input name="volume" inputmode="decimal" value="${m?.volume || ''}"></label>
      <label class="champ">Formateur habituel<select name="formateur">${options(E.formateurs, m?.formateur || '', 'À désigner')}</select></label></div>
      <label class="champ">Équipement demandé<small>une salle sans cet équipement sera signalée</small><select name="equipement"><option value="">Aucun</option>${E.reglages.equipements.map((q) => `<option ${q === m?.equipement ? 'selected' : ''}>${esc(q)}</option>`).join('')}</select></label>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${i === coul ? 'checked' : ''}><span style="--c:${c.fond};border-color:${c.bord}"></span><b class="sr-only">Couleur ${i + 1}</b></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Modifier le module' : 'Nouveau module', corps, PIED(!!m), (fd, v) => {
      if (v === 'supprimer') { supprimer('module', m.id, m.nom); return undefined; }
      const nom = String(fd.get('nom')).trim();
      const vol = nombre(fd.get('volume'));
      if (!nom) return 'Donne un nom au module.';
      if (!fd.get('groupe')) return 'Choisis le groupe.';
      if (vol === null) return 'Le volume est un nombre d\'heures (ou laisse vide).';
      enregistrer('modules', R.normaliserModule({ ...(m || {}), id: m?.id || uid(), nom, groupe: fd.get('groupe'), formateur: fd.get('formateur'), volume: vol, equipement: fd.get('equipement'), couleur: Number(fd.get('couleur')) }), m ? 'Module modifié.' : 'Module ajouté.');
      return undefined;
    });
  }

  function modaleCreneau(id) {
    const c = id ? E.reglages.creneaux.find((x) => x.id === id) : null;
    const corps = `<div class="rang-champs"><label class="champ">Début<input name="debut" type="time" value="${c?.debut || ''}" step="300"></label><label class="champ">Fin<input name="fin" type="time" value="${c?.fin || ''}" step="300"></label></div>
      <p class="aide">Les séances déjà placées gardent leurs heures ; la grille les range dans les créneaux qu'elles recouvrent.</p><p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Modifier le créneau' : 'Nouveau créneau', corps, PIED(!!c), (fd, v) => {
      retenir();
      if (v === 'supprimer') { E.reglages.creneaux = E.reglages.creneaux.filter((x) => x.id !== c.id); E.formateurs.forEach((f) => { f.indispos = f.indispos.filter((k) => !k.endsWith(`-${c.id}`)); }); sauver(); rendre(); toast('Créneau supprimé.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      const debut = String(fd.get('debut')), fin = String(fd.get('fin'));
      if (!R.estHeure(debut) || !R.estHeure(fin) || R.hMin(fin) <= R.hMin(debut)) return 'Indique une heure de début et une heure de fin après le début.';
      const n = { id: c?.id || uid(), debut, fin };
      E.reglages = R.normaliserReglages({ ...E.reglages, creneaux: E.reglages.creneaux.filter((x) => x.id !== n.id).concat(n) }, B);
      sauver(); rendre(); toast(c ? 'Créneau modifié.' : 'Créneau ajouté.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  function modaleFermeture(id) {
    const f = id ? E.fermetures.find((x) => x.id === id) : null;
    const corps = `<label class="champ">Nom<small>vacances, pont, fermeture</small><input name="nom" value="${esc(f?.nom || '')}" maxlength="60"></label>
      <div class="rang-champs"><label class="champ">Du<input name="debut" type="date" value="${f?.debut || ''}"></label><label class="champ">Au (inclus)<input name="fin" type="date" value="${f?.fin || ''}"></label></div><p class="erreur" role="alert"></p>`;
    ouvrirModale(f ? 'Modifier la fermeture' : 'Nouvelle fermeture', corps, PIED(!!f), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.fermetures = E.fermetures.filter((x) => x.id !== f.id); sauver(); rendre(); toast('Fermeture supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      const debut = String(fd.get('debut')), fin = String(fd.get('fin') || fd.get('debut'));
      if (!R.estDate(debut)) return 'Indique le premier jour de fermeture.';
      if (R.estDate(fin) && fin < debut) return 'Le dernier jour doit être après le premier.';
      enregistrer('fermetures', R.normaliserFermeture({ id: f?.id || uid(), nom: fd.get('nom'), debut, fin }), f ? 'Fermeture modifiée.' : 'Fermeture ajoutée.');
      return undefined;
    });
  }

  // Duplication de la semaine affichée.
  function modaleDupliquer() {
    const res = ressourceCourante();
    const l = plan.lundi;
    const w = semaineInfo(l);
    const corps = `<p>Recopier la <b>${esc(libelleSemaine(l).replace('Semaine du', 'semaine du'))}</b> sur d'autres semaines. Les jours fériés et les fermetures sont sautés.</p>
      <fieldset class="champ"><legend>Quelles séances</legend><div class="choix-statut deux">
        <label><input type="radio" name="portee" value="ressource" checked><span>${esc(res ? `${NOM_TYPE[plan.type]} : ${res.nom}` : 'Cette vue')}</span></label>
        <label><input type="radio" name="portee" value="tout"><span>Tout l'établissement</span></label></div></fieldset>
      <fieldset class="champ"><legend>Vers</legend><div class="choix-statut deux">
        <label><input type="radio" name="vers" value="suivante" checked><span>La semaine suivante</span></label>
        <label><input type="radio" name="vers" value="jusqua"><span>Toutes jusqu'au…</span></label></div></fieldset>
      <label class="champ">Jusqu'au (inclus)<input name="jusqua" type="date" value="${E.reglages.fin || R.ajout(l, 35)}"></label>
      ${E.reglages.alternance && w?.type ? `<label class="case"><input type="checkbox" name="memeType" checked> Seulement les semaines ${w.type}</label>` : ''}
      <label class="case"><input type="checkbox" name="remplacer"> Remplacer les séances déjà placées (pour ces séances) dans les semaines cibles</label>
      <div class="apercu" id="apercu" aria-live="polite"></div><p class="erreur" role="alert"></p>`;
    const calcul = (fd) => {
      const portee = fd.get('portee') === 'tout' || !res ? { type: 'tout' } : { type: plan.type, id: res.id };
      const memeType = fd.get('memeType') === 'on';
      let cibles;
      if (fd.get('vers') === 'suivante') { const t = R.ciblesDuplication(E, l, { jusqua: R.ajout(l, 7 * 20), memeType }); cibles = t.slice(0, 1); if (!SEM.length) cibles = [R.ajout(l, 7)]; } else cibles = R.ciblesDuplication(E, l, { jusqua: String(fd.get('jusqua')), memeType });
      return { cibles, r: R.dupliquerSemaine(E, l, cibles, { portee, remplacer: fd.get('remplacer') === 'on' }) };
    };
    ouvrirModale('Dupliquer la semaine', corps, '<button class="btn primaire" value="ok">Dupliquer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const { cibles, r } = calcul(fd);
      if (!r.modele) return 'Aucune séance à recopier dans cette semaine.';
      if (!cibles.length) return 'Aucune semaine cible (vérifie la date et la fin de l\'année).';
      retenir();
      E = r.etat;
      sauver(); rendre();
      toast(`${pluriel(r.ajoutees, 'séance ajoutée', 'séances ajoutées')} sur ${pluriel(cibles.length, 'semaine')}${r.sautees ? `, ${r.sautees} sautée${r.sautees > 1 ? 's' : ''} (jours fermés)` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    const apercu = () => {
      const { cibles, r } = calcul(new FormData(f));
      $('#apercu').innerHTML = !r.modele ? '<p class="cd-alerte jaune">Aucune séance à recopier dans cette semaine pour ce choix.</p>'
        : `<p>${pluriel(r.modele, 'séance')} × ${pluriel(cibles.length, 'semaine')}${cibles.length ? ` (${esc(R.dateFr(cibles[0]))}${cibles.length > 1 ? ` → ${esc(R.dateFr(cibles[cibles.length - 1]))}` : ''})` : ''} : ${pluriel(r.ajoutees, 'séance ajoutée', 'séances ajoutées')}${r.sautees ? `, ${r.sautees} sautée${r.sautees > 1 ? 's' : ''} (jours fermés)` : ''}${r.retirees ? `, ${r.retirees} remplacée${r.retirees > 1 ? 's' : ''}` : ''}.</p>`;
    };
    f.addEventListener('input', apercu);
    apercu();
  }

  // ---------- Impression (A4 paysage) ----------
  function imprimer(html) {
    const el = $('#impression');
    el.innerHTML = html;
    el.hidden = false;
    document.body.classList.add('imprime');
    if (modale().open) modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }
  function imprimerSemaine() {
    const res = ressourceCourante();
    if (!res) return;
    const l = plan.lundi, cr = E.reglages.creneaux;
    const jours = R.joursDeSemaine(E, l);
    const seances = R.seancesDe(E, plan.type, res.id, l, R.ajout(l, 6)).filter((s) => !s.annulee);
    const cellule = (d, k) => seances.filter((s) => s.date === d && R.creneauxCouverts(s, cr)[0] === k).map((s) => { const m = module_(s.module); const cf = C.parSeance.get(s.id) || []; return `<div class="imp-se" style="border-left-color:${couleur(m).bord}"><b>${esc(m?.nom || '')}</b><span>${s.debut}–${s.fin}</span><span>${detailSeance(s)}</span>${cf.some((c) => c.gravite !== 'info') ? '<span class="imp-cf">⚠ conflit</span>' : ''}</div>`; }).join('');
    const corps = cr.map((c, k) => `<tr><th class="imp-h">${c.debut}<br><small>${c.fin}</small></th>${jours.map((d) => { const fe = R.fermeture(E, d); return `<td class="${fe ? 'imp-ferme' : ''}">${cellule(d, k)}</td>`; }).join('')}</tr>`).join('');
    const sousTitre = plan.type === 'groupe' ? `${res.effectif} personnes` : plan.type === 'salle' ? `${res.capacite} places${res.equipements.length ? ` · ${res.equipements.join(', ')}` : ''}` : '';
    imprimer(`<header class="imp-tete"><div><p class="surtitre">${esc(E.reglages.etablissement || 'Emploi du temps')} · ${NOM_TYPE[plan.type]}</p><h1>${esc(res.nom)}</h1><p>${esc(sousTitre)}</p></div><div class="imp-km"><b>${esc(libelleSemaine(l).split(' · ')[0])}</b><span>${esc(libelleSemaine(l).split(' · ').slice(1).join(' · '))}</span></div></header>
      <table class="tableau imp-grille"><thead><tr><th></th>${jours.map((d) => { const fe = R.fermeture(E, d); return `<th>${esc(dateCourte(d))}${fe ? `<br><small>${esc(fe.nom)}</small>` : ''}</th>`; }).join('')}</tr></thead><tbody>${corps}</tbody></table>
      <p class="mention">${pluriel(seances.length, 'séance')} · ${hT(R.totalMinutes(seances))} · imprimé le ${esc(R.dateFrLongue(auj()))}.</p>`);
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const res = vue === 'planning' ? ressourceCourante() : null;
    const corps = `
      <label class="champ">Nom de l'établissement<small>affiché sur les impressions</small><input name="etablissement" value="${esc(E.reglages.etablissement)}" maxlength="80"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule) : les séances avec leurs conflits, ou le bilan des heures.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-semaine">Séances de la semaine affichée</button><button class="btn petit" type="button" data-action="csv-annee">Séances de l'année</button><button class="btn petit" type="button" data-action="csv-heures">Bilan des heures</button>${res ? '<button class="btn petit" type="button" data-action="imprimer">Imprimer la semaine</button>' : ''}</div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton emploi du temps est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${Math.round(t / 1000)} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte puis retire les semaines passées.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer les séances avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute l'emploi du temps à ton écran d'accueil pour l'ouvrir comme une application, entre deux cours ou à l'accueil.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention avertissement-rgpd">L'emploi du temps est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. N'y mets que le nom (ou le prénom et l'initiale) des formateurs et le nom des groupes : <b>aucun nom d'apprenant</b>, l'effectif suffit. Les absences se notent sans motif. Informe les formateurs que leur planning est tenu ici et efface ce qui ne sert plus en fin d'année.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Placement manuel : aucune optimisation automatique. Jours fériés calculés (Code du travail, art. L3133-1). Les conflits sont calculés sur cet appareil à partir de ce que tu saisis. Aucune connexion à un agenda, un logiciel de scolarité ou une autre application : le planning s'imprime et s'exporte.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      E.reglages = R.normaliserReglages({ ...E.reglages, etablissement: fd.get('etablissement') }, B);
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.seances) || !Array.isArray(donnees.groupes)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.groupes.length, 'groupe')}, ${pluriel(donnees.seances.length, 'séance')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de l\'emploi du temps.'); }
    });
  }
  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.seances.filter((s) => s.date < d).length;
    if (!n) { toast('Aucune séance avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'séance')} antérieure${n > 1 ? 's' : ''} au ${R.dateFrLongue(d)} ? Pense à exporter l'année en CSV avant.`)) return;
    retenir();
    E = R.purgerAvant(E, d).etat;
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
  const nomFichier = (t) => R.plat(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `emploi-du-temps-${auj()}.json`);
  const CSV = 'text/csv;charset=utf-8';
  function csvSemaine() { const res = ressourceCourante(); const opt = { debut: plan.lundi, fin: R.ajout(plan.lundi, 6) }; if (res && vue === 'planning') Object.assign(opt, { type: plan.type, id: res.id }); telecharger(R.csvSeances(E, opt), CSV, `seances-${res && vue === 'planning' ? `${nomFichier(res.nom)}-` : ''}${plan.lundi}.csv`); }
  const csvAnnee = () => telecharger(R.csvSeances(E, { debut: E.reglages.debut || '0000-01-01', fin: E.reglages.fin || '9999-12-31' }), CSV, `seances-annee-${auj()}.csv`);
  const csvHeures = () => telecharger(R.csvHeures(E, maintenant()), CSV, `heures-${auj()}.csv`);

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
      <p>Enregistre cet emploi du temps sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  function allerA(date, type, id) {
    plan.lundi = R.lundi(date); plan.jour = date;
    if (type) { plan.type = type; if (id) plan.id = id; sauverPref(); }
    if (modale().open) modale().close();
    changerVue('planning');
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
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
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-semaine': csvSemaine(); break;
      case 'csv-annee': csvAnnee(); break;
      case 'csv-heures': csvHeures(); break;
      case 'purger': purger(); break;
      case 'imprimer': imprimerSemaine(); break;
      case 'fermer': modale().close(); break;
      case 'mode': plan.type = el.dataset.type; plan.id = ''; ressourceCourante(); sauverPref(); rendre(); break;
      case 'semaine': { const s = Number(el.dataset.sens); plan.lundi = s ? R.ajout(plan.lundi, 7 * s) : lundiParDefaut(); plan.jour = ''; rendre(); break; }
      case 'jour': plan.jour = el.dataset.date; rendre(); break;
      case 'aller-semaine': allerA(el.dataset.date); break;
      case 'planning-de': allerA(plan.lundi, el.dataset.type, id); break;
      case 'nouvelle': if (!E.modules.length) { toast('Ajoute d\'abord un groupe et un module (onglet Ressources).'); break; } if (!E.reglages.creneaux.length) { toast('Ajoute d\'abord des créneaux (onglet Calendrier).'); break; } modaleSeance(null, { date: el.dataset.date, c: el.dataset.c }); break;
      case 'seance': modaleSeance(id); break;
      case 'voir-conflit': { const s = trouver('seances', id); if (!s) break; if (vue === 'planning') { modaleSeance(id); break; } const r2 = ressourceDuConflit({ type: el.dataset.type, seances: [id] }); allerA(s.date, r2.type, r2.id); break; }
      case 'dupliquer': if (!ressourceCourante()) break; modaleDupliquer(); break;
      case 'groupe': if (modale().open) modale().close(); modaleGroupe(id || null); break;
      case 'formateur': if (modale().open) modale().close(); modaleFormateur(id || null); break;
      case 'salle': if (modale().open) modale().close(); modaleSalle(id || null); break;
      case 'module': if (modale().open) modale().close(); if (!E.groupes.length) { toast('Ajoute d\'abord un groupe.'); break; } modaleModule(id || null); break;
      case 'creneau': modaleCreneau(id || null); break;
      case 'fermeture': modaleFermeture(id || null); break;
      case 'filtre-conflits': filtre.conflits = el.dataset.f; rendre(); break;
      case 'filtre-type': filtre.typeConflit = el.dataset.f; rendre(); break;
      case 'filtre-ressources': filtre.ressources = el.dataset.f; rendre(); break;
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
  // Passage ordinateur ↔ téléphone : la grille change de forme.
  MQ_TEL.addEventListener('change', () => { if (E && vue === 'planning' && !modale().open) rendre(); });

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
  window.__edt = { etat: () => E, regles: R, conflits: () => C };
  init();
})();
