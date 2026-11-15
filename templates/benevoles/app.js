// Bénévoles et planning des créneaux QME : annuaire des bénévoles, événements, postes et créneaux, affectation
// manuelle ou suggérée, trous et conflits visibles, plannings imprimables, messages à copier, bilan des heures.
// Données synchronisées par clé de licence ou code d'accès, partagées par les responsables qui ont la clé ;
// les saisies faites en même temps sur deux appareils sont fusionnées.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.BNV;
  const API = '/api/templates';
  const PRODUIT = 'BNV';
  const CLE_CODE = 'qme-bnv-code';
  const CLE_CACHE = 'qme-bnv-cache';
  const CLE_DEMO = 'qme-bnv-demo';
  const CLE_AUTEUR = 'qme-bnv-auteur';
  const CLE_EVT = 'qme-bnv-evenement';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-bnv-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, couleurs: B.couleurs, message: B.message };

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
  const { ajout, versDate, heuresTexte: hh } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateJour = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());
  const dateJourCourt = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const hm = (s) => s.replace(':', ' h ').replace(/ h 00$/, ' h');
  const plageC = (c) => `${hm(c.debut)} – ${hm(c.fin)}`;
  const pct = (t) => (Number.isFinite(t) ? `${Math.round(t * 100)} %` : '—');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, baseEtat: null, memoriser: true };
  let vue = 'evenement';
  let evId = stock.lire(CLE_EVT);
  const pl = { mode: 'poste', jour: '' };
  const fb = { q: '', comp: '', dispo: '' };
  const bi = { periode: '' };
  let annulation = null;

  const etatVide = () => ({ ...R.etatVide(DEFAUTS), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const tr = (coll, id) => R.trouver(E, coll, id);
  const benevole = (id) => tr('benevoles', id);
  const poste = (id) => tr('postes', id);
  const creneau = (id) => tr('creneaux', id);
  const evenement = (id) => tr('evenements', id);
  const nomB = (id) => { const b = benevole(id); return b ? `${b.prenom} ${b.nom}`.trim() || 'Sans nom' : 'Bénévole supprimé'; };
  const courtB = (id) => { const b = benevole(id); return b ? `${b.prenom}${b.nom ? ` ${b.nom.slice(0, 1)}.` : ''}` : '?'; };
  const nomPo = (id) => poste(id)?.nom || 'Poste supprimé';
  const nomC = (id) => tr('competences', id)?.nom || '';
  const couleur = (p) => B.couleurs[p?.couleur ?? 0] || B.couleurs[0];
  const auteur = () => stock.lire(CLE_AUTEUR) || '';
  const triB = (a, b) => a.prenom.localeCompare(b.prenom) || a.nom.localeCompare(b.nom);
  const actifs = () => E.benevoles.filter((b) => !b.efface).sort(triB);

  // Événement affiché : celui choisi sur cet appareil, sinon le prochain, sinon le plus récent.
  function evCourant() {
    if (!E.evenements.length) return null;
    const ev = evenement(evId);
    if (ev) return ev;
    const t = auj();
    const tries = [...E.evenements].sort((a, b) => a.debut.localeCompare(b.debut));
    const choisi = tries.find((x) => x.fin >= t) || tries.at(-1);
    evId = choisi.id;
    return choisi;
  }
  function choisirEv(id) { evId = id; stock.ecrire(CLE_EVT, id); pl.jour = ''; }

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
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, baseEtat: session.baseEtat, nonEnvoye }, !session.memoriser);
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

  // Fusion avec la version d'un autre appareil : ce qui a été ajouté, modifié ou supprimé ici l'emporte.
  function fusionnerAvec(donnees) {
    const serveur = normaliser(donnees);
    const guideVu = !!E?.tutorielVu || !!serveur.tutorielVu; // le guide déjà vu ici ou ailleurs ne revient pas
    E = normaliser(R.fusionner(session.baseEtat || serveur, E, serveur));
    E.tutorielVu = guideVu;
    E.majLe = donnees.majLe;
    session.base = donnees.majLe;
    session.baseEtat = serveur;
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        fusionnerAvec(corps.donnees);
        cache(true);
        if (!modale().open) rendre();
        toast('Un autre responsable a modifié le planning : ses changements et les tiens sont réunis. Vérifie les conflits.');
        aRenvoyer = true;
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        E.majLe = corps.majLe;
        session.baseEtat = structuredClone(E);
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
        session.baseEtat = structuredClone(E);
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
    if (c && c.code === session.code && c.nonEnvoye && c.etat) {
      E = normaliser(c.etat);
      session.baseEtat = c.baseEtat ? normaliser(c.baseEtat) : null;
      session.base = c.base ?? null;
      if (donnees && c.base !== donnees.majLe) fusionnerAvec(donnees);
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    session.baseEtat = E ? structuredClone(E) : null;
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
    Object.assign(session, { code: null, jeton: null, demo: false, base: null, baseEtat: null });
    E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Création d'événement ----------
  // Postes de la base retenus dans l'état (créés au besoin) : { nom → id }.
  function postesPourModele(e, modele) {
    const res = {};
    for (const [nom] of modele.creneaux) {
      let p = e.postes.find((x) => x.nom === nom);
      if (!p) {
        const t = B.postes.find((x) => x[0] === nom);
        const comp = t?.[2] ? e.competences.find((c) => c.nom === t[2]) : null;
        p = R.normaliserPoste({ id: uid(), nom, famille: t?.[1] || '', competence: comp?.id || '', consigne: t?.[3] || '', couleur: e.postes.length % B.couleurs.length }, 0, B.couleurs.length);
        e.postes.push(p);
      }
      res[nom] = p.id;
    }
    return res;
  }
  function creerEvenement(e, v, modeleId) {
    const ev = R.normaliserEvenement({ id: uid(), ...v });
    e.evenements.push(ev);
    const m = B.modeles.find((x) => x.id === modeleId);
    if (m) {
      if (ev.fin === ev.debut && m.jours > 1) ev.fin = ajout(ev.debut, m.jours - 1);
      e.creneaux.push(...R.creneauxDepuisModele(m, ev, postesPourModele(e, m), uid));
    }
    return ev;
  }

  // ---------- Données de démonstration ----------
  // Comité des fêtes fictif : 22 bénévoles, une fête dans une dizaine de jours (montage la veille, buvette,
  // grillades, animations, démontage), une course et une brocante passées pour le bilan. Dates relatives à
  // aujourd'hui ; tous les états visibles : places à pourvoir, double affectation, bénévole indisponible
  // affecté, enchaînement sans pause, compétence manquante, réponses en attente, bénévole effacé.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    e.association = 'Comité des fêtes Exemple';
    e.reglages.contact = 'Dominique au 06 00 00 00 00';
    e.reglages.signature = 'Dominique, pour le comité des fêtes';
    e.competences = B.competences.map((nom) => ({ id: uid(), nom }));
    const idC = (nom) => e.competences.find((c) => c.nom === nom).id;
    let samedi = ajout(t, 10);
    while (versDate(samedi).getDay() !== 6) samedi = ajout(samedi, 1);
    const prenoms = [['Camille', 'Martin'], ['Hugo', 'Bernard'], ['Inès', 'Petit'], ['Malik', 'Durand'], ['Sophie', 'Leroy'], ['Théo', 'Moreau'], ['Léa', 'Simon'], ['Nora', 'Laurent'], ['Julien', 'Michel'], ['Manon', 'Garcia'], ['Yanis', 'David'], ['Chloé', 'Bertrand'], ['Paul', 'Roux'], ['Sarah', 'Vincent'], ['Lucas', 'Fournier'], ['Emma', 'Morel'], ['Karim', 'Girard'], ['Jeanne', 'André'], ['Louis', 'Mercier'], ['Alice', 'Blanc'], ['Rémi', 'Guerin'], ['Zoé', 'Boyer']];
    const comps = [['Tenue de caisse', 'Accueil du public'], ['Bricolage et montage', 'Permis B'], ['Hygiène alimentaire', 'Cuisine en grande quantité'], ['Bricolage et montage'], ['Animation enfants', 'Accueil du public'], ['Sono et lumière', 'Bricolage et montage'], ['Premiers secours (PSC1 ou plus)'], ['Tenue de caisse'], ['Bricolage et montage', 'Permis B'], ['Hygiène alimentaire'], [], ['Animation enfants'], ['Bricolage et montage'], ['Accueil du public', 'Langue étrangère'], ['Permis B'], ['Photo et vidéo'], ['Hygiène alimentaire', 'Tenue de caisse'], ['Cuisine en grande quantité'], [], ['Accueil du public'], ['Bricolage et montage'], ['Animation enfants']];
    e.benevoles = prenoms.map(([prenom, nom], i) => R.normaliserBenevole({ id: `b${i}`, prenom, nom, telephone: `06 00 00 ${String(10 + i).padStart(2, '0')} ${String(20 + i).padStart(2, '0')}`, email: i % 3 ? '' : `${prenom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@exemple.fr`, competences: comps[i].map(idC), ajouteLe: ajout(t, -400 + i * 5) }));
    // Ancienne bénévole sans créneau depuis plus de deux ans : signalée pour effacement (durée choisie dans les Réglages).
    e.benevoles.push(R.normaliserBenevole({ id: 'b22', prenom: 'Odile', nom: 'Lambert', telephone: '06 00 00 32 42', note: 'A déménagé.', ajouteLe: ajout(t, -1100) }));
    const fete = creerEvenement(e, { nom: 'Fête du village', lieu: 'Place de la mairie', debut: samedi, fin: samedi, responsable: 'Dominique au 06 00 00 00 00', consignes: 'Rendez-vous au local du comité 15 minutes avant ton premier créneau : badge, gilet et t-shirt t\'y attendent.' }, 'fete');
    const pid = (nom) => e.postes.find((p) => p.nom === nom).id;
    // Préférences de quelques bénévoles.
    const pref = (i, noms, evites = []) => { e.benevoles[i].preferes = noms.map(pid); e.benevoles[i].evites = evites.map(pid); };
    pref(0, ['Caisse de la buvette']); pref(2, ['Grillades et snack']); pref(4, ['Animation enfants']); pref(11, ['Animation enfants', 'Stand jeux']);
    pref(1, ['Montage', 'Démontage']); pref(8, ['Montage']); pref(7, ['Caisse de la buvette'], ['Grillades et snack']); pref(13, ['Accueil et information']); pref(19, ['Accueil et information'], ['Buvette']);
    e.benevoles[6].note = 'Disponible surtout le matin.';
    // Courses et brocante passées (heures du bilan), remplies par la suggestion automatique.
    const passe = (nom, lieu, jours, modele) => {
      const ev = creerEvenement(e, { nom, lieu, debut: ajout(t, -jours), fin: ajout(t, -jours) }, modele);
      e.benevoles.forEach((b, i) => { if ((i + jours) % 5 && b.id !== 'b22') e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: ev.id, statut: 'dispo' })); });
      e.affectations.push(...R.remplir(e, ev.id, { aujourdhui: t, par: 'Dominique', le: ajout(t, -jours - 7), ids: uid }).ajouts);
      return ev;
    };
    passe('Brocante de printemps', 'Rue principale', 190, 'brocante');
    passe('Course nature des coteaux', 'Stade municipal', 62, 'course');
    // Fête à venir : réponses, puis remplissage partiel et quelques erreurs à corriger.
    const plage = (date, debut, fin) => ({ date, debut, fin });
    const veille = ajout(samedi, -1);
    e.benevoles.forEach((b, i) => {
      if ([17, 20, 21].includes(i)) return; // sans réponse
      if (i === 22) { e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'absent' })); return; }
      if (i === 9 || i === 16) { e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'absent', note: i === 9 ? 'En déplacement ce week-end.' : '' })); return; }
      if (i === 6) { e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'partiel', plages: [plage(samedi, '09:00', '14:00')] })); return; }
      if (i === 3 || i === 12) { e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'partiel', plages: [plage(veille, '16:00', '21:00'), plage(samedi, '19:00', '23:30')] })); return; }
      if (i === 14) { e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'dispo', maxHeures: 4 })); return; }
      e.dispos.push(R.normaliserDispo({ id: uid(), benevole: b.id, evenement: fete.id, statut: 'dispo' }));
    });
    const auto = R.remplir(e, fete.id, { aujourdhui: t, par: 'Dominique', le: ajout(t, -2), ids: uid }).ajouts;
    // On garde une partie de la suggestion : il reste des trous à combler.
    const crFete = R.creneauxEvenement(e, fete.id);
    const retirer = new Set([crFete.find((c) => c.poste === pid('Démontage'))?.id, crFete.find((c) => c.poste === pid('Stand jeux'))?.id]);
    let retires = 0;
    e.affectations.push(...auto.filter((a) => { if (retirer.has(a.creneau) && retires < 5) { retires++; return false; } return true; }).map((a) => ({ ...a, auto: false })));
    const affecter = (i, c) => { if (c && !e.affectations.some((a) => a.benevole === `b${i}` && a.creneau === c.id)) e.affectations.push(R.normaliserAffectation({ id: uid(), benevole: `b${i}`, creneau: c.id, par: 'Camille', le: ajout(t, -1) })); };
    const trouverC = (nom, debut) => crFete.find((c) => c.poste === pid(nom) && c.debut === debut);
    affecter(9, trouverC('Buvette', '14:00'));             // Manon a dit qu'elle n'était pas là
    affecter(5, trouverC('Accueil et information', '13:00')); // Théo, deux postes à la même heure
    affecter(5, trouverC('Buvette', '14:00'));
    // Un bénévole sans la compétence demandée, sans autre conflit.
    const gr = trouverC('Grillades et snack', '18:00');
    const sansComp = gr && R.candidats(e, gr.id).find((x) => !x.bloquant.length && x.reserves.length === 1 && x.reserves[0] === 'sans la compétence demandée');
    if (sansComp) affecter(Number(sansComp.benevole.slice(1)), gr);
    // Ancien bénévole effacé : ses heures passées restent dans le bilan.
    Object.assign(e, R.effacerBenevole(e, 'b18', 1));
    const idsFete = new Set(crFete.map((c) => c.id));
    e.affectations = e.affectations.filter((a) => !(a.benevole === 'b18' && idsFete.has(a.creneau)));
    return R.normaliser(e, DEFAUTS);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Bénévoles et créneaux · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="56" fill="#1D4E89"/><rect x="150" y="20" width="120" height="56" fill="#1D4E89"/><rect x="280" y="20" width="120" height="56" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="20" y="96" width="185" height="56" fill="#F5B400"/><rect x="215" y="96" width="185" height="56" fill="#D9302A"/>
          <rect x="20" y="172" width="380" height="56" fill="#141414"/>
          <circle cx="490" cy="150" r="60" fill="#F0EDE6"/>
          <path d="M490 150 L490 90 A60 60 0 0 1 550 150 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Bénévoles et planning des créneaux</p>
          <h1>Chaque créneau tenu, sans trou ni doublon.</h1>
          <p>Tes bénévoles, leurs disponibilités et ce qu'ils savent faire ; les postes et les créneaux de ton événement ; qui tient quoi, ce qui reste à pourvoir et les conflits, avant le jour J.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planning de bénévoles</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Le planning est enregistré en ligne : chaque responsable qui a la clé le retrouve sur ses appareils.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/benevoles/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  const accueilVide = () => ({ etape: 1, association: '', auteur: auteur(), modele: 'fete', nom: '', debut: '', postes: null, competences: null });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const m = B.modeles.find((x) => x.id === a.modele);
    if (a.postes === null) a.postes = m ? [...new Set(m.creneaux.map((c) => c[0]))] : [];
    if (a.competences === null) a.competences = [...B.competences];
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare le planning de tes bénévoles.</h1>
        <p class="intro">Tu crées ton premier événement à partir d'un modèle (ses postes et ses créneaux types), tu ajoutes tes bénévoles et leurs disponibilités, puis tu affectes : les trous et les conflits se voient tout de suite. Rien n'est envoyé aux bénévoles.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Ton association <small>Signe les messages aux bénévoles.</small><input id="association" value="${esc(a.association)}" autocomplete="organization" maxlength="80"></label>
            <label class="champ">Ton prénom <small>Gardé sur cet appareil, il signe tes affectations.</small><input id="auteur" value="${esc(a.auteur)}" autocomplete="given-name" maxlength="40"></label>
          </div>
          <fieldset class="champ"><legend>Ton premier événement <small>Les créneaux du modèle se modifient ensuite.</small></legend>
            <div class="choix-secteur">${[...B.modeles, { id: '', nom: 'Partir de zéro' }].map((x) => `<label><input type="radio" name="modele" value="${x.id}" ${a.modele === x.id ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
          <div class="rang-champs">
            <label class="champ">Nom de l'événement<input id="ev-nom" value="${esc(a.nom)}" maxlength="80" placeholder="${esc(m?.nom || 'Fête de juin')}"></label>
            <label class="champ">Date (premier jour)<input id="ev-debut" type="date" value="${a.debut}"></label>
          </div>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const familles = B.familles.map((f) => [f, B.postes.filter((p) => p[1] === f)]);
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Postes et compétences</h1>
        <p class="intro">Les postes sont les rôles à tenir (accueil, buvette, montage…) ; ceux du modèle sont cochés. Les compétences servent aux postes qui en demandent une (la caisse, le montage) : l'outil signale un bénévole affecté qui ne l'a pas.</p>
        ${familles.map(([f, ps]) => `<fieldset class="groupe-types" style="margin-top:18px;max-width:820px"><legend>${esc(f)}</legend><div class="cases">${ps.map((p) => `<label class="case"><input type="checkbox" data-poste="${esc(p[0])}" ${a.postes.includes(p[0]) ? 'checked' : ''}> ${esc(p[0])}</label>`).join('')}</div></fieldset>`).join('')}
        <fieldset class="groupe-types" style="margin-top:18px;max-width:820px"><legend>Compétences</legend><div class="cases">${B.competences.map((c) => `<label class="case"><input type="checkbox" data-comp="${esc(c)}" ${a.competences.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div></fieldset>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon planning</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#association', 'association'); lier('#auteur', 'auteur'); lier('#ev-nom', 'nom'); lier('#ev-debut', 'debut');
    document.querySelectorAll('[name=modele]').forEach((el) => el.addEventListener('change', () => { accueil.modele = el.value; accueil.postes = null; ecranAccueil(); }));
    document.querySelectorAll('[data-poste]').forEach((el) => el.addEventListener('change', () => { const p = el.dataset.poste; accueil.postes = el.checked ? [...accueil.postes, p] : accueil.postes.filter((x) => x !== p); }));
    document.querySelectorAll('[data-comp]').forEach((el) => el.addEventListener('change', () => { const c = el.dataset.comp; accueil.competences = el.checked ? [...accueil.competences, c] : accueil.competences.filter((x) => x !== c); }));
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    E.association = a.association.trim();
    if (a.auteur.trim()) stock.ecrire(CLE_AUTEUR, a.auteur.trim());
    E.competences = a.competences.map((nom) => ({ id: uid(), nom }));
    B.postes.filter((p) => a.postes.includes(p[0])).forEach((p, i) => {
      const comp = p[2] ? E.competences.find((c) => c.nom === p[2]) : null;
      E.postes.push(R.normaliserPoste({ id: uid(), nom: p[0], famille: p[1], competence: comp?.id || '', consigne: p[3], couleur: i % B.couleurs.length }, i, B.couleurs.length));
    });
    const m = B.modeles.find((x) => x.id === a.modele);
    if (m || a.nom.trim()) {
      const debut = R.estDate(a.debut) ? a.debut : ajout(auj(), 30);
      // Seuls les créneaux des postes retenus sont créés.
      const modele = m ? { ...m, creneaux: m.creneaux.filter((c) => a.postes.includes(c[0])) } : null;
      const ev = R.normaliserEvenement({ id: uid(), nom: a.nom.trim() || m?.nom || 'Mon événement', debut, fin: m ? ajout(debut, m.jours - 1) : debut });
      E.evenements.push(ev);
      if (modele) E.creneaux.push(...R.creneauxDepuisModele(modele, ev, postesPourModele(E, modele), uid));
      choisirEv(ev.id);
    }
    accueil = accueilVide();
    vue = 'benevoles';
    sauver();
    demarrer();
    toast('Ton planning est prêt. Ajoute tes bénévoles.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    evenement: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="5" fill="currentColor"/><rect x="13" y="4" width="8" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="11" width="18" height="4" fill="currentColor"/><rect x="3" y="17" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    benevoles: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 21a6 6 0 0 1 12 0Z" fill="currentColor"/><path d="M14 21a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    evenements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['evenement', 'Événement'], ['planning', 'Planning'], ['benevoles', 'Bénévoles'], ['evenements', 'Événements'], ['bilan', 'Bilan']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'organisation : les repères de pause et d\'heures sont ceux que tu fixes dans les Réglages, pas des règles légales. La sécurité de l\'événement (secours, autorisations, assurances) reste à organiser par ailleurs. Aucun message n\'est envoyé par l\'outil.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/benevoles/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Bénévoles<br>et créneaux</span>
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
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Bénévoles et créneaux`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { evenement: vueEvenement, planning: vuePlanning, benevoles: vueBenevoles, evenements: vueEvenements, bilan: vueBilan }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { fb.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    document.querySelectorAll('[data-choix-ev]').forEach((el) => el.addEventListener('change', () => { choisirEv(el.value); rendre(); }));
    document.querySelectorAll('[data-filtre-b]').forEach((el) => el.addEventListener('change', () => { fb[el.dataset.filtreB] = el.value; rendre(); }));
    document.querySelectorAll('[data-filtre-bi]').forEach((el) => el.addEventListener('change', () => { bi.periode = el.value; rendre(); }));
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, bouton = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${bouton ? `<div class="actions">${bouton}</div>` : ''}</div></div>`;
  const puceP = (p, texte = esc(p?.nom || 'Poste'), extra = '') => `<span class="puce-projet" style="--c:${couleur(p)}" ${extra}>${texte}</span>`;
  const chipsC = (ids, surligne = '') => ids.map((c) => `<span class="puce-comp ${c === surligne ? 'ok' : ''}">${esc(nomC(c))}</span>`).join('');
  const BTN_EV = `<button class="btn primaire" data-action="nouvel-evenement">${ICONES.plus}Nouvel événement</button>`;
  const BTN_BEN = `<button class="btn primaire" data-action="nouveau-benevole">${ICONES.plus}Ajouter un bénévole</button>`;
  const LIB_DISPO_COURT = { dispo: 'Disponible', partiel: 'En partie', absent: 'Indisponible', inconnu: 'Sans réponse' };
  const COUL_DISPO = { dispo: 'vert', partiel: 'ciel', absent: 'rose', inconnu: 'sable' };
  const statutDe = (bid, id) => R.dispoDe(E, bid, id)?.statut || 'inconnu';
  const etiquetteDispo = (s) => `<span class="etiquette ${COUL_DISPO[s]}">${LIB_DISPO_COURT[s]}</span>`;
  const COUL_CONFLIT = { double: 'rouge', indispo: 'rose', repos: 'jaune', jour: 'jaune', max: 'jaune', competence: 'ciel' };

  function selecteurEv(ev) {
    const liste = [...E.evenements].sort((a, b) => b.debut.localeCompare(a.debut));
    return `<label class="champ choix-ev"><span class="sr-only">Événement</span><select data-choix-ev>${liste.map((x) => `<option value="${x.id}" ${x.id === ev.id ? 'selected' : ''}>${esc(x.nom)} · ${dateCourte(x.debut)}${x.debut.slice(0, 4) !== auj().slice(0, 4) ? ` ${x.debut.slice(0, 4)}` : ''}</option>`).join('')}</select></label>`;
  }
  const datesEv = (ev) => (ev.debut === ev.fin ? dateJour(ev.debut) : `${dateJourCourt(ev.debut)} → ${dateJourCourt(ev.fin)}`);
  function rebours(ev) {
    const t = auj();
    if (ev.fin < t) return '<span class="etiquette sable">Passé</span>';
    if (ev.debut <= t) return '<span class="etiquette vert">En cours</span>';
    const n = R.ecart(t, ev.debut);
    return `<span class="etiquette ciel">${n === 1 ? 'Demain' : `Dans ${n} jours`}</span>`;
  }

  function texteConflit(x) {
    const cr = x.creneaux.map(creneau).filter(Boolean);
    const c0 = cr[0];
    const ou = c0 ? `${nomPo(c0.poste)}, ${dateJourCourt(c0.date)} ${plageC(c0)}` : '';
    switch (x.type) {
      case 'double': return [`${esc(nomB(x.benevole))} est sur deux créneaux à la fois`, `${cr.map((c) => `${esc(nomPo(c.poste))} ${plageC(c)}`).join(' et ')} · ${dateJourCourt(c0.date)}`];
      case 'indispo': return [`${esc(nomB(x.benevole))} ${x.raison === 'hors' ? 'affecté hors de ses disponibilités' : 'affecté alors qu\'il ou elle a répondu « indisponible »'}`, esc(ou)];
      case 'repos': return [`${esc(nomB(x.benevole))} enchaîne ${hh(x.minutes)} sans pause`, `${pluriel(cr.length, 'créneau', 'créneaux')} d'affilée à partir de ${plageC(c0).split(' – ')[0]} · repère : ${E.reglages.maxContinu} h, pause de ${E.reglages.reposMin} min`];
      case 'jour': return [`${esc(nomB(x.benevole))} : ${hh(x.minutes)} le ${dateJourCourt(x.date)}`, `au-delà de ${E.reglages.maxJour} h dans la journée`];
      case 'max': return [`${esc(nomB(x.benevole))} : ${hh(x.minutes)} sur l'événement`, `il ou elle a donné ${x.maxHeures} h au plus`];
      case 'competence': return [`${esc(nomB(x.benevole))} sans « ${esc(nomC(x.competence))} »`, esc(ou)];
      default: return ['', ''];
    }
  }
  function ligneConflit(x) {
    const [titre, detail] = texteConflit(x);
    return `<li><span class="etiquette ${COUL_CONFLIT[x.type]}">${R.LIB_CONFLIT[x.type]}</span><button class="lien-ligne" data-action="creneau" data-id="${x.creneaux[0]}"><b>${titre}</b><span>${detail}</span></button></li>`;
  }
  function ligneTrou(t) {
    const c = t.creneau, p = poste(c.poste);
    const v = R.couverture(E, c);
    return `<li><span class="libre-pastille manque"><b>${t.manque}</b>${t.manque > 1 ? 'places' : 'place'}</span><button class="lien-ligne" data-action="creneau" data-id="${c.id}"><b>${puceP(p)} ${plageC(c)}</b><span>${dateJourCourt(c.date)} · ${v.nombre}/${c.besoin}${v.affectes.length ? ` · ${v.affectes.map((b) => esc(courtB(b))).join(', ')}` : ''}${p?.competence ? ` · demande « ${esc(nomC(p.competence))} »` : ''}</span></button><button class="btn petit" data-action="creneau" data-id="${c.id}">Affecter</button></li>`;
  }

  // ---------- Événement (tableau de bord) ----------
  function vueEvenement() {
    const ev = evCourant();
    if (!ev) return `<div class="vue-tete"><div><h1>Événement</h1><p>Le tableau de bord de ton prochain événement.</p></div></div>${vide('Aucun événement', 'Crée ton premier événement à partir d\'un modèle (fête, festival, compétition, course, brocante, repas) : ses postes et ses créneaux types sont créés.', BTN_EV)}${AVERTISSEMENT}`;
    const bil = R.bilanEvenement(E, ev.id);
    const cf = R.conflits(E, ev.id);
    const stat = { dispo: 0, partiel: 0, absent: 0, inconnu: 0 };
    actifs().forEach((b) => { stat[statutDe(b.id, ev.id)] += 1; });
    const tuiles = [
      ['Places pourvues', pct(bil.taux), `${bil.pourvu} sur ${bil.besoin} · ${pluriel(bil.creneaux, 'créneau', 'créneaux')}`, 'var(--bleu)', 'rond'],
      ['À pourvoir', String(bil.manque), bil.manque ? `${pluriel(bil.trous.length, 'créneau incomplet', 'créneaux incomplets')}` : 'tout est pourvu', 'var(--jaune)', ''],
      ['Conflits', String(cf.length), cf.length ? 'à régler avant le jour J' : 'aucun conflit', 'var(--rouge)', 'rond'],
      ['Bénévoles', String(bil.benevoles), `${hh(bil.minutes)} au total · ${stat.inconnu} sans réponse`, 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const sansRep = actifs().filter((b) => statutDe(b.id, ev.id) === 'inconnu');
    return `
      <div class="vue-tete"><div><h1>${esc(ev.nom)}</h1><p>${datesEv(ev)}${ev.lieu ? ` · ${esc(ev.lieu)}` : ''} ${rebours(ev)}</p></div>
        <div class="actions">${selecteurEv(ev)}<button class="btn" data-action="remplir" ${bil.manque ? '' : 'disabled'}>Remplir les trous</button><button class="btn primaire" data-action="vue" data-vue="planning">Voir le planning</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À pourvoir <span>${pluriel(bil.manque, 'place')}</span></h2>
          ${bil.trous.length ? `<ul class="prochains trous">${bil.trous.slice(0, 10).map(ligneTrou).join('')}</ul>${bil.trous.length > 10 ? `<p class="aide">Et ${bil.trous.length - 10} autres créneaux incomplets : voir le planning.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Tout est pourvu</h3><p>Chaque créneau a le nombre de bénévoles demandé.</p></div></div>'}
          <h2 class="titre-section">Conflits <span>${pluriel(cf.length, 'conflit')}</span></h2>
          ${cf.length ? `<ul class="alertes-liste">${cf.map(ligneConflit).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun conflit</h3><p>Ni double affectation, ni bénévole indisponible, ni enchaînement sans pause.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Réponses des bénévoles <span>${actifs().length} dans l'annuaire</span></h2>
          <div class="reponses">${['dispo', 'partiel', 'absent', 'inconnu'].map((s) => `<button class="reponse" data-action="voir-dispo" data-dispo="${s}">${etiquetteDispo(s)}<b>${stat[s]}</b></button>`).join('')}</div>
          ${sansRep.length ? `<p class="aide">Sans réponse : note leur disponibilité, sinon la suggestion ne les propose pas${E.reglages.sansReponse ? ' en priorité' : ''}.</p><ul class="prochains">${sansRep.slice(0, 8).map((b) => `<li><span class="pastille-abs">?</span><button class="lien-ligne" data-action="benevole" data-id="${b.id}"><b>${esc(nomB(b.id))}</b><span>${b.telephone ? esc(b.telephone) : 'pas de téléphone noté'}</span></button><button class="btn petit" data-action="dispo" data-id="${b.id}">Noter la réponse</button></li>`).join('')}</ul>` : '<p class="aide">Tout le monde a répondu.</p>'}
          <h2 class="titre-section">Par poste</h2>
          ${barresPostes(ev)}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function barresPostes(ev) {
    const m = new Map();
    for (const c of R.creneauxEvenement(E, ev.id)) {
      const v = R.couverture(E, c);
      const x = m.get(c.poste) || { besoin: 0, pourvu: 0 };
      x.besoin += c.besoin; x.pourvu += Math.min(c.besoin, v.nombre); m.set(c.poste, x);
    }
    if (!m.size) return '<p class="aide">Aucun créneau : ajoute-les depuis le planning.</p>';
    const lignes = [...m.entries()].sort((a, b) => (a[1].pourvu / (a[1].besoin || 1)) - (b[1].pourvu / (b[1].besoin || 1)));
    return `<div class="barres-postes">${lignes.map(([pid, x]) => { const t = x.besoin ? x.pourvu / x.besoin : 1; return `<div class="barre-poste">${puceP(poste(pid))}<span class="jauge ${t < 1 ? 'etat-manque' : 'etat-disponible'}" aria-hidden="true"><i style="width:${Math.round(t * 100)}%"></i></span><span class="bp-val"><b>${x.pourvu}/${x.besoin}</b></span></div>`; }).join('')}</div>`;
  }

  // ---------- Planning ----------
  function vuePlanning() {
    const ev = evCourant();
    const tete = (outils = '') => `<div class="vue-tete"><div><h1>Planning</h1><p>${ev ? `${esc(ev.nom)} · ${datesEv(ev)}` : 'Les créneaux de ton événement.'}</p></div><div class="actions">${outils}</div></div>`;
    if (!ev) return `${tete()}${vide('Aucun événement', 'Crée un événement pour planifier ses créneaux.', BTN_EV)}`;
    const cr = R.creneauxEvenement(E, ev.id);
    const jours = [...new Set(cr.map((c) => c.date))].sort();
    if (pl.jour && !jours.includes(pl.jour)) pl.jour = '';
    const outils = `${selecteurEv(ev)}<button class="btn" data-action="imprimer" data-mode="poste">Imprimer par poste</button><button class="btn" data-action="imprimer" data-mode="personne">Imprimer par personne</button><button class="btn primaire" data-action="nouveau-creneau">${ICONES.plus}Créneau</button>`;
    const bascule = (val, lib) => `<button class="filtre" data-action="pl-mode" data-val="${val}" aria-pressed="${pl.mode === val}">${lib}</button>`;
    const filtreJour = jours.length > 1 ? `<div class="filtres" role="group" aria-label="Jour"><button class="filtre" data-action="pl-jour" data-val="" aria-pressed="${!pl.jour}">Tous les jours</button>${jours.map((j) => `<button class="filtre" data-action="pl-jour" data-val="${j}" aria-pressed="${pl.jour === j}">${dateJourCourt(j)}</button>`).join('')}</div>` : '';
    const barreOutils = `<div class="cal-outils"><div class="filtres" role="group" aria-label="Affichage">${bascule('poste', 'Par poste')}${bascule('personne', 'Par personne')}${bascule('messages', 'Messages')}</div>${pl.mode === 'messages' ? '' : filtreJour}</div>`;
    if (!cr.length) return `${tete(outils)}${vide('Aucun créneau', 'Ajoute les créneaux de chaque poste (une série d\'un coup : de 10 h à 18 h par tranches de 2 h), avec le nombre de bénévoles demandés.', `<button class="btn primaire" data-action="nouveau-creneau">${ICONES.plus}Créneau</button>`)}${AVERTISSEMENT}`;
    const corps = pl.mode === 'poste' ? planningPoste(ev, jours) : pl.mode === 'personne' ? planningPersonne(ev) : planningMessages(ev);
    return `${tete(outils)}${barreOutils}${corps}${AVERTISSEMENT}`;
  }

  function planningPoste(ev, jours) {
    const cf = R.creneauxEnConflit(R.conflits(E, ev.id));
    const ordre = (id) => E.postes.findIndex((p) => p.id === id);
    return (pl.jour ? [pl.jour] : jours).map((j) => {
      const duJour = R.creneauxEvenement(E, ev.id).filter((c) => c.date === j);
      const postes = [...new Set(duJour.map((c) => c.poste))].sort((a, b) => ordre(a) - ordre(b));
      return `<section class="jour"><h2 class="titre-section">${dateJour(j)} <span>${pluriel(duJour.length, 'créneau', 'créneaux')} · ${duJour.reduce((s, c) => s + R.couverture(E, c).manque, 0)} à pourvoir</span></h2>
        ${postes.map((pid) => `<div class="rangee-poste"><div class="rp-nom"><button class="lien-ligne" data-action="poste" data-id="${pid}"><b>${puceP(poste(pid))}</b></button></div><div class="rp-creneaux">${duJour.filter((c) => c.poste === pid).map((c) => carteCreneau(c, cf)).join('')}</div></div>`).join('')}
      </section>`;
    }).join('');
  }
  function carteCreneau(c, cf) {
    const v = R.couverture(E, c);
    const noms = v.affectes.map((bid) => { const types = cf.get(`${c.id}|${bid}`); return `<span class="nom-puce ${types ? 'conflit' : ''}" ${types ? `title="${esc(types.map((t) => R.LIB_CONFLIT[t]).join(', '))}"` : ''}>${types ? '<i aria-hidden="true">!</i>' : ''}${esc(courtB(bid))}${types ? `<span class="sr-only"> (${esc(types.map((t) => R.LIB_CONFLIT[t]).join(', '))})</span>` : ''}</span>`; });
    for (let i = 0; i < v.manque; i++) noms.push('<span class="place-vide">À pourvoir</span>');
    return `<button class="creneau-carte ${v.manque ? 'incomplet' : 'complet'} ${noms.some((n) => n.includes('conflit')) ? 'a-conflit' : ''}" data-action="creneau" data-id="${c.id}" aria-label="${esc(`${nomPo(c.poste)}, ${plageC(c)}, ${v.nombre} sur ${c.besoin}`)}"><span class="cc-tete"><b>${plageC(c)}</b><small>${v.nombre}/${c.besoin}</small></span><span class="cc-noms">${noms.join('') || '<span class="aide">Aucune place demandée</span>'}</span></button>`;
  }

  function planningPersonne(ev) {
    const pers = R.parPersonne(E, ev.id).filter((x) => !pl.jour || x.creneaux.some((c) => c.date === pl.jour));
    if (!pers.length) return vide('Personne n\'est encore affecté', 'Ouvre un créneau pour affecter un bénévole, ou utilise « Remplir les trous » sur l\'onglet Événement.', '');
    const cf = R.conflits(E, ev.id);
    return `<ul class="lignes-abs">${pers.map((x) => {
      const b = benevole(x.benevole);
      const siens = cf.filter((k) => k.benevole === x.benevole);
      return `<li class="ligne-abs ${siens.length ? 'alerte-trou' : ''}">
        <button class="ligne-info" data-action="benevole" data-id="${x.benevole}"><b>${esc(nomB(x.benevole))} <span class="numero">${hh(x.minutes)}</span></b>
          <span class="ligne-detail">${x.creneaux.filter((c) => !pl.jour || c.date === pl.jour).map((c) => `${dateJourCourt(c.date)} ${plageC(c)} · ${esc(nomPo(c.poste))}`).join('<br>')}</span>
          <span class="ligne-etiquettes">${siens.map((k) => `<span class="etiquette ${COUL_CONFLIT[k.type]}">${R.LIB_CONFLIT[k.type]}</span>`).join('')}${b?.telephone ? `<span class="puce-comp">${esc(b.telephone)}</span>` : ''}</span></button>
        <div class="ligne-droite"><button class="btn petit" data-action="message" data-id="${x.benevole}">Message</button></div>
      </li>`;
    }).join('')}</ul>`;
  }

  function planningMessages(ev) {
    const pers = R.parPersonne(E, ev.id);
    if (!pers.length) return vide('Aucun message à préparer', 'Les messages apparaissent dès qu\'un bénévole a un créneau.', '');
    return `<p class="aide">Un message par bénévole, prêt à copier dans ta messagerie habituelle. Le modèle se change dans les Réglages. Rien n'est envoyé par l'outil.</p>
      <ul class="messages">${pers.map((x) => `<li class="message-carte"><div class="mc-tete"><b>${esc(nomB(x.benevole))}</b><span>${pluriel(x.creneaux.length, 'créneau', 'créneaux')} · ${hh(x.minutes)}</span><button class="btn petit primaire" data-action="copier" data-id="${x.benevole}">Copier</button></div><textarea readonly rows="7" aria-label="Message pour ${esc(nomB(x.benevole))}">${esc(R.message(E, x.benevole, ev.id, E.message))}</textarea></li>`).join('')}</ul>`;
  }

  // ---------- Bénévoles ----------
  function vueBenevoles() {
    const t = auj();
    const ev = evCourant();
    const q = fb.q.trim().toLowerCase();
    const liste = actifs().filter((b) => (!q || `${b.prenom} ${b.nom} ${b.telephone} ${b.email} ${b.note}`.toLowerCase().includes(q)) && (!fb.comp || b.competences.includes(fb.comp)) && (!fb.dispo || !ev || statutDe(b.id, ev.id) === fb.dispo));
    const an = t.slice(0, 4);
    const ina = R.inactifs(E, t, E.reglages.conservationMois);
    const ligne = (b) => {
      const s = ev ? statutDe(b.id, ev.id) : null;
      const h = R.heuresBenevole(E, b.id, { annee: an });
      const nbEv = ev ? R.creneauxDe(E, b.id, ev.id).length : 0;
      return `<li class="ligne-abs">
        <button class="ligne-info" data-action="benevole" data-id="${b.id}"><b>${esc(b.prenom)} ${esc(b.nom)}</b>
          <span class="ligne-detail">${[b.telephone, b.email].filter(Boolean).map(esc).join(' · ') || 'Aucune coordonnée'}${b.preferes.length ? ` · aime : ${b.preferes.map((p) => esc(nomPo(p))).join(', ')}` : ''}</span>
          <span class="ligne-etiquettes">${chipsC(b.competences, fb.comp)}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${hh(h)}</b><small>en ${an}</small></span>${ev ? `<button class="reponse petite" data-action="dispo" data-id="${b.id}" aria-label="Disponibilité pour ${esc(ev.nom)} : ${LIB_DISPO_COURT[s]}">${etiquetteDispo(s)}${nbEv ? `<small>${pluriel(nbEv, 'créneau', 'créneaux')}</small>` : ''}</button>` : ''}</div>
      </li>`;
    };
    return `
      <div class="vue-tete"><div><h1>Bénévoles</h1><p>L'annuaire de l'association : coordonnées minimales, compétences, postes préférés${ev ? `, et la réponse de chacun pour « ${esc(ev.nom)} »` : ''}.</p></div>
        <div class="actions"><button class="btn" data-action="csv-annuaire">Annuaire (CSV)</button>${BTN_BEN}</div></div>
      <div class="outils-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Prénom, nom, téléphone" value="${esc(fb.q)}"></label>
        <label class="champ"><span class="sr-only">Compétence</span><select data-filtre-b="comp"><option value="">Toutes les compétences</option>${E.competences.map((c) => `<option value="${c.id}" ${fb.comp === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        ${ev ? `<label class="champ"><span class="sr-only">Réponse</span><select data-filtre-b="dispo"><option value="">Toutes les réponses</option>${['dispo', 'partiel', 'absent', 'inconnu'].map((s) => `<option value="${s}" ${fb.dispo === s ? 'selected' : ''}>${LIB_DISPO_COURT[s]}</option>`).join('')}</select></label>` : ''}
      </div>
      ${ina.length ? `<div class="bandeau-info"><p><b>${pluriel(ina.length, 'bénévole', 'bénévoles')} sans créneau depuis ${E.reglages.conservationMois} mois</b> (durée choisie dans les Réglages) : ${ina.slice(0, 5).map((b) => esc(nomB(b.id))).join(', ')}${ina.length > 5 ? '…' : ''}. Efface leurs coordonnées si tu n'en as plus besoin.</p><button class="btn petit" data-action="effacer-inactifs">Effacer leurs données</button></div>` : ''}
      ${liste.length ? `<ul class="lignes-abs" style="margin-top:12px">${liste.map(ligne).join('')}</ul>` : vide(E.benevoles.length ? 'Personne ne correspond' : 'Aucun bénévole', E.benevoles.length ? 'Change la recherche ou les filtres.' : 'Le minimum : un prénom et un moyen de les joindre. Ajoute ce qu\'ils savent faire et les postes qu\'ils préfèrent : la suggestion en tient compte.', BTN_BEN)}
      <div class="rgpd"><h2>Données personnelles des bénévoles</h2><p>Garde le minimum : prénom, nom, un téléphone ou un e-mail, compétences et préférences. <b>Aucune donnée de santé</b>, aucun motif d'absence. Informe les bénévoles que leurs coordonnées et leurs créneaux sont tenus ici, par qui et pour combien de temps (RGPD, art. 13). Ouvre une fiche pour <b>exporter ses données</b> (droit d'accès), les <b>effacer</b> (ses heures passées restent pour le bilan) ou <b>supprimer</b> le bénévole avec ses créneaux.</p></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Événements ----------
  function vueEvenements() {
    const t = auj();
    const avenir = E.evenements.filter((x) => x.fin >= t).sort((a, b) => a.debut.localeCompare(b.debut));
    const passes = E.evenements.filter((x) => x.fin < t).sort((a, b) => b.debut.localeCompare(a.debut));
    const ligne = (ev) => {
      const bil = R.bilanEvenement(E, ev.id);
      return `<li class="ligne-abs ${ev.id === evId ? 'courant' : ''}">
        <button class="ligne-info" data-action="ouvrir-ev" data-id="${ev.id}"><b>${esc(ev.nom)} ${rebours(ev)}</b>
          <span class="ligne-detail">${datesEv(ev)}${ev.lieu ? ` · ${esc(ev.lieu)}` : ''}</span>
          <span class="ligne-detail">${pluriel(bil.creneaux, 'créneau', 'créneaux')} · ${bil.pourvu}/${bil.besoin} places · ${pluriel(bil.benevoles, 'bénévole')} · ${hh(bil.minutes)}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${pct(bil.taux)}</b><small>pourvu</small></span><span class="rang"><button class="btn petit" data-action="evenement" data-id="${ev.id}">Modifier</button><button class="btn petit" data-action="dupliquer-ev" data-id="${ev.id}">Dupliquer</button></span></div>
      </li>`;
    };
    const familles = [...new Set(E.postes.map((p) => p.famille || 'Autres'))];
    return `
      <div class="vue-tete"><div><h1>Événements</h1><p>Chaque événement a ses créneaux et ses réponses de bénévoles. « Dupliquer » reprend tous les créneaux à une nouvelle date : l'édition de l'an prochain est prête en un geste.</p></div>
        <div class="actions">${BTN_EV}</div></div>
      ${E.evenements.length ? '' : vide('Aucun événement', 'Choisis un modèle : ses postes et ses créneaux types sont créés, tu ajustes ensuite.', BTN_EV)}
      ${avenir.length ? `<h2 class="titre-section">À venir</h2><ul class="lignes-abs">${avenir.map(ligne).join('')}</ul>` : ''}
      ${passes.length ? `<h2 class="titre-section">Passés</h2><ul class="lignes-abs">${passes.map(ligne).join('')}</ul>` : ''}
      <h2 class="titre-section">Postes <span>${pluriel(E.postes.length, 'poste')} · communs à tous les événements</span><button class="btn petit" data-action="nouveau-poste">${ICONES.plus}Poste</button></h2>
      ${familles.map((f) => `<div class="famille-postes"><h3>${esc(f)}</h3><div class="ligne-etiquettes">${E.postes.filter((p) => (p.famille || 'Autres') === f).map((p) => `<button class="puce-projet bouton" style="--c:${couleur(p)}" data-action="poste" data-id="${p.id}">${esc(p.nom)}${p.competence ? ` <small>${esc(nomC(p.competence))}</small>` : ''}</button>`).join('')}</div></div>`).join('') || '<p class="aide">Aucun poste.</p>'}
      <h2 class="titre-section">Compétences <span>${pluriel(E.competences.length, 'compétence')}</span></h2>
      <div class="ligne-etiquettes comp-liste">${E.competences.map((c) => `<button class="puce-comp" data-action="competence" data-id="${c.id}">${esc(c.nom)} <small>${E.benevoles.filter((b) => b.competences.includes(c.id)).length}</small></button>`).join('')}<button class="btn petit" data-action="nouvelle-competence">${ICONES.plus}Compétence</button></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Bilan ----------
  function vueBilan() {
    const annees = [...new Set(E.creneaux.map((c) => c.date.slice(0, 4)))].sort().reverse();
    if (!bi.periode) bi.periode = annees.includes(auj().slice(0, 4)) ? `a${auj().slice(0, 4)}` : (annees[0] ? `a${annees[0]}` : '');
    const filtre = bi.periode.startsWith('a') ? { annee: bi.periode.slice(1) } : bi.periode.startsWith('e') ? { evenement: bi.periode.slice(1) } : {};
    const s = R.statistiques(E, filtre);
    const choix = `<label class="champ"><span class="sr-only">Période</span><select data-filtre-bi>${annees.map((a) => `<option value="a${a}" ${bi.periode === `a${a}` ? 'selected' : ''}>Année ${a}</option>`).join('')}${[...E.evenements].sort((a, b) => b.debut.localeCompare(a.debut)).map((x) => `<option value="e${x.id}" ${bi.periode === `e${x.id}` ? 'selected' : ''}>${esc(x.nom)} · ${dateCourte(x.debut)} ${x.debut.slice(0, 4)}</option>`).join('')}</select></label>`;
    const tete = `<div class="vue-tete"><div><h1>Bilan</h1><p>Les heures données par chaque bénévole et par poste : pour remercier, pour le rapport d'activité, et pour voir si la charge repose sur trop peu de monde.</p></div><div class="actions">${choix}<button class="btn" data-action="csv-heures">Heures (CSV)</button></div></div>`;
    if (!s.total) return `${tete}${vide('Aucune heure sur cette période', 'Les heures se comptent dès qu\'un bénévole est affecté à un créneau.', '')}${AVERTISSEMENT}`;
    const tuiles = [
      ['Heures données', hh(s.total), `${pluriel(s.evenements, 'événement')}`, 'var(--bleu)', 'rond'],
      ['Bénévoles mobilisés', String(s.actifs), `${hh(s.moyenne)} en moyenne`, 'var(--encre)', ''],
      ['Places pourvues', pct(s.taux), `${s.pourvu} sur ${s.besoin}`, 'var(--jaune)', 'rond'],
      ['Part du quart le plus investi', pct(s.partQuart), `des heures, faites par ${pluriel(Math.max(1, Math.ceil(s.actifs / 4)), 'bénévole')}`, 'var(--rouge)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const max = s.benevoles[0].minutes;
    const barres = s.benevoles.map((x) => `<div class="barre-pers statique"><span class="bp-nom"><b>${esc(nomB(x.benevole))}</b><small>${pluriel(x.creneaux, 'créneau', 'créneaux')} · ${pluriel(x.evenements, 'événement')}</small></span><span class="jauge etat-plein" aria-hidden="true"><i style="width:${Math.max(2, Math.round((x.minutes / max) * 100))}%"></i></span><span class="bp-val"><b>${hh(x.minutes)}</b></span></div>`).join('');
    const maxP = s.postes[0].minutes;
    const barresP = s.postes.map((x) => `<div class="barre-poste">${puceP(poste(x.poste))}<span class="jauge etat-plein" aria-hidden="true"><i style="width:${Math.max(2, Math.round((x.minutes / maxP) * 100))}%;background:${couleur(poste(x.poste))}"></i></span><span class="bp-val"><b>${hh(x.minutes)}</b></span></div>`).join('');
    return `${tete}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Heures par bénévole <span>de la plus grande à la plus petite</span></h2><figure class="graphique"><div class="barres-pers">${barres}</div></figure></section>
        <section><h2 class="titre-section">Heures par poste</h2><div class="barres-postes">${barresP}</div>
          <p class="aide">Repère d'équité : quand le quart des bénévoles les plus investis fait plus de la moitié des heures, pense à solliciter les autres (la suggestion automatique propose d'abord ceux qui ont le moins d'heures).</p></section>
      </div>
      <details class="tableau-details"><summary>Tableau des heures</summary><div class="defile"><table class="tableau"><thead><tr><th>Bénévole</th><th class="nb">Créneaux</th><th class="nb">Événements</th><th class="nb">Heures</th></tr></thead><tbody>${s.benevoles.map((x) => `<tr><td>${esc(nomB(x.benevole))}</td><td class="nb">${x.creneaux}</td><td class="nb">${x.evenements}</td><td class="nb">${hh(x.minutes)}</td></tr>`).join('')}</tbody></table></div></details>
      ${AVERTISSEMENT}`;
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
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const radios = (nom, opts, val, cls = 'trois') => `<div class="choix-statut ${cls}">${opts.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${val === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  const optionsPostes = (choisi) => E.postes.map((p) => `<option value="${p.id}" ${p.id === choisi ? 'selected' : ''}>${esc(p.nom)}</option>`).join('');

  // Créneau : horaires, besoin, bénévoles affectés et candidats classés (suggérés, avec réserve, indisponibles).
  function modaleCreneau(id) {
    const c = creneau(id);
    if (!c) return;
    const ev = evenement(c.evenement);
    const p = poste(c.poste);
    const v = R.couverture(E, c);
    const cf = R.creneauxEnConflit(R.conflits(E, c.evenement));
    const cand = R.candidats(E, c.id, { aujourdhui: auj() });
    const ok = cand.filter((x) => x.ok), res = cand.filter((x) => !x.ok && !x.bloquant.length), non = cand.filter((x) => x.bloquant.length);
    const ligneCand = (x) => `<li><span><b>${esc(nomB(x.benevole))}</b>${x.prefere ? ' <span class="etiquette vert">Aime ce poste</span>' : ''}<small>${hh(x.heuresEv)} sur l'événement${x.heuresAn ? ` · ${hh(x.heuresAn)} sur 12 mois` : ''}${[...x.bloquant, ...x.reserves].length ? ` · ${[...x.bloquant, ...x.reserves].join(', ')}` : ''}</small></span><button type="button" class="btn petit ${x.ok ? 'primaire' : ''}" data-action="affecter" data-creneau="${c.id}" data-benevole="${x.benevole}">Affecter</button></li>`;
    const corps = `
      <p class="cc-resume">${puceP(p)} <span><b>${dateJour(c.date)}</b>, ${plageC(c)} · ${hh(R.duree(c))}${p?.competence ? ` · demande « ${esc(nomC(p.competence))} »` : ''}</span></p>
      <section class="bloc-detail"><h3>Affectés <span>${v.nombre}/${c.besoin}</span></h3>
        ${v.affectes.length ? `<ul class="mini-liste">${v.affectes.map((bid) => { const t = cf.get(`${c.id}|${bid}`); return `<li><span><b>${esc(nomB(bid))}</b>${t ? ` ${t.map((k) => `<span class="etiquette ${COUL_CONFLIT[k]}">${R.LIB_CONFLIT[k]}</span>`).join(' ')}` : ''}${benevole(bid)?.telephone ? `<small>${esc(benevole(bid).telephone)}</small>` : ''}</span><button type="button" class="btn petit" data-action="retirer" data-creneau="${c.id}" data-benevole="${bid}">Retirer</button></li>`; }).join('')}</ul>` : '<p class="mention">Personne pour l\'instant.</p>'}
        ${v.manque ? `<p class="aide">${pluriel(v.manque, 'place')} à pourvoir.</p>` : v.surplus ? `<p class="aide">${v.surplus} de plus que demandé.</p>` : ''}</section>
      <section class="bloc-detail"><h3>Suggérés <span>${ok.length}</span></h3><p class="aide">Disponibles, sans conflit ; d'abord ceux qui aiment ce poste ou ont la compétence, puis ceux qui ont le moins d'heures.</p>
        ${ok.length ? `<ul class="mini-liste candidats">${ok.slice(0, 8).map(ligneCand).join('')}</ul>` : '<p class="mention">Aucun bénévole disponible sans réserve.</p>'}
        ${res.length ? `<details class="plus-tard"><summary>Possibles avec réserve (${res.length})</summary><ul class="mini-liste candidats">${res.map(ligneCand).join('')}</ul></details>` : ''}
        ${non.length ? `<details class="plus-tard"><summary>Indisponibles (${non.length})</summary><ul class="mini-liste candidats">${non.map(ligneCand).join('')}</ul></details>` : ''}</section>
      <details class="plus-tard"><summary>Modifier le créneau</summary>
        <div class="rang-champs"><label class="champ">Poste<select name="poste">${optionsPostes(c.poste)}</select></label><label class="champ">Date<input type="date" name="date" value="${c.date}"></label></div>
        <div class="rang-champs trois"><label class="champ">Début<input type="time" name="debut" value="${c.debut}" step="300"></label><label class="champ">Fin<input type="time" name="fin" value="${c.fin}" step="300"></label><label class="champ">Bénévoles demandés<input name="besoin" inputmode="numeric" value="${c.besoin}"></label></div>
        <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="120" value="${esc(c.note)}"></label>
      </details>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`${esc(nomPo(c.poste))} · ${esc(ev?.nom || '')}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="supprimer">Supprimer le créneau</button>', (fd, action) => {
      if (action === 'supprimer') {
        if (v.nombre && !confirm(`Supprimer ce créneau et ses ${pluriel(v.nombre, 'affectation')} ?`)) { garderOuverte(); return; }
        retenir();
        E.creneaux = E.creneaux.filter((x) => x.id !== c.id);
        E.affectations = E.affectations.filter((a) => a.creneau !== c.id);
        sauver(); rendre(); toast('Créneau supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const lu = lireCreneau(fd);
      if (typeof lu === 'string') return lu;
      retenir();
      Object.assign(c, R.normaliserCreneau({ ...c, ...lu }));
      sauver(); rendre();
    });
  }
  function lireCreneau(fd) {
    if (!poste(fd.get('poste'))) return 'Choisis un poste.';
    if (!R.estDate(fd.get('date'))) return 'Indique la date du créneau.';
    if (!R.estHeure(fd.get('debut')) || !R.estHeure(fd.get('fin'))) return 'Indique l\'heure de début et de fin (par exemple 10:00 et 13:00).';
    if (fd.get('debut') === fd.get('fin')) return 'Le début et la fin sont identiques.';
    const besoin = R.lireNombre(fd.get('besoin'));
    if (besoin === null || besoin > 200 || !Number.isInteger(besoin)) return 'Bénévoles demandés : un nombre entier (0 à 200).';
    return { poste: fd.get('poste'), date: fd.get('date'), debut: fd.get('debut'), fin: fd.get('fin'), besoin, note: String(fd.get('note') || '').trim() };
  }

  function affecter(cid, bid) {
    const c = creneau(cid);
    if (!c || E.affectations.some((a) => a.creneau === cid && a.benevole === bid)) return;
    retenir();
    E.affectations.push(R.normaliserAffectation({ id: uid(), creneau: cid, benevole: bid, par: auteur(), le: auj() }));
    sauver(); rendre();
    const nouveaux = R.conflitsBenevole(E, bid, c.evenement).filter((x) => x.creneaux.includes(cid));
    toast(`${courtB(bid)} sur ${nomPo(c.poste)} ${plageC(c)}.${nouveaux.length ? ` Attention : ${nouveaux.map((x) => R.LIB_CONFLIT[x.type].toLowerCase()).join(', ')}.` : ''}`, { libelle: 'Annuler', faire: annuler });
    if (modale().open) modaleCreneau(cid);
  }
  function retirer(cid, bid) {
    retenir();
    E.affectations = E.affectations.filter((a) => !(a.creneau === cid && a.benevole === bid));
    sauver(); rendre();
    toast(`${courtB(bid)} retiré du créneau.`, { libelle: 'Annuler', faire: annuler });
    if (modale().open) modaleCreneau(cid);
  }

  // Nouveau créneau, ou une série (de 10 h à 18 h par tranches de 2 h).
  function modaleNouveauCreneau() {
    const ev = evCourant();
    if (!ev) { toast('Crée d\'abord un événement.'); return; }
    if (!E.postes.length) { toast('Crée d\'abord un poste dans l\'onglet Événements.'); return; }
    const jours = [];
    for (let d = ajout(ev.debut, -1); d <= ev.fin; d = ajout(d, 1)) jours.push(d);
    const corps = `
      <div class="rang-champs"><label class="champ">Poste<select name="poste">${optionsPostes(E.postes[0].id)}</select></label>
        <label class="champ">Jour<select name="date">${jours.map((d) => `<option value="${d}" ${d === (pl.jour || ev.debut) ? 'selected' : ''}>${dateJourCourt(d)}${d < ev.debut ? ' (veille)' : ''}</option>`).join('')}</select></label></div>
      <div class="rang-champs trois"><label class="champ">Début<input type="time" name="debut" value="10:00" step="300"></label><label class="champ">Fin<input type="time" name="fin" value="12:00" step="300"></label><label class="champ">Bénévoles demandés<input name="besoin" inputmode="numeric" value="2"></label></div>
      <label class="case"><input type="checkbox" name="serie"> Créer une série de créneaux jusqu'à une heure de fin</label>
      <div class="rang-champs" id="serie" hidden><label class="champ">Jusqu'à<input type="time" name="jusqua" value="18:00" step="300"></label><p class="aide">Chaque créneau dure comme le premier (début → fin), bout à bout.</p></div>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="120"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouveau créneau', corps, '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lu = lireCreneau(fd);
      if (typeof lu === 'string') return lu;
      const liste = [R.normaliserCreneau({ id: uid(), evenement: ev.id, ...lu })];
      if (fd.get('serie')) {
        const pas = R.duree(lu);
        const fin = R.estHeure(fd.get('jusqua')) ? R.minutes(fd.get('jusqua')) : null;
        if (fin === null) return 'Indique l\'heure de fin de la série.';
        let a = R.minutes(lu.debut) + pas;
        const limite = fin <= R.minutes(lu.debut) ? fin + 1440 : fin;
        while (a + pas <= limite && liste.length < 24) {
          const t = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          liste.push(R.normaliserCreneau({ id: uid(), evenement: ev.id, ...lu, date: a >= 1440 ? ajout(lu.date, 1) : lu.date, debut: t(a), fin: t(a + pas) }));
          a += pas;
        }
      }
      retenir();
      E.creneaux.push(...liste);
      pl.jour = pl.jour && pl.jour !== lu.date ? lu.date : pl.jour;
      sauver(); rendre();
      toast(`${pluriel(liste.length, 'créneau créé', 'créneaux créés')} pour ${nomPo(lu.poste)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelector('[name=serie]').addEventListener('change', (e) => { d.querySelector('#serie').hidden = !e.target.checked; });
  }

  function remplirTrous() {
    const ev = evCourant();
    if (!ev) return;
    const { ajouts, reste } = R.remplir(E, ev.id, { aujourdhui: auj(), par: auteur(), le: auj(), ids: uid });
    if (!ajouts.length) { toast(reste ? 'Aucun bénévole disponible sans conflit pour les places restantes : note les réponses manquantes ou affecte à la main avec réserve.' : 'Tout est déjà pourvu.'); return; }
    const parB = new Map();
    ajouts.forEach((a) => parB.set(a.benevole, (parB.get(a.benevole) || 0) + 1));
    ouvrirModale('Remplir les trous', `
      <p>La suggestion propose <b>${pluriel(ajouts.length, 'affectation')}</b> pour ${pluriel(parB.size, 'bénévole')} : seulement des bénévoles disponibles, sans double affectation ni dépassement de tes repères, en commençant par les créneaux les plus difficiles à pourvoir et par ceux qui ont le moins d'heures.${reste ? ` Il restera <b>${pluriel(reste, 'place')}</b> à pourvoir.` : ' Toutes les places seront pourvues.'}</p>
      <ul class="mini-liste">${[...parB.entries()].sort((a, b) => courtB(a[0]).localeCompare(courtB(b[0]))).map(([bid, n]) => `<li><span><b>${esc(nomB(bid))}</b><small>${ajouts.filter((a) => a.benevole === bid).map((a) => { const c = creneau(a.creneau); return `${esc(nomPo(c.poste))} ${dateJourCourt(c.date)} ${plageC(c)}`; }).join(' · ')}</small></span><span class="nb">${n}</span></li>`).join('')}</ul>
      <p class="aide">Tu peux tout annuler juste après, ou retirer une affectation depuis son créneau.</p>`,
    '<button class="btn primaire" value="ok">Appliquer</button><button class="btn" value="annuler">Annuler</button>', () => {
      retenir();
      E.affectations.push(...ajouts.map(R.normaliserAffectation));
      sauver(); rendre();
      toast(`${pluriel(ajouts.length, 'affectation ajoutée', 'affectations ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Fiche d'un bénévole.
  function modaleBenevole(id) {
    const b = id ? benevole(id) : null;
    const v = b || { prenom: '', nom: '', telephone: '', email: '', competences: [], preferes: [], evites: [], note: '' };
    const ev = evCourant();
    let detail = '';
    if (b) {
      const t = auj();
      const avenir = R.creneauxDe(E, b.id).filter((c) => c.date >= t);
      detail = `
      <section class="bloc-detail"><h3>Créneaux à venir <span>${avenir.length}</span></h3>
        ${avenir.length ? `<ul class="mini-liste">${avenir.map((c) => `<li><span>${puceP(poste(c.poste))} ${dateJourCourt(c.date)} ${plageC(c)}<small>${esc(evenement(c.evenement)?.nom || '')}</small></span><button type="button" class="btn petit" data-action="creneau" data-id="${c.id}">Ouvrir</button></li>`).join('')}</ul>` : '<p class="mention">Aucun créneau à venir.</p>'}
        <p class="aide">${hh(R.heuresBenevole(E, b.id, { annee: t.slice(0, 4) }))} données en ${t.slice(0, 4)} · ${hh(R.heuresBenevole(E, b.id))} en tout.</p>
        <div class="rang">${ev ? `<button type="button" class="btn petit" data-action="dispo" data-id="${b.id}">Disponibilité : ${LIB_DISPO_COURT[statutDe(b.id, ev.id)]}</button>` : ''}${ev && R.creneauxDe(E, b.id, ev.id).length ? `<button type="button" class="btn petit" data-action="message" data-id="${b.id}">Message pour ${esc(ev.nom)}</button>` : ''}</div></section>
      <div class="groupe"><h3>Données personnelles</h3><p class="aide">« Exporter » télécharge sa fiche, ses réponses et ses créneaux (droit d'accès). « Effacer » vide son nom, ses coordonnées et ses préférences ; ses heures passées restent pour le bilan. « Supprimer » le retire avec ses réponses et ses créneaux.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter-benevole" data-id="${b.id}">Exporter ses données</button><button class="btn petit" type="button" data-action="effacer-benevole" data-id="${b.id}">Effacer les données</button><button class="btn petit danger" type="button" data-action="supprimer-benevole" data-id="${b.id}">Supprimer</button></div></div>`;
    }
    const casesPostes = (nom, choisis) => `<div class="cases compactes">${E.postes.map((p) => `<label class="case"><input type="checkbox" name="${nom}" value="${p.id}" ${choisis.includes(p.id) ? 'checked' : ''}> ${esc(p.nom)}</label>`).join('')}</div>`;
    const corps = `
      <div class="rang-champs"><label class="champ">Prénom<input name="prenom" maxlength="40" required value="${esc(v.prenom)}" autocomplete="off"></label><label class="champ">Nom<input name="nom" maxlength="60" value="${esc(v.nom)}" autocomplete="off" placeholder="Facultatif"></label></div>
      <div class="rang-champs"><label class="champ">Téléphone<input name="telephone" type="tel" maxlength="30" value="${esc(v.telephone)}" autocomplete="off"></label><label class="champ">E-mail<input name="email" type="email" maxlength="80" value="${esc(v.email)}" autocomplete="off"></label></div>
      <fieldset class="champ"><legend>Compétences</legend>${E.competences.length ? `<div class="cases">${E.competences.map((c) => `<label class="case"><input type="checkbox" name="competences" value="${c.id}" ${v.competences.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</div>` : '<p class="mention">Aucune compétence : ajoute-les dans l\'onglet Événements.</p>'}</fieldset>
      <details class="plus-tard" ${v.preferes.length || v.evites.length ? 'open' : ''}><summary>Postes préférés et à éviter</summary>
        <fieldset class="champ"><legend>Aime tenir <small>Proposé en premier pour ces postes.</small></legend>${casesPostes('preferes', v.preferes)}</fieldset>
        <fieldset class="champ"><legend>Préfère éviter <small>Proposé seulement avec réserve.</small></legend>${casesPostes('evites', v.evites)}</fieldset></details>
      <label class="champ">Note <small>Facultative. Jamais d'information de santé ni de motif personnel.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      ${detail}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(b ? esc(nomB(b.id)) : 'Nouveau bénévole', corps, `<button class="btn primaire" value="ok">${b ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>`, (fd) => {
      const prenom = String(fd.get('prenom') || '').trim();
      if (!prenom) return 'Indique au moins un prénom.';
      const email = String(fd.get('email') || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Cet e-mail semble incomplet.';
      const preferes = fd.getAll('preferes'), evites = fd.getAll('evites');
      if (preferes.some((p) => evites.includes(p))) return 'Un même poste ne peut pas être à la fois préféré et à éviter.';
      retenir();
      const n = R.normaliserBenevole({ ...(b || {}), id: b?.id || uid(), prenom, nom: String(fd.get('nom') || '').trim(), telephone: String(fd.get('telephone') || '').trim(), email, competences: fd.getAll('competences'), preferes, evites, note: String(fd.get('note') || '').trim(), ajouteLe: b?.ajouteLe || auj(), efface: false });
      if (b) Object.assign(b, n); else E.benevoles.push(n);
      sauver(); rendre(); toast(`${prenom} enregistré${b ? '' : ' dans l\'annuaire'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Réponse d'un bénévole pour l'événement affiché.
  function modaleDispo(bid) {
    const ev = evCourant(), b = benevole(bid);
    if (!ev || !b) return;
    const d = R.dispoDe(E, bid, ev.id);
    const s = d?.statut || 'inconnu';
    const jours = [];
    for (let x = ajout(ev.debut, -1); x <= ev.fin; x = ajout(x, 1)) jours.push(x);
    const plage = (j) => d?.plages.find((p) => p.date === j);
    const corps = `
      <p>${esc(ev.nom)} · ${datesEv(ev)}</p>
      <fieldset class="champ"><legend>Réponse</legend>${radios('statut', [['dispo', 'Disponible'], ['partiel', 'En partie'], ['absent', 'Indisponible'], ['inconnu', 'Sans réponse']], s, 'quatre')}</fieldset>
      <fieldset class="champ" id="plages" ${s === 'partiel' ? '' : 'hidden'}><legend>Plages où il ou elle peut venir <small>Une plage par jour ; la veille sert au montage.</small></legend>
        ${jours.map((j) => { const p = plage(j); return `<div class="plage-jour"><label class="case"><input type="checkbox" name="jour" value="${j}" ${p ? 'checked' : ''}> ${dateJourCourt(j)}${j < ev.debut ? ' (veille)' : ''}</label><input type="time" name="debut-${j}" value="${p?.debut || '09:00'}" step="300" aria-label="De, ${dateJourCourt(j)}"><span>à</span><input type="time" name="fin-${j}" value="${p?.fin || '18:00'}" step="300" aria-label="À, ${dateJourCourt(j)}"></div>`; }).join('')}</fieldset>
      <label class="champ">Heures au plus sur l'événement <small>Facultatif : ce qu'il ou elle veut bien donner.</small><input name="maxHeures" inputmode="decimal" value="${d?.maxHeures ?? ''}"></label>
      <label class="champ">Note <small>Facultative, sans motif personnel.</small><input name="note" maxlength="120" value="${esc(d?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Disponibilité de ${esc(b.prenom)}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const statut = fd.get('statut');
      retenir();
      E.dispos = E.dispos.filter((x) => !(x.benevole === bid && x.evenement === ev.id));
      if (statut !== 'inconnu') {
        const plages = statut === 'partiel' ? fd.getAll('jour').map((j) => ({ date: j, debut: fd.get(`debut-${j}`), fin: fd.get(`fin-${j}`) })) : [];
        if (statut === 'partiel' && !plages.length) { E = annulation; return 'Coche au moins un jour, ou choisis « Disponible ».'; }
        const max = String(fd.get('maxHeures') || '').trim() ? R.lireNombre(fd.get('maxHeures')) : null;
        if (String(fd.get('maxHeures') || '').trim() && (max === null || max > 72)) { E = annulation; return 'Heures au plus : un nombre entre 0 et 72.'; }
        E.dispos.push(R.normaliserDispo({ id: d?.id || uid(), benevole: bid, evenement: ev.id, statut, plages, maxHeures: max, note: String(fd.get('note') || '').trim() }));
      }
      sauver(); rendre();
      const cf = R.conflitsBenevole(E, bid, ev.id).filter((x) => x.type === 'indispo');
      toast(`Réponse de ${b.prenom} : ${LIB_DISPO_COURT[statut].toLowerCase()}.${cf.length ? ` ${pluriel(cf.length, 'créneau', 'créneaux')} à revoir.` : ''}`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelectorAll('[name=statut]').forEach((el) => el.addEventListener('change', () => { modale().querySelector('#plages').hidden = el.value !== 'partiel' || !el.checked; }));
  }

  function modaleMessage(bid) {
    const ev = evCourant();
    if (!ev) return;
    const texte = R.message(E, bid, ev.id, E.message);
    ouvrirModale(`Message pour ${esc(benevole(bid)?.prenom || '')}`, `<textarea readonly rows="12" id="message-texte" aria-label="Message">${esc(texte)}</textarea><p class="aide">Copie-le dans ta messagerie habituelle (SMS, e-mail, groupe de discussion). Le modèle se change dans les Réglages.</p>`,
      '<button class="btn primaire" type="button" data-action="copier" data-id="' + bid + '">Copier</button><button class="btn" value="annuler">Fermer</button>');
  }
  async function copier(bid) {
    const ev = evCourant();
    const texte = R.message(E, bid, ev.id, E.message);
    try { await navigator.clipboard.writeText(texte); toast(`Message de ${courtB(bid)} copié.`); } catch {
      const zone = $('#message-texte') || [...document.querySelectorAll('.message-carte textarea')].find((x) => x.value === texte);
      if (zone) { zone.select(); toast('Sélectionné : copie-le avec Ctrl+C ou un appui long.'); } else toast('Copie impossible dans ce navigateur.');
    }
  }

  function modaleEvenement(id) {
    const ev = id ? evenement(id) : null;
    const t = auj();
    const v = ev || { nom: '', lieu: '', debut: ajout(t, 30), fin: ajout(t, 30), responsable: E.reglages.contact, consignes: '', note: '' };
    const corps = `
      ${ev ? '' : `<fieldset class="champ"><legend>Modèle <small>Crée les postes et les créneaux types ; tout se modifie ensuite.</small></legend><div class="choix-secteur">${[...B.modeles, { id: '', nom: 'Sans modèle' }].map((m, i) => `<label><input type="radio" name="modele" value="${m.id}" ${i === 0 ? 'checked' : ''}><span>${esc(m.nom)}</span></label>`).join('')}</div></fieldset>`}
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="80" required value="${esc(v.nom)}"></label><label class="champ">Lieu <small>Facultatif.</small><input name="lieu" maxlength="80" value="${esc(v.lieu)}"></label></div>
      <div class="rang-champs"><label class="champ">Premier jour<input type="date" name="debut" value="${v.debut}"></label><label class="champ">Dernier jour<input type="date" name="fin" value="${v.fin}"></label></div>
      <label class="champ">Qui prévenir en cas d'empêchement <small>Repris dans les messages.</small><input name="responsable" maxlength="80" value="${esc(v.responsable)}"></label>
      <label class="champ">Consignes pour tous <small>Rendez-vous, tenue, badge… Reprises dans les messages.</small><textarea name="consignes" rows="3" maxlength="400">${esc(v.consignes)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const nb = ev ? R.creneauxEvenement(E, ev.id).length : 0;
    ouvrirModale(ev ? 'Modifier l\'événement' : 'Nouvel événement', corps, `<button class="btn primaire" value="ok">${ev ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>${ev ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${ev.nom} », ses ${pluriel(nb, 'créneau', 'créneaux')}, leurs affectations et les réponses des bénévoles ? Le bilan des heures perdra cet événement.`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerEvenement(E, ev.id);
        sauver(); rendre(); toast(`« ${ev.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'événement.';
      const debut = fd.get('debut'), fin = fd.get('fin') || debut;
      if (!R.estDate(debut)) return 'Indique le premier jour.';
      if (fin < debut) return 'Le dernier jour ne peut pas précéder le premier.';
      if (R.ecart(debut, fin) > 30) return 'Un événement de plus d\'un mois : découpe-le.';
      const champs = { nom, lieu: String(fd.get('lieu') || '').trim(), debut, fin, responsable: String(fd.get('responsable') || '').trim(), consignes: String(fd.get('consignes') || '').trim() };
      retenir();
      if (ev) {
        const dec = R.ecart(ev.debut, debut);
        if (dec && R.creneauxEvenement(E, ev.id).length && confirm(`Décaler aussi les créneaux de ${pluriel(Math.abs(dec), 'jour')} ?`)) E.creneaux.forEach((c) => { if (c.evenement === ev.id) c.date = ajout(c.date, dec); });
        Object.assign(ev, R.normaliserEvenement({ ...ev, ...champs }));
        sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
      } else {
        const n = creerEvenement(E, champs, fd.get('modele'));
        choisirEv(n.id);
        sauver(); changerVue('planning');
        toast(`« ${nom} » créé avec ${pluriel(R.creneauxEvenement(E, n.id).length, 'créneau', 'créneaux')}.`, { libelle: 'Annuler', faire: annuler });
      }
    });
  }

  function modaleDupliquer(id) {
    const ev = evenement(id);
    if (!ev) return;
    let d = ajout(ev.debut, 364); // même jour de la semaine, un an plus tard
    ouvrirModale('Dupliquer l\'événement', `<p>Les ${pluriel(R.creneauxEvenement(E, id).length, 'créneau', 'créneaux')} de « ${esc(ev.nom)} » sont repris à la nouvelle date, mêmes horaires et mêmes besoins. Ni affectations ni réponses : tout est à redemander.</p>
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="80" value="${esc(ev.nom)}"></label><label class="champ">Premier jour <small>Proposé : le même jour de la semaine, un an plus tard.</small><input type="date" name="debut" value="${d}"></label></div><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Dupliquer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      d = fd.get('debut');
      const r = R.dupliquerEvenement(E, id, d, uid, String(fd.get('nom') || '').trim() || ev.nom);
      if (!r) return 'Indique une date valide.';
      retenir();
      E.evenements.push(r.evenement); E.creneaux.push(...r.creneaux);
      choisirEv(r.evenement.id);
      sauver(); changerVue('planning');
      toast(`« ${r.evenement.nom} » prêt pour le ${dateCourte(d)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePoste(id) {
    const p = id ? poste(id) : null;
    const v = p || { nom: '', famille: '', couleur: E.postes.length % B.couleurs.length, competence: '', consigne: '' };
    const n = p ? E.creneaux.filter((c) => c.poste === p.id).length : 0;
    const types = B.postes.filter((x) => !E.postes.some((y) => y.nom === x[0]));
    const corps = `
      ${p ? '' : `<label class="champ">Partir d'un poste type <small>Facultatif.</small><select name="type"><option value="">—</option>${types.map((x, i) => `<option value="${i}">${esc(x[0])} · ${esc(x[1])}</option>`).join('')}</select></label>`}
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="60" required value="${esc(v.nom)}"></label><label class="champ">Famille <small>Pour ranger la liste.</small><input name="famille" maxlength="30" value="${esc(v.famille)}" list="familles"><datalist id="familles">${B.familles.map((f) => `<option value="${esc(f)}">`).join('')}</datalist></label></div>
      <label class="champ">Compétence demandée <small>Un bénévole affecté sans elle est signalé.</small><select name="competence"><option value="">Aucune</option>${E.competences.map((c) => `<option value="${c.id}" ${v.competence === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <label class="champ">Consigne <small>Reprise dans le message de chaque bénévole.</small><textarea name="consigne" rows="2" maxlength="240">${esc(v.consigne)}</textarea></label>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${v.couleur === i ? 'checked' : ''}><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      ${p ? `<p class="mention">Utilisé par ${pluriel(n, 'créneau', 'créneaux')}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Poste' : 'Nouveau poste', corps, `<button class="btn primaire" value="ok">${p ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>${p ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        if (n && !confirm(`Supprimer « ${p.nom} », ses ${pluriel(n, 'créneau', 'créneaux')} et leurs affectations, sur tous les événements ?`)) { garderOuverte(); return; }
        retenir();
        const ids = new Set(E.creneaux.filter((c) => c.poste === p.id).map((c) => c.id));
        E.postes = E.postes.filter((x) => x.id !== p.id);
        E.creneaux = E.creneaux.filter((c) => !ids.has(c.id));
        E.affectations = E.affectations.filter((a) => !ids.has(a.creneau));
        E.benevoles.forEach((b) => { b.preferes = b.preferes.filter((x) => x !== p.id); b.evites = b.evites.filter((x) => x !== p.id); });
        sauver(); rendre(); toast(`Poste « ${p.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au poste.';
      if (E.postes.some((x) => x.id !== p?.id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Ce poste existe déjà.';
      retenir();
      const x = R.normaliserPoste({ ...(p || {}), id: p?.id || uid(), nom, famille: String(fd.get('famille') || '').trim(), competence: fd.get('competence') || '', consigne: String(fd.get('consigne') || '').trim(), couleur: Number(fd.get('couleur')) }, 0, B.couleurs.length);
      if (p) Object.assign(p, x); else E.postes.push(x);
      sauver(); rendre(); toast(`Poste « ${nom} » enregistré.`);
    });
    const sel = modale().querySelector('[name=type]');
    sel?.addEventListener('change', () => {
      const x = types[Number(sel.value)];
      if (!x) return;
      const f = modale().querySelector('form');
      f.nom.value = x[0]; f.famille.value = x[1]; f.consigne.value = x[3];
      const c = E.competences.find((k) => k.nom === x[2]);
      f.competence.value = c?.id || '';
    });
  }

  function modaleCompetence(id) {
    const c = id ? tr('competences', id) : null;
    const n = c ? E.benevoles.filter((b) => b.competences.includes(c.id)).length + E.postes.filter((p) => p.competence === c.id).length : 0;
    ouvrirModale(c ? 'Compétence' : 'Nouvelle compétence', `
      <label class="champ">Nom<input name="nom" maxlength="50" required value="${esc(c?.nom || '')}"></label>
      ${c ? `<p class="mention">Utilisée par ${pluriel(n, 'bénévole ou poste', 'bénévoles ou postes')}.${n ? ' La supprimer la retire de leurs fiches.' : ''}</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${c ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        retenir();
        E.competences = E.competences.filter((x) => x.id !== c.id);
        E.benevoles.forEach((b) => { b.competences = b.competences.filter((x) => x !== c.id); });
        E.postes.forEach((p) => { if (p.competence === c.id) p.competence = ''; });
        if (fb.comp === c.id) fb.comp = '';
        sauver(); rendre(); toast(`Compétence « ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la compétence.';
      if (E.competences.some((x) => x.id !== c?.id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Cette compétence existe déjà.';
      retenir();
      if (c) c.nom = nom; else E.competences.push({ id: uid(), nom });
      sauver(); rendre(); toast(`Compétence « ${nom} » enregistrée.`);
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="rang-champs"><label class="champ">Ton association<input name="association" maxlength="80" value="${esc(E.association)}"></label>
        <label class="champ">Ton prénom sur cet appareil <small>Signe tes affectations. Gardé sur cet appareil.</small><input name="auteur" maxlength="40" value="${esc(auteur())}" autocomplete="given-name"></label></div>
      <div class="groupe"><h3>Repères de l'association</h3><p class="aide">Choix de ton association, pas des règles légales : les bénévoles ne relèvent pas du Code du travail. 0 pour désactiver une alerte.</p>
        <div class="rang-champs trois">
          <label class="champ">Heures d'affilée au plus<input name="maxContinu" inputmode="decimal" value="${String(r.maxContinu).replace('.', ',')}"></label>
          <label class="champ">Pause qui coupe (min)<input name="reposMin" inputmode="numeric" value="${r.reposMin}"></label>
          <label class="champ">Heures par jour au plus<input name="maxJour" inputmode="decimal" value="${String(r.maxJour).replace('.', ',')}"></label>
        </div>
        <label class="case"><input type="checkbox" name="sansReponse" ${r.sansReponse ? 'checked' : ''}> La suggestion propose aussi les bénévoles qui n'ont pas répondu</label></div>
      <div class="groupe"><h3>Messages aux bénévoles</h3>
        <div class="rang-champs"><label class="champ">Qui prévenir par défaut<input name="contact" maxlength="120" value="${esc(r.contact)}"></label><label class="champ">Signature<input name="signature" maxlength="120" value="${esc(r.signature)}"></label></div>
        <label class="champ">Modèle <small>Marqueurs : {prenom} {evenement} {lieu} {dates} {creneaux} {total} {consignes} {contact} {signature}.</small><textarea name="message" rows="9" maxlength="2000">${esc(E.message)}</textarea></label>
        <div class="rang"><button class="btn petit" type="button" data-action="message-defaut">Revenir au modèle d'origine</button></div></div>
      <div class="groupe"><h3>Conservation des données <span class="etiquette jaune">Choix de l'association</span></h3>
        <label class="champ">Signaler les bénévoles sans créneau depuis (mois) <small>Aucune durée légale n'est intégrée : le RGPD demande de ne pas garder les données plus longtemps que nécessaire (art. 5.1.e). Indique la durée choisie dans ton information aux bénévoles.</small><input name="conservationMois" inputmode="numeric" value="${r.conservationMois}"></label>
        <details class="champs-aide"><summary>Sources (lues le ${fmt(B.rgpd.verifieLe, { day: 'numeric', month: 'long', year: 'numeric' })})</summary><ul>${B.rgpd.sources.map(([l, u]) => `<li>${esc(l)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV) : le planning de l'événement affiché avec les places à pourvoir, les heures de l'année, l'annuaire.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-planning">Planning (CSV)</button><button class="btn petit" type="button" data-action="csv-heures">Heures (CSV)</button><button class="btn petit" type="button" data-action="csv-annuaire">Annuaire (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Le planning est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="mention">Les responsables qui partagent cette clé voient le même planning. Si deux personnes modifient en même temps, leurs changements sont réunis ; une même personne affectée deux fois apparaît en conflit.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du planning, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le planning est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Ton association est responsable des données de ses bénévoles : garde le minimum (art. 5.1.c), informe-les (art. 13), réponds à leurs demandes d'accès (art. 15) et d'effacement (art. 17) depuis leur fiche. Pas de donnée de santé. Pour un bénévole mineur, l'accord de ses parents se gère hors de l'outil.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Postes, modèles d'événement et messages rédigés pour QME (version ${B.version}). Aucun message envoyé, aucune inscription en ligne, aucune connexion à une messagerie ou à un agenda.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom, mini, maxi) => { const n = R.lireNombre(fd.get(nom)); return n !== null && n >= mini && n <= maxi ? n : null; };
      const v = { maxContinu: lire('maxContinu', 0, 24), reposMin: lire('reposMin', 0, 240), maxJour: lire('maxJour', 0, 24), conservationMois: lire('conservationMois', 1, 120) };
      if (v.maxContinu === null || v.maxJour === null) return 'Heures : un nombre entre 0 et 24.';
      if (v.reposMin === null) return 'Pause : un nombre de minutes entre 0 et 240.';
      if (v.conservationMois === null) return 'Conservation : un nombre de mois entre 1 et 120.';
      E.association = String(fd.get('association') || '').trim();
      const a = String(fd.get('auteur') || '').trim();
      if (a) stock.ecrire(CLE_AUTEUR, a); else stock.suppr(CLE_AUTEUR);
      E.message = String(fd.get('message') || '').trim() || B.message;
      E.reglages = R.normaliserReglages({ ...r, ...v, sansReponse: !!fd.get('sansReponse'), contact: fd.get('contact'), signature: fd.get('signature') }, r);
      sauver(); rendre();
      toast('Réglages enregistrés : conflits et suggestions recalculés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.benevoles) || !Array.isArray(donnees.creneaux)) throw new Error();
        if (!confirm(`Remplacer le planning actuel par cette copie (${pluriel(donnees.benevoles.length, 'bénévole')}, ${pluriel(donnees.creneaux.length, 'créneau', 'créneaux')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
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
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function effacerBenevole(id) {
    if (!benevole(id) || !confirm(`Effacer les données personnelles de ${nomB(id)} ? Son nom, ses coordonnées, ses préférences et ses réponses sont effacés. Ses heures passées restent dans le bilan.`)) return;
    retenir();
    E = R.effacerBenevole(E, id, E.benevoles.filter((x) => x.efface).length + 1);
    sauver(); rendre(); modale().close();
    toast('Données personnelles effacées.', { libelle: 'Annuler', faire: annuler });
  }
  function supprimerBenevole(id) {
    const b = benevole(id);
    if (!b) return;
    const n = R.creneauxDe(E, id).length;
    if (!confirm(`Supprimer ${nomB(id)}${n ? ` et ses ${pluriel(n, 'créneau', 'créneaux')}` : ''} ? Ses heures disparaissent du bilan.`)) return;
    retenir();
    E = R.supprimerBenevole(E, id);
    sauver(); rendre(); modale().close();
    toast(`${b.prenom} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }
  function effacerInactifs() {
    const ina = R.inactifs(E, auj(), E.reglages.conservationMois);
    if (!ina.length || !confirm(`Effacer les données personnelles de ${pluriel(ina.length, 'bénévole')} sans créneau depuis ${E.reglages.conservationMois} mois ? Leurs heures passées restent dans le bilan.`)) return;
    retenir();
    let rang = E.benevoles.filter((x) => x.efface).length;
    for (const b of ina) E = R.effacerBenevole(E, b.id, ++rang);
    sauver(); rendre();
    toast(`${pluriel(ina.length, 'bénévole effacé', 'bénévoles effacés')}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Impression (A4) : zone #impression, imprimée seule ----------
  function imprimer(mode) {
    const ev = evCourant();
    if (!ev) return;
    const tete = `<header class="impr-tete"><div><p class="impr-org">${esc(E.association || '')}</p><h1>${esc(ev.nom)}</h1><p>${datesEv(ev)}${ev.lieu ? ` · ${esc(ev.lieu)}` : ''}</p></div><p class="impr-date">Planning ${mode === 'poste' ? 'par poste' : 'par personne'} · imprimé le ${fmt(auj())}</p></header>`;
    let corps;
    if (mode === 'poste') {
      corps = R.parPoste(E, ev.id).map((j) => `<section class="impr-jour"><h2>${dateJour(j.date)}</h2>${j.postes.map((x) => { const p = poste(x.poste); return `<table class="impr-table"><caption>${esc(p?.nom || '')}${p?.consigne ? ` <small>${esc(p.consigne)}</small>` : ''}</caption><tbody>${x.creneaux.map((v) => `<tr><th>${plageC(v.creneau)}</th><td>${[...v.affectes.map((bid) => `${esc(nomB(bid))}${benevole(bid)?.telephone ? ` <small>${esc(benevole(bid).telephone)}</small>` : ''}`), ...Array.from({ length: v.manque }, () => '<span class="impr-vide">…………………… (à pourvoir)</span>')].join('<br>')}</td></tr>`).join('')}</tbody></table>`; }).join('')}</section>`).join('');
    } else {
      corps = `<div class="impr-personnes">${R.parPersonne(E, ev.id).map((x) => `<article class="impr-personne"><h2>${esc(nomB(x.benevole))} <small>${hh(x.minutes)}</small></h2><ul>${x.creneaux.map((c) => `<li><b>${dateJourCourt(c.date)} ${plageC(c)}</b> · ${esc(nomPo(c.poste))}</li>`).join('')}</ul>${ev.responsable ? `<p class="impr-contact">Empêchement : ${esc(ev.responsable)}</p>` : ''}</article>`).join('')}</div>`;
    }
    $('#impression').innerHTML = `<article class="impr">${tete}${corps}</article>`;
    document.body.classList.add('impression');
    const fin = () => { document.body.classList.remove('impression'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const h = (x) => `${String(x).replace('.', ',')}&nbsp;h`;
    const reperes = [
      r.maxContinu > 0 ? `plus de ${h(r.maxContinu)} d'affilée sans pause d'au moins ${r.reposMin}&nbsp;min` : '',
      r.maxJour > 0 ? `plus de ${h(r.maxJour)} dans la journée` : '',
    ].filter(Boolean);
    const blocs = [
      ['rose', 'Un événement, ses créneaux', `Chaque événement a ses créneaux&nbsp;: un poste (accueil, buvette, montage…), un horaire et le nombre de personnes à trouver. Les postes servent à tous tes événements, certains demandent une compétence. <b>Dupliquer</b> un événement prépare l'édition suivante avec tous ses créneaux.`],
      ['beurre', 'Note la réponse de chacun', `Ton annuaire garde le minimum&nbsp;: prénom, nom, coordonnées, compétences, postes préférés ou à éviter. Pour chaque événement, note la réponse de chaque bénévole&nbsp;: disponible, en partie (avec ses plages horaires) ou indisponible, et son maximum d'heures s'il en donne un.`],
      ['ciel', 'Affecte, l\'outil vérifie', `Sur un créneau, les bénévoles sont classés&nbsp;: ceux sans réserve d'abord, puis poste préféré, compétence, et le moins d'heures déjà données. Un conflit est signalé tout de suite&nbsp;: double affectation, indisponibilité, compétence manquante, maximum dépassé${reperes.length ? `, ${reperes.join(', ')}` : ''}. <b>Remplir les trous</b> propose des affectations sans conflit, à valider.`],
      ['sable', 'Préviens, imprime, remercie', `Pour chaque bénévole, un <b>Message</b> prêt à copier liste ses créneaux&nbsp;: c'est toi qui l'envoies, l'outil n'envoie rien. Le planning s'imprime par poste ou par personne, et le <b>Bilan</b> compte les heures données par chacun.`],
    ];
    const corps = `
      <p>L'outil te montre les places à pourvoir et les conflits de ton planning, et propose qui mettre où. Ton rôle&nbsp;: créer les créneaux de l'événement, noter qui est disponible, puis affecter.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">L'onglet <b>Événement</b> résume les places à pourvoir, les conflits et les réponses. Les repères de pause et d'heures sont des choix de l'association, à régler dans les réglages. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils, et plusieurs responsables peuvent saisir en même temps.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.benevoles.length;
    const pied = premier
      ? '<button class="btn primaire" value="benevole">Ajouter mon premier bénévole</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'benevole') setTimeout(() => modaleBenevole(null), 0); });
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
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Pratique le jour J pour voir qui tient quel poste.</p>
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
  const fermer = () => { if (modale().open) modale().close(); };
  const csv = (contenu, nom) => telecharger(contenu, 'text/csv;charset=utf-8', nom);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const ev = E ? evCourant() : null;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); evId = null; cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), 'application/json', `benevoles-${auj()}.json`); break;
      case 'csv-planning': if (ev) csv(R.planningCsv(E, ev.id), `planning-${slug(ev.nom)}-${ev.debut}.csv`); break;
      case 'csv-heures': { const f = bi.periode.startsWith('e') ? { evenement: bi.periode.slice(1) } : { annee: bi.periode.slice(1) || auj().slice(0, 4) }; csv(R.heuresCsv(E, f), `heures-benevoles-${auj()}.csv`); break; }
      case 'csv-annuaire': csv(R.annuaireCsv(E), `annuaire-benevoles-${auj()}.csv`); break;
      case 'message-defaut': { const t = modale().querySelector('[name=message]'); if (t) t.value = B.message; break; }
      case 'imprimer': imprimer(el.dataset.mode); break;
      case 'fermer': modale().close(); break;
      case 'remplir': remplirTrous(); break;
      case 'creneau': if (id) modaleCreneau(id); break;
      case 'nouveau-creneau': fermer(); modaleNouveauCreneau(); break;
      case 'affecter': affecter(el.dataset.creneau, el.dataset.benevole); break;
      case 'retirer': retirer(el.dataset.creneau, el.dataset.benevole); break;
      case 'benevole': modaleBenevole(id); break;
      case 'nouveau-benevole': fermer(); modaleBenevole(null); break;
      case 'dispo': modaleDispo(id); break;
      case 'voir-dispo': fb.dispo = el.dataset.dispo; changerVue('benevoles'); break;
      case 'message': modaleMessage(id); break;
      case 'copier': copier(id); break;
      case 'evenement': modaleEvenement(id); break;
      case 'nouvel-evenement': fermer(); modaleEvenement(null); break;
      case 'ouvrir-ev': choisirEv(id); changerVue('evenement'); break;
      case 'dupliquer-ev': modaleDupliquer(id); break;
      case 'poste': modalePoste(id); break;
      case 'nouveau-poste': modalePoste(null); break;
      case 'competence': modaleCompetence(id); break;
      case 'nouvelle-competence': modaleCompetence(null); break;
      case 'exporter-benevole': { const d = R.donneesBenevole(E, id, auj()); if (d) telecharger(JSON.stringify(d, null, 2), 'application/json', `donnees-${slug(nomB(id)) || 'benevole'}-${auj()}.json`); break; }
      case 'effacer-benevole': effacerBenevole(id); break;
      case 'supprimer-benevole': supprimerBenevole(id); break;
      case 'effacer-inactifs': effacerInactifs(); break;
      case 'pl-mode': pl.mode = el.dataset.val; rendre(); break;
      case 'pl-jour': pl.jour = el.dataset.val; rendre(); break;
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton; session.baseEtat = c.baseEtat ? normaliser(c.baseEtat) : null;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__benevoles = { etat: () => E, regles: R };
  init();
})();
