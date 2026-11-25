// Banque de questions et quiz QME : banque de questions taguées (QCM, vrai ou faux, réponse courte, difficulté,
// explication), génération de quiz par tirage (étiquettes, difficulté, mélange reproductible), sujet imprimable avec
// corrigé séparé, sessions corrigées (saisie des réponses, note automatique, réponses courtes à vérifier, passation
// sur l'appareil), statistiques (réussite par question et par étiquette, distracteurs, progression), données
// d'apprenants minimisées (copies anonymes ou pseudonymes, export et effacement). Données synchronisées par clé de
// licence ou code d'accès. Aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.QZZ;
  const API = '/api/templates';
  const PRODUIT = 'QZZ';
  const CLE_CODE = 'qme-qzz-code';
  const CLE_CACHE = 'qme-qzz-cache';
  const CLE_DEMO = 'qme-qzz-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-qzz-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${String(n).replace('.', ',')} ${Math.abs(n) >= 2 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => (s ? fmt(s, { day: 'numeric', month: 'long', year: 'numeric' }) : '…');
  const dateCourte = (s) => (s ? fmt(s, { day: 'numeric', month: 'short' }) : '…');
  const pc = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
  const nb = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const coupe = (t, n = 90) => { const s = String(t ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const filtre = { recherche: '', type: '', tag: '', dif: '', archivees: false, quiz: '', session: '', stats: '', apprenant: '' };
  const selection = new Set();
  let annulation = null;
  let passation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, B), tutorielVu: Boolean(d?.tutorielVu) });
  const question = (id) => E.questions.find((q) => q.id === id);
  const quizParId = (id) => E.quiz.find((z) => z.id === id);
  const sessionParId = (id) => E.sessions.find((s) => s.id === id);
  const copieParId = (id) => E.copies.find((c) => c.id === id);
  const actives = () => E.questions.filter((q) => !q.archivee);
  const tousTags = () => [...new Set(actives().flatMap((q) => q.tags))].sort((a, b) => a.localeCompare(b, 'fr'));
  const sessionsTriees = () => [...E.sessions].sort((a, b) => b.date.localeCompare(a.date) || a.nom.localeCompare(b.nom));
  const quizTries = () => [...E.quiz].sort((a, b) => String(b.creeLe || '').localeCompare(String(a.creeLe || '')) || a.titre.localeCompare(b.titre));
  const quizChoisi = () => (quizParId(filtre.quiz) || quizTries()[0])?.id || '';
  const sessionChoisie = () => (sessionParId(filtre.session) || sessionsTriees()[0])?.id || '';
  const dateSession = (d) => (d.slice(0, 4) === auj().slice(0, 4) ? dateCourte(d) : fmt(d));
  const nomSession = (s) => (s ? `${s.nom} · ${dateSession(s.date)}` : 'Session supprimée');
  // Couleur fixe d'une étiquette : choisie dans B.couleurs d'après son nom (jamais générée).
  const couleurTag = (t) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return B.couleurs[h % B.couleurs.length]; };
  const tag = (t) => { const [f, c] = couleurTag(t); return `<span class="tag" style="--f:${f};--t:${c}">${esc(t)}</span>`; };
  const NOM_TYPE = Object.fromEntries(B.types.map((t) => [t.code, t.nom]));
  const NOM_DIF = Object.fromEntries(B.difficultes.map((d) => [d.niveau, d.nom]));
  const difficulte = (n) => `<span class="dif d${n}" title="Difficulté : ${NOM_DIF[n]}"><i></i><i></i><i></i><span class="sr-only">${NOM_DIF[n]}</span></span>`;
  const plusieursBonnes = (q) => q.type === 'qcm' && R.bonnes(q).length > 1;
  // Calculs mis en mémoire pendant un rendu.
  let memo = null;
  const oublier = () => { memo = null; };
  const statsQ = () => { if (!memo) memo = {}; if (!memo.sq) memo.sq = Object.fromEntries(R.statsQuestions(E).map((s) => [s.qid, s])); return memo.sq; };
  const usages = () => { if (!memo) memo = {}; if (!memo.u) memo.u = R.usages(E); return memo.u; };

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
    oublier();
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
        cache(false); oublier();
        if (!passation) rendre();
        toast('Un autre appareil a modifié ta banque entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Trop de données pour un seul compte : exporte puis efface des résultats anciens (onglet Corrections).');
        throw new Error('413');
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
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours || passation) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false); oublier();
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
  // Code interne (QZZ-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; oublier(); passation = null;
    document.body.classList.remove('app', 'en-passation');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Formateur fictif : 30 questions génériques rédigées pour QME (pourcentages, unités, tableur, orthographe,
  // sécurité numérique), quatre quiz, cinq sessions à des dates relatives à aujourd'hui. Apprenants inventés
  // (prénom et initiale, ou pseudonymes), résultats simulés avec les vraies règles de correction.
  const BANQUE_DEMO = `
? Un article à 80 € est soldé à −25 %. Quel est son nouveau prix ?
- 55 €
+ 60 €
- 65 €
- 20 €
# pourcentages
~ 1
! 25 % de 80 € font 20 € ; 80 − 20 = 60 €.
? Quel pourcentage représente 15 sur 60 ? (nombre seul)
= 25
# pourcentages
~ 2
! 15 ÷ 60 = 0,25, soit 25 %.
? Une hausse de 10 % suivie d'une baisse de 10 % ramène au prix de départ.
= faux
# pourcentages
~ 2
! 100 → 110 → 99 : la baisse s'applique au prix déjà augmenté.
? Un prix passe de 50 € à 60 €. Quelle est l'augmentation en pourcentage ?
- 10 %
- 16,7 %
+ 20 %
- 60 %
# pourcentages
~ 3
! (60 − 50) ÷ 50 = 0,2. On divise par la valeur de départ, pas par la valeur d'arrivée.
? Combien font 50 % de 46 ?
- 20
+ 23
- 25
- 92
# pourcentages
~ 1
? Un prix TTC de 120 € comprend une TVA de 20 %. Quel est le prix hors taxe, en euros ?
= 100
# pourcentages, tva
~ 3
! 120 ÷ 1,2 = 100. Retirer 20 % de 120 (soit 96) est l'erreur classique.
? Combien de centimètres dans 1,5 mètre ?
- 15
+ 150
- 105
- 1 500
# unités
~ 1
? Combien de minutes dans 2,5 heures ?
= 150
# unités
~ 2
! 2 h = 120 min et 0,5 h = 30 min.
? Un litre équivaut à un décimètre cube.
= vrai
# unités
~ 1
? Combien de mètres carrés dans un hectare ?
- 100
- 1 000
+ 10 000
- 100 000
# unités
~ 2
! Un hectare est un carré de 100 m de côté.
? Une voiture roule à 90 km/h. Quelle distance parcourt-elle en 20 minutes ?
- 18 km
- 20 km
+ 30 km
- 45 km
# unités
~ 3
! 20 minutes font un tiers d'heure : 90 ÷ 3 = 30 km.
? Dans le Système international, un kilooctet vaut exactement 1 024 octets.
= faux
# unités, numérique
~ 2
! Le préfixe kilo vaut 1 000 ; 1 024 octets forment un kibioctet (Kio).
? Dans un tableur en français, quelle formule additionne les cellules de A1 à A5 ?
- =SOMME(A1;A5)
+ =SOMME(A1:A5)
- =TOTAL(A1-A5)
- =AJOUTER(A1:A5)
# tableur
~ 1
! Les deux-points désignent une plage ; le point-virgule sépare deux arguments (ici A1 et A5 seulement).
? Que signifie le symbole $ dans la référence $A$1 ?
- La cellule contient un montant en dollars
+ La référence ne change pas quand on recopie la formule
- La cellule est protégée en écriture
- La formule n'est calculée qu'une fois
# tableur
~ 2
? Quelle fonction calcule la moyenne d'une plage de cellules ? (nom de la fonction en français)
= MOYENNE
# tableur
~ 2
? Dans un tableur, une formule commence par le signe =.
= vrai
# tableur
~ 1
? La cellule B2 contient =A2*2. On la recopie dans B3. Que contient B3 ?
- =A2*2
+ =A3*2
- =A3*3
- =B3*2
# tableur
~ 3
! La référence relative A2 devient A3 quand on descend d'une ligne.
? Lesquelles de ces écritures sont des références de cellule valides ?
+ A1
- 4D
+ $B$2
- A:1
# tableur
~ 2
? Complétez : « Les dossiers que j'ai … hier sont prêts. »
- terminé
+ terminés
- terminées
- terminer
# orthographe
~ 1
! Avec avoir, le participe s'accorde avec le complément placé avant : « que » reprend « les dossiers ».
? Quelle phrase est correctement écrite ?
- Quelque soient vos choix, prévenez-nous.
- Quelque soit vos choix, prévenez-nous.
+ Quels que soient vos choix, prévenez-nous.
- Quels que soit vos choix, prévenez-nous.
# orthographe
~ 2
? « Ci-joint la facture » : en tête de phrase, « ci-joint » reste invariable.
= vrai
# orthographe
~ 1
? Écrivez au pluriel : « un travail ».
= des travaux
= travaux
# orthographe
~ 2
? Complétez : « Elle s'est … compte de son erreur. »
+ rendu
- rendue
- rendus
- rendues
# orthographe
~ 3
! « Compte » est le complément d'objet : le participe reste invariable.
? « Malgré que » est la tournure conseillée dans un écrit soigné.
= faux
# orthographe
~ 2
! Préférez « bien que », suivi du subjonctif.
? Un e-mail vous demande de confirmer votre mot de passe en cliquant sur un lien. Que faire ?
- Cliquer si le logo semble officiel
- Répondre en indiquant le mot de passe
+ Ne pas cliquer et signaler le message
- Le transférer à des collègues pour avis
# sécurité numérique
~ 1
? Utiliser le même mot de passe sur plusieurs sites est sans risque s'il est long.
= faux
# sécurité numérique
~ 1
! Si un site est piraté, le même mot de passe ouvre tous les autres comptes.
? Que permet l'authentification à deux facteurs ?
- Doubler la longueur du mot de passe
+ Exiger une seconde preuve en plus du mot de passe
- Chiffrer le disque dur
- Se connecter sans mot de passe partout
# sécurité numérique
~ 2
? Comment appelle-t-on une escroquerie par faux message qui imite un expéditeur de confiance ?
= hameçonnage
= phishing
# sécurité numérique
~ 3
? Lequel de ces mots de passe est le plus robuste ?
- Le prénom d'un proche suivi de l'année
- azerty123
+ Une phrase de passe de cinq mots sans lien entre eux
- Le nom du site suivi d'un point d'exclamation
# sécurité numérique
~ 2
? Le cadenas dans la barre d'adresse garantit que le site est honnête.
= faux
# sécurité numérique
~ 2
! Il indique seulement que la connexion est chiffrée.`;

  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    e.reglages.rgpdLu = true;
    e.questions = R.analyserTexte(BANQUE_DEMO).questions.map((q, i) => ({ ...q, creeLe: ajout(t, -60 + Math.floor(i / 3)) }));
    const Q = e.questions;
    const parTag = (tg) => Q.filter((q) => q.tags.includes(tg)).map((q) => q.id);
    const quiz = (titre, lesIds, creeLe, graine, consignes = '') => { const z = R.normaliserQuiz({ id: uid(), titre, consignes, creeLe, items: R.items(e, lesIds, true, graine) }, Q); e.quiz.push(z); return z; };
    const z1 = quiz('Remise à niveau · calculs', [...parTag('pourcentages'), ...parTag('unités').slice(0, 4)], ajout(t, -45), 3, 'Calculatrice autorisée. Une seule réponse par question sauf mention contraire.');
    const z2 = quiz('Tableur · les bases', parTag('tableur'), ajout(t, -20), 5, 'Plusieurs réponses possibles à la question 6 : cochez toutes les bonnes.');
    const z3 = quiz('Écrit professionnel et sécurité numérique', [...parTag('orthographe').slice(0, 5), ...parTag('sécurité numérique').slice(0, 5)], ajout(t, -8), 9);
    const tirage = R.tirer(e, { nombre: 10, moinsPosees: true, ordre: 'difficulte' }, 11);
    quiz('Bilan de mi-parcours', tirage.ids, t, 11, 'Durée : 20 minutes.');

    // Biais par question pour rendre la démo lisible : une trop facile, deux trop difficiles.
    const biais = {};
    biais[Q[4].id] = 0.45; biais[Q[2].id] = -0.45; biais[Q[5].id] = -0.3; biais[Q[16].id] = -0.15; biais[Q[19].id] = -0.2;
    const fausses = { [Q[1].id]: ['4', '40'], [Q[5].id]: ['96', '96 €'], [Q[7].id]: ['130', '2h30'], [Q[14].id]: ['AVERAGE', 'MOY'], [Q[21].id]: ['des travails'], [Q[27].id]: ['virus', 'spam'] };
    const rnd = R.alea(2026);
    const repondre = (q, capacite) => {
      if (rnd() < 0.03) return null;
      const p = Math.min(0.97, Math.max(0.05, capacite + (q.difficulte === 1 ? 0.18 : q.difficulte === 3 ? -0.22 : 0) + (biais[q.id] || 0)));
      const juste = rnd() < p;
      if (q.type === 'vf') return juste ? q.vrai : !q.vrai;
      if (q.type === 'courte') return juste ? q.acceptees[Math.floor(rnd() * q.acceptees.length)] : (fausses[q.id] || ['?'])[Math.floor(rnd() * (fausses[q.id] || ['?']).length)];
      const b = R.bonnes(q);
      if (juste) return b;
      if (b.length > 1) return rnd() < 0.6 ? [b[0]] : [...b, 3];
      const m = q.choix.map((c, i) => (c.juste ? -1 : i)).filter((i) => i >= 0);
      return [rnd() < 0.55 ? m[0] : m[1 + Math.floor(rnd() * (m.length - 1))]];
    };
    const sessionDemo = (z, nom, date, mode, apprenants) => {
      const s = R.normaliserSession({ id: uid(), quizId: z.id, nom, date, mode });
      e.sessions.push(s);
      apprenants.forEach(([qui, cap], i) => {
        const rep = {};
        for (const it of z.items) rep[it.qid] = repondre(Q.find((q) => q.id === it.qid), cap);
        e.copies.push(R.normaliserCopie({ id: uid(), sessionId: s.id, apprenant: mode === 'anonyme' ? `Copie ${i + 1}` : qui, reponses: rep }));
      });
      return s;
    };
    const groupeA = [['Lina R.', 0.78], ['Malo D.', 0.55], ['Inès B.', 0.86], ['Hugo T.', 0.46], ['Sacha L.', 0.68], ['Nora K.', 0.72], ['Yanis P.', 0.5], ['Jade M.', 0.82], ['Élio F.', 0.62], ['Rose V.', 0.58]];
    const plus = (l, d) => l.map(([n, c]) => [n, c + d]);
    sessionDemo(z1, 'Promotion précédente', ajout(t, -400), 'nominatif', [['Aster', 0.6], ['Boréal', 0.7], ['Cobalt', 0.5], ['Dune', 0.65], ['Écho', 0.75], ['Fjord', 0.55]]);
    sessionDemo(z1, 'Groupe A', ajout(t, -38), 'nominatif', groupeA);
    sessionDemo(z1, 'Groupe B', ajout(t, -31), 'anonyme', Array.from({ length: 12 }, (_, i) => [null, 0.45 + (i % 5) * 0.08]));
    const s3 = sessionDemo(z2, 'Groupe A', ajout(t, -17), 'nominatif', plus(groupeA, 0.05));
    const s4 = sessionDemo(z3, 'Groupe A', ajout(t, -4), 'nominatif', plus(groupeA.slice(0, 9), 0.08));
    // Réponses courtes fausses déjà tranchées par le formateur, sauf deux sur la dernière session (à vérifier).
    for (const c of e.copies) for (const [qid, v] of Object.entries(c.reponses)) {
      const q = Q.find((x) => x.id === qid);
      if (q.type === 'courte' && v && R.corriger(q, v).etat === 'a-verifier') c.corrections[qid] = false;
    }
    const c4 = e.copies.filter((c) => c.sessionId === s4.id);
    c4[1].reponses[Q[27].id] = 'hameconnage (faux mail)';
    c4[3].reponses[Q[27].id] = 'arnaque';
    delete c4[1].corrections[Q[27].id]; delete c4[3].corrections[Q[27].id];
    // Une copie incomplète (saisie interrompue) sur la session du tableur.
    const inc = e.copies.find((c) => c.sessionId === s3.id && c.apprenant === 'Hugo T.');
    for (const it of z2.items.slice(3)) delete inc.reponses[it.qid];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Banque de questions et quiz · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="300" y="40" width="240" height="240" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="335" cy="88" r="13" fill="#1D4E89"/><rect x="362" y="80" width="150" height="16" fill="#141414"/>
          <circle cx="335" cy="148" r="13" fill="none" stroke="#141414" stroke-width="4"/><rect x="362" y="140" width="120" height="16" fill="#141414"/>
          <circle cx="335" cy="208" r="13" fill="#D9302A"/><rect x="362" y="200" width="160" height="16" fill="#141414"/>
          <rect x="190" y="180" width="80" height="80" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Banque de questions et quiz</p>
          <h1>Tes questions, tes quiz, tes résultats.</h1>
          <p>Une banque de questions étiquetées, des quiz tirés en un clic avec leur corrigé, une correction automatique, et les questions qui posent problème repérées d'un coup d'œil.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta banque de questions</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta banque est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma banque</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/quiz/">Voir la banque de questions et quiz</a>. La démo, avec des questions et des apprenants fictifs, reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma banque'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const TEXTE_RGPD = `<p><b>Des résultats nominatifs sont des données personnelles.</b> Ta banque est hébergée en ligne par QME, liée à ta clé ; tu restes responsable de l'usage des résultats. Avant de saisir des noms réels, vérifie avec ton établissement ou ton organisme de formation que cet usage est possible.</p>
    <p>L'outil est conçu pour en savoir le moins possible : <b>copies anonymes</b> (Copie 1, Copie 2…) par défaut, ou <b>prénom et initiale, ou pseudonyme</b>. Aucune autre information sur les apprenants. Tu peux à tout moment <b>exporter</b> (CSV ou JSON) puis <b>effacer</b> les résultats d'un apprenant, d'une session ou tous les résultats ; une session peut aussi être anonymisée en gardant ses statistiques.</p>`;
  const accueilVide = () => ({ etape: 1, mode: B.reglages.saisieDefaut, lu: false, bareme: B.reglages.bareme });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes questions, tes quiz, tes résultats.</h1>
        <p class="intro">Tu ranges tes questions une fois, avec leurs étiquettes et leur difficulté. Ensuite, un quiz se tire en un clic, s'imprime avec son corrigé à part, se corrige tout seul quand tu saisis les réponses, et les statistiques te disent quelles questions sont trop faciles, trop difficiles, ou mal comprises.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Résultats et données des apprenants</h1>
        <section class="rgpd" aria-labelledby="rgpd-accueil"><h2 id="rgpd-accueil">À lire avant de commencer</h2>${TEXTE_RGPD}
          <label class="case"><input type="checkbox" id="a-lu" ${a.lu ? 'checked' : ''}> J'ai lu et je saisirai le moins de données possible</label></section>
        <div class="form-accueil">
          <fieldset><legend>Saisie proposée pour une nouvelle session <small>Modifiable session par session.</small></legend>
            <div class="choix-statut deux">
              <label><input type="radio" name="a-mode" value="anonyme" ${a.mode === 'anonyme' ? 'checked' : ''}><span>Copies anonymes</span></label>
              <label><input type="radio" name="a-mode" value="nominatif" ${a.mode === 'nominatif' ? 'checked' : ''}><span>Prénom ou pseudonyme</span></label>
            </div></fieldset>
          <label class="champ">Notes sur<select id="a-bareme">${B.baremes.map((b) => `<option ${a.bareme === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma banque</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#a-lu')?.addEventListener('change', (e) => { accueil.lu = e.target.checked; });
    $('#a-bareme')?.addEventListener('change', (e) => { accueil.bareme = Number(e.target.value); });
    document.querySelectorAll('[name=a-mode]').forEach((el) => el.addEventListener('change', () => { accueil.mode = el.value; }));
  }

  function terminerAccueil() {
    if (!accueil.lu) return ecranAccueil('Coche la case pour confirmer que tu as lu le paragraphe sur les données des apprenants.');
    E = etatVide();
    E.reglages = R.normaliserReglages({ ...E.reglages, saisieDefaut: accueil.mode, bareme: accueil.bareme, rgpdLu: true }, B.reglages);
    accueil = accueilVide();
    vue = 'banque';
    sauver();
    demarrer();
    toast('Ta banque est créée. Ajoute une question, ou colle une liste de questions d\'un coup.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    banque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    quiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="3" fill="currentColor"/><rect x="3" y="10.5" width="12" height="3" fill="currentColor"/><rect x="3" y="17" width="15" height="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    corrections: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['banque', 'Banque'], ['quiz', 'Quiz'], ['corrections', 'Corrections'], ['stats', 'Statistiques']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil personnel de préparation et de correction. Questions rédigées par toi : aucun programme ni manuel intégré. Résultats nominatifs : données personnelles, à limiter (copies anonymes ou pseudonymes), à exporter puis effacer quand elles ne servent plus. Seuils « trop facile » et « trop difficile » indicatifs, réglables.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const tuile = ([lib, v, d, col, f]) => `<div class="tuile ${f || ''}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;
  const CLASSE = { facile: ['jaune', 'Trop facile'], difficile: ['rouge', 'Trop difficile'], ok: ['ciel', 'Équilibrée'], peu: ['sable', 'Peu de réponses'] };
  const etiquetteClasse = (c) => `<span class="etiquette ${CLASSE[c][0]}">${CLASSE[c][1]}</span>`;
  const SYMB = { juste: ['✓', 'juste', 'Juste'], faux: ['✗', 'faux', 'Faux'], blanc: ['–', 'blanc', 'Blanc'], 'a-verifier': ['?', 'verif', 'À vérifier'], 'non-saisie': ['·', 'vide', 'Non saisie'] };

  function demarrer() {
    passation = null;
    document.body.classList.remove('en-passation');
    document.body.classList.add('app');
    oublier();
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Questions, quiz et apprenants fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Banque de<br>questions</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}${id === 'bord' ? '<span class="long">Tableau de bord</span><span class="court">Accueil</span>' : id === 'stats' ? '<span class="long">Statistiques</span><span class="court">Stats</span>' : `<span>${nom}</span>`}</button>`).join('')}</nav>
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
    if (passation) return rendrePassation();
    if (!E || !$('#vue')) return;
    oublier();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Banque de questions et quiz`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, banque: vueBanque, quiz: vueQuiz, corrections: vueCorrections, stats: vueStats }[vue]();
    const lier = (sel, cle, ev = 'change', apres = rendre) => $(sel)?.addEventListener(ev, (e) => { filtre[cle] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; apres(); });
    lier('#f-quiz', 'quiz'); lier('#f-session', 'session'); lier('#f-stats', 'stats'); lier('#f-apprenant', 'apprenant');
    lier('#f-tag', 'tag'); lier('#f-dif', 'dif'); lier('#f-archivees', 'archivees');
    $('#f-recherche')?.addEventListener('input', (e) => { filtre.recherche = e.target.value; rendreListeBanque(); });
    // La liste de la banque se remplit à part : la recherche la redessine sans perdre le focus.
    if (vue === 'banque') { rendreListeBanque(); majSelection(); }
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  const aller = (v, f = {}) => { Object.assign(filtre, f); changerVue(v); };

  // ---------- Tableau de bord ----------
  function aRegarder() {
    const l = [];
    const sq = Object.values(statsQ());
    for (const s of sessionsTriees()) {
      const st = R.statsSession(E, s.id);
      if (st.aVerifier) l.push(['?', 'alerte', `${pluriel(st.aVerifier, 'réponse courte', 'réponses courtes')} à vérifier`, `${nomSession(s)} · ${esc(st.quiz?.titre || '')}`, `<button class="btn petit" data-action="aller-session" data-id="${s.id}">Vérifier</button>`]);
      if (st.incompletes) l.push(['·', '', `${pluriel(st.incompletes, 'copie incomplète', 'copies incomplètes')}`, `${nomSession(s)} : elles ne comptent pas dans la moyenne.`, `<button class="btn petit" data-action="aller-session" data-id="${s.id}">Compléter</button>`]);
    }
    const anciennes = R.sessionsAnciennes(E, auj(), E.reglages.conservation);
    if (anciennes.length) l.push(['!', 'alerte', `${pluriel(anciennes.length, 'session nominative', 'sessions nominatives')} de plus de ${E.reglages.conservation} mois`, `${anciennes.map(nomSession).map(esc).join(', ')} : exporte, puis efface ou anonymise.`, `<button class="btn petit" data-action="aller-session" data-id="${anciennes[0].id}">Voir</button>`]);
    const dif = sq.filter((s) => s.classe === 'difficile' && !question(s.qid).archivee);
    const fac = sq.filter((s) => s.classe === 'facile' && !question(s.qid).archivee);
    if (dif.length) l.push(['↓', 'alerte', `${pluriel(dif.length, 'question trop difficile', 'questions trop difficiles')}`, `Réussite sous ${E.reglages.seuilDifficile} % : énoncé ambigu, notion à reprendre ou distracteur trompeur ?`, '<button class="btn petit" data-action="vue" data-vue="stats">Voir</button>']);
    if (fac.length) l.push(['↑', '', `${pluriel(fac.length, 'question trop facile', 'questions trop faciles')}`, `Réussite au-dessus de ${E.reglages.seuilFacile} % : à garder pour l'échauffement, ou à rendre plus exigeante.`, '<button class="btn petit" data-action="vue" data-vue="stats">Voir</button>']);
    const sansTag = actives().filter((q) => !q.tags.length).length;
    if (sansTag) l.push(['#', '', `${pluriel(sansTag, 'question sans étiquette', 'questions sans étiquette')}`, 'Elles ne sortent dans un tirage que si aucune étiquette n\'est choisie.', '<button class="btn petit" data-action="vue" data-vue="banque">Banque</button>']);
    return l;
  }

  function vueBord() {
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${esc(fmt(auj(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p></div>
      <div class="actions"><button class="btn" data-action="question">${ICONES.plus}Nouvelle question</button>${actives().length ? `<button class="btn primaire" data-action="generer">${ICONES.plus}Générer un quiz</button>` : ''}</div></div>`;
    const rgpd = E.reglages.rgpdLu ? '' : `<section class="rgpd" aria-labelledby="rgpd-bord"><h2 id="rgpd-bord">Données des apprenants : à lire</h2>${TEXTE_RGPD}<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="rgpd-lu">J'ai compris</button></div></section>`;
    if (!E.questions.length) return `${titre}${rgpd}${videEtat('Ta banque est vide', 'Ajoute une première question, ou colle une liste rédigée ailleurs (un format simple : « ? » pour l\'énoncé, « + » et « - » pour les propositions).', `<button class="btn primaire" data-action="question">${ICONES.plus}Nouvelle question</button><button class="btn" data-action="coller">Coller des questions</button>`)}${AVERTISSEMENT}`;
    const completes = E.sessions.flatMap((s) => R.statsSession(E, s.id).scores.filter((x) => x.complete));
    const moy = completes.length ? completes.reduce((t, x) => t + x.pct, 0) / completes.length : null;
    const aVerif = E.sessions.reduce((t, s) => t + R.statsSession(E, s.id).aVerifier, 0);
    const tuiles = [
      ['Questions', actives().length, `${pluriel(tousTags().length, 'étiquette')}${E.questions.length > actives().length ? ` · ${E.questions.length - actives().length} archivée(s)` : ''}`, 'var(--bleu)', 'rond'],
      ['Quiz', E.quiz.length, pluriel(E.sessions.length, 'session'), 'var(--jaune)', ''],
      ['Copies corrigées', completes.length, aVerif ? `${pluriel(aVerif, 'réponse')} à vérifier` : 'rien à vérifier', 'var(--rouge)', 'rond'],
      ['Réussite moyenne', pc(moy), moy === null ? 'aucune copie' : `note moyenne ${nb(R.arrondi(moy * E.reglages.bareme, 1))} / ${E.reglages.bareme}`, 'var(--encre)', ''],
    ];
    const l = aRegarder();
    const dernieres = sessionsTriees().slice(0, 5).map((s) => { const st = R.statsSession(E, s.id); return `<li><span class="date-pastille"><b>${versDate(s.date).getDate()}</b>${esc(fmt(s.date, { month: 'short' }))}</span>
      <button class="lien-ligne" data-action="aller-session" data-id="${s.id}"><b>${esc(s.nom)} · ${esc(st.quiz?.titre || '')}</b><span>${pluriel(st.copies, 'copie')}${s.mode === 'anonyme' ? ' · anonyme' : ''}</span></button>
      <span class="nb">${pc(st.moyenne)}</span></li>`; }).join('');
    const prets = E.quiz.filter((z) => !E.sessions.some((s) => s.quizId === z.id));
    return `${titre}${rgpd}<div class="tuiles">${tuiles.map(tuile).join('')}</div>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">À regarder <span>${l.length ? pluriel(l.length, 'point') : 'rien pour l\'instant'}</span></h2>
          ${l.length ? `<ul class="alertes-liste">${l.map(([s, c, t2, d, b]) => `<li><span class="date-pastille ${c}"><b>${s}</b></span><span class="lien-ligne"><b>${t2}</b><span>${d}</span></span><span class="alerte-droite">${b}</span></li>`).join('')}</ul>` : '<p class="aide">Aucune réponse à vérifier, aucune copie incomplète, aucune question hors des seuils.</p>'}</section>
        <section><h2 class="titre-section">Dernières sessions</h2>
          ${dernieres ? `<ul class="prochains">${dernieres}</ul>` : '<p class="aide">Aucune session corrigée : ouvre un quiz et choisis « Nouvelle session ».</p>'}
          ${prets.length ? `<h2 class="titre-section">Prêts à faire passer</h2><ul class="prochains">${prets.map((z) => `<li><span class="date-pastille"><b>${z.items.length}</b>quest.</span><button class="lien-ligne" data-action="aller-quiz" data-id="${z.id}"><b>${esc(z.titre)}</b><span>${z.creeLe ? `créé le ${dateCourte(z.creeLe)}` : ''}</span></button><span></span></li>`).join('')}</ul>` : ''}</section>
      </div>${AVERTISSEMENT}`;
  }

  // ---------- Banque ----------
  function questionsFiltrees() {
    const r = R.plat(filtre.recherche).trim();
    return E.questions.filter((q) => (filtre.archivees ? q.archivee : !q.archivee) && (!filtre.type || q.type === filtre.type) && (!filtre.tag || q.tags.includes(filtre.tag))
      && (!filtre.dif || q.difficulte === Number(filtre.dif)) && (!r || R.plat(`${q.enonce} ${q.tags.join(' ')} ${q.choix.map((c) => c.texte).join(' ')} ${q.acceptees.join(' ')}`).includes(r)));
  }
  function carteQuestion(q) {
    const st = statsQ()[q.id];
    const u = usages()[q.id] || 0;
    const corps = q.type === 'qcm' ? `<ol class="choix-liste">${q.choix.map((c, i) => `<li class="${c.juste ? 'juste' : ''}"><b>${B.lettres[i]}</b>${esc(c.texte)}${c.juste ? '<span class="sr-only"> (juste)</span>' : ''}</li>`).join('')}</ol>`
      : q.type === 'vf' ? `<p class="reponse-attendue">Réponse : <b>${q.vrai ? 'Vrai' : 'Faux'}</b></p>` : `<p class="reponse-attendue">Acceptées : <b>${q.acceptees.map(esc).join(' · ')}</b></p>`;
    return `<li class="q-carte${q.archivee ? ' archivee' : ''}">
      <label class="q-sel"><input type="checkbox" data-sel="${q.id}" ${selection.has(q.id) ? 'checked' : ''} ${q.archivee ? 'disabled' : ''}><span class="sr-only">Sélectionner</span></label>
      <div class="q-corps">
        <div class="q-tete"><span class="etiquette sable">${NOM_TYPE[q.type]}${plusieursBonnes(q) ? ' · plusieurs' : ''}</span>${difficulte(q.difficulte)}${q.tags.map(tag).join('')}${q.points !== 1 ? `<span class="etiquette sable">${nb(q.points)} pts</span>` : ''}</div>
        <button class="q-enonce" data-action="question" data-id="${q.id}">${esc(q.enonce)}</button>
        ${corps}
        ${q.explication ? `<p class="q-explication">${esc(q.explication)}</p>` : ''}
        <p class="q-pied"><span>${st.n ? `Réussite <b>${pc(st.taux)}</b> sur ${pluriel(st.n, 'réponse')}` : 'Jamais corrigée'}</span>${st.n >= E.reglages.minReponses ? etiquetteClasse(st.classe) : ''}<span>${u ? `Dans ${pluriel(u, 'quiz', 'quiz')}` : 'Dans aucun quiz'}</span>
          <span class="q-actions"><button class="btn lien" data-action="question" data-id="${q.id}">Modifier</button><button class="btn lien" data-action="dupliquer-q" data-id="${q.id}">Dupliquer</button>${q.archivee ? `<button class="btn lien" data-action="restaurer-q" data-id="${q.id}">Restaurer</button>` : ''}</span></p>
      </div></li>`;
  }
  function rendreListeBanque() {
    const el = $('#liste-banque');
    if (!el) return;
    const l = questionsFiltrees();
    $('#resume-banque').textContent = `${pluriel(l.length, 'question')}${l.length !== E.questions.length ? ` sur ${E.questions.length}` : ''}`;
    el.innerHTML = l.length ? l.map(carteQuestion).join('') : `<li>${videEtat('Aucune question', filtre.archivees ? 'Aucune question archivée.' : 'Aucune question ne correspond à ces filtres.')}</li>`;
    el.querySelectorAll('[data-sel]').forEach((x) => x.addEventListener('change', () => { if (x.checked) selection.add(x.dataset.sel); else selection.delete(x.dataset.sel); majSelection(); }));
  }
  function majSelection() {
    for (const id of [...selection]) if (!question(id) || question(id).archivee) selection.delete(id);
    const el = $('#barre-selection');
    if (!el) return;
    el.hidden = !selection.size;
    $('#nb-selection').textContent = pluriel(selection.size, 'question sélectionnée', 'questions sélectionnées');
  }

  function vueBanque() {
    const titre = `<div class="vue-tete"><div><h1>Banque</h1><p>Toutes tes questions, avec leurs étiquettes, leur difficulté et leur réussite réelle.</p></div>
      <div class="actions"><button class="btn" data-action="coller">Coller des questions</button><button class="btn primaire" data-action="question">${ICONES.plus}Nouvelle question</button></div></div>`;
    if (!E.questions.length) return `${titre}${videEtat('Aucune question', 'Rédige ta première question, ou colle une liste. Les étiquettes (notion, séquence, module) servent ensuite à tirer les quiz et à lire la réussite.', `<button class="btn primaire" data-action="question">${ICONES.plus}Nouvelle question</button><button class="btn" data-action="coller">Coller des questions</button>`)}${AVERTISSEMENT}`;
    const nbType = (c) => E.questions.filter((q) => !q.archivee && (!c || q.type === c)).length;
    const tags = tousTags();
    return `${titre}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Type">${[['', 'Toutes'], ...B.types.map((t) => [t.code, t.nom])].map(([c, n]) => `<button class="filtre" data-action="f-type" data-type="${c}" aria-pressed="${filtre.type === c}">${n} <small>${nbType(c)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="f-recherche" type="search" placeholder="Rechercher un mot, une étiquette…" value="${esc(filtre.recherche)}"></label>
      </div>
      <div class="rang-filtres">
        <label class="champ"><span class="sr-only">Étiquette</span><select id="f-tag"><option value="">Toutes les étiquettes</option>${tags.map((t) => `<option value="${esc(t)}" ${filtre.tag === t ? 'selected' : ''}>${esc(t)} (${actives().filter((q) => q.tags.includes(t)).length})</option>`).join('')}</select></label>
        <label class="champ"><span class="sr-only">Difficulté</span><select id="f-dif"><option value="">Toutes les difficultés</option>${B.difficultes.map((d) => `<option value="${d.niveau}" ${Number(filtre.dif) === d.niveau ? 'selected' : ''}>${d.nom}</option>`).join('')}</select></label>
        <label class="case"><input type="checkbox" id="f-archivees" ${filtre.archivees ? 'checked' : ''}> Archivées</label>
        <button class="btn petit" data-action="csv-banque">Export CSV</button>
      </div>
      <div class="barre-selection" id="barre-selection" hidden><b id="nb-selection"></b><span class="rang"><button class="btn petit primaire" data-action="quiz-selection">Créer un quiz avec</button><button class="btn petit" data-action="vider-selection">Désélectionner</button></span></div>
      <p class="resume-liste" id="resume-banque"></p>
      <ul class="q-liste" id="liste-banque"></ul>${AVERTISSEMENT}`;
  }

  // ---------- Quiz ----------
  function vueQuiz() {
    const titre = (sel = '') => `<div class="vue-tete"><div><h1>Quiz</h1><p>Tire un quiz dans ta banque, ajuste-le, imprime le sujet et son corrigé, puis corrige-le.</p></div>
      <div class="actions">${sel}${actives().length ? `<button class="btn primaire" data-action="generer">${ICONES.plus}Générer un quiz</button>` : ''}</div></div>`;
    if (!E.quiz.length) return `${titre()}${videEtat('Aucun quiz', actives().length ? 'Choisis des étiquettes, une difficulté et un nombre de questions : le tirage fait le reste, et tu peux ensuite ajuster.' : 'Commence par ajouter des questions dans la banque.', actives().length ? `<button class="btn primaire" data-action="generer">${ICONES.plus}Générer un quiz</button>` : `<button class="btn primaire" data-action="vue" data-vue="banque">Aller à la banque</button>`)}${AVERTISSEMENT}`;
    const zid = quizChoisi();
    const z = quizParId(zid);
    const choix = `<label class="champ choix-classe"><span class="sr-only">Quiz</span><select id="f-quiz">${quizTries().map((x) => `<option value="${x.id}" ${x.id === zid ? 'selected' : ''}>${esc(x.titre)} (${x.items.length})</option>`).join('')}</select></label>`;
    const items = R.itemsDe(E, z);
    const total = items.reduce((t, it) => t + it.q.points, 0);
    const tags = [...new Set(items.flatMap((it) => it.q.tags))].sort((a, b) => a.localeCompare(b, 'fr'));
    const sessions = E.sessions.filter((s) => s.quizId === z.id).sort((a, b) => b.date.localeCompare(a.date));
    const difs = [1, 2, 3].map((d) => items.filter((it) => it.q.difficulte === d).length);
    return `${titre(choix)}
      <section class="quiz-entete">
        <div><p class="surtitre">${z.creeLe ? `Créé le ${dateLongue(z.creeLe)}` : 'Quiz'}</p><h2>${esc(z.titre)}</h2>${z.consignes ? `<p class="aide">${esc(z.consignes)}</p>` : ''}
          <p class="quiz-resume">${pluriel(items.length, 'question')} · ${nb(total)} points · ${difs.map((n, i) => `${n} ${NOM_DIF[i + 1].toLowerCase()}${n > 1 ? 's' : ''}`).join(', ')}</p>
          <div class="ligne-etiquettes">${tags.map(tag).join('')}</div></div>
        <div class="rang quiz-actions">
          <button class="btn primaire" data-action="session" data-quiz="${z.id}">${ICONES.plus}Nouvelle session</button>
          <button class="btn" data-action="imprimer">Imprimer sujet et corrigé</button>
          <button class="btn petit" data-action="qz-ajouter">Ajouter des questions</button>
          <button class="btn petit" data-action="qz-melanger">Mélanger à nouveau</button>
          <button class="btn petit" data-action="qz-modifier">Titre, consignes…</button>
        </div>
      </section>
      ${sessions.length ? `<p class="resume-liste">Corrigé en ${pluriel(sessions.length, 'session')} : ${sessions.map((s) => `<button class="btn lien" data-action="aller-session" data-id="${s.id}">${esc(nomSession(s))}</button>`).join(' ')}. Modifier les questions change aussi la correction de ces sessions.</p>` : ''}
      ${items.length ? `<ol class="quiz-items">${items.map((it, i) => `<li>
        <span class="numero-q">${i + 1}</span>
        <div class="qi-corps"><p class="qi-enonce">${esc(it.q.enonce)}</p>
          ${it.q.type === 'qcm' ? `<ol class="choix-liste compacte">${it.ordre.map((o, p) => `<li class="${it.q.choix[o].juste ? 'juste' : ''}"><b>${B.lettres[p]}</b>${esc(it.q.choix[o].texte)}</li>`).join('')}</ol>` : `<p class="reponse-attendue">${it.q.type === 'vf' ? 'Vrai ou faux' : 'Réponse courte'} · <b>${esc(R.bonneReponseLisible(it.q, it))}</b></p>`}
          <div class="q-tete">${difficulte(it.q.difficulte)}${it.q.tags.map(tag).join('')}${it.q.points !== 1 ? `<span class="etiquette sable">${nb(it.q.points)} pts</span>` : ''}</div></div>
        <span class="qi-actions"><button class="btn-suppr" data-action="qz-haut" data-id="${it.qid}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn-suppr" data-action="qz-bas" data-id="${it.qid}" aria-label="Descendre" ${i === items.length - 1 ? 'disabled' : ''}>↓</button><button class="btn-suppr" data-action="qz-retirer" data-id="${it.qid}" aria-label="Retirer du quiz">×</button></span>
      </li>`).join('')}</ol>` : videEtat('Quiz vide', 'Ajoute des questions depuis la banque.', '<button class="btn primaire" data-action="qz-ajouter">Ajouter des questions</button>')}
      ${AVERTISSEMENT}`;
  }

  // ---------- Corrections ----------
  const blocRgpd = () => `<section class="rgpd" aria-labelledby="rgpd-corr"><h2 id="rgpd-corr">Données des apprenants</h2>${TEXTE_RGPD}
      <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="apprenant">Exporter ou effacer un apprenant</button><button class="btn petit" data-action="json-resultats">Exporter tous les résultats (JSON)</button><button class="btn petit" data-action="csv-notes-tout">Toutes les notes (CSV)</button><button class="btn petit danger" data-action="effacer-tout">Effacer tous les résultats</button></div></section>`;

  function vueCorrections() {
    const titre = (sel = '') => `<div class="vue-tete"><div><h1>Corrections</h1><p>Une session, c'est un quiz passé par un groupe à une date. Saisis les réponses : la note se calcule seule.</p></div>
      <div class="actions">${sel}${E.quiz.length ? `<button class="btn primaire" data-action="session">${ICONES.plus}Nouvelle session</button>` : ''}</div></div>`;
    if (!E.sessions.length) return `${titre()}${videEtat('Aucune session', E.quiz.length ? 'Crée une session pour un quiz : groupe, date, copies anonymes ou nominatives. Tu saisis ensuite les réponses de chaque copie, ou tu fais passer le quiz sur cet appareil.' : 'Il faut d\'abord un quiz : génère-le dans l\'onglet Quiz.', E.quiz.length ? `<button class="btn primaire" data-action="session">${ICONES.plus}Nouvelle session</button>` : '<button class="btn primaire" data-action="vue" data-vue="quiz">Aller aux quiz</button>')}${E.copies.length ? '' : ''}${blocRgpd()}${AVERTISSEMENT}`;
    const sid = sessionChoisie();
    const s = sessionParId(sid);
    const st = R.statsSession(E, sid);
    const items = R.itemsDe(E, st.quiz);
    const choix = `<label class="champ choix-classe"><span class="sr-only">Session</span><select id="f-session">${sessionsTriees().map((x) => `<option value="${x.id}" ${x.id === sid ? 'selected' : ''}>${esc(nomSession(x))} · ${esc(quizParId(x.quizId)?.titre || '')}</option>`).join('')}</select></label>`;
    const bar = E.reglages.bareme;
    const ancienne = R.sessionsAnciennes(E, auj(), E.reglages.conservation).some((x) => x.id === sid);
    const tuiles = [
      ['Copies', st.copies, st.incompletes ? `${pluriel(st.incompletes, 'incomplète')}` : 'toutes complètes', 'var(--bleu)', 'rond'],
      ['Moyenne', st.moyenne === null ? '–' : `${nb(R.arrondi(st.moyenne * bar, 1))}/${bar}`, `${pc(st.moyenne)} de réussite`, 'var(--jaune)', ''],
      ['Médiane', st.mediane === null ? '–' : `${nb(R.arrondi(st.mediane * bar, 1))}/${bar}`, st.min === null ? '' : `de ${nb(R.arrondi(st.min * bar, 1))} à ${nb(R.arrondi(st.max * bar, 1))}`, 'var(--encre)', 'rond'],
      ['À vérifier', st.aVerifier, st.aVerifier ? 'réponses courtes' : 'rien à trancher', 'var(--rouge)', ''],
    ];
    const verifs = [];
    for (const x of st.scores) for (const d of x.detail) if (d.etat === 'a-verifier') verifs.push({ c: x.copie, q: question(d.qid) });
    const tauxQ = items.map((it) => { const r = st.scores.map((x) => x.detail.find((d) => d.qid === it.qid)).filter((d) => d && ['juste', 'faux', 'blanc'].includes(d.etat)); return r.length ? r.filter((d) => d.juste).length / r.length : null; });
    const lignes = st.scores.sort((a, b) => a.copie.apprenant.localeCompare(b.copie.apprenant, 'fr', { numeric: true })).map((x) => `<tr>
        <th scope="row"><button class="btn lien" data-action="copie" data-id="${x.copie.id}">${esc(x.copie.apprenant)}</button></th>
        ${x.detail.map((d, i) => { const [sy, cl, lib] = SYMB[d.etat]; return `<td class="cellule ${cl}" title="Question ${i + 1} : ${lib}">${sy}<span class="sr-only"> ${lib}</span></td>`; }).join('')}
        <td class="nb">${x.complete ? `<b>${nb(x.note)}</b>/${bar}` : `<span class="etiquette sable">${x.nonSaisies} à saisir</span>`}</td></tr>`).join('');
    return `${titre(choix)}
      <section class="quiz-entete"><div><p class="surtitre">${esc(dateLongue(s.date))} · ${s.mode === 'anonyme' ? 'copies anonymes' : 'prénom ou pseudonyme'}</p><h2>${esc(s.nom)} · ${esc(st.quiz?.titre || '')}</h2>
        ${ancienne ? `<p class="cd-alerte">Session nominative de plus de ${E.reglages.conservation} mois : exporte les notes si tu en as besoin, puis efface-la ou anonymise-la.</p>` : ''}</div>
        <div class="rang quiz-actions"><button class="btn primaire" data-action="copie" data-session="${sid}">${ICONES.plus}Saisir une copie</button><button class="btn" data-action="passation" data-id="${sid}">Faire passer sur cet appareil</button></div></section>
      <div class="tuiles">${tuiles.map(tuile).join('')}</div>
      ${verifs.length ? `<h2 class="titre-section">Réponses à vérifier <span>la réponse ne correspond à aucune réponse acceptée</span></h2><ul class="alertes-liste verifs">${verifs.map(({ c, q }) => `<li><span class="date-pastille alerte"><b>?</b></span>
          <span class="lien-ligne"><b>« ${esc(c.reponses[q.id])} »</b><span>${esc(c.apprenant)} · ${esc(coupe(q.enonce, 80))} · acceptées : ${esc(q.acceptees.join(' / '))}</span></span>
          <span class="alerte-droite rang"><button class="btn petit" data-action="verif" data-copie="${c.id}" data-q="${q.id}" data-v="1">Juste</button><button class="btn petit" data-action="verif" data-copie="${c.id}" data-q="${q.id}" data-v="0">Faux</button><button class="btn petit lien" data-action="accepter" data-copie="${c.id}" data-q="${q.id}" title="Ajoute cette réponse aux réponses acceptées de la question">Toujours accepter</button></span></li>`).join('')}</ul>` : ''}
      <h2 class="titre-section">Copies <span>${st.copies ? 'touche un nom pour modifier la copie' : 'aucune copie saisie'}</span></h2>
      ${st.copies ? `<div class="defile"><table class="tableau grille-copies"><thead><tr><th scope="col">${s.mode === 'anonyme' ? 'Copie' : 'Apprenant'}</th>${items.map((it, i) => `<th scope="col" class="nb" title="${esc(coupe(it.q.enonce, 120))}">Q${i + 1}</th>`).join('')}<th scope="col" class="nb">Note</th></tr></thead>
        <tbody>${lignes}</tbody>
        <tfoot><tr><th scope="row">Réussite</th>${tauxQ.map((t) => `<td class="nb taux">${t === null ? '–' : Math.round(t * 100)}</td>`).join('')}<td class="nb">${pc(st.moyenne)}</td></tr></tfoot></table></div>
        <p class="legende-copies"><span class="cellule juste">✓</span> juste <span class="cellule faux">✗</span> faux <span class="cellule blanc">–</span> blanc <span class="cellule verif">?</span> à vérifier <span class="cellule vide">·</span> non saisie · réussite par question en %</p>`
        : videEtat('Aucune copie', 'Saisis les réponses de chaque copie, ou fais passer le quiz sur cet appareil (une personne après l\'autre).', `<button class="btn primaire" data-action="copie" data-session="${sid}">${ICONES.plus}Saisir une copie</button>`)}
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv-notes" data-id="${sid}">Notes (CSV)</button><button class="btn petit" data-action="csv-reponses" data-id="${sid}">Réponses détaillées (CSV)</button><button class="btn petit" data-action="session-modifier" data-id="${sid}">Modifier la session</button>${s.mode === 'nominatif' ? `<button class="btn petit" data-action="anonymiser" data-id="${sid}">Anonymiser</button>` : ''}<button class="btn petit danger" data-action="effacer-session" data-id="${sid}">Effacer la session</button></div>
      ${blocRgpd()}${AVERTISSEMENT}`;
  }

  // ---------- Statistiques ----------
  const barre = (lib, taux, detail, titre = '') => `<div class="barre-cat" title="${esc(titre || lib)}"><span class="bc-nom">${lib}</span><span class="bc-piste"><span class="bc-barre" style="width:${taux === null ? 0 : Math.max(1, Math.round(taux * 100))}%"></span></span><span class="bc-val"><b>${pc(taux)}</b> ${detail}</span></div>`;

  function vueStats() {
    const titre = (sel = '') => `<div class="vue-tete"><div><h1>Statistiques</h1><p>La réussite réelle de chaque question et de chaque étiquette, sur les copies corrigées.</p></div><div class="actions">${sel}</div></div>`;
    if (!E.copies.length) return `${titre()}${videEtat('Pas encore de résultats', 'Les statistiques apparaissent dès les premières copies corrigées (onglet Corrections).', '<button class="btn primaire" data-action="vue" data-vue="corrections">Aller aux corrections</button>')}${AVERTISSEMENT}`;
    const sid = sessionParId(filtre.stats) ? filtre.stats : '';
    const ids = sid ? [sid] : null;
    const choix = `<label class="champ choix-classe"><span class="sr-only">Périmètre</span><select id="f-stats"><option value="">Toutes les sessions</option>${sessionsTriees().map((x) => `<option value="${x.id}" ${x.id === sid ? 'selected' : ''}>${esc(nomSession(x))} · ${esc(quizParId(x.quizId)?.titre || '')}</option>`).join('')}</select></label>`;
    const sq = R.statsQuestions(E, ids).filter((x) => x.n);
    const n = sq.reduce((t, x) => t + x.n, 0);
    const j = sq.reduce((t, x) => t + x.justes, 0);
    const fac = sq.filter((x) => x.classe === 'facile'), dif = sq.filter((x) => x.classe === 'difficile');
    const tuiles = [
      ['Réponses analysées', n, `${pluriel(sq.length, 'question')}`, 'var(--bleu)', 'rond'],
      ['Réussite globale', pc(n ? j / n : null), 'blancs comptés faux', 'var(--encre)', ''],
      ['Trop difficiles', dif.length, `réussite ≤ ${E.reglages.seuilDifficile} %`, 'var(--rouge)', 'rond'],
      ['Trop faciles', fac.length, `réussite ≥ ${E.reglages.seuilFacile} %`, 'var(--jaune)', ''],
    ];
    const tags = R.statsTags(E, ids).filter((t) => t.n);
    const lignesQ = [...sq].sort((a, b) => a.taux - b.taux || b.n - a.n).map((x) => {
      const q = question(x.qid);
      const dis = x.distracteur && x.distracteur.part >= 0.15 ? `<small class="distracteur">« ${esc(coupe(q.choix[x.distracteur.indice]?.texte, 50))} » choisie par ${pc(x.distracteur.part)}</small>` : '';
      return `<tr><td><button class="btn lien q-lien" data-action="question" data-id="${q.id}">${esc(coupe(q.enonce, 110))}</button>${dis}<div class="q-tete">${difficulte(q.difficulte)}${q.tags.map(tag).join('')}</div></td>
        <td class="nb">${x.n}</td><td class="taux-cellule"><span class="mini-barre"><span style="width:${Math.round(x.taux * 100)}%"></span></span><b>${pc(x.taux)}</b></td><td>${etiquetteClasse(x.classe)}</td></tr>`;
    }).join('');
    // Progression : moyenne de chaque session dans l'ordre des dates ; parcours d'un apprenant nommé.
    const chrono = R.sessionsChrono(E).filter((x) => x.completes);
    const app = R.apprenants(E);
    const cle = app.some((a) => a.cle === filtre.apprenant) ? filtre.apprenant : '';
    const parcours = cle ? R.parcoursApprenant(E, cle) : [];
    return `${titre(choix)}<div class="tuiles">${tuiles.map(tuile).join('')}</div>
      <div class="colonnes-graph">
        <section><h2 class="titre-section">Par étiquette <span>part de réponses justes</span></h2>
          <div class="graphique"><div class="barres-cats">${tags.map((t) => barre(tag(t.tag), t.taux, `<small>${t.n} rép.</small>`, `${t.tag} : ${pc(t.taux)} sur ${t.n} réponses`)).join('')}</div></div></section>
        <section><h2 class="titre-section">Progression <span>moyenne de chaque session</span></h2>
          <div class="graphique"><div class="barres-cats">${chrono.map((x) => barre(`${esc(dateSession(x.session.date))} · ${esc(x.session.nom)}<small>${esc(coupe(x.quiz?.titre, 34))}</small>`, x.moyenne, `<small>${x.completes} cop.</small>`, `${x.session.nom}, ${x.quiz?.titre} : ${pc(x.moyenne)}`)).join('')}</div></div>
          ${app.length ? `<label class="champ" style="margin-top:14px">Parcours d'un apprenant<small>Sessions nominatives seulement : le même nom d'une session à l'autre.</small><select id="f-apprenant"><option value="">Choisir…</option>${app.map((a) => `<option value="${esc(a.cle)}" ${a.cle === cle ? 'selected' : ''}>${esc(a.nom)} (${a.copies})</option>`).join('')}</select></label>
            ${parcours.length ? `<div class="graphique" style="margin-top:10px"><div class="barres-cats">${parcours.map((x) => barre(`${esc(dateSession(x.session.date))}<small>${esc(coupe(x.quiz?.titre, 34))}</small>`, x.complete ? x.pct : null, x.complete ? `<small>${nb(x.note)}/${x.bareme}</small>` : '<small>incomplète</small>')).join('')}</div></div>` : ''}` : ''}
        </section>
      </div>
      <h2 class="titre-section">Par question <span>de la moins réussie à la plus réussie · minimum ${E.reglages.minReponses} réponses pour classer</span></h2>
      <div class="defile"><table class="tableau stats-q"><thead><tr><th scope="col">Question</th><th scope="col" class="nb">Rép.</th><th scope="col">Réussite</th><th scope="col">Lecture</th></tr></thead><tbody>${lignesQ}</tbody></table></div>
      <p class="mention" style="margin-top:10px">Une question trop difficile n'est pas forcément mauvaise : regarde le distracteur le plus choisi (une erreur fréquente) et l'énoncé. Réponses non saisies et « à vérifier » non comptées.</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Passation sur cet appareil ----------
  function rendrePassation() {
    const s = sessionParId(passation.sid);
    const z = quizParId(s?.quizId);
    if (!s || !z) { passation = null; return demarrer(); }
    document.body.classList.add('en-passation');
    document.title = `${z.titre} · passation`;
    const items = R.itemsDe(E, z);
    let corps;
    if (passation.fin) {
      corps = `<div class="passation-fin">${FORME_VIDE}<h1>Copie rendue, merci.</h1><p>Passe l'appareil à la personne suivante.</p>
        <div class="rang"><button class="btn primaire" data-action="passation-suivante">Copie suivante</button><button class="btn" data-action="passation-fin">Terminer la passation</button></div></div>`;
    } else {
      corps = `<form id="form-passation" novalidate>
        <header class="passation-tete"><p class="surtitre">${esc(s.nom)} · ${esc(dateLongue(s.date))}</p><h1>${esc(z.titre)}</h1>${z.consignes ? `<p class="aide">${esc(z.consignes)}</p>` : ''}
          ${s.mode === 'nominatif' ? '<label class="champ">Ton prénom et l\'initiale de ton nom, ou un pseudonyme<input name="apprenant" maxlength="40" autocomplete="off" required></label>' : '<p class="mention">Copie anonyme : aucun nom n\'est demandé.</p>'}</header>
        <ol class="passation-liste">${items.map((it, i) => `<li><fieldset><legend><span class="numero-q">${i + 1}</span>${esc(it.q.enonce)}${plusieursBonnes(it.q) ? ' <small>(plusieurs réponses)</small>' : ''}</legend>${champsReponse(it, undefined, 'p')}</fieldset></li>`).join('')}</ol>
        <p class="erreur" role="alert"></p>
        <div class="rang passation-pied"><button class="btn primaire" type="submit">Rendre ma copie</button></div></form>`;
    }
    $('#racine').innerHTML = `<div class="passation"><div class="passation-barre"><span class="marque">${MARQUE}</span><span>Passation · ${pluriel(E.copies.filter((c) => c.sessionId === s.id).length, 'copie')}</span><button class="btn petit" data-action="passation-fin">Terminer</button></div>${corps}</div>`;
    window.scrollTo({ top: 0 });
    $('#form-passation')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const nom = String(fd.get('apprenant') || '').trim();
      if (s.mode === 'nominatif' && !nom) { e.target.querySelector('.erreur').textContent = 'Indique ton prénom et une initiale, ou un pseudonyme.'; e.target.querySelector('[name=apprenant]').focus(); return; }
      const rep = lireReponses(fd, items, 'p', true);
      E.copies.push(R.normaliserCopie({ id: uid(), sessionId: s.id, apprenant: s.mode === 'anonyme' ? `Copie ${R.prochainNumeroCopie(E, s.id)}` : nom, reponses: rep }));
      sauver();
      passation.fin = true;
      rendrePassation();
    });
  }

  // Champs de réponse d'une question (copie saisie par le formateur, ou passation).
  function champsReponse(it, val, pre) {
    const q = it.q, n = `${pre}-${q.id}`;
    const blanc = val === null;
    if (q.type === 'qcm') {
      const multi = plusieursBonnes(q);
      const choisis = Array.isArray(val) ? val : [];
      return `<div class="lettres">${it.ordre.map((o, p) => `<label><input type="${multi ? 'checkbox' : 'radio'}" name="${n}" value="${o}" ${choisis.includes(o) ? 'checked' : ''}><span><b>${B.lettres[p]}</b>${pre === 'p' ? esc(q.choix[o].texte) : ''}</span></label>`).join('')}${pre === 'p' ? '' : `<label class="blanc"><input type="checkbox" name="b-${n}" ${blanc ? 'checked' : ''}><span>Blanc</span></label>`}</div>`;
    }
    if (q.type === 'vf') {
      return `<div class="lettres">${[['v', 'Vrai', val === true], ['f', 'Faux', val === false]].map(([v, l, c]) => `<label><input type="radio" name="${n}" value="${v}" ${c ? 'checked' : ''}><span>${l}</span></label>`).join('')}${pre === 'p' ? '' : `<label class="blanc"><input type="checkbox" name="b-${n}" ${blanc ? 'checked' : ''}><span>Blanc</span></label>`}</div>`;
    }
    return `<div class="lettres courte"><input name="${n}" value="${typeof val === 'string' ? esc(val) : ''}" maxlength="200" autocomplete="off" aria-label="Réponse">${pre === 'p' ? '' : `<label class="blanc"><input type="checkbox" name="b-${n}" ${blanc ? 'checked' : ''}><span>Blanc</span></label>`}</div>`;
  }
  // Lecture des réponses d'un formulaire. En passation, une question sans réponse est un blanc.
  function lireReponses(fd, items, pre, sansSaisie = false) {
    const rep = {};
    for (const it of items) {
      const n = `${pre}-${it.qid}`;
      let v;
      if (fd.get(`b-${n}`)) v = null;
      else if (it.q.type === 'qcm') { const l = fd.getAll(n).map(Number); v = l.length ? l : undefined; }
      else if (it.q.type === 'vf') { const x = fd.get(n); v = x === 'v' ? true : x === 'f' ? false : undefined; }
      else { const x = String(fd.get(n) || '').trim(); v = x || undefined; }
      if (v === undefined && sansSaisie) v = null;
      if (v !== undefined) rep[it.qid] = v;
    }
    return rep;
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
    d.classList.remove('large');
    editionListe = null;
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  let editionListe = null;
  function modifier(f, message) {
    retenir();
    f();
    sauver(); rendre();
    toast(typeof message === 'function' ? message() : message, { libelle: 'Annuler', faire: annuler });
  }
  const confirmer = (texte, mot) => String(prompt(`${texte}\nÉcris ${mot} pour confirmer.`) || '').trim().toUpperCase() === mot;

  // Question : type, énoncé, propositions ou réponse, étiquettes, difficulté, points, explication.
  function modaleQuestion(id, modele = null) {
    const q = id ? question(id) : null;
    const b = structuredClone(q || modele || R.normaliserQuestion({ type: 'qcm', choix: [{ texte: '', juste: true }, { texte: '' }, { texte: '' }, { texte: '' }], tags: filtre.tag ? [filtre.tag] : [] }));
    const zone = () => {
      if (b.type === 'qcm') return `<fieldset class="champ"><legend>Propositions <small>Coche la ou les propositions justes. De 2 à 6.</small></legend>
          <ol class="edit-choix">${b.choix.map((c, i) => `<li><label class="case-juste" title="Juste"><input type="checkbox" name="juste-${i}" ${c.juste ? 'checked' : ''}><span>${B.lettres[i]}</span></label><input name="choix-${i}" value="${esc(c.texte)}" maxlength="300" aria-label="Proposition ${B.lettres[i]}"><button type="button" class="btn-suppr" data-action="ch-suppr" data-i="${i}" aria-label="Retirer la proposition ${B.lettres[i]}" ${b.choix.length <= 2 ? 'disabled' : ''}>×</button></li>`).join('')}</ol>
          ${b.choix.length < B.maxChoix ? '<div class="rang"><button type="button" class="btn petit" data-action="ch-ajout">Ajouter une proposition</button></div>' : ''}</fieldset>`;
      if (b.type === 'vf') return `<fieldset class="champ"><legend>L'affirmation est</legend><div class="choix-statut deux"><label><input type="radio" name="vrai" value="1" ${b.vrai ? 'checked' : ''}><span>Vraie</span></label><label><input type="radio" name="vrai" value="0" ${!b.vrai ? 'checked' : ''}><span>Fausse</span></label></div></fieldset>`;
      return `<label class="champ">Réponses acceptées<small>Une par ligne (variantes, synonymes). Comparées sans majuscules, accents, espaces ni ponctuation ; « 12,5 » = « 12.5 ». Les autres réponses sont « à vérifier ».</small><textarea name="acceptees" rows="3">${esc(b.acceptees.join('\n'))}</textarea></label>`;
    };
    const tags = tousTags();
    const corps = `<fieldset class="champ"><legend>Type</legend><div class="choix-statut trois">${B.types.map((t) => `<label><input type="radio" name="type" value="${t.code}" ${b.type === t.code ? 'checked' : ''}><span>${t.nom}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Énoncé<textarea name="enonce" rows="3" maxlength="1000">${esc(b.enonce)}</textarea></label>
      <div id="zone-type">${zone()}</div>
      <label class="champ">Étiquettes<small>Séparées par des virgules : notion, module, séquence, niveau…</small><input name="tags" value="${esc(b.tags.join(', '))}" maxlength="200"></label>
      ${tags.length ? `<div class="tags-proposes">${tags.slice(0, 24).map((t) => `<button type="button" class="tag bouton" data-action="ch-tag" data-i="${esc(t)}" style="--f:${couleurTag(t)[0]};--t:${couleurTag(t)[1]}">+ ${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="rang-champs"><fieldset class="champ"><legend>Difficulté</legend><div class="choix-statut trois">${B.difficultes.map((d) => `<label><input type="radio" name="difficulte" value="${d.niveau}" ${b.difficulte === d.niveau ? 'checked' : ''}><span>${d.nom}</span></label>`).join('')}</div></fieldset>
        <label class="champ champ-court">Points<input name="points" inputmode="decimal" value="${nb(b.points)}"></label></div>
      <label class="champ">Explication<small>Facultative : montrée dans le corrigé imprimé.</small><textarea name="explication" rows="2" maxlength="1000">${esc(b.explication)}</textarea></label>
      ${q && (usages()[q.id] || 0) ? `<p class="aide">Cette question est dans ${pluriel(usages()[q.id], 'quiz', 'quiz')} : la modifier change aussi leur correction. Supprimée, elle sera archivée (ses statistiques restent).</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    // Relit les champs dynamiques avant de redessiner la zone du type.
    const relire = () => {
      const f = modale().querySelector('form');
      if (b.type === 'qcm') b.choix = b.choix.map((c, i) => ({ texte: f.elements[`choix-${i}`]?.value ?? c.texte, juste: !!f.elements[`juste-${i}`]?.checked }));
      if (b.type === 'courte') b.acceptees = String(f.elements.acceptees?.value || '').split('\n');
      if (b.type === 'vf') b.vrai = f.elements.vrai?.value !== '0';
    };
    const redessiner = () => { $('#zone-type').innerHTML = zone(); };
    ouvrirModale(q ? 'Modifier la question' : 'Nouvelle question', corps, PIED(!!q), (fd, choix) => {
      if (choix === 'supprimer') {
        const archive = (usages()[q.id] || 0) > 0;
        modifier(() => { E = R.supprimerQuestion(E, q.id); selection.delete(q.id); }, archive ? 'Question archivée (elle reste dans les quiz et les statistiques).' : 'Question supprimée.');
        return undefined;
      }
      relire();
      const pts = R.lireNombre(fd.get('points'));
      const n = R.normaliserQuestion({ ...b, id: q?.id || uid(), enonce: fd.get('enonce'), tags: fd.get('tags'), difficulte: fd.get('difficulte'), points: pts, explication: fd.get('explication'), creeLe: q?.creeLe || auj(), archivee: q?.archivee || false,
        choix: b.choix.filter((c) => c.texte.trim()), acceptees: b.acceptees.map((a) => a.trim()).filter(Boolean) });
      if (!n.enonce) return 'Écris l\'énoncé.';
      if (pts === null || pts <= 0 || pts > 20) return 'Points : un nombre entre 0,5 et 20.';
      if (n.type === 'qcm' && n.choix.length < 2) return 'Un QCM a au moins deux propositions remplies.';
      if (n.type === 'qcm' && !n.choix.some((c) => c.juste)) return 'Coche au moins une proposition juste.';
      if (n.type === 'courte' && !n.acceptees.length) return 'Indique au moins une réponse acceptée.';
      modifier(() => {
        if (q) {
          E.questions = E.questions.map((x) => (x.id === q.id ? n : x));
          // Nombre de propositions changé : l'ordre affiché des quiz est réinitialisé (normalisation).
          E = normaliser(E);
        } else E.questions.unshift(n);
      }, q ? 'Question enregistrée.' : 'Question ajoutée à la banque.');
      return undefined;
    });
    modale().querySelectorAll('[name=type]').forEach((el) => el.addEventListener('change', () => {
      relire();
      b.type = el.value;
      if (b.type === 'qcm' && b.choix.length < 2) b.choix = [{ texte: '', juste: true }, { texte: '', juste: false }, { texte: '', juste: false }];
      redessiner();
    }));
    editionListe = (action, i) => {
      relire();
      if (action === 'ch-ajout' && b.choix.length < B.maxChoix) b.choix.push({ texte: '', juste: false });
      if (action === 'ch-suppr' && b.choix.length > 2) b.choix.splice(Number(i), 1);
      if (action === 'ch-tag') { const champ = modale().querySelector('[name=tags]'); champ.value = R.lireTags(`${champ.value},${i}`).join(', '); return; }
      redessiner();
      modale().querySelector(`[name=choix-${b.choix.length - 1}]`)?.focus();
    };
  }

  // Collage d'une liste de questions au format simple.
  function modaleColler() {
    const exemple = '? Combien font 15 % de 200 ?\n- 15\n+ 30\n- 20\n# pourcentages\n~ 1\n\n? Un litre équivaut à un décimètre cube.\n= vrai\n# unités';
    const corps = `<p class="aide">Rédige ou colle tes questions, une ligne par élément. Les lignes vides sont ignorées.</p>
      <table class="tableau petit format-collage"><tbody>${B.format.map(([m, d]) => `<tr><th scope="row"><code>${esc(m)}</code></th><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
      <label class="champ">Questions<textarea name="texte" rows="10" placeholder="${esc(exemple)}"></textarea></label>
      <div class="apercu" id="apercu-collage"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Coller des questions', corps, '<button class="btn primaire" value="ok">Ajouter à la banque</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const { questions, erreurs } = R.analyserTexte(fd.get('texte'));
      if (erreurs.length) return `Ligne ${erreurs[0].ligne} : ${erreurs[0].message}`;
      if (!questions.length) return 'Aucune question reconnue : une question commence par « ? ».';
      modifier(() => { E.questions = [...questions.map((q) => ({ ...q, id: uid(), creeLe: auj() })), ...E.questions]; }, `${pluriel(questions.length, 'question ajoutée', 'questions ajoutées')} à la banque.`);
      return undefined;
    });
    modale().classList.add('large');
    const zone = modale().querySelector('[name=texte]');
    zone.addEventListener('input', () => {
      const { questions, erreurs } = R.analyserTexte(zone.value);
      const par = B.types.map((t) => [t.nom, questions.filter((q) => q.type === t.code).length]).filter(([, n]) => n);
      $('#apercu-collage').innerHTML = zone.value.trim() ? `<p>${pluriel(questions.length, 'question reconnue', 'questions reconnues')}${par.length ? ` (${par.map(([t2, n]) => `${n} ${t2.toLowerCase()}`).join(', ')})` : ''}.</p>${erreurs.map((x) => `<p class="cd-alerte">Ligne ${x.ligne} : ${esc(x.message)}</p>`).join('')}` : '';
    });
  }

  // Générateur : tirage dans la banque.
  function modaleGenerer(ids = null) {
    const tags = tousTags();
    const corps = `<label class="champ">Titre du quiz<input name="titre" maxlength="80" value="${ids ? 'Quiz du ' : 'Quiz du '}${esc(dateCourte(auj()))}"></label>
      ${ids ? `<p class="aide">${pluriel(ids.length, 'question choisie', 'questions choisies')} dans la banque.</p>` : `
      ${tags.length ? `<fieldset class="champ"><legend>Étiquettes <small>Aucune cochée : toute la banque.</small></legend><div class="cases cases-tags">${tags.map((t) => `<label class="case"><input type="checkbox" name="tags" value="${esc(t)}" ${filtre.tag === t ? 'checked' : ''}> ${tag(t)} <small>${actives().filter((q) => q.tags.includes(t)).length}</small></label>`).join('')}</div>
        <label class="case"><input type="checkbox" name="tous"> Seulement les questions qui portent toutes les étiquettes cochées</label></fieldset>` : ''}
      <fieldset class="champ"><legend>Difficulté</legend><div class="cases">${B.difficultes.map((d) => `<label class="case"><input type="checkbox" name="difficultes" value="${d.niveau}" checked> ${d.nom}</label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Types</legend><div class="cases">${B.types.map((t) => `<label class="case"><input type="checkbox" name="types" value="${t.code}" checked> ${t.nom}</label>`).join('')}</div></fieldset>
      <div class="rang-champs"><label class="champ">Nombre de questions<input name="nombre" inputmode="numeric" value="10"></label>
        <label class="champ">Ordre<select name="ordre"><option value="hasard">Au hasard</option><option value="difficulte">Difficulté croissante</option></select></label></div>
      <label class="case"><input type="checkbox" name="moins" checked> Priorité aux questions les moins posées</label>`}
      <label class="case"><input type="checkbox" name="melanger" checked> Mélanger l'ordre des propositions des QCM</label>
      <p class="apercu" id="apercu-tirage" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    const criteres = (fd) => ({ tags: fd.getAll('tags'), tousLesTags: !!fd.get('tous'), difficultes: fd.getAll('difficultes'), types: fd.getAll('types'), nombre: Number(fd.get('nombre')) || 10, moinsPosees: !!fd.get('moins'), ordre: fd.get('ordre') });
    ouvrirModale(ids ? 'Créer un quiz' : 'Générer un quiz', corps, `<button class="btn primaire" value="ok">${ids ? 'Créer le quiz' : 'Tirer les questions'}</button><button class="btn" value="annuler">Annuler</button>`, (fd) => {
      const graine = Math.floor(Math.random() * 1e9) + 1;
      let lesIds = ids, dispo = ids?.length;
      if (!ids) {
        const c = criteres(fd);
        if (!c.difficultes.length || !c.types.length) return 'Coche au moins une difficulté et un type.';
        const r = R.tirer(E, c, graine);
        if (!r.ids.length) return 'Aucune question ne correspond à ces critères.';
        lesIds = r.ids; dispo = r.disponibles;
      }
      const z = R.normaliserQuiz({ id: uid(), titre: fd.get('titre'), creeLe: auj(), items: R.items(E, lesIds, !!fd.get('melanger'), graine) }, E.questions);
      modifier(() => { E.quiz.push(z); filtre.quiz = z.id; selection.clear(); vue = 'quiz'; history.replaceState(null, '', '#quiz'); }, `Quiz de ${pluriel(z.items.length, 'question')} créé${!ids && dispo > z.items.length ? ` (tirées parmi ${dispo})` : ''}.`);
      return undefined;
    });
    const maj = () => {
      const el = $('#apercu-tirage');
      if (!el || ids) return;
      const c = criteres(new FormData(modale().querySelector('form')));
      const n = R.eligibles(E, c).length;
      el.textContent = n ? `${pluriel(n, 'question disponible', 'questions disponibles')} : le quiz en comptera ${Math.min(n, Math.max(1, c.nombre))}.` : 'Aucune question ne correspond.';
    };
    modale().querySelector('form').addEventListener('input', maj);
    modale().querySelector('form').addEventListener('change', maj);
    maj();
  }

  // Ajout de questions de la banque à un quiz existant.
  function modaleAjouter() {
    const z = quizParId(quizChoisi());
    if (!z) return;
    const dans = new Set(z.items.map((it) => it.qid));
    const l = actives().filter((q) => !dans.has(q.id));
    const corps = `<label class="champ"><span class="sr-only">Rechercher</span><input type="search" id="cherche-ajout" placeholder="Rechercher un mot, une étiquette…"></label>
      <ul class="ajout-liste">${l.map((q) => `<li data-texte="${esc(R.plat(`${q.enonce} ${q.tags.join(' ')}`))}"><label class="case"><input type="checkbox" name="ids" value="${q.id}"><span><b>${esc(coupe(q.enonce, 100))}</b><small>${NOM_TYPE[q.type]} · ${NOM_DIF[q.difficulte]}${q.tags.length ? ` · ${esc(q.tags.join(', '))}` : ''}</small></span></label></li>`).join('') || '<li class="aide">Toutes les questions de la banque sont déjà dans ce quiz.</li>'}</ul>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Ajouter à ${esc(z.titre)}`, corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ids = fd.getAll('ids');
      if (!ids.length) return 'Coche au moins une question.';
      modifier(() => { z.items.push(...R.items(E, ids, true, Math.floor(Math.random() * 1e9) + 1)); }, `${pluriel(ids.length, 'question ajoutée', 'questions ajoutées')} au quiz.`);
      return undefined;
    });
    modale().classList.add('large');
    $('#cherche-ajout').addEventListener('input', (e) => { const r = R.plat(e.target.value); modale().querySelectorAll('.ajout-liste li[data-texte]').forEach((li) => { li.hidden = !!r && !li.dataset.texte.includes(r); }); });
  }

  function modaleQuizInfos() {
    const z = quizParId(quizChoisi());
    if (!z) return;
    const n = E.sessions.filter((s) => s.quizId === z.id).length;
    const corps = `<label class="champ">Titre<input name="titre" maxlength="80" value="${esc(z.titre)}"></label>
      <label class="champ">Consignes<small>Imprimées en tête du sujet.</small><textarea name="consignes" rows="3" maxlength="500">${esc(z.consignes)}</textarea></label>
      ${n ? `<p class="aide">Supprimer ce quiz efface aussi ses ${pluriel(n, 'session')} et leurs copies.</p>` : ''}<p class="erreur" role="alert"></p>`;
    ouvrirModale('Le quiz', corps, `${PIED(true)}<button class="btn" value="dupliquer">Dupliquer</button>`, (fd, choix) => {
      if (choix === 'supprimer') {
        if (n && !confirmer(`Supprimer « ${z.titre} », ses ${pluriel(n, 'session')} et leurs copies ?`, 'SUPPRIMER')) return 'Rien n\'a été supprimé.';
        modifier(() => { E = R.supprimerQuiz(E, z.id); filtre.quiz = ''; }, 'Quiz supprimé.');
        return undefined;
      }
      if (choix === 'dupliquer') {
        const c = R.normaliserQuiz({ ...structuredClone(z), id: uid(), titre: `${z.titre} (copie)`, creeLe: auj() }, E.questions);
        modifier(() => { E.quiz.push(c); filtre.quiz = c.id; }, 'Quiz dupliqué (sans les sessions).');
        return undefined;
      }
      modifier(() => { z.titre = R.texte(fd.get('titre'), 80) || z.titre; z.consignes = R.texte(fd.get('consignes'), 500); }, 'Quiz enregistré.');
      return undefined;
    });
  }

  // Impression : sujet, puis corrigé sur une page à part.
  function modaleImprimer() {
    const z = quizParId(quizChoisi());
    if (!z) return;
    const corps = `<p class="aide">Le sujet ne montre ni les bonnes réponses ni les étiquettes. Le corrigé commence sur une nouvelle page.</p>
      <label class="case"><input type="checkbox" name="corrige" checked> Corrigé séparé</label>
      <label class="case"><input type="checkbox" name="explications" checked> Explications dans le corrigé</label>
      <label class="case"><input type="checkbox" name="nom" checked> Cadre « Nom ou pseudonyme » sur le sujet</label>
      <label class="case"><input type="checkbox" name="points"> Points de chaque question sur le sujet</label>
      <label class="champ">Exemplaires du sujet<input name="exemplaires" inputmode="numeric" value="1"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Imprimer', corps, '<button class="btn primaire" value="ok">Imprimer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const n = Number(fd.get('exemplaires'));
      if (!Number.isInteger(n) || n < 1 || n > 60) return 'Exemplaires : de 1 à 60.';
      const sujet = pageSujet(z, { nom: !!fd.get('nom'), points: !!fd.get('points') });
      imprimer(`${Array.from({ length: n }, () => sujet).join('')}${fd.get('corrige') ? pageCorrige(z, !!fd.get('explications')) : ''}`);
      return undefined;
    });
  }
  function pageSujet(z, o) {
    const items = R.itemsDe(E, z);
    const total = items.reduce((t, it) => t + it.q.points, 0);
    return `<section class="sujet-page"><header class="imp-tete"><div><p class="surtitre">Quiz · ${pluriel(items.length, 'question')}${o.points ? ` · ${nb(total)} points` : ''}</p><h1>${esc(z.titre)}</h1>${z.consignes ? `<p>${esc(z.consignes)}</p>` : ''}</div>
        ${o.nom ? '<div class="imp-nom">Nom ou pseudonyme<span></span>Date<span></span></div>' : ''}</header>
      <ol class="imp-questions">${items.map((it, i) => `<li><p><b>${i + 1}.</b> ${esc(it.q.enonce)}${plusieursBonnes(it.q) ? ' <i>(plusieurs réponses possibles)</i>' : ''}${o.points ? ` <small>(${nb(it.q.points)} pt${it.q.points > 1 ? 's' : ''})</small>` : ''}</p>
        ${it.q.type === 'qcm' ? `<ul class="imp-choix">${it.ordre.map((c, p) => `<li><span class="imp-case"></span><b>${B.lettres[p]}.</b> ${esc(it.q.choix[c].texte)}</li>`).join('')}</ul>`
          : it.q.type === 'vf' ? '<ul class="imp-choix ligne"><li><span class="imp-case"></span>Vrai</li><li><span class="imp-case"></span>Faux</li></ul>' : '<p class="imp-ligne"></p>'}</li>`).join('')}</ol></section>`;
  }
  function pageCorrige(z, explications) {
    const items = R.itemsDe(E, z);
    return `<section class="sujet-page corrige"><header class="imp-tete"><div><p class="surtitre">Corrigé · à ne pas distribuer</p><h1>${esc(z.titre)}</h1></div><div class="imp-km"><b>${nb(items.reduce((t, it) => t + it.q.points, 0))} points</b><span>Note sur ${E.reglages.bareme} au prorata</span></div></header>
      <table class="tableau"><thead><tr><th>N°</th><th>Réponse</th><th>Pts</th>${explications ? '<th>Explication</th>' : ''}</tr></thead>
      <tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td><b>${esc(R.bonneReponseLisible(it.q, it))}</b>${it.q.type === 'qcm' ? `<br><small>${esc(R.bonnes(it.q).map((b) => it.q.choix[b].texte).join(' ; '))}</small>` : ''}</td><td>${nb(it.q.points)}</td>${explications ? `<td>${esc(it.q.explication)}</td>` : ''}</tr>`).join('')}</tbody></table>
      <p class="mention">QCM à plusieurs réponses : juste seulement si toutes les bonnes propositions, et elles seules, sont cochées. Établi le ${dateLongue(auj())}.</p></section>`;
  }
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

  // Session : quiz, nom du groupe, date, mode de saisie.
  function modaleSession(id, quizId) {
    const s = id ? sessionParId(id) : null;
    const x = s || { quizId: quizId || quizChoisi(), nom: '', date: auj(), mode: E.reglages.saisieDefaut };
    const corps = `${s ? `<p class="aide">Quiz : <b>${esc(quizParId(s.quizId)?.titre || '')}</b></p>` : `<label class="champ">Quiz<select name="quiz">${quizTries().map((z) => `<option value="${z.id}" ${z.id === x.quizId ? 'selected' : ''}>${esc(z.titre)} (${z.items.length})</option>`).join('')}</select></label>`}
      <div class="rang-champs"><label class="champ">Groupe ou session<input name="nom" maxlength="60" value="${esc(x.nom)}" placeholder="Groupe A"></label><label class="champ">Date<input type="date" name="date" value="${x.date}"></label></div>
      ${s ? '' : `<fieldset class="champ"><legend>Saisie des copies <small>Anonyme : « Copie 1, Copie 2… », rien d'autre. Nominative : prénom et initiale, ou pseudonyme, pour suivre la progression.</small></legend>
        <div class="choix-statut deux"><label><input type="radio" name="mode" value="anonyme" ${x.mode === 'anonyme' ? 'checked' : ''}><span>Anonyme</span></label><label><input type="radio" name="mode" value="nominatif" ${x.mode === 'nominatif' ? 'checked' : ''}><span>Prénom ou pseudonyme</span></label></div></fieldset>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier la session' : 'Nouvelle session', corps, PIED(false), (fd) => {
      const nom = R.texte(fd.get('nom'), 60);
      if (!nom) return 'Donne un nom au groupe ou à la session.';
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      if (s) { modifier(() => { s.nom = nom; s.date = fd.get('date'); }, 'Session enregistrée.'); return undefined; }
      const n = R.normaliserSession({ id: uid(), quizId: fd.get('quiz'), nom, date: fd.get('date'), mode: fd.get('mode') });
      modifier(() => { E.sessions.push(n); filtre.session = n.id; vue = 'corrections'; history.replaceState(null, '', '#corrections'); }, 'Session créée : saisis les copies ou fais passer le quiz sur cet appareil.');
      return undefined;
    });
  }

  // Copie : réponses question par question, note calculée.
  function modaleCopie(id, sid) {
    const c = id ? copieParId(id) : null;
    const s = sessionParId(c?.sessionId || sid);
    const z = quizParId(s?.quizId);
    if (!s || !z) return;
    const items = R.itemsDe(E, z);
    const nomDefaut = s.mode === 'anonyme' ? `Copie ${R.prochainNumeroCopie(E, s.id)}` : '';
    const corps = `<label class="champ">${s.mode === 'anonyme' ? 'Copie' : 'Prénom et initiale, ou pseudonyme'}${s.mode === 'nominatif' ? '<small>Rien de plus : pas de nom complet ni d\'autre information.</small>' : ''}<input name="apprenant" maxlength="40" value="${esc(c?.apprenant ?? nomDefaut)}" autocomplete="off" list="liste-apprenants"></label>
      ${s.mode === 'nominatif' ? `<datalist id="liste-apprenants">${R.apprenants(E).map((a) => `<option value="${esc(a.nom)}">`).join('')}</datalist>` : ''}
      <p class="aide">Lettres dans l'ordre du sujet imprimé. Une question laissée vide reste « non saisie » ; coche « Blanc » si l'apprenant n'a rien répondu.</p>
      <ol class="saisie-copie">${items.map((it, i) => `<li><p class="sc-enonce"><span class="numero-q">${i + 1}</span>${esc(coupe(it.q.enonce, 140))}${plusieursBonnes(it.q) ? ' <small>(plusieurs)</small>' : ''}</p>${champsReponse(it, c?.reponses[it.qid], 'c')}</li>`).join('')}</ol>
      <p class="apercu" id="score-copie" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button>${c ? '' : '<button class="btn" value="suivante">Enregistrer et suivante</button>'}<button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    const construire = (fd) => {
      const rep = lireReponses(fd, items, 'c');
      const cor = {};
      for (const [k, v] of Object.entries(c?.corrections || {})) if (rep[k] === c.reponses[k]) cor[k] = v; // une réponse changée perd sa correction manuelle
      return R.normaliserCopie({ id: c?.id || uid(), sessionId: s.id, apprenant: fd.get('apprenant'), reponses: rep, corrections: cor });
    };
    ouvrirModale(c ? `${esc(c.apprenant)} · ${esc(z.titre)}` : `Nouvelle copie · ${esc(s.nom)}`, corps, pied, (fd, choix) => {
      if (choix === 'supprimer') { modifier(() => { E.copies = E.copies.filter((x) => x.id !== c.id); }, 'Copie supprimée.'); return undefined; }
      if (!String(fd.get('apprenant') || '').trim()) return s.mode === 'anonyme' ? 'Donne un numéro à la copie.' : 'Indique un prénom et une initiale, ou un pseudonyme.';
      const n = construire(fd);
      const sc = R.scoreCopie(E, n, z);
      modifier(() => { if (c) E.copies = E.copies.map((x) => (x.id === c.id ? n : x)); else E.copies.push(n); },
        `${n.apprenant} : ${sc.complete ? `${nb(sc.note)}/${sc.bareme}` : `${pluriel(sc.nonSaisies, 'question')} encore à saisir`}${sc.aVerifier ? `, ${pluriel(sc.aVerifier, 'réponse')} à vérifier` : ''}.`);
      if (choix === 'suivante') { setTimeout(() => modaleCopie(null, s.id), 0); }
      return undefined;
    });
    modale().classList.add('large');
    const maj = () => {
      const n = construire(new FormData(modale().querySelector('form')));
      const sc = R.scoreCopie(E, n, z);
      $('#score-copie').textContent = `${nb(sc.points)} / ${nb(sc.total)} points${sc.complete ? ` · ${nb(sc.note)}/${sc.bareme}` : ` · ${pluriel(sc.nonSaisies, 'question non saisie', 'questions non saisies')}`}${sc.aVerifier ? ` · ${pluriel(sc.aVerifier, 'réponse')} à vérifier` : ''}`;
    };
    modale().querySelector('form').addEventListener('change', maj);
    modale().querySelector('form').addEventListener('input', maj);
    maj();
  }

  // Un apprenant : ses copies, export (JSON, CSV), effacement.
  function modaleApprenant() {
    const app = R.apprenants(E);
    if (!app.length) return toast('Aucun apprenant nommé : les sessions sont toutes anonymes.');
    const corps = `<label class="champ">Apprenant<select name="cle">${app.map((a) => `<option value="${esc(a.cle)}">${esc(a.nom)} (${pluriel(a.copies, 'copie')})</option>`).join('')}</select></label>
      <p class="aide">Export : toutes ses copies (date, quiz, réponses, note), pour lui remettre ou pour garder une trace. Effacement : ses copies disparaissent de toutes les sessions nominatives ; les statistiques sont recalculées sans elles.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Un apprenant', corps, '<button class="btn primaire" value="json">Exporter (JSON)</button><button class="btn" value="csv">Exporter (CSV)</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="effacer">Effacer</button>', (fd, choix) => {
      const cle = fd.get('cle');
      const a = app.find((x) => x.cle === cle);
      if (choix === 'json') { telecharger(JSON.stringify(R.exportResultats(E, { cle }, auj()), null, 2), 'application/json', `resultats-${fichier(a.nom)}.json`); modale().dataset.garder = '1'; return undefined; }
      if (choix === 'csv') { telecharger(R.csvReponses(E, { cle }), 'text/csv;charset=utf-8', `resultats-${fichier(a.nom)}.csv`); modale().dataset.garder = '1'; return undefined; }
      if (choix === 'effacer') {
        if (!confirm(`Effacer définitivement les ${pluriel(a.copies, 'copie')} de ${a.nom} ?`)) return 'Rien n\'a été effacé.';
        retenir();
        E = R.effacerApprenant(E, cle);
        sauver(); rendre();
        toast(`Copies de ${a.nom} effacées.`, { libelle: 'Annuler', faire: annuler });
      }
      return undefined;
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const ko = Math.round(R.taille(E) / 1000);
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Notes et statistiques</h3>
        <div class="rang-champs"><label class="champ">Notes sur<select name="bareme">${B.baremes.map((b) => `<option ${r.bareme === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label class="champ">Réponses minimum<small>avant de classer</small><input name="minReponses" inputmode="numeric" value="${r.minReponses}"></label></div>
        <div class="rang-champs"><label class="champ">Trop facile au-dessus de (%)<input name="seuilFacile" inputmode="numeric" value="${r.seuilFacile}"></label>
          <label class="champ">Trop difficile en dessous de (%)<input name="seuilDifficile" inputmode="numeric" value="${r.seuilDifficile}"></label></div></div>
      <div class="groupe"><h3>Données des apprenants</h3>
        <fieldset class="champ"><legend>Saisie proposée pour une nouvelle session</legend><div class="choix-statut deux"><label><input type="radio" name="saisieDefaut" value="anonyme" ${r.saisieDefaut === 'anonyme' ? 'checked' : ''}><span>Anonyme</span></label><label><input type="radio" name="saisieDefaut" value="nominatif" ${r.saisieDefaut === 'nominatif' ? 'checked' : ''}><span>Prénom ou pseudonyme</span></label></div></fieldset>
        <label class="champ">Conservation des résultats nominatifs (mois)<small>Au-delà, le tableau de bord rappelle d'exporter puis d'effacer ou d'anonymiser. Durée à fixer selon les règles de ton établissement.</small><input name="conservation" inputmode="numeric" value="${r.conservation}"></label>
        <div class="rang"><button class="btn petit" type="button" data-action="apprenant">Exporter ou effacer un apprenant</button><button class="btn petit" type="button" data-action="json-resultats">Tous les résultats (JSON)</button><button class="btn petit danger" type="button" data-action="effacer-tout">Effacer tous les résultats</button></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter pour un tableur</h3><div class="rang"><button class="btn petit" type="button" data-action="csv-banque">Banque (CSV)</button><button class="btn petit" type="button" data-action="csv-notes-tout">Toutes les notes (CSV)</button><button class="btn petit" type="button" data-action="csv-reponses-tout">Toutes les réponses (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde et reprise</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : `Ta banque est enregistrée en ligne avec ta clé (${ko} Ko utilisés sur environ 900). Garde aussi une copie complète sur ton ordinateur.`}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de la banque de questions, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute la banque à ton écran d'accueil pour l'ouvrir comme une application et saisir les copies où que tu sois.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${esc(B.sources.rgpd)} ${esc(B.sources.analyse)} Version ${B.version}. Aucune question fournie : la banque est la tienne. Aucune connexion à une plateforme de formation ni à une autre application.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const f = R.lireNombre(fd.get('seuilFacile')), d = R.lireNombre(fd.get('seuilDifficile')), m = R.lireNombre(fd.get('minReponses')), cons = R.lireNombre(fd.get('conservation'));
      if (f === null || f < 50 || f > 100) return 'Trop facile : un pourcentage entre 50 et 100.';
      if (d === null || d > 50) return 'Trop difficile : un pourcentage entre 0 et 50.';
      if (m === null || m < 1 || m > 100) return 'Réponses minimum : de 1 à 100.';
      if (cons === null || cons < 1 || cons > 60) return 'Conservation : de 1 à 60 mois.';
      E.reglages = R.normaliserReglages({ ...r, bareme: fd.get('bareme'), seuilFacile: f, seuilDifficile: d, minReponses: m, conservation: cons, saisieDefaut: fd.get('saisieDefaut') }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés : tout est recalculé.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichierChoisi = e.target.files[0];
      if (!fichierChoisi) return;
      try {
        const donnees = JSON.parse(await fichierChoisi.text());
        if (!Array.isArray(donnees.questions) || !Array.isArray(donnees.quiz)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.questions.length, 'question')}, ${pluriel(donnees.quiz.length, 'quiz', 'quiz')}) ?`)) return;
        retenir();
        const vu = E.tutorielVu; E = normaliser(donnees); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu);
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide de la banque de questions.'); }
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
  const fichier = (s) => R.plat(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `banque-quiz-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const blocs = [
      ['rose', 'Une banque de questions', `QCM, vrai ou faux, réponse courte&nbsp;: chaque question a ses étiquettes (thème, chapitre…), sa difficulté et, si tu veux, une explication. Une liste déjà tapée se colle d'un coup. Une question utilisée par un quiz n'est jamais perdue&nbsp;: la supprimer l'archive.`],
      ['beurre', 'Un quiz se tire en un clic', `Choisis les étiquettes, la difficulté et le nombre de questions&nbsp;: le quiz est tiré au hasard dans ta banque, avec les propositions mélangées si tu le demandes. Il s'imprime avec son corrigé à part.`],
      ['ciel', 'La correction est automatique', `Saisis les réponses de chaque copie, ou fais passer le quiz sur cet appareil&nbsp;: la note sur ${r.bareme} se calcule seule. Une réponse courte qui ne correspond à aucune réponse acceptée est mise de côté&nbsp;: c'est à toi de dire si elle est juste.`],
      ['sable', 'Des questions à améliorer', `Après ${pluriel(r.minReponses, 'réponse')}, une question réussie par ${r.seuilFacile}&nbsp;% ou plus est signalée trop facile, par ${r.seuilDifficile}&nbsp;% ou moins trop difficile. Pour un QCM, la mauvaise réponse la plus choisie est montrée si elle attire au moins 15&nbsp;% des réponses.`],
    ];
    const corps = `
      <p>L'outil tire tes quiz, corrige les copies et montre ce que tes apprenants ont compris. Ton rôle&nbsp;: écrire tes questions une fois, puis saisir les réponses de chaque session.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Corrections</b> réunit les sessions et leurs copies. Une session peut rester anonyme (Copie 1, Copie 2…)&nbsp;; une session nominative de plus de ${pluriel(r.conservation, 'mois', 'mois')} est signalée, à anonymiser ou à effacer. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.questions.length;
    const pied = premier
      ? '<button class="btn primaire" value="question">Ajouter ma première question</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'question') setTimeout(() => modaleQuestion(null), 0); });
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
      <p>Enregistre ta banque de questions sur ton écran d'accueil : elle s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    setTimeout(() => { if (!modale().open && !dejaInstalle() && !passation) modaleEcranAccueil(true); }, 900);
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
  const LISTES = ['ch-'];
  function deplacer(qid, d) {
    const z = quizParId(quizChoisi());
    const i = z.items.findIndex((it) => it.qid === qid);
    const j = i + d;
    if (i < 0 || j < 0 || j >= z.items.length) return;
    retenir();
    [z.items[i], z.items[j]] = [z.items[j], z.items[i]];
    sauver(); rendre();
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (LISTES.some((p) => action.startsWith(p))) { if (editionListe && modale().open) editionListe(action, el.dataset.i); return; }
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); oublier(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'rgpd-lu': E.reglages.rgpdLu = true; sauver(); rendre(); break;
      case 'question': modaleQuestion(id || null); break;
      case 'dupliquer-q': { const q = question(id); if (q) modaleQuestion(null, { ...structuredClone(q), id: '', enonce: `${q.enonce} (copie)`, archivee: false }); break; }
      case 'restaurer-q': modifier(() => { question(id).archivee = false; }, 'Question restaurée dans la banque.'); break;
      case 'coller': modaleColler(); break;
      case 'f-type': filtre.type = el.dataset.type; rendre(); break;
      case 'quiz-selection': modaleGenerer([...selection].filter((x) => question(x) && !question(x).archivee)); break;
      case 'vider-selection': selection.clear(); rendre(); break;
      case 'csv-banque': telecharger(R.csvBanque(E), 'text/csv;charset=utf-8', `banque-questions-${auj()}.csv`); break;
      case 'generer': modaleGenerer(); break;
      case 'aller-quiz': aller('quiz', { quiz: id }); break;
      case 'qz-ajouter': modaleAjouter(); break;
      case 'qz-modifier': modaleQuizInfos(); break;
      case 'qz-haut': deplacer(id, -1); break;
      case 'qz-bas': deplacer(id, 1); break;
      case 'qz-retirer': { const z = quizParId(quizChoisi()); modifier(() => { z.items = z.items.filter((it) => it.qid !== id); }, 'Question retirée du quiz (elle reste dans la banque).'); break; }
      case 'qz-melanger': { const z = quizParId(quizChoisi()); modifier(() => { z.items = R.items(E, z.items.map((it) => it.qid), true, Math.floor(Math.random() * 1e9) + 1); }, 'Propositions mélangées : réimprime le sujet et le corrigé.'); break; }
      case 'imprimer': modaleImprimer(); break;
      case 'session': modaleSession(null, el.dataset.quiz); break;
      case 'session-modifier': modaleSession(id); break;
      case 'aller-session': aller('corrections', { session: id }); break;
      case 'copie': modaleCopie(id || null, el.dataset.session); break;
      case 'verif': { const c = copieParId(el.dataset.copie); if (c) modifier(() => { c.corrections[el.dataset.q] = el.dataset.v === '1'; }, el.dataset.v === '1' ? 'Réponse comptée juste.' : 'Réponse comptée fausse.'); break; }
      case 'accepter': { const c = copieParId(el.dataset.copie); const q = question(el.dataset.q); if (c && q) modifier(() => { q.acceptees = [...q.acceptees, R.texte(c.reponses[q.id], 120)].slice(0, 10); }, `« ${c.reponses[q.id]} » ajoutée aux réponses acceptées : toutes les copies sont recorrigées.`); break; }
      case 'passation': fermer(); passation = { sid: id, fin: false }; rendre(); break;
      case 'passation-suivante': passation.fin = false; rendre(); break;
      case 'passation-fin': if (passation.fin || confirm('Terminer la passation ? La copie en cours n\'est pas enregistrée.')) { const sid = passation.sid; passation = null; filtre.session = sid; vue = 'corrections'; history.replaceState(null, '', '#corrections'); demarrer(); } break;
      case 'csv-notes': telecharger(R.csvNotes(E, { sessionId: id }), 'text/csv;charset=utf-8', `notes-${fichier(sessionParId(id).nom)}-${sessionParId(id).date}.csv`); break;
      case 'csv-reponses': telecharger(R.csvReponses(E, { sessionId: id }), 'text/csv;charset=utf-8', `reponses-${fichier(sessionParId(id).nom)}-${sessionParId(id).date}.csv`); break;
      case 'csv-notes-tout': telecharger(R.csvNotes(E), 'text/csv;charset=utf-8', `notes-${auj()}.csv`); break;
      case 'csv-reponses-tout': telecharger(R.csvReponses(E), 'text/csv;charset=utf-8', `reponses-${auj()}.csv`); break;
      case 'json-resultats': telecharger(JSON.stringify(R.exportResultats(E, {}, auj()), null, 2), 'application/json', `resultats-${auj()}.json`); break;
      case 'apprenant': fermer(); modaleApprenant(); break;
      case 'anonymiser': { const s = sessionParId(id); if (s && confirm(`Anonymiser « ${s.nom} » ? Les noms sont remplacés par « Copie 1, Copie 2… » ; notes et statistiques restent. Impossible de retrouver les noms ensuite.`)) modifier(() => { E = R.anonymiserSession(E, id); }, 'Session anonymisée.'); break; }
      case 'effacer-session': { const s = sessionParId(id); if (s && confirmer(`Effacer la session « ${s.nom} » et ses ${pluriel(E.copies.filter((c) => c.sessionId === id).length, 'copie')} ? Le quiz reste.`, 'EFFACER')) modifier(() => { E = R.effacerSession(E, id); filtre.session = ''; }, 'Session effacée.'); else toast('Rien n\'a été effacé.'); break; }
      case 'effacer-tout': fermer(); if (confirmer(`Effacer toutes les sessions et toutes les copies (${pluriel(E.copies.length, 'copie')}) ? La banque et les quiz restent. Pense à exporter avant.`, 'EFFACER')) modifier(() => { E = R.effacerResultats(E); filtre.session = ''; }, 'Tous les résultats sont effacés.'); else toast('Rien n\'a été effacé.'); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E || passation) return;
    rafraichir();
    if (!modale().open) rendre();
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
  window.__quiz = { etat: () => E, regles: R };
  init();
})();
