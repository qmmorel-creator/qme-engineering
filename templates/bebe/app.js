// Suivi du bébé QME : tétées et biberons, sommeil (minuteur hors ligne), couches, mesures, notes et rendez-vous
// saisis, vue « Aujourd'hui » à une main, résumés par jour et par semaine (sommes et moyennes des saisies, sans
// jugement), courbes des mesures saisies SANS courbe de référence, récapitulatif imprimable pour le rendez-vous,
// export CSV. Données de santé d'un enfant : rien n'est enregistré ni envoyé avant le consentement explicite.
// Aucun diagnostic, aucune interprétation, aucune alerte médicale, aucune norme, aucune posologie.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.BBE;
  const API = '/api/templates';
  const PRODUIT = 'BBE';
  const CLE_CODE = 'qme-bbe-code';
  const CLE_CACHE = 'qme-bbe-cache';
  const CLE_DEMO = 'qme-bbe-demo';
  const CLE_ENFANT = 'qme-bbe-enfant';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-bbe-ecran-accueil';
  const VERSION_CONSENTEMENT = '2026-11-14';

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
  const { ajout, versDate, ecart, jourDe, heureDe, texteDuree } = R;
  const maintenant = () => R.horo(new Date());
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const jourNomme = (j) => { const n = ecart(j, auj()); return n === 0 ? 'Aujourd\'hui' : n === 1 ? 'Hier' : fmt(j, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()); };
  const nb = (n, d = 1) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
  const kg = (n) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;
  const cm = (n) => `${nb(n, 1)} cm`;
  const signe = (n, f) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0));
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'jour';
  const filtre = { enfant: stock.lire(CLE_ENFANT) || '', jour: null, periode: 0 };
  let annulation = null;

  // tutorielVu (guide « Comment ça marche » déjà vu) est gardé tel quel par R.normaliser ; la fusion de deux
  // appareils garde la version en ligne : on le conserve s'il était vu d'un côté ou de l'autre.
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => ({ tutorielVu: false, ...R.normaliser(d, B) });
  const fusionner = (local, serveur) => { const f = R.fusionner(local, serveur); if (f && local?.tutorielVu) f.tutorielVu = true; return f; };
  const enfant = (id) => E.enfants.find((a) => a.id === id);
  const presents = () => E.enfants.filter((a) => a.actif !== false);
  // Enfant choisi (mémorisé sur cet appareil), sinon le plus jeune encore suivi.
  function courant() {
    const c = filtre.enfant && enfant(filtre.enfant);
    if (c) return c;
    const l = presents().length ? presents() : E.enfants;
    return [...l].sort((a, b) => String(b.naissance || '').localeCompare(String(a.naissance || '')))[0] || null;
  }
  const nomE = (id) => enfant(id)?.prenom || 'Enfant supprimé';
  const tampon = (x) => ({ ...x, maj: Date.now() });

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    // Restaure l'état d'avant, en datant à nouveau ce qui revient (pour que la fusion le garde).
    const avant = annulation; annulation = null;
    const t = Date.now();
    const ids = new Set([...avant.evenements, ...avant.rdv, ...avant.enfants].map((x) => x.id));
    const supprimes = { ...avant.supprimes };
    for (const l of ['evenements', 'rdv', 'enfants']) for (const x of E[l]) if (!ids.has(x.id)) supprimes[x.id] = t;
    for (const l of ['evenements', 'rdv', 'enfants']) avant[l] = avant[l].map((x) => { const y = E[l].find((z) => z.id === x.id); return y && JSON.stringify(y) === JSON.stringify(x) ? x : { ...x, maj: t }; });
    for (const id of ids) delete supprimes[id];
    E = { ...avant, supprimes, consentement: E.consentement };
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

  // Rien n'est gardé ni envoyé tant que le consentement n'est pas donné (E est alors null).
  function sauver() {
    if (!E || !R.consentementValide(E.consentement)) return;
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
    if (session.demo || !E || !R.consentementValide(E.consentement)) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      let { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        // L'autre parent a écrit entre-temps : on fusionne les deux versions, puis on renvoie.
        const serveur = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        if (!R.consentementValide(serveur.consentement)) { donneesEffacees(); return; }
        E = fusionner(E, serveur);
        ({ statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) }));
        if (!modale().open) rendre();
      }
      if (statut === 401) { deconnecter('Ce code d\'accès n\'est plus valide.'); return; }
      if (statut === 409) { aRenvoyer = true; throw new Error('conflit'); }
      if (statut !== 200) throw new Error(String(statut));
      session.base = corps.majLe;
      cache(false);
      majSync('ok');
    } catch {
      majSync(aRenvoyer ? 'attente' : 'horsligne');
    } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; setTimeout(envoyer, 300); }
    }
  }

  async function rafraichir() {
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours || !E) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        const serveur = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        if (!R.consentementValide(serveur.consentement)) { donneesEffacees(); return; }
        E = serveur;
        cache(false);
        if (!modale().open) rendre();
      }
    } catch { majSync('horsligne'); }
  }

  // Les données ont été effacées depuis un autre appareil : retour à l'écran de consentement.
  function donneesEffacees() {
    E = null;
    stock.suppr(CLE_CACHE);
    clearTimeout(minuterie);
    if (modale().open) modale().close();
    ecranConsentement('Les données de ce suivi ont été effacées depuis un autre appareil.');
  }

  function majSync(etat) {
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes saisies sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Code interne (BBE-…, ADM-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
  // 3 lettres dont au moins une hors de A–F, ce qu'une clé Gumroad hexadécimale ne peut pas être.
  // « BBE » n'a que des lettres hexadécimales : un code BBE compte 19 caractères, une clé Gumroad 32 ;
  // au-delà de 19 caractères, la saisie est lue comme une clé Gumroad (qui peut commencer par BBE).
  const estCodeInterne = (n) => (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3))) || (n.startsWith(PRODUIT) && n.length <= 19);
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
    const serveur = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    // Saisies faites hors ligne et pas encore envoyées : fusionnées avec la version en ligne.
    if (c && c.code === session.code && c.nonEnvoye && R.consentementValide(c.etat?.consentement) && (!serveur || R.consentementValide(serveur.consentement))) {
      E = serveur ? fusionner(normaliser(c.etat), serveur) : normaliser(c.etat);
      demarrer(); envoyer();
      return;
    }
    // Premier lancement (ou données effacées) : rien n'est enregistré avant le consentement.
    if (serveur && R.consentementValide(serveur.consentement)) { E = serveur; cache(false); demarrer(); } else { E = null; stock.suppr(CLE_CACHE); ecranConsentement(); }
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    if (!R.consentementValide(E.consentement)) E = donneesDemo();
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    clearTimeout(minuterie);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    $('#toast').hidden = true;
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Enfants fictifs (Lou, 10 semaines ; Sacha, 2 ans), aucune photo, aucune marque. Les quantités, durées et
  // mesures sont INVENTÉES pour la démonstration : ce ne sont ni des normes ni des recommandations.
  // Horaires relatifs à maintenant, tous les états couverts : sommeil en cours, tétées gauche, droite et des deux
  // côtés, biberons de lait maternel et de préparation infantile, couches pipi, selle et les deux, une journée non
  // notée, mesures (poids, taille, périmètre crânien), notes, rendez-vous passé avec compte rendu et à venir avec
  // questions, second enfant sans périmètre crânien (courbe vide).
  function donneesDemo() {
    const e = etatVide();
    e.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT, demo: true };
    const t = auj(), now = maintenant();
    const j = (n) => ajout(t, n);
    const h = (n, hh) => `${j(n)}T${hh}`;
    const T0 = Date.now() - 60000;
    const enf = (x) => { const o = R.normaliserEnfant({ id: uid(), ...x, maj: T0 }); e.enfants.push(o); return o; };
    const ev = (x) => { const o = R.normaliserEvenement({ id: uid(), maj: T0, ...x }); e.evenements.push(o); return o; };
    const rdv = (x) => { const o = R.normaliserRdv({ id: uid(), maj: T0, ...x }); e.rdv.push(o); return o; };
    // Variation déterministe (la démo est la même à chaque ouverture).
    const vari = (k, a) => Math.round(Math.sin(k * 2.17) * a);

    const lou = enf({ prenom: 'Lou', naissance: j(-72), notes: 'Enfant fictif de la démo.' });
    const sacha = enf({ prenom: 'Sacha', naissance: ajout(R.ajoutMois(t, -27), -6) });

    // Lou : cycles « repas, couche, sommeil » remontés depuis maintenant, sur 14 jours.
    const debutSommeil = R.ajoutMinutes(now, -38);
    ev({ enfantId: lou.id, type: 'sommeil', debut: debutSommeil, fin: null });
    let curseur = R.ajoutMinutes(debutSommeil, -12); // fin du dernier repas
    const limite = `${j(-14)}T06:00`;
    const sauter = j(-9); // journée non notée
    let k = 0;
    while (curseur > limite) {
      const heure = Number(heureDe(curseur).slice(0, 2));
      const nuit = heure >= 21 || heure < 6;
      // Repas : surtout des tétées, un biberon de lait maternel tiré le soir, parfois de la préparation infantile.
      const biberon = (heure >= 19 && heure < 22) || k % 11 === 5;
      const duree = biberon ? 15 : 12 + Math.abs(vari(k, 8));
      const debutRepas = R.ajoutMinutes(curseur, -duree);
      if (jourDe(debutRepas) !== sauter) {
        if (biberon) ev({ enfantId: lou.id, type: 'repas', mode: 'biberon', debut: debutRepas, ml: 110 + 10 * Math.abs(vari(k, 2)), contenu: k % 11 === 5 ? 'Préparation infantile' : 'Lait maternel' });
        else ev({ enfantId: lou.id, type: 'repas', mode: 'sein', debut: debutRepas, fin: curseur, cote: k % 7 === 3 ? '2' : k % 2 ? 'G' : 'D' });
        // Pas une couche à chaque repas (une sur cinq environ est sautée), parfois une couche entre deux repas.
        if (Math.sin(k * 1.37) > -0.75) ev({ enfantId: lou.id, type: 'couche', debut: curseur, pipi: k % 5 !== 2, selle: k % 3 === 0 });
        if (Math.sin(k * 0.91) > 0.8) ev({ enfantId: lou.id, type: 'couche', debut: R.ajoutMinutes(curseur, 40), pipi: true, selle: false });
      }
      // Sommeil précédent : plus long la nuit ; éveils et siestes irréguliers (déterministes).
      const eveil = 20 + Math.abs(Math.round(Math.sin(k * 0.73 + 1) * 50));
      const finSommeil = R.ajoutMinutes(debutRepas, -eveil);
      // Long éveil : une courte tétée de plus juste après le réveil (le nombre de repas varie d'un jour à l'autre).
      if (eveil >= 55 && !biberon && jourDe(finSommeil) !== sauter) { const d0 = R.ajoutMinutes(finSommeil, 8); ev({ enfantId: lou.id, type: 'repas', mode: 'sein', debut: d0, fin: R.ajoutMinutes(d0, 7), cote: k % 2 ? 'D' : 'G' }); }
      const long = nuit ? 150 + Math.abs(Math.round(Math.sin(k * 1.91) * 80)) : 35 + Math.abs(Math.round(Math.sin(k * 1.13 + 2) * 85));
      const debutS = R.ajoutMinutes(finSommeil, -long);
      if (jourDe(debutS) !== sauter && jourDe(finSommeil) !== sauter) ev({ enfantId: lou.id, type: 'sommeil', debut: debutS, fin: finSommeil });
      curseur = R.ajoutMinutes(debutS, -10 - Math.abs(vari(k + 3, 6)));
      k++;
    }
    // Mesures de Lou (fictives) : naissance, maternité, puis chez le médecin et à la PMI.
    const mes = (n, x, lieu) => ev({ enfantId: lou.id, type: 'mesure', debut: h(n, '10:30'), texte: lieu, ...x });
    mes(-72, { poids: 3.35, taille: 49, pc: 34.5 }, 'Naissance');
    mes(-69, { poids: 3.18 }, 'Sortie de la maternité');
    mes(-62, { poids: 3.41 }, 'Sage-femme à la maison');
    mes(-48, { poids: 3.92, taille: 52, pc: 36.5 }, 'Médecin traitant');
    mes(-41, { poids: 4.18 }, 'PMI');
    mes(-30, { poids: 4.62, taille: 54.5, pc: 38 }, 'Médecin traitant');
    mes(-16, { poids: 5.05 }, 'PMI');
    mes(-2, { poids: 5.46, taille: 57.5, pc: 39.5 }, 'PMI');
    // Notes et un premier repas « solide » absent (trop tôt) : l'enfant plus âgé en a.
    ev({ enfantId: lou.id, type: 'note', debut: h(-1, '18:40'), texte: 'Bain du soir, très calme ensuite.' });
    ev({ enfantId: lou.id, type: 'note', debut: h(-4, '09:15'), texte: 'Premier sourire en réponse à la voix.' });
    ev({ enfantId: lou.id, type: 'note', debut: h(-6, '15:00'), texte: 'Garde chez les grands-parents l\'après-midi : biberons notés par eux sur le même suivi.' });
    rdv({ enfantId: lou.id, quand: h(-30, '10:00'), avec: 'Médecin traitant', motif: 'Visite du premier mois', compteRendu: 'Mesures notées. Prochain rendez-vous dans un mois environ (exemple fictif).', fait: true });
    rdv({ enfantId: lou.id, quand: h(5, '10:30'), avec: 'PMI', motif: 'Consultation', questions: 'Organisation des biberons pour la reprise du travail.\nQuand passer le coucher dans sa chambre ?' });

    // Sacha : quelques mesures (pas de périmètre crânien), repas solides, un rendez-vous à venir.
    const ms = (d, x, lieu) => ev({ enfantId: sacha.id, type: 'mesure', debut: `${d}T11:00`, texte: lieu, ...x });
    ms(sacha.naissance, { poids: 3.62, taille: 50.5 }, 'Naissance');
    ms(R.ajoutMois(sacha.naissance, 4), { poids: 6.7, taille: 63 }, 'Médecin traitant');
    ms(R.ajoutMois(sacha.naissance, 9), { poids: 8.9, taille: 71 }, 'Médecin traitant');
    ms(R.ajoutMois(sacha.naissance, 13), { poids: 10.1, taille: 77 }, 'Pédiatre');
    ms(R.ajoutMois(sacha.naissance, 18), { poids: 11.2, taille: 82 }, 'Médecin traitant');
    ms(R.ajoutMois(sacha.naissance, 24), { poids: 12.3, taille: 87.5 }, 'Médecin traitant');
    ev({ enfantId: sacha.id, type: 'repas', mode: 'solide', debut: h(0, '12:10'), texte: 'Purée de carottes, compote' });
    ev({ enfantId: sacha.id, type: 'repas', mode: 'solide', debut: h(-1, '19:00'), texte: 'Pâtes, courgettes' });
    ev({ enfantId: sacha.id, type: 'sommeil', debut: h(-1, '13:20'), fin: h(-1, '15:05') });
    ev({ enfantId: sacha.id, type: 'note', debut: h(-2, '08:00'), texte: 'Dit « encore » pour la première fois.' });
    rdv({ enfantId: sacha.id, quand: h(12, '17:15'), avec: 'Médecin traitant', motif: 'Consultation de suivi', questions: 'Dort mal depuis la rentrée à la crèche.' });
    // Rien dans le futur sauf les rendez-vous.
    e.evenements = e.evenements.filter((x) => x.debut <= now);
    return e;
  }

  // ---------- Textes : avertissement et données ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT_TEXTE = 'Outil de notes pour les parents : il <b>ne remplace pas l\'avis du médecin, de la sage-femme ou de la PMI</b>. Il ne pose aucun diagnostic, n\'interprète aucune mesure, n\'émet aucune alerte médicale et ne donne ni posologie, ni quantité de lait, ni durée de sommeil recommandées : les totaux et les moyennes ne sont que la somme de tes saisies. En cas d\'inquiétude, appelle ton médecin ; en cas d\'urgence, le 15 ou le 112.';
  const AVERTISSEMENT = `<p class="mention avertissement" role="note">${AVERTISSEMENT_TEXTE}</p>`;
  const TEXTE_DONNEES = `
    <ul class="puces">
      <li><b>Quelles données</b> : le prénom ou le surnom et la date de naissance de ton enfant, ses repas, son sommeil, ses couches, ses mesures (poids, taille, périmètre crânien), tes notes et ses rendez-vous. Ce sont des <b>données de santé d'un enfant</b>, une catégorie particulière au sens du RGPD (article 9).</li>
      <li><b>Où</b> : en ligne, chez l'hébergeur Netlify, <b>dans l'Union européenne (Francfort, Allemagne)</b>, rattachées à ta clé de licence, et en copie dans ce navigateur pour fonctionner hors ligne. Toute personne à qui tu donnes ta clé (l'autre parent, par exemple) voit et modifie le même suivi.</li>
      <li><b>À quoi elles servent</b> : uniquement à afficher le suivi, les résumés et le récapitulatif, sur tes appareils. Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité ; QME ne les consulte pas.</li>
      <li><b>Comment les effacer</b> : Réglages → « Effacer toutes mes données » vide la version en ligne et celle de cet appareil. Tu peux aussi écrire à <b>quentin.morel@qm-engineering.fr</b> (Quentin Morel Engineering, responsable du traitement).</li>
      <li><b>Le détail</b> : <a href="/confidentialite/" target="_blank" rel="noopener">politique de confidentialité de QME</a>.</li>
    </ul>`;

  // ---------- Rendu : connexion ----------
  function ecranConnexion(message = '') {
    document.title = 'Suivi du bébé · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="80" cy="80" r="60" fill="#E8B93A"/>
          <rect x="20" y="160" width="120" height="120" fill="#2E5A88"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#E58C74"/>
          <rect x="160" y="20" width="120" height="120" fill="none" stroke="#FBF7F1" stroke-opacity=".5" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M330 250 A100 100 0 1 1 530 250 Z" fill="#2E5A88"/>
          <path d="M350 250 A80 80 0 0 1 510 250 Z" fill="#FBF7F1"/>
          <circle cx="430" cy="110" r="34" fill="#E58C74"/>
          <path d="M420 60 a10 10 0 0 1 20 0 Z" fill="#E8B93A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi du bébé</p>
          <h1>Ses journées, notées d'une main.</h1>
          <p>Tétées et biberons, sommeil, couches, mesures et rendez-vous, sur ton téléphone et celui de l'autre parent, avec le récapitulatif à montrer au médecin.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre le suivi de ton bébé</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Rien n'est enregistré avant ton accord, demandé à la première ouverture.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/bebe/">Voir le suivi du bébé</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Premier lancement : consentement, puis premier enfant ----------
  let accueil = { consentement: null, prenom: '', naissance: '' };

  function ecranConsentement(message = '') {
    document.body.classList.remove('app');
    document.title = 'Avant de commencer · Suivi du bébé';
    accueil = { consentement: null, prenom: '', naissance: '' };
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 1 sur 2"><span class="actif"></span><span></span></div></div>
        ${message ? `<p class="aide" role="status" style="margin-bottom:20px">${esc(message)}</p>` : ''}
        <p class="surtitre">Avant de commencer</p>
        <h1>Les données de ton enfant restent à toi.</h1>
        <p class="intro">Rien n'est enregistré ni envoyé tant que tu n'as pas donné ton accord ci-dessous. Lis ces points.</p>
        <div class="consentement">${TEXTE_DONNEES}</div>
        <p class="aide avertissement-sante" style="margin-top:16px">${AVERTISSEMENT_TEXTE}</p>
        <form id="form-consentement" class="consentement-form" novalidate>
          <label class="case haute"><input type="checkbox" id="accord"> <span>J'accepte que les données de santé de mon enfant (repas, sommeil, couches, mesures, notes, rendez-vous) soient enregistrées en ligne, dans l'Union européenne (Francfort), pour faire fonctionner ce suivi. Je pourrai retirer cet accord à tout moment en effaçant les données.</span></label>
          <label class="case haute"><input type="checkbox" id="parent"> <span>Je suis parent de cet enfant ou titulaire de l'autorité parentale, ou j'agis avec l'accord de l'un d'eux, et j'ai 18 ans ou plus.</span></label>
          <div class="accueil-pied">
            <button class="btn primaire" id="accepter" type="submit" disabled>Continuer</button>
            <button class="btn" type="button" data-action="deconnexion">Refuser et me déconnecter</button>
          </div>
        </form>
      </div>`;
    const maj = () => { $('#accepter').disabled = !($('#accord').checked && $('#parent').checked); };
    $('#accord').addEventListener('change', maj);
    $('#parent').addEventListener('change', maj);
    $('#form-consentement').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!($('#accord').checked && $('#parent').checked)) return;
      accueil.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT };
      ecranPremierEnfant();
      window.scrollTo({ top: 0 });
    });
  }

  function ecranPremierEnfant(erreur = '') {
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 2 sur 2"><span class="actif"></span><span class="actif"></span></div></div>
        <p class="surtitre">Ton enfant</p>
        <h1>Le suivi, en deux informations.</h1>
        <p class="intro">Un prénom ou un surnom suffit. La date de naissance sert à afficher son âge et l'âge de chaque mesure. Tu ajouteras un autre enfant ensuite, dans l'onglet Carnet.</p>
        <form id="form-enfant" novalidate class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Prénom ou surnom<input id="e-prenom" name="prenom" maxlength="40" value="${esc(accueil.prenom)}" autocomplete="off" placeholder="Ex. : Lou"></label>
            <label class="champ">Date de naissance<input id="e-naissance" name="naissance" type="date" value="${accueil.naissance}" max="${auj()}"></label>
          </div>
          <ol class="conseils" style="margin-top:20px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
          <p class="erreur" role="alert">${esc(erreur)}</p>
          <div class="accueil-pied">
            <button class="btn primaire" type="submit">Ouvrir le suivi</button>
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
          </div>
        </form>
      </div>`;
    $('#form-enfant').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      accueil.prenom = String(fd.get('prenom') || ''); accueil.naissance = String(fd.get('naissance') || '');
      if (!accueil.prenom.trim()) return ecranPremierEnfant('Indique un prénom ou un surnom.');
      if (!R.estDate(accueil.naissance) || accueil.naissance > auj()) return ecranPremierEnfant('Indique sa date de naissance (elle ne peut pas être dans le futur).');
      E = etatVide();
      E.consentement = accueil.consentement;
      const en = R.normaliserEnfant({ id: uid(), prenom: accueil.prenom, naissance: accueil.naissance, maj: Date.now() });
      E.enfants.push(en);
      filtre.enfant = en.id; stock.ecrire(CLE_ENFANT, en.id);
      accueil = { consentement: null, prenom: '', naissance: '' };
      vue = 'jour';
      sauver();
      demarrer();
      toast(`Le suivi de ${en.prenom} est prêt. Note la prochaine tétée, le prochain biberon ou la prochaine couche.`);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    jour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="3" fill="currentColor"/><rect x="3" y="10.5" width="18" height="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="17" width="12" height="3" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    croissance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19 9 13l4 3 8-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="21" cy="6" r="2.5" fill="currentColor"/></svg>',
    carnet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#E8B93A" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#B84A34" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#2E5A88" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['jour', 'Aujourd\'hui'], ['journal', 'Journal'], ['bilan', 'Résumés'], ['croissance', 'Mesures'], ['carnet', 'Carnet']];
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="30" fill="#E8B93A"/><rect x="40" y="40" width="56" height="56" fill="#2E5A88"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#E58C74"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  // Pastille de type (formes Bauhaus, jamais de couleur « d'alerte »).
  const PASTILLE = {
    sein: '<i class="pt pt-sein" aria-hidden="true"></i>', biberon: '<i class="pt pt-biberon" aria-hidden="true"></i>', solide: '<i class="pt pt-solide" aria-hidden="true"></i>',
    sommeil: '<i class="pt pt-sommeil" aria-hidden="true"></i>', couche: '<i class="pt pt-couche" aria-hidden="true"></i>', mesure: '<i class="pt pt-mesure" aria-hidden="true"></i>', note: '<i class="pt pt-note" aria-hidden="true"></i>',
  };
  const pastille = (e) => PASTILLE[e.type === 'repas' ? e.mode : e.type] || '';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Enfants fictifs, consentement simulé : rien n\'est envoyé, tout reste sur cet appareil.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi<br>du bébé</span>
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

  let jourRendu = null;
  function rendre() {
    if (!E || !$('#vue')) return;
    jourRendu = auj();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Suivi du bébé`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { jour: vueJour, journal: vueJournal, bilan: vueBilan, croissance: vueCroissance, carnet: vueCarnet }[vue]();
    brancherInfobulles();
    $('#filtre-enfant')?.addEventListener('change', (e) => { choisirEnfant(e.target.value); });
    $('#filtre-jour')?.addEventListener('change', (e) => { if (R.estDate(e.target.value)) { filtre.jour = e.target.value; rendre(); } });
    $('#filtre-periode')?.addEventListener('change', (e) => { filtre.periode = Number(e.target.value); rendre(); });
    tic();
  }
  function choisirEnfant(id) { filtre.enfant = id; stock.ecrire(CLE_ENFANT, id); rendre(); }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Minuteurs : texte des durées « en cours » et des « il y a » mis à jour toutes les 15 secondes, sans réseau.
  function tic() {
    const m = maintenant();
    document.querySelectorAll('[data-depuis]').forEach((el) => { el.textContent = texteDuree(R.minutesEntre(el.dataset.depuis, m)); });
    document.querySelectorAll('[data-ilya]').forEach((el) => { el.textContent = R.ilYa(el.dataset.ilya, m); });
  }
  setInterval(() => { if (!E || !$('#vue')) return; if (jourRendu !== auj() && !modale().open) rendre(); else tic(); }, 15000);

  function choixEnfant() {
    if (E.enfants.length < 2) return '';
    const c = courant();
    return `<label class="champ choix-enfant"><span class="sr-only">Enfant</span><select id="filtre-enfant">${E.enfants.map((a) => `<option value="${a.id}" ${c?.id === a.id ? 'selected' : ''}>${esc(a.prenom)}${a.actif === false ? ' (archivé)' : ''}</option>`).join('')}</select></label>`;
  }
  const ageDe = (en) => (en?.naissance ? R.texteAge(en.naissance, auj()) : '');
  const sansEnfant = (titre) => `${titre}${videEtat('Aucun enfant', 'Ajoute ton enfant : un prénom ou un surnom et sa date de naissance suffisent.', `<button class="btn primaire" data-action="enfant">${ICONES.plus}Ajouter un enfant</button>`)}${AVERTISSEMENT}`;

  // ---------- Aujourd'hui ----------
  function vueJour() {
    const en = courant();
    const titre = `<div class="vue-tete"><div><h1>${en ? esc(en.prenom) : 'Aujourd\'hui'}</h1><p>${en ? `${esc(ageDe(en))}${ageDe(en) ? ' · ' : ''}${esc(fmt(auj(), { weekday: 'long', day: 'numeric', month: 'long' }))}` : ''}</p></div>
      <div class="actions">${choixEnfant()}</div></div>`;
    if (!en) return sansEnfant(titre);
    const m = maintenant();
    const s = R.etatDuMoment(E, en.id, m);
    const r = R.resumeJour(E, en.id, auj(), m);
    // En cours (minuteurs).
    const enCours = [];
    if (s.teteeEnCours) enCours.push(`<div class="en-cours sein"><div><p class="surtitre">Tétée en cours${s.teteeEnCours.cote ? ` · ${s.teteeEnCours.cote === '2' ? 'les deux côtés' : `côté ${R.NOM_COTE[s.teteeEnCours.cote]}`}` : ''}</p><b data-depuis="${s.teteeEnCours.debut}">${texteDuree(R.minutesEntre(s.teteeEnCours.debut, m))}</b><span>depuis ${heureDe(s.teteeEnCours.debut)}</span></div><div class="rang">${s.teteeEnCours.cote && s.teteeEnCours.cote !== '2' ? `<button class="btn" data-action="tetee" data-cote="${s.teteeEnCours.cote === 'G' ? 'D' : 'G'}">Changer de côté</button>` : ''}<button class="btn primaire" data-action="terminer" data-id="${s.teteeEnCours.id}">Terminer</button></div></div>`);
    if (s.sommeilEnCours) enCours.push(`<div class="en-cours sommeil"><div><p class="surtitre">Dort depuis</p><b data-depuis="${s.sommeilEnCours.debut}">${texteDuree(R.minutesEntre(s.sommeilEnCours.debut, m))}</b><span>endormi à ${heureDe(s.sommeilEnCours.debut)}</span></div><div class="rang"><button class="btn primaire" data-action="terminer" data-id="${s.sommeilEnCours.id}">Réveil</button></div></div>`);
    const tuile = (lib, val, detail, col, forme, attr = '') => `<div class="tuile ${forme}" style="--c:${col}"><p class="surtitre">${lib}</p><b ${attr}>${val}</b><span>${detail}</span></div>`;
    const depuisRepas = s.repas ? tuile('Dernier repas', R.ilYa(s.repas.debut, m), `${heureDe(s.repas.debut)} · ${esc(R.libelle(s.repas, m))}`, 'var(--rouge)', 'rond', `data-ilya="${s.repas.debut}"`) : tuile('Dernier repas', '–', 'rien de noté', 'var(--rouge)', 'rond');
    const cote = tuile('Dernier côté', s.dernierCote ? (s.dernierCote === '2' ? 'Les deux' : s.dernierCote === 'G' ? 'Gauche' : 'Droit') : '–', s.dernierCote ? 'à la dernière tétée notée' : 'aucune tétée notée', 'var(--jaune)', '');
    const sommeil = s.sommeilEnCours ? tuile('Sommeil', 'Dort', `depuis ${heureDe(s.sommeilEnCours.debut)}`, 'var(--bleu)', 'rond')
      : s.reveilDepuis ? tuile('Éveillé', R.ilYa(s.reveilDepuis, m).replace('il y a ', 'depuis '), `réveil noté à ${heureDe(s.reveilDepuis)}`, 'var(--bleu)', 'rond') : tuile('Sommeil', '–', 'rien de noté', 'var(--bleu)', 'rond');
    const couche = s.couche ? tuile('Dernière couche', R.ilYa(s.couche.debut, m), `${heureDe(s.couche.debut)} · ${esc(R.libelle(s.couche).replace('Couche · ', ''))}`, 'var(--encre)', '', `data-ilya="${s.couche.debut}"`) : tuile('Dernière couche', '–', 'rien de noté', 'var(--encre)', '');
    const evs = R.evenementsDe(E, en.id).filter((e) => jourDe(e.debut) === auj() || (e.type === 'sommeil' && R.finEffective(e, m) >= `${auj()}T00:00` && e.debut < `${auj()}T00:00`));
    const prochain = R.rdvAVenir(E, en.id, m)[0];
    return `${titre}
      ${enCours.join('')}
      <h2 class="titre-section titre-noter">Noter <span>en un geste ; tout se modifie ensuite</span></h2>
      <div class="gestes" role="group" aria-label="Saisie rapide">
        <button class="geste sein" data-action="tetee" data-cote="G">${PASTILLE.sein}<b>Tétée</b><span>gauche</span></button>
        <button class="geste sein" data-action="tetee" data-cote="D">${PASTILLE.sein}<b>Tétée</b><span>droit</span></button>
        <button class="geste biberon" data-action="biberon">${PASTILLE.biberon}<b>Biberon</b><span>quantité</span></button>
        ${s.sommeilEnCours ? `<button class="geste sommeil" data-action="terminer" data-id="${s.sommeilEnCours.id}">${PASTILLE.sommeil}<b>Réveil</b><span>fin du sommeil</span></button>` : `<button class="geste sommeil" data-action="dodo">${PASTILLE.sommeil}<b>Sommeil</b><span>démarrer</span></button>`}
        <button class="geste couche" data-action="couche" data-pipi="1">${PASTILLE.couche}<b>Couche</b><span>pipi</span></button>
        <button class="geste couche" data-action="couche" data-selle="1">${PASTILLE.couche}<b>Couche</b><span>selle</span></button>
        <button class="geste couche" data-action="couche" data-pipi="1" data-selle="1">${PASTILLE.couche}<b>Couche</b><span>les deux</span></button>
        <button class="geste autre" data-action="evenement">${ICONES.plus}<b>Autre</b><span>mesure, note…</span></button>
      </div>
      <h2 class="titre-section">Depuis <span>les dernières saisies</span></h2>
      <div class="tuiles tuiles-jour">${depuisRepas}${cote}${sommeil}${couche}</div>
      <h2 class="titre-section">Aujourd'hui <span>${pluriel(r.saisies, 'saisie')}, sans comparaison à une norme</span></h2>
      <div class="totaux">
        <div><b>${r.repas}</b><span>repas</span><small>${[r.tetees ? `${pluriel(r.tetees, 'tétée')} · ${texteDuree(r.minutesSein)}` : '', r.biberons ? `${pluriel(r.biberons, 'biberon')} · ${r.ml} ml` : '', r.solides ? pluriel(r.solides, 'repas solide', 'repas solides') : ''].filter(Boolean).join('<br>') || '&nbsp;'}</small></div>
        <div><b>${texteDuree(r.sommeilMin)}</b><span>de sommeil</span><small>depuis minuit${s.sommeilEnCours ? ', sommeil en cours compris' : ''}</small></div>
        <div><b>${r.couches}</b><span>${r.couches > 1 ? 'couches' : 'couche'}</span><small>${r.pipi} pipi · ${pluriel(r.selles, 'selle')}</small></div>
      </div>
      <h2 class="titre-section">Fil du jour <span>du plus récent au plus ancien</span></h2>
      ${evs.length ? `<ul class="fil">${evs.map((e) => ligneEvenement(e, m)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien de noté aujourd\'hui</h3><p>Les gestes ci-dessus notent une tétée, un biberon, un sommeil ou une couche à l\'heure qu\'il est.</p></div></div>'}
      ${prochain ? `<h2 class="titre-section">Prochain rendez-vous</h2><ul class="rdv-liste">${ligneRdv(prochain)}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  function ligneEvenement(e, m) {
    const debutVeille = jourDe(e.debut) !== auj() && vue === 'jour';
    return `<li class="ev ${e.type === 'repas' ? e.mode : e.type}${R.enCours(e) ? ' encours' : ''}"><span class="ev-heure">${debutVeille ? `<small>veille</small>` : ''}${heureDe(e.debut)}</span>${pastille(e)}
      <button class="lien-ligne" data-action="evenement" data-id="${e.id}"><b>${esc(R.libelle(e, m))}</b>${e.type === 'sommeil' && e.fin ? `<span>${heureDe(e.debut)} → ${heureDe(e.fin)}${jourDe(e.fin) !== jourDe(e.debut) ? ' le lendemain' : ''}</span>` : ''}${e.texte ? `<span>${esc(e.texte)}</span>` : ''}</button>
      ${R.enCours(e) ? `<button class="btn petit" data-action="terminer" data-id="${e.id}">${e.type === 'sommeil' ? 'Réveil' : 'Terminer'}</button>` : ''}</li>`;
  }

  // ---------- Journal (jour par jour) ----------
  function vueJournal() {
    const en = courant();
    const j = filtre.jour && filtre.jour <= auj() ? filtre.jour : auj();
    const titre = `<div class="vue-tete"><div><h1>Journal</h1><p>Chaque jour noté${en ? ` pour ${esc(en.prenom)}` : ''}, à corriger ou à compléter après coup.</p></div>
      <div class="actions">${choixEnfant()}${en ? `<button class="btn primaire" data-action="evenement" data-jour="${j}">${ICONES.plus}Ajouter</button>` : ''}</div></div>`;
    if (!en) return sansEnfant(titre);
    const m = maintenant();
    const r = R.resumeJour(E, en.id, j, m);
    const evs = R.evenementsDe(E, en.id).filter((e) => jourDe(e.debut) === j);
    const nav = `<div class="nav-jour"><button class="btn" data-action="jour" data-jour="${ajout(j, -1)}" aria-label="Jour précédent">‹</button>
      <label class="champ"><span class="sr-only">Jour</span><input type="date" id="filtre-jour" value="${j}" max="${auj()}"></label>
      <b>${esc(jourNomme(j))}</b>
      <button class="btn" data-action="jour" data-jour="${ajout(j, 1)}" aria-label="Jour suivant" ${j >= auj() ? 'disabled' : ''}>›</button></div>`;
    const resume = `<p class="resume-jour">${r.repas} repas${r.tetees ? ` (${pluriel(r.tetees, 'tétée')}, ${texteDuree(r.minutesSein)})` : ''}${r.biberons ? ` · ${pluriel(r.biberons, 'biberon')}, ${r.ml} ml` : ''} · sommeil ${texteDuree(r.sommeilMin)} · ${pluriel(r.couches, 'couche')} (${r.pipi} pipi, ${pluriel(r.selles, 'selle')})</p>`;
    return `${titre}${nav}${resume}
      ${evs.length ? `<ul class="fil">${evs.map((e) => ligneEvenement(e, m)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Jour non noté</h3><p>Rien n'a été noté ce jour-là. Il n'est pas compté dans les moyennes des résumés.</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Résumés ----------
  function vueBilan() {
    const en = courant();
    const n = filtre.periode || E.reglages.resumeJours;
    const titre = `<div class="vue-tete"><div><h1>Résumés</h1><p>Les totaux par jour et la moyenne des jours notés${en ? ` pour ${esc(en.prenom)}` : ''}. Ce sont tes saisies, sans comparaison à une norme : seul le professionnel qui suit ton enfant les interprète.</p></div>
      <div class="actions">${choixEnfant()}<label class="champ choix-periode"><span class="sr-only">Période</span><select id="filtre-periode">${[[7, '7 derniers jours'], [14, '14 derniers jours']].map(([k, l]) => `<option value="${k}" ${n === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${en ? '<button class="btn" data-action="recap">Récapitulatif</button>' : ''}</div></div>`;
    if (!en) return sansEnfant(titre);
    const m = maintenant();
    const p = R.resumePeriode(E, en.id, auj(), n, m);
    const mo = p.moyennes;
    const v = (x, f) => (x === null ? '–' : f(x));
    const tuiles = [
      ['Repas', v(mo.repas, (x) => nb(x)), 'par jour noté', 'var(--rouge)', 'rond'],
      ['Biberons', v(mo.ml, (x) => `${nb(x, 0)} ml`), 'par jour noté', 'var(--jaune)', ''],
      ['Sommeil', v(mo.sommeilMin, (x) => texteDuree(x)), 'par jour noté', 'var(--bleu)', 'rond'],
      ['Couches', v(mo.couches, (x) => nb(x)), 'par jour noté', 'var(--encre)', ''],
    ].map(([lib, val, d, col, fo]) => `<div class="tuile ${fo}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${val}</b><span>${d}</span></div>`).join('');
    const nomJ = (j) => fmt(j, { weekday: 'short', day: 'numeric' }).replace('.', '');
    const barres = (champ, f, unite, couleur) => {
      const max = Math.max(1, ...p.jours.map((r) => r[champ]));
      const iMax = p.jours.reduce((im, r, i) => (r[champ] > p.jours[im][champ] ? i : im), 0);
      return `<figure class="graphique"><figcaption class="sr-only">${unite} par jour</figcaption><div class="projection" style="--barre:${couleur};--n:${p.jours.length}">${p.jours.map((r, i) => `<div class="col-proj ${r.jour === auj() ? 'actif' : ''} ${i === iMax ? 'max' : ''} ${!r.saisies && !r.sommeilMin ? 'non-note' : ''}" tabindex="0" data-info="<b>${esc(jourNomme(r.jour))}</b>${!r.saisies && !r.sommeilMin ? 'non noté' : esc(f(r[champ]))}${r.jour === auj() ? ' · journée en cours' : ''}"><span class="cp-val">${r[champ] ? esc(f(r[champ]).replace(/ (min|ml)$/, '')) : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${r[champ] / max * 100}%"></span></span><span class="cp-mois">${esc(nomJ(r.jour))}</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>`;
    };
    const tableau = `<details class="tableau-details"><summary>Voir le tableau jour par jour</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Jour</th><th class="nb">Repas</th><th class="nb">Tétées</th><th class="nb">Biberons</th><th class="nb">Sommeil</th><th class="nb">Couches</th><th class="nb">Pipi</th><th class="nb">Selles</th></tr></thead><tbody>${p.jours.slice().reverse().map((r) => (!r.saisies && !r.sommeilMin ? `<tr><td>${esc(jourNomme(r.jour))}</td><td colspan="7">non noté</td></tr>` : `<tr><td>${esc(jourNomme(r.jour))}</td><td class="nb">${r.repas}</td><td class="nb">${r.tetees}${r.minutesSein ? ` · ${texteDuree(r.minutesSein)}` : ''}</td><td class="nb">${r.biberons}${r.ml ? ` · ${r.ml} ml` : ''}</td><td class="nb">${texteDuree(r.sommeilMin)}</td><td class="nb">${r.couches}</td><td class="nb">${r.pipi}</td><td class="nb">${r.selles}</td></tr>`)).join('')}</tbody></table></div></details>`;
    return `${titre}<div class="tuiles">${tuiles}</div>
      <p class="aide" style="margin-top:14px">Moyennes sur ${pluriel(p.joursNotes, 'jour noté', 'jours notés')} (la journée en cours et les jours sans aucune saisie ne sont pas comptés).</p>
      <h2 class="titre-section">Le rythme <span>sommeil et repas notés, heure par heure</span></h2>
      ${rythme(en, p.jours, m)}
      <div class="colonnes-graph">
        <section><h2 class="titre-section">Sommeil <span>par jour</span></h2>${barres('sommeilMin', (x) => texteDuree(x), 'Sommeil', 'var(--bleu)')}</section>
        <section><h2 class="titre-section">Repas <span>nombre par jour</span></h2>${barres('repas', (x) => String(x), 'Repas', 'var(--rouge)')}</section>
        ${p.totaux.ml ? `<section><h2 class="titre-section">Biberons <span>ml par jour</span></h2>${barres('ml', (x) => `${x} ml`, 'Biberons', 'var(--jaune)')}</section>` : ''}
        <section><h2 class="titre-section">Couches <span>nombre par jour</span></h2>${barres('couches', (x) => String(x), 'Couches', 'var(--encre)')}</section>
      </div>
      ${tableau}
      ${AVERTISSEMENT}`;
  }

  // Rythme : une ligne de 24 h par jour, sommeil en aplat bleu, repas en repères rouges (tétées) ou jaunes (biberons).
  function rythme(en, jours, m) {
    const pct = (hh) => `${(R.minutesEntre(hh.slice(0, 10) + 'T00:00', hh) / 1440 * 100).toFixed(2)}%`;
    const lignes = jours.slice().reverse().map((r) => {
      const j = r.jour, d0 = `${j}T00:00`, d1 = `${ajout(j, 1)}T00:00`;
      const seg = [];
      for (const e of E.evenements) {
        if (e.enfantId !== en.id || !R.estHoro(e.debut)) continue;
        if (e.type === 'sommeil') {
          const a = e.debut > d0 ? e.debut : d0, f = R.finEffective(e, m), b = f < d1 ? f : d1;
          if (a < b) seg.push(`<span class="ry-s${R.enCours(e) ? ' encours' : ''}" style="left:${pct(a)};width:${(R.minutesEntre(a, b) / 1440 * 100).toFixed(2)}%"></span>`);
        } else if (e.type === 'repas' && jourDe(e.debut) === j) seg.push(`<span class="ry-r ${e.mode}" style="left:${pct(e.debut)}"></span>`);
      }
      const non = !r.saisies && !r.sommeilMin;
      return `<div class="ry-ligne${non ? ' non-note' : ''}"><span class="ry-jour">${esc(fmt(j, { weekday: 'short', day: 'numeric' }).replace('.', ''))}</span><span class="ry-piste">${non ? '<em>non noté</em>' : seg.join('')}</span></div>`;
    }).join('');
    const heures = [0, 6, 12, 18, 24].map((hh) => `<span style="left:${hh / 24 * 100}%">${hh} h</span>`).join('');
    return `<figure class="graphique rythme" aria-label="Rythme des ${jours.length} derniers jours"><div class="ry-lignes">${lignes}</div><div class="ry-heures"><span class="ry-jour"></span><span class="ry-axe">${heures}</span></div>
      <figcaption class="legende"><span><i class="ry-s"></i>Sommeil</span><span><i class="ry-r sein"></i>Tétée</span><span><i class="ry-r biberon"></i>Biberon</span><span><i class="ry-r solide"></i>Repas</span></figcaption></figure>`;
  }

  // ---------- Mesures et courbes (sans courbe de référence) ----------
  function pasRond(r) {
    const p = 10 ** Math.floor(Math.log10(r));
    const f = r / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  // Courbe d'une grandeur en fonction de l'âge (en jours depuis la naissance). Une seule série : les mesures saisies.
  function grapheMesure(en, liste, grandeur) {
    const NOMS = { poids: ['poids', 'kg', (v) => kg(v)], taille: ['taille', 'cm', (v) => cm(v)], pc: ['périmètre crânien', 'cm', (v) => cm(v)] };
    const [nom, unite, f] = NOMS[grandeur];
    if (!liste.length) return `<div class="vide-etat petit"><div><h3>Aucune mesure de ${nom}</h3><p>Note la prochaine mesure faite chez le médecin, à la PMI ou par la sage-femme : la courbe apparaît dès la deuxième.</p><div class="actions"><button class="btn" data-action="mesure">${ICONES.plus}Noter une mesure</button></div></div></div>`;
    const tel = estTel();
    const dispo = ($('#vue')?.clientWidth || 760) - (tel ? 46 : 66);
    const W = Math.round(Math.min(1140, Math.max(300, dispo))), H = (tel ? 200 : 250) - (grandeur === 'poids' ? 0 : 30);
    const mg = { g: tel ? 42 : 50, d: tel ? 54 : 66, h: 16, b: 30 };
    const base = en.naissance && en.naissance <= liste[0].date ? en.naissance : liste[0].date;
    const x0 = ecart(base, liste[0].date), x1 = ecart(base, liste.at(-1).date);
    const span = Math.max(1, x1 - x0);
    const vals = liste.map((p) => p.valeur);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const marge = Math.max((hi - lo) * 0.15, hi * 0.03, 0.05);
    const pas = pasRond((hi - lo + 2 * marge) / 4);
    const y0 = Math.max(0, Math.floor((lo - marge) / pas) * pas), y1 = Math.ceil((hi + marge) / pas) * pas;
    const dec = pas >= 1 ? 0 : 1;
    const X = (d) => (liste.length === 1 ? (mg.g + W - mg.d) / 2 : mg.g + (W - mg.g - mg.d) * (ecart(base, d) - x0) / span);
    const Y = (v) => mg.h + (H - mg.h - mg.b) * (1 - (v - y0) / (y1 - y0));
    const nbv = (v, d = dec) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const grille = [];
    for (let v = y0; v <= y1 + pas / 2; v += pas) grille.push(`<line x1="${mg.g}" x2="${W - mg.d}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g-grille"/><text x="${mg.g - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="g-axe">${nbv(v)}</text>`);
    // Étiquettes d'âge comptées depuis la fin.
    const nbE = liste.length === 1 ? 1 : tel ? 3 : 5;
    const etiq = [];
    for (let k = nbE - 1; k >= 0; k--) {
      const jj = nbE === 1 ? x1 : Math.round(x0 + span * k / (nbE - 1));
      const d = ajout(base, jj);
      etiq.push(`<text x="${X(d).toFixed(1)}" y="${H - 8}" text-anchor="${nbE > 1 && k === nbE - 1 ? 'end' : nbE > 1 && k === 0 ? 'start' : 'middle'}" class="g-axe">${esc(en.naissance && base === en.naissance ? (R.texteAge(en.naissance, d) || 'naissance').replace(/ et .*$/, '') : fmt(d, { month: 'short', year: '2-digit' }))}</text>`);
    }
    const pts = liste.map((p) => [X(p.date), Y(p.valeur)]);
    const ligne = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const zones = liste.map((p, i) => {
      const xg = i ? (pts[i - 1][0] + pts[i][0]) / 2 : mg.g, xd = i < liste.length - 1 ? (pts[i][0] + pts[i + 1][0]) / 2 : W - mg.d;
      const ec = i ? R.arrondi(p.valeur - liste[i - 1].valeur, 3) : null;
      const info = `<b>${esc(dateLongue(p.date))}</b>${en.naissance ? `${esc(R.texteAge(en.naissance, p.date) || 'naissance')} · ` : ''}${f(p.valeur)}${ec !== null ? ` · ${signe(ec, f)} depuis la mesure précédente` : ''}${p.note ? `<br>${esc(p.note)}` : ''}`;
      return `<g class="g-zone" tabindex="0" data-info="${esc(info)}"><rect x="${xg.toFixed(1)}" y="${mg.h}" width="${Math.max(2, xd - xg).toFixed(1)}" height="${H - mg.h - mg.b}" fill="transparent"/><line class="g-repere" x1="${pts[i][0].toFixed(1)}" x2="${pts[i][0].toFixed(1)}" y1="${mg.h}" y2="${H - mg.b}"/><circle class="ancre" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="6" fill="transparent"/></g>`;
    }).join('');
    const der = liste.at(-1);
    return `<figure class="graphique graphe-poids"><figcaption class="sr-only">Courbe des mesures saisies (${nom}) de ${esc(en.prenom)}, ${pluriel(liste.length, 'mesure')}, sans courbe de référence</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mesures saisies : ${nom} en ${unite}">${grille.join('')}
        <path d="${ligne}" class="g-ligne"/>
        ${pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="g-point"/>`).join('')}
        <text x="${(pts.at(-1)[0] + 9).toFixed(1)}" y="${(pts.at(-1)[1] + 4).toFixed(1)}" class="g-fin">${nbv(der.valeur, grandeur === 'poids' ? 2 : 1)}</text>
        ${etiq.join('')}${zones}</svg>
      <div class="infobulle" hidden></div></figure>`;
  }

  function vueCroissance() {
    const en = courant();
    const titre = `<div class="vue-tete"><div><h1>Mesures</h1><p>Le poids, la taille et le périmètre crânien notés${en ? ` pour ${esc(en.prenom)}` : ''}, mesure après mesure. Les courbes montrent tes saisies, sans courbe de référence ni percentile.</p></div>
      <div class="actions">${choixEnfant()}${en ? `<button class="btn primaire" data-action="mesure">${ICONES.plus}Mesure</button>` : ''}</div></div>`;
    if (!en) return sansEnfant(titre);
    const L = { poids: R.mesures(E, en.id, 'poids'), taille: R.mesures(E, en.id, 'taille'), pc: R.mesures(E, en.id, 'pc') };
    const S = { poids: R.statsMesure(L.poids), taille: R.statsMesure(L.taille), pc: R.statsMesure(L.pc) };
    const tuile = (lib, s, f, col, fo) => `<div class="tuile ${fo}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${s.dernier ? f(s.dernier.valeur) : '–'}</b><span>${s.dernier ? `le ${dateCourte(s.dernier.date)}${s.ecart !== null ? ` · ${signe(s.ecart, f)} en ${pluriel(s.jours, 'jour')}` : ''}` : 'aucune mesure'}</span></div>`;
    const toutes = R.evenementsDe(E, en.id).filter((e) => e.type === 'mesure');
    return `${titre}
      <div class="tuiles tuiles-3">${tuile('Poids', S.poids, kg, 'var(--bleu)', 'rond')}${tuile('Taille', S.taille, cm, 'var(--rouge)', '')}${tuile('Périmètre crânien', S.pc, cm, 'var(--jaune)', 'rond')}</div>
      <p class="mention reference" role="note"><b>Pas de courbe de référence.</b> ${esc(B.sources.courbes)}</p>
      <h2 class="titre-section">Poids <span>en kilogrammes, selon l'âge</span></h2>${grapheMesure(en, L.poids, 'poids')}
      <h2 class="titre-section">Taille <span>en centimètres, selon l'âge</span></h2>${grapheMesure(en, L.taille, 'taille')}
      <h2 class="titre-section">Périmètre crânien <span>en centimètres, selon l'âge</span></h2>${grapheMesure(en, L.pc, 'pc')}
      <h2 class="titre-section">Toutes les mesures <span>${pluriel(toutes.length, 'mesure')}</span></h2>
      ${toutes.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Âge</th><th class="nb">Poids</th><th class="nb">Taille</th><th class="nb">PC</th><th>Où</th><th></th></tr></thead><tbody>${toutes.map((e) => `<tr><td>${dateCourte(jourDe(e.debut))}</td><td>${esc(en.naissance ? (R.texteAge(en.naissance, jourDe(e.debut)) || 'naissance') : '')}</td><td class="nb">${e.poids ? kg(e.poids) : ''}</td><td class="nb">${e.taille ? cm(e.taille) : ''}</td><td class="nb">${e.pc ? cm(e.pc) : ''}</td><td>${esc(e.texte)}</td><td class="nb"><button class="btn lien" data-action="evenement" data-id="${e.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="aide">Aucune mesure notée.</p>'}
      ${AVERTISSEMENT}`;
  }

  // ---------- Carnet : rendez-vous, notes, enfants, récapitulatif ----------
  function ligneRdv(r) {
    const passe = r.fait || r.quand < `${auj()}T00:00`;
    return `<li class="${passe ? 'passe' : 'a-venir'}"><span class="date-pastille"><b>${versDate(r.quand).getDate()}</b>${fmt(r.quand, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="rdv" data-id="${r.id}"><b>${esc(r.motif || 'Rendez-vous')}${E.enfants.length > 1 ? ` · ${esc(nomE(r.enfantId))}` : ''}</b><span>${esc(fmt(r.quand.slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long' }))} à ${heureDe(r.quand)}${r.avec ? ` · ${esc(r.avec)}` : ''}</span>
      ${!passe && r.questions ? `<span class="rdv-q"><b>Questions</b> ${esc(r.questions).replace(/\n/g, ' · ')}</span>` : ''}${passe && r.compteRendu ? `<span class="rdv-q">${esc(r.compteRendu)}</span>` : ''}</button></li>`;
  }

  function vueCarnet() {
    const en = courant();
    const m = maintenant();
    const titre = `<div class="vue-tete"><div><h1>Carnet</h1><p>Les rendez-vous et les questions à poser, les notes, les enfants suivis, et le récapitulatif à imprimer pour le médecin, la sage-femme ou la PMI.</p></div>
      <div class="actions">${choixEnfant()}${en ? `<button class="btn" data-action="recap">Récapitulatif</button><button class="btn primaire" data-action="rdv">${ICONES.plus}Rendez-vous</button>` : ''}</div></div>`;
    if (!en) return sansEnfant(titre);
    const avenir = R.rdvAVenir(E, en.id, m), passes = R.rdvPasses(E, en.id, m);
    const notes = R.evenementsDe(E, en.id).filter((e) => e.type === 'note');
    const enfants = [...E.enfants].sort((a, b) => (a.actif === false) - (b.actif === false));
    return `${titre}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Rendez-vous à venir <span>${pluriel(avenir.length, 'rendez-vous', 'rendez-vous')}</span></h2>
          ${avenir.length ? `<ul class="rdv-liste">${avenir.map(ligneRdv).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun rendez-vous prévu</h3><p>Note le prochain rendez-vous et les questions qui te viennent d\'ici là : elles figurent dans le récapitulatif.</p></div></div>'}
          <h2 class="titre-section">Notes <span>${pluriel(notes.length, 'note')}</span><button class="btn petit" data-action="note">${ICONES.plus}Note</button></h2>
          ${notes.length ? `<ul class="fil">${notes.slice(0, 30).map((e) => `<li class="ev note"><span class="ev-heure">${esc(fmt(jourDe(e.debut), { day: 'numeric', month: 'short' }).replace('.', ''))}</span>${PASTILLE.note}<button class="lien-ligne" data-action="evenement" data-id="${e.id}"><b>${esc(e.texte)}</b></button></li>`).join('')}</ul>` : '<p class="aide">Aucune note : un premier sourire, une question, un changement à signaler au prochain rendez-vous…</p>'}
          <details class="plus-tard"${passes.length && passes.length <= 3 ? ' open' : ''}><summary>Rendez-vous passés · ${passes.length}</summary>${passes.length ? `<ul class="rdv-liste">${passes.map(ligneRdv).join('')}</ul>` : '<p class="aide">Aucun.</p>'}</details>
        </section>
        <section>
          <h2 class="titre-section">Enfants suivis</h2>
          <ul class="enfants">${enfants.map((a) => {
            const st = R.statsMesure(R.mesures(E, a.id, 'poids'));
            return `<li class="${a.actif === false ? 'inactif' : ''}${a.id === en.id ? ' choisi' : ''}"><button class="lien-ligne" data-action="choisir" data-id="${a.id}"><b>${esc(a.prenom)}</b><span>${a.naissance ? `${esc(ageDe(a))} · né(e) le ${dateCourte(a.naissance)}` : 'date de naissance inconnue'}</span><span>${st.dernier ? `Dernier poids noté : ${kg(st.dernier.valeur)} le ${dateCourte(st.dernier.date)}` : 'Aucun poids noté'}</span></button><button class="btn petit" data-action="enfant" data-id="${a.id}">Modifier</button></li>`;
          }).join('')}</ul>
          <div class="rang" style="margin-top:10px"><button class="btn petit" data-action="enfant">${ICONES.plus}Ajouter un enfant</button></div>
          <h2 class="titre-section">Récapitulatif et export</h2>
          <p class="aide">Le récapitulatif reprend les jours notés, les dernières mesures, tes notes et les questions du prochain rendez-vous : à imprimer ou à copier. L'export CSV contient toutes les saisies, pour un tableur.</p>
          <div class="rang" style="margin-top:10px"><button class="btn petit" data-action="recap">Préparer le récapitulatif</button><button class="btn petit" data-action="csv">Exporter en CSV</button></div>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Infobulles des graphiques (survol ou focus d'un élément [data-info]).
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = (el.querySelector('.ancre') || el).getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 10;
        if (y < 4) y = re.bottom - rf.top + 10;
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

  // ---------- Saisie rapide ----------
  function ajouter(liste, objet, message) {
    retenir();
    const o = tampon(objet);
    const i = E[liste].findIndex((x) => x.id === o.id);
    if (i >= 0) E[liste][i] = o; else E[liste].push(o);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
    return o;
  }
  function retirer(liste, id, message) {
    retenir();
    E[liste] = E[liste].filter((x) => x.id !== id);
    E.supprimes = { ...E.supprimes, [id]: Date.now() };
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  // Termine ce qui est en cours (tétée, sommeil) à `m` ; renvoie les libellés de ce qui a été terminé.
  function terminerEnCours(en, types, m) {
    const fini = [];
    for (const e of E.evenements) {
      if (e.enfantId !== en.id || !R.enCours(e) || !types.includes(e.type)) continue;
      const i = E.evenements.indexOf(e);
      E.evenements[i] = tampon({ ...e, fin: m > e.debut ? m : R.ajoutMinutes(e.debut, 1) });
      fini.push(e.type === 'sommeil' ? `sommeil terminé à ${heureDe(m)}` : 'tétée précédente terminée');
    }
    return fini;
  }
  function tetee(cote) {
    const en = courant(); if (!en) return;
    const m = maintenant();
    retenir();
    const fini = terminerEnCours(en, ['repas', 'sommeil'], m);
    E.evenements.push(tampon(R.normaliserEvenement({ id: uid(), enfantId: en.id, type: 'repas', mode: 'sein', cote, debut: m })));
    sauver(); rendre();
    toast(`Tétée côté ${R.NOM_COTE[cote]} démarrée à ${heureDe(m)}${fini.length ? ` (${fini.join(', ')})` : ''}.`, { libelle: 'Annuler', faire: annuler });
  }
  function dodo() {
    const en = courant(); if (!en) return;
    const m = maintenant();
    retenir();
    const fini = terminerEnCours(en, ['repas'], m);
    E.evenements.push(tampon(R.normaliserEvenement({ id: uid(), enfantId: en.id, type: 'sommeil', debut: m })));
    sauver(); rendre();
    toast(`Sommeil démarré à ${heureDe(m)}${fini.length ? ` (${fini.join(', ')})` : ''}.`, { libelle: 'Annuler', faire: annuler });
  }
  function terminer(id) {
    const e = E.evenements.find((x) => x.id === id);
    if (!e || !R.enCours(e)) return;
    const m = maintenant();
    const fin = m > e.debut ? m : R.ajoutMinutes(e.debut, 1);
    ajouter('evenements', { ...e, fin }, `${e.type === 'sommeil' ? 'Sommeil' : 'Tétée'} terminé${e.type === 'sommeil' ? '' : 'e'} : ${texteDuree(R.minutesEntre(e.debut, fin))}.`);
  }
  function couche(pipi, selle) {
    const en = courant(); if (!en) return;
    const m = maintenant();
    ajouter('evenements', R.normaliserEvenement({ id: uid(), enfantId: en.id, type: 'couche', debut: m, pipi, selle }), `Couche notée à ${heureDe(m)} (${[pipi ? 'pipi' : '', selle ? 'selle' : ''].filter(Boolean).join(' et ')}).`);
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
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const optionsEnfants = (val) => E.enfants.map((a) => `<option value="${a.id}" ${a.id === val ? 'selected' : ''}>${esc(a.prenom)}</option>`).join('');
  const champEnfant = (val, fige) => (E.enfants.length > 1 ? `<label class="champ">Enfant<select name="enfantId" ${fige ? 'disabled' : ''}>${optionsEnfants(val)}</select></label>` : `<input type="hidden" name="enfantId" value="${val}">`);
  const TYPES_SAISIE = [['sein', 'Tétée'], ['biberon', 'Biberon'], ['solide', 'Repas'], ['sommeil', 'Sommeil'], ['couche', 'Couche'], ['mesure', 'Mesure'], ['note', 'Note']];
  const nomType = (k) => TYPES_SAISIE.find((t) => t[0] === k)?.[1] || 'Saisie';
  // Horodatage par défaut d'une saisie : maintenant, ou midi d'un jour passé choisi dans le journal.
  const debutParDefaut = (jour) => (jour && jour < auj() ? `${jour}T12:00` : maintenant());

  // Saisie ou modification d'un événement. `sorte` : sein, biberon, solide, sommeil, couche, mesure, note.
  function modaleEvenement(id, sorte, jour) {
    if (!E.enfants.length) return toast('Ajoute d\'abord un enfant.');
    const ex = id ? E.evenements.find((x) => x.id === id) : null;
    if (id && !ex) return;
    const m = maintenant();
    const k = ex ? (ex.type === 'repas' ? ex.mode : ex.type) : sorte || 'sein';
    const en = ex ? enfant(ex.enfantId) || courant() : courant();
    const x = ex || { debut: debutParDefaut(jour), cote: '', fin: null, ml: '', contenu: '', texte: '', pipi: true, selle: false, poids: '', taille: '', pc: '' };
    const dmax = R.ajoutMinutes(m, 5);
    const choixType = ex ? '' : `<div class="choix-type" role="radiogroup" aria-label="Type">${TYPES_SAISIE.map(([t, l]) => `<label><input type="radio" name="sorte" value="${t}" ${t === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    const dernierBib = R.evenementsDe(E, en.id).find((e) => e.type === 'repas' && e.mode === 'biberon' && e.ml);
    const dureeIni = ex && k === 'sein' && !R.enCours(ex) ? R.dureeMinutes(ex, m) : '';
    const blocs = {
      sein: `<fieldset class="champ cadre-champs"><legend>Côté</legend><div class="choix-statut trois">${[['G', 'Gauche'], ['D', 'Droit'], ['2', 'Les deux']].map(([c, l]) => `<label><input type="radio" name="cote" value="${c}" ${String(x.cote) === c ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <label class="champ">Durée (minutes)<small>Laisse vide si la tétée est en cours : le minuteur la compte.</small><input name="duree" inputmode="numeric" value="${dureeIni}" placeholder="Ex. : 15"></label>
        <div class="puces-duree" aria-label="Durées en un geste">${B.durees.map((d) => `<button type="button" class="filtre" data-duree="${d}">${d} min</button>`).join('')}</div>`,
      biberon: `<div class="rang-champs"><label class="champ">Quantité bue (ml)<input name="ml" inputmode="numeric" value="${x.ml || ''}" placeholder="${dernierBib ? `Dernière fois : ${dernierBib.ml}` : 'Ex. : 90'}"></label>
        <label class="champ">Contenu<small>Sans marque.</small><input name="contenu" list="contenus" maxlength="60" value="${esc(x.contenu || '')}" placeholder="Lait maternel, préparation…"><datalist id="contenus">${B.contenus.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
        ${dernierBib && !ex ? `<button type="button" class="btn petit" data-ml="${dernierBib.ml}">Comme la dernière fois : ${dernierBib.ml} ml</button>` : ''}`,
      solide: '<label class="champ">Ce qui a été mangé<input name="texte" maxlength="200" value="' + esc(x.texte) + '" placeholder="Ex. : purée de carottes"></label>',
      sommeil: `<label class="champ">Fin<small>Laisse vide si le sommeil est en cours.</small><input type="datetime-local" name="fin" value="${x.fin || ''}" max="${dmax}"></label>`,
      couche: `<div class="cases-ops"><label class="case"><input type="checkbox" name="pipi" ${x.pipi ? 'checked' : ''}> Pipi</label><label class="case"><input type="checkbox" name="selle" ${x.selle ? 'checked' : ''}> Selle</label></div>`,
      mesure: `<div class="rang-champs"><label class="champ">Poids<small>En kg (5,46) ou en g (5460 g).</small><input name="poids" inputmode="decimal" value="${x.poids ? String(x.poids).replace('.', ',') : ''}"></label>
        <label class="champ">Taille (cm)<input name="taille" inputmode="decimal" value="${x.taille ? String(x.taille).replace('.', ',') : ''}"></label>
        <label class="champ">Périmètre crânien (cm)<input name="pc" inputmode="decimal" value="${x.pc ? String(x.pc).replace('.', ',') : ''}"></label></div>
        <label class="champ">Où<small>Facultatif : médecin, PMI, sage-femme, maison…</small><input name="texte" maxlength="120" value="${esc(x.texte)}"></label>
        <p class="aide">Recopie les mesures relevées par le professionnel (carnet de santé). L'outil les trace sans les comparer à aucune référence.</p>`,
      note: `<label class="champ">Note<textarea name="texte" maxlength="500" placeholder="Une observation, une question pour le prochain rendez-vous…">${esc(x.texte)}</textarea></label>`,
    };
    const corps = `${choixType}${champEnfant(en.id, !!ex)}
      <label class="champ" data-debut>${k === 'sommeil' ? 'Endormi à' : k === 'mesure' ? 'Mesuré le' : 'Le'}<input type="datetime-local" name="debut" value="${x.debut}" max="${dmax}" required></label>
      <div data-blocs>${blocs[k]}</div>
      ${k === 'sein' || k === 'biberon' ? '<p class="aide">Aucune quantité ni durée n\'est recommandée par l\'outil : il additionne ce que tu notes.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(ex ? `Modifier : ${nomType(k).toLowerCase()}` : 'Nouvelle saisie', corps, PIED(!!ex), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer cette saisie ?')) return ''; retirer('evenements', ex.id, 'Saisie supprimée.'); return undefined; }
      const sorteF = ex ? k : fd.get('sorte') || k;
      const debut = String(fd.get('debut') || '');
      if (!R.estHoro(debut)) return 'Date et heure illisibles.';
      if (debut > dmax) return 'L\'heure est dans le futur.';
      const enfantId = ex ? ex.enfantId : fd.get('enfantId');
      const o = { ...(ex || {}), id: ex?.id || uid(), enfantId, debut };
      if (sorteF === 'sein' || sorteF === 'biberon' || sorteF === 'solide') { o.type = 'repas'; o.mode = sorteF; } else o.type = sorteF;
      if (sorteF === 'sein') {
        o.cote = fd.get('cote') || '';
        const dS = String(fd.get('duree') || '').trim();
        if (dS) { const d = R.lireDuree(dS); if (d === null) return 'Durée illisible : écris un nombre de minutes (ex. 15) ou 1 h 10.'; o.fin = R.ajoutMinutes(debut, d); o.duree = 0; }
        else { if (R.minutesEntre(debut, m) > 360) return 'Indique la durée : une tétée en cours ne peut pas avoir commencé il y a plus de 6 heures.'; o.fin = null; o.duree = 0; }
      } else if (sorteF === 'biberon') {
        const s = String(fd.get('ml') || '').trim();
        const ml = s ? R.lireMl(s) : 0;
        if (ml === null) return 'Quantité illisible : écris un nombre de millilitres (ex. 90).';
        o.ml = ml; o.contenu = fd.get('contenu');
      } else if (sorteF === 'solide') {
        o.texte = fd.get('texte');
      } else if (sorteF === 'sommeil') {
        const fin = String(fd.get('fin') || '');
        if (fin && !R.estHoro(fin)) return 'Heure de fin illisible.';
        if (fin && fin <= debut) return 'La fin doit être après le début.';
        if (fin && fin > dmax) return 'L\'heure de fin est dans le futur.';
        if (!fin && E.evenements.some((e) => e.id !== o.id && e.enfantId === enfantId && e.type === 'sommeil' && R.enCours(e))) return 'Un sommeil est déjà en cours : termine-le d\'abord, ou indique la fin de celui-ci.';
        o.fin = fin || null;
      } else if (sorteF === 'couche') {
        o.pipi = !!fd.get('pipi'); o.selle = !!fd.get('selle');
      } else if (sorteF === 'mesure') {
        const lire = (nom, f, msg) => { const s = String(fd.get(nom) || '').trim(); if (!s) return 0; const v = f(s); if (v === null) throw new Error(msg); return v; };
        try {
          o.poids = lire('poids', R.lirePoids, 'Poids illisible : écris par exemple 5,46 (kg) ou 5460 g.');
          o.taille = lire('taille', R.lireTaille, 'Taille illisible : écris par exemple 57,5 (cm).');
          o.pc = lire('pc', R.lirePc, 'Périmètre crânien illisible : écris par exemple 39,5 (cm).');
        } catch (er) { return er.message; }
        if (!o.poids && !o.taille && !o.pc) return 'Indique au moins une mesure.';
        o.texte = fd.get('texte');
      } else if (sorteF === 'note') {
        o.texte = fd.get('texte');
        if (!String(o.texte).trim()) return 'Écris la note.';
      }
      ajouter('evenements', R.normaliserEvenement(o), ex ? 'Saisie modifiée.' : `${nomType(sorteF)} notée.`.replace('Sommeil notée', 'Sommeil noté').replace('Repas notée', 'Repas noté'));
      return undefined;
    });
    const d = modale();
    // Changement de type (nouvelle saisie) : on rouvre la modale sur le bon formulaire, l'heure saisie est gardée.
    d.querySelectorAll('[name=sorte]').forEach((r) => r.addEventListener('change', () => { const deb = d.querySelector('[name=debut]').value; modaleEvenement(null, r.value, jour); if (R.estHoro(deb)) modale().querySelector('[name=debut]').value = deb; }));
    d.querySelectorAll('[data-duree]').forEach((b) => b.addEventListener('click', () => { d.querySelector('[name=duree]').value = b.dataset.duree; }));
    d.querySelector('[data-ml]')?.addEventListener('click', (ev) => { d.querySelector('[name=ml]').value = ev.target.dataset.ml; });
  }

  function modaleEnfant(id) {
    const a = id ? enfant(id) : null;
    if (id && !a) return;
    const x = a || { prenom: '', naissance: '', notes: '', actif: true };
    const n = a ? E.evenements.filter((e) => e.enfantId === a.id).length + E.rdv.filter((r) => r.enfantId === a.id).length : 0;
    const corps = `<div class="rang-champs"><label class="champ">Prénom ou surnom<input name="prenom" maxlength="40" value="${esc(x.prenom)}" required></label>
        <label class="champ">Date de naissance<input type="date" name="naissance" value="${x.naissance || ''}" max="${auj()}"></label></div>
      <label class="champ">Notes<small>Facultatif.</small><textarea name="notes" maxlength="500">${esc(x.notes)}</textarea></label>
      ${a ? `<label class="case"><input type="checkbox" name="archive" ${x.actif === false ? 'checked' : ''}> Ne plus suivre (gardé pour son historique, retiré de la sélection par défaut)</label>` : ''}
      <p class="aide">Seuls un prénom (ou un surnom) et la date de naissance sont demandés : aucune autre donnée d'identité.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Modifier l\'enfant' : 'Nouvel enfant', corps, PIED(!!a), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${a.prenom} »${n ? ` et ses ${pluriel(n, 'saisie')}` : ''} ? C'est définitif (télécharge une copie avant si besoin).`)) return '';
        retenir(); E = R.supprimerEnfant(E, a.id, Date.now()); if (filtre.enfant === a.id) choisirEnfant(''); sauver(); rendre();
        toast('Enfant supprimé.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      if (!String(fd.get('prenom')).trim()) return 'Indique un prénom ou un surnom.';
      const nais = fd.get('naissance');
      if (!nais) return 'Indique sa date de naissance.';
      if (nais > auj()) return 'La date de naissance ne peut pas être dans le futur.';
      const o = R.normaliserEnfant({ ...(a || {}), id: a?.id || uid(), prenom: fd.get('prenom'), naissance: nais, notes: fd.get('notes'), actif: a ? !fd.get('archive') : true });
      ajouter('enfants', o, a ? 'Fiche enregistrée.' : `${o.prenom} est ajouté(e).`);
      if (!a) choisirEnfant(o.id);
      return undefined;
    });
  }

  function modaleRdv(id) {
    if (!E.enfants.length) return toast('Ajoute d\'abord un enfant.');
    const r = id ? E.rdv.find((x) => x.id === id) : null;
    if (id && !r) return;
    const en = r ? enfant(r.enfantId) || courant() : courant();
    const x = r || { quand: `${ajout(auj(), 7)}T10:00`, avec: '', motif: '', questions: '', compteRendu: '', fait: false };
    const corps = `${champEnfant(en.id, !!r)}
      <div class="rang-champs"><label class="champ">Le<input type="datetime-local" name="quand" value="${x.quand}" required></label>
        <label class="champ">Avec<input name="avec" list="interlocuteurs" maxlength="120" value="${esc(x.avec)}" placeholder="Médecin, PMI, sage-femme…"><datalist id="interlocuteurs">${B.interlocuteurs.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
      <label class="champ">Motif<input name="motif" maxlength="200" value="${esc(x.motif)}" placeholder="Ex. : consultation de suivi"></label>
      <label class="champ">Questions à poser<small>Elles figurent dans le récapitulatif.</small><textarea name="questions" maxlength="1000">${esc(x.questions)}</textarea></label>
      <label class="champ">Ce qui a été dit<small>Après le rendez-vous, pour t'en souvenir.</small><textarea name="compteRendu" maxlength="2000">${esc(x.compteRendu)}</textarea></label>
      <label class="case"><input type="checkbox" name="fait" ${x.fait ? 'checked' : ''}> Rendez-vous passé</label>
      <p class="aide">Aucun calendrier de vaccins ni d'examens n'est intégré : tu notes les rendez-vous fixés avec le professionnel qui suit ton enfant.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', corps, PIED(!!r), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer ce rendez-vous ?')) return ''; retirer('rdv', r.id, 'Rendez-vous supprimé.'); return undefined; }
      const quand = String(fd.get('quand') || '');
      if (!R.estHoro(quand)) return 'Date et heure illisibles.';
      ajouter('rdv', R.normaliserRdv({ ...(r || {}), id: r?.id || uid(), enfantId: r ? r.enfantId : fd.get('enfantId'), quand, avec: fd.get('avec'), motif: fd.get('motif'), questions: fd.get('questions'), compteRendu: fd.get('compteRendu'), fait: !!fd.get('fait') }), r ? 'Rendez-vous enregistré.' : 'Rendez-vous noté.');
      return undefined;
    });
  }

  // Récapitulatif : période (depuis le dernier rendez-vous, 7, 14 ou 30 jours), aperçu, impression, copie.
  function modaleRecap() {
    const en = courant(); if (!en) return;
    const m = maintenant();
    const dernier = R.rdvPasses(E, en.id, m)[0];
    const choix = [['7', '7 derniers jours'], ['14', '14 derniers jours'], ['30', '30 derniers jours'], ...(dernier ? [['rdv', `Depuis le dernier rendez-vous (${dateCourte(dernier.quand.slice(0, 10))})`]] : [])];
    let periode = '7';
    const bornes = () => { const au = auj(); const du = periode === 'rdv' && dernier ? jourDe(dernier.quand) : ajout(au, -(Number(periode) - 1)); return [du < au ? du : au, au]; };
    const c = () => { const [du, au] = bornes(); return R.recap(E, en, du, au, m); };
    const corps = `<p>Le récapitulatif de <b>${esc(en.prenom)}</b>, à imprimer ou à copier pour le rendez-vous : jours notés, dernières mesures, notes et questions.</p>
      <label class="champ">Période<select name="periode">${choix.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
      <pre class="apercu-histo" data-recap></pre>`;
    ouvrirModale('Récapitulatif', corps, '<button class="btn primaire" value="imprimer">Imprimer</button><button class="btn" value="copier">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (_, v) => {
      if (v === 'imprimer') { imprimerRecap(c()); return undefined; }
      if (v === 'copier') {
        navigator.clipboard?.writeText(R.texteRecap(c())).then(() => toast('Récapitulatif copié : colle-le dans un message ou un document.'), () => toast('Copie impossible : sélectionne le texte à la main.'));
        modale().dataset.garder = '1';
      }
      return undefined;
    });
    const maj = () => { modale().querySelector('[data-recap]').textContent = R.texteRecap(c()); };
    modale().querySelector('[name=periode]').addEventListener('change', (e) => { periode = e.target.value; maj(); });
    maj();
  }

  function imprimerRecap(c) {
    const el = $('#impression');
    const d = c.derniers;
    const mo = c.periode.moyennes;
    el.innerHTML = `<header class="imp-tete"><div><p class="surtitre">Récapitulatif pour le rendez-vous</p><h1>${esc(c.enfant.prenom)}</h1><p>${c.enfant.naissance ? `Né(e) le ${dateLongue(c.enfant.naissance)} · ${esc(c.age)}` : ''}</p><p>Du ${dateLongue(c.du)} au ${dateLongue(c.au)} · notes des parents</p></div>
      <div class="imp-km">${d.poids ? `<b>${kg(d.poids.valeur)}</b><span>poids noté le ${dateLongue(d.poids.date)}</span>` : '<span>aucun poids noté</span>'}</div></header>
      <h2>Dernières mesures notées</h2>
      <table class="tableau"><thead><tr><th>Date</th><th class="nb">Poids</th><th class="nb">Taille</th><th class="nb">Périmètre crânien</th><th>Où</th></tr></thead><tbody>${c.mesures.map((e) => `<tr><td>${dateCourte(jourDe(e.debut))}</td><td class="nb">${e.poids ? kg(e.poids) : ''}</td><td class="nb">${e.taille ? cm(e.taille) : ''}</td><td class="nb">${e.pc ? cm(e.pc) : ''}</td><td>${esc(e.texte)}</td></tr>`).join('') || '<tr><td colspan="5">Aucune mesure notée.</td></tr>'}</tbody></table>
      <h2>Jour par jour</h2>
      <table class="tableau"><thead><tr><th>Jour</th><th class="nb">Repas</th><th class="nb">Tétées</th><th class="nb">Biberons</th><th class="nb">Sommeil</th><th class="nb">Couches</th><th class="nb">Pipi</th><th class="nb">Selles</th></tr></thead><tbody>${c.periode.jours.slice().reverse().map((r) => (!r.saisies && !r.sommeilMin ? `<tr><td>${dateCourte(r.jour)}</td><td colspan="7">non noté</td></tr>` : `<tr><td>${dateCourte(r.jour)}</td><td class="nb">${r.repas}</td><td class="nb">${r.tetees}${r.minutesSein ? ` · ${texteDuree(r.minutesSein)}` : ''}</td><td class="nb">${r.biberons}${r.ml ? ` · ${r.ml} ml` : ''}</td><td class="nb">${texteDuree(r.sommeilMin)}</td><td class="nb">${r.couches}</td><td class="nb">${r.pipi}</td><td class="nb">${r.selles}</td></tr>`)).join('')}</tbody>
      ${c.periode.joursNotes ? `<tfoot><tr><td>Moyenne par jour noté (${c.periode.joursNotes})</td><td class="nb">${nb(mo.repas)}</td><td class="nb">${nb(mo.tetees)}</td><td class="nb">${nb(mo.biberons)}${mo.ml ? ` · ${nb(mo.ml, 0)} ml` : ''}</td><td class="nb">${texteDuree(mo.sommeilMin)}</td><td class="nb">${nb(mo.couches)}</td><td class="nb">${nb(mo.pipi)}</td><td class="nb">${nb(mo.selles)}</td></tr></tfoot>` : ''}</table>
      ${c.repasTextes.length ? `<h2>Repas notés</h2>${c.repasTextes.map((e) => `<p>${dateCourte(jourDe(e.debut))} ${heureDe(e.debut)} · ${esc(e.texte)}</p>`).join('')}` : ''}
      <h2>Notes</h2>${c.notes.length ? c.notes.map((n) => `<p>${dateCourte(jourDe(n.debut))} ${heureDe(n.debut)} · ${esc(n.texte)}</p>`).join('') : '<p>Aucune note sur la période.</p>'}
      ${c.prochain ? `<h2>Prochain rendez-vous</h2><p>${dateLongue(jourDe(c.prochain.quand))} à ${heureDe(c.prochain.quand)}${c.prochain.avec ? ` · ${esc(c.prochain.avec)}` : ''}${c.prochain.motif ? ` · ${esc(c.prochain.motif)}` : ''}</p>${c.prochain.questions ? `<p><b>Questions à poser :</b> ${esc(c.prochain.questions).replace(/\n/g, '<br>')}</p>` : ''}` : ''}
      <p class="mention">Établi le ${dateLongue(auj())} à partir des notes des parents. Ne remplace ni le carnet de santé ni l'avis du médecin, de la sage-femme ou de la PMI.</p>`;
    el.hidden = false;
    document.body.classList.add('imprime');
    modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Résumés</h3><p class="aide">Période affichée par défaut dans l'onglet Résumés.</p>
        <div class="choix-statut deux">${[[7, '7 jours'], [14, '14 jours']].map(([k, l]) => `<label><input type="radio" name="resumeJours" value="${k}" ${r.resumeJours === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <div class="groupe"><h3>À deux</h3><p class="aide">Pour que l'autre parent note aussi, ouvre ce suivi sur son téléphone avec la même clé de licence. Vos saisies se rejoignent, même faites en même temps. Ne donne ta clé qu'aux personnes de confiance : elles voient tout le suivi.</p></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les saisies (repas, sommeil, couches, mesures, notes, rendez-vous) en tableur (CSV). Le récapitulatif imprimable se prépare depuis l'onglet Carnet.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button><button class="btn petit" type="button" data-action="recap">Récapitulatif</button></div></div>
      <div class="groupe"><h3>Tes données</h3>${session.demo ? '<p class="aide">En démo, le consentement est simulé : les données sont fictives et restent dans ce navigateur, rien n\'est envoyé.</p>' : TEXTE_DONNEES}
        ${E.consentement && !session.demo ? `<p class="aide">Accord donné le ${new Date(E.consentement.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (version ${esc(E.consentement.version)}).</p>` : ''}
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <div class="rang"><button class="btn petit danger" type="button" data-action="effacer-tout">Effacer toutes mes données</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi du bébé, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le suivi à ton écran d'accueil pour l'ouvrir d'un geste, même la nuit, comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Santé de ton enfant</h3><p class="mention">${AVERTISSEMENT_TEXTE}</p></div>
      <div class="groupe"><h3>Sources</h3><p class="mention">${esc(B.sources.courbes)} Libellés et choix proposés rédigés pour QME (version ${esc(B.version)}) ; aucune norme de quantité de lait, de nombre de repas ou de durée de sommeil, aucun calendrier vaccinal, aucune posologie, aucune marque.</p></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Fermer</button>', (fd) => {
      const n = Number(fd.get('resumeJours'));
      if (n !== r.resumeJours) { E.reglages = tampon(R.normaliserReglages({ resumeJours: n }, B.reglages)); filtre.periode = 0; sauver(); rendre(); toast('Réglages enregistrés.'); }
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.enfants) || !Array.isArray(d.evenements)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.enfants.length, 'enfant')}, ${pluriel(d.evenements.length, 'saisie')}) ?`)) return;
        const consentement = E.consentement;
        const t = Date.now();
        const anciens = [...E.enfants, ...E.evenements, ...E.rdv].map((x) => x.id);
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe;
        E.consentement = consentement; E.tutorielVu = E.tutorielVu || vu;
        for (const l of ['enfants', 'evenements', 'rdv']) E[l] = E[l].map((x) => ({ ...x, maj: t }));
        const gardes = new Set([...E.enfants, ...E.evenements, ...E.rdv].map((x) => x.id));
        for (const id of anciens) if (!gardes.has(id)) E.supprimes[id] = t;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-bebe-${auj()}.json`);
  const exporterCsv = () => telecharger(R.csv(E, maintenant()), 'text/csv;charset=utf-8', `suivi-bebe-${auj()}.csv`);

  // Efface tout : la version en ligne est remplacée par un espace vide (sans consentement), puis l'appareil est vidé.
  async function effacerTout() {
    if (session.demo) {
      if (!confirm('Effacer les données de démo de ce navigateur ?')) return;
      stock.suppr(CLE_DEMO); stock.suppr(CLE_CODE);
      modale().close();
      deconnecter('Données de démo effacées.');
      return;
    }
    if (!confirm('Effacer toutes les données du suivi (enfants, repas, sommeil, couches, mesures, notes, rendez-vous), en ligne et sur cet appareil ? C\'est définitif, aussi pour l\'autre parent qui utilise la même clé. Télécharge une copie avant si tu veux la garder.')) return;
    clearTimeout(minuterie);
    for (let i = 0; envoiEnCours && i < 50; i++) await new Promise((r) => setTimeout(r, 100));
    const vide = etatVide();
    const bouton = modale().querySelector('[data-action="effacer-tout"]');
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Effacement…'; }
    try {
      let { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: vide, base: session.base }) });
      if (statut === 409) ({ statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: vide, base: corps.donnees.majLe }) }));
      if (statut !== 200) throw new Error(String(statut));
      session.base = corps.majLe;
    } catch {
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Effacer toutes mes données'; }
      toast('Effacement impossible sans connexion : la version en ligne n\'a pas été modifiée. Réessaie une fois en ligne.');
      return;
    }
    E = null;
    stock.suppr(CLE_CACHE);
    stock.suppr(CLE_ENFANT);
    modale().close();
    ecranConsentement('Toutes les données ont été effacées, en ligne et sur cet appareil. Tu peux recommencer ou te déconnecter.');
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Note en un geste', `Dans <b>Aujourd'hui</b>, touche <b>Tétée</b> (gauche ou droit), <b>Biberon</b>, <b>Sommeil</b> ou <b>Couche</b>&nbsp;: l'heure notée est celle du moment. Une tétée ou un sommeil lance un minuteur, arrêté par <b>Terminer</b> ou <b>Réveil</b>. Tout se modifie ensuite, et un geste s'annule depuis le message qui s'affiche.`],
      ['beurre', 'Depuis quand&nbsp;?', `Les tuiles montrent depuis quand ont eu lieu le dernier repas et la dernière couche, le dernier côté donné, et depuis quand ton enfant dort ou est éveillé. Les totaux du jour se comptent depuis minuit.`],
      ['ciel', 'Résumés et mesures', `<b>Résumés</b> donne les totaux par jour et la moyenne des jours notés, sur ${E.reglages.resumeJours}&nbsp;jours par défaut. <b>Mesures</b> trace le poids, la taille et le périmètre crânien que tu saisis, sans courbe de référence ni percentile.`],
      ['sable', 'Le carnet des rendez-vous', `Dans <b>Carnet</b>, note les rendez-vous et les questions à poser. Le <b>Récapitulatif</b> prépare une page à imprimer pour le médecin, la sage-femme ou la PMI.`],
      ['rose', 'Des notes, pas un avis médical', `Aucun diagnostic, aucune norme, aucune alerte médicale&nbsp;: les totaux et les moyennes ne sont que la somme de tes saisies. En cas d'inquiétude, appelle ton médecin&nbsp;; en cas d'urgence, le&nbsp;15 ou le&nbsp;112.`],
    ];
    const corps = `
      <p>Le suivi additionne pour toi les repas, le sommeil et les couches de ton enfant, et garde ses mesures et ses rendez-vous. Ton rôle&nbsp;: noter, en un geste, au moment où ça se passe.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">${session.demo ? 'En démo, les données sont fictives et restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne, dans l\'Union européenne, avec ta clé&nbsp;: l\'autre parent qui ouvre le suivi avec la même clé note au même endroit, et vos saisies se rejoignent.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
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
      <p>Enregistre ce suivi sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-retour': ecranConsentement(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'effacer-tout': effacerTout(); break;
      case 'fermer': modale().close(); break;
      case 'tetee': tetee(el.dataset.cote); break;
      case 'dodo': dodo(); break;
      case 'terminer': terminer(id); break;
      case 'couche': couche(!!el.dataset.pipi, !!el.dataset.selle); break;
      case 'biberon': modaleEvenement(null, 'biberon'); break;
      case 'mesure': modaleEvenement(null, 'mesure'); break;
      case 'note': modaleEvenement(null, 'note'); break;
      case 'evenement': modaleEvenement(id || null, null, el.dataset.jour); break;
      case 'enfant': modaleEnfant(id || null); break;
      case 'choisir': choisirEnfant(id); break;
      case 'rdv': modaleRdv(id || null); break;
      case 'recap': if (modale().open) modale().close(); modaleRecap(); break;
      case 'jour': if (el.dataset.jour <= auj()) { filtre.jour = el.dataset.jour; rendre(); } break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // l'heure a avancé
  });
  // L'autre parent note peut-être en ce moment : relecture toutes les 30 secondes quand la page est visible.
  setInterval(() => { if (document.visibilityState === 'visible' && E) rafraichir(); }, 30000);
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Les courbes dépendent de la largeur (viewBox) : redessinées au passage téléphone / ordinateur.
  MQ_TEL.addEventListener?.('change', () => { if (E && vue === 'croissance' && !modale().open) rendre(); });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
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
      if (c && c.code === code && R.consentementValide(c.etat?.consentement) && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__bebe = { etat: () => E, regles: R };
  init();
})();
