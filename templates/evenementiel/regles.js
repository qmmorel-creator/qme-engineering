// Règles métier de l'Organisateur d'événement : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.EVT) et par les tests (outils/templates/evenementiel.test.mjs).
// Toute fonction qui dépend du jour reçoit la date « aujourd'hui » en paramètre. Montants en centimes.
// Fusion du 22/11/2026 (rationalisation F1) : pilote événementiel (socle), organisateur de mariage (plan de table,
// enfants, démarches) et séminaire / offsite (transports, chambres, salles parallèles, fiche traiteur agrégée).
(function (g) {
  'use strict';

  // ---------- Dates locales AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (estDate(s) ? s.split('-').reverse().join('/') : '');
  const minutes = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  const hm = (n) => `${deux(Math.floor(n / 60))}:${deux(n % 60)}`;

  // ---------- Montants ----------
  // « 1 250,50 € », « 1250.5 », « 12 », « 1.250,50 » → centimes entiers ; vide → 0 ; illisible → null.
  function lireMontant(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
    let s = String(v ?? '').replace(/[\s  €]/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!s) return 0;
    if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null;
    const [ent, dec = ''] = s.replace('-', '').split('.');
    const c = Number(ent) * 100 + Number((dec + '00').slice(0, 2));
    return s.startsWith('-') ? -c : c;
  }
  function eur(c, decimales) {
    const n = (Number(c) || 0) / 100;
    const d = decimales ?? (Math.round(Number(c) || 0) % 100 ? 2 : 0);
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const champMontant = (c) => (c || c === 0 ? String(c / 100).replace('.', ',') : '');
  // Découpe un montant en acompte (pourcentage saisi) et solde ; le reste de l'arrondi va au solde.
  function decouper(montant, pct) {
    if (!(pct > 0 && pct < 100)) return null;
    const acompte = Math.round((montant * pct) / 100);
    return [acompte, montant - acompte];
  }

  // ---------- Types d'événement et fonctions activées ----------
  const TYPES = ['mariage', 'seminaire', 'entreprise', 'fete'];
  const MODULES = ['tables', 'transports', 'hebergement', 'badges', 'enfants'];
  // Fonctions proposées à la création selon le type (modifiables ensuite, événement par événement).
  function modulesParDefaut(type, format, nbJours) {
    const m = { tables: false, transports: false, hebergement: false, badges: false, enfants: false };
    if (type === 'mariage') Object.assign(m, { tables: true, enfants: true });
    else if (type === 'fete') Object.assign(m, { tables: true, enfants: true });
    else if (type === 'seminaire') Object.assign(m, { transports: true, hebergement: (Number(nbJours) || 1) > 1, badges: true });
    else Object.assign(m, { badges: true, tables: format === 'gala' });
    return m;
  }
  const aModule = (evt, m) => Boolean(evt && evt.modules && evt.modules[m]);
  // Modèle de rétroplanning, de postes et de conducteur d'un événement.
  function cleModele(evt) {
    if (!evt) return 'conference';
    if (evt.type === 'mariage' || evt.type === 'fete' || evt.type === 'seminaire') return evt.type;
    return { salon: 'salon', soiree: 'soiree', gala: 'soiree', conference: 'conference' }[evt.format] || 'conference';
  }
  const cleConducteur = (evt) => (evt && evt.type === 'seminaire' ? ((evt.nbJours || 1) > 1 ? 'deuxjours' : 'journee') : cleModele(evt));

  // ---------- Événements ----------
  const finEvenement = (evt) => ajout(evt.date, Math.max(1, evt.nbJours || 1) - 1);
  const evenementPasse = (evt, auj) => finEvenement(evt) < auj;
  const nuits = (evt) => Math.max(1, evt.nbJours || 1) - 1;
  // Compte à rebours : « J-12 », « Jour J », « Jour 2 », « Terminé ».
  function compteRebours(evt, auj) {
    const n = ecart(auj, evt.date);
    if (n > 0) return `J-${n}`;
    if (n === 0) return 'Jour J';
    if (auj <= finEvenement(evt)) return `Jour ${1 - n}`;
    return 'Terminé';
  }

  // ---------- Rétroplanning ----------
  const echeance = (t, evt) => t.dateFixe || (evt ? ajout(evt.date, -(Number(t.avant) || 0)) : null);
  // Statut à une date : faite, retard, semaine (≤ 7 jours), avenir ; retard en jours.
  function statutTache(t, evt, auj) {
    if (t.faite) return { statut: 'faite', retard: 0 };
    const e = echeance(t, evt);
    const n = ecart(auj, e);
    if (n < 0) return { statut: 'retard', retard: -n };
    if (n <= 7) return { statut: 'semaine', retard: 0 };
    return { statut: 'avenir', retard: 0 };
  }
  // Indice de la période (BASE.periodes) selon les jours entre l'échéance et l'événement.
  function periode(t, evt, periodes) {
    const j = ecart(echeance(t, evt), evt.date);
    const i = periodes.findIndex((p) => j >= p.min);
    return i < 0 ? periodes.length - 1 : i;
  }
  const libelleRelatif = (avant) => (avant > 0 ? `J-${avant}` : avant === 0 ? 'Jour J' : `J+${-avant}`);

  // Tâches d'un modèle [titre, phase, avant, note?] pour un événement.
  // mode pour les échéances déjà passées : 'garder' (en retard), 'aujourdhui' (date fixe = auj), 'ignorer'.
  // Les titres déjà présents dans l'événement ne sont pas dupliqués.
  function tachesDepuisModele(lignes, evt, auj, mode, existantes, uid) {
    const deja = new Set((existantes || []).filter((t) => t.evtId === evt.id).map((t) => t.titre.trim().toLowerCase()));
    const res = [];
    let passees = 0;
    for (const [titre, phase, avant, note] of lignes) {
      if (deja.has(titre.toLowerCase())) continue;
      const e = ajout(evt.date, -avant);
      const passee = e < auj;
      if (passee) passees++;
      if (passee && mode === 'ignorer') continue;
      res.push({ id: uid(), evtId: evt.id, titre, phase, avant, dateFixe: passee && mode === 'aujourdhui' ? auj : null, responsable: '', faite: null, note: note || '' });
    }
    return { taches: res, passees };
  }

  // Tâches ouvertes et en retard par responsable (événements donnés ou tous).
  function chargeResponsables(E, auj, evtIds) {
    const evts = new Map(E.evenements.map((e) => [e.id, e]));
    const m = new Map();
    for (const t of E.taches) {
      const evt = evts.get(t.evtId);
      if (!evt || t.faite || (evtIds && !evtIds.includes(t.evtId))) continue;
      const nom = (t.responsable || '').trim() || 'Sans responsable';
      const r = m.get(nom) || { nom, ouvertes: 0, retard: 0, semaine: 0 };
      const s = statutTache(t, evt, auj).statut;
      r.ouvertes++;
      if (s === 'retard') r.retard++;
      if (s === 'semaine') r.semaine++;
      m.set(nom, r);
    }
    return [...m.values()].sort((a, b) => b.retard - a.retard || b.ouvertes - a.ouvertes || a.nom.localeCompare(b.nom));
  }

  // ---------- Budget ----------
  const sommeEch = (c, payees) => (c.echeances || []).reduce((s, e) => s + (payees === undefined || Boolean(e.payeLe) === payees ? e.montant || 0 : 0), 0);
  function infoContrat(c) {
    const planifie = sommeEch(c);
    const paye = sommeEch(c, true);
    return { planifie, paye, aPlanifier: c.statut === 'signe' ? c.montant - planifie : 0, engage: c.statut === 'signe' ? c.montant : 0 };
  }
  // Par poste : prévu, engagé (contrats signés), payé (échéances payées, même d'un contrat annulé),
  // reste à payer = max(engagé, payé) − payé, écart = engagé − prévu.
  function budget(E, evtId) {
    const postes = E.postes.filter((p) => p.evtId === evtId);
    const contrats = E.contrats.filter((c) => c.evtId === evtId);
    const ligne = (poste, liste) => {
      const prevu = poste ? poste.prevu || 0 : 0;
      const engage = liste.reduce((s, c) => s + infoContrat(c).engage, 0);
      const paye = liste.reduce((s, c) => s + infoContrat(c).paye, 0);
      const reste = Math.max(engage, paye) - paye;
      const ecartP = engage - prevu;
      return { poste, prevu, engage, paye, reste, ecart: ecartP, depassement: prevu > 0 && ecartP > 0, nbContrats: liste.length };
    };
    const ids = new Set(postes.map((p) => p.id));
    const lignes = postes.map((p) => ligne(p, contrats.filter((c) => c.posteId === p.id)));
    const orphelins = contrats.filter((c) => !c.posteId || !ids.has(c.posteId));
    const nonAffecte = orphelins.length ? ligne(null, orphelins) : null;
    const tout = [...lignes, ...(nonAffecte ? [nonAffecte] : [])];
    const total = ['prevu', 'engage', 'paye', 'reste'].reduce((o, k) => ({ ...o, [k]: tout.reduce((s, l) => s + l[k], 0) }), {});
    total.ecart = total.engage - total.prevu;
    return { lignes, nonAffecte, total };
  }
  // Coût par invité confirmé (réponse « oui »), arrondi au centime ; null si aucun confirmé.
  const coutParInvite = (total, nbConfirmes) => (nbConfirmes > 0 ? { prevu: Math.round(total.prevu / nbConfirmes), engage: Math.round(total.engage / nbConfirmes) } : null);

  // Échéances non payées (d'un événement ou de tous), triées par date ; retard si passée, proche à 14 j.
  function echeancier(E, auj, evtId) {
    const res = [];
    for (const c of E.contrats) {
      if (evtId && c.evtId !== evtId) continue;
      if (c.statut === 'annule') continue;
      for (const e of c.echeances || []) {
        if (e.payeLe || !e.date) continue;
        const n = ecart(auj, e.date);
        res.push({ contrat: c, echeance: e, jours: n, etat: n < 0 ? 'retard' : n <= 14 ? 'proche' : 'avenir' });
      }
    }
    return res.sort((a, b) => a.echeance.date.localeCompare(b.echeance.date));
  }

  // ---------- Invités ----------
  // Concerné = on prévoit pour lui (couvert, place, trajet, chambre) : oui ou en attente.
  const concerne = (i) => i.reponse !== 'non';
  const nomComplet = (i) => `${i.prenom || ''} ${i.nom || ''}`.trim();
  const trierInvites = (liste) => [...liste].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));
  // Groupes présents dans une liste (familles, services, catégories…), triés.
  const groupesDe = (liste) => [...new Set(liste.map((i) => (i.groupe || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

  // Réponses, adultes et enfants, comptage AGRÉGÉ des données sensibles (régime en liste fermée, cases sans détail).
  // regimes : liste fermée ; un régime non renseigné compte comme le premier (« Sans restriction »).
  function statsInvites(liste, regimes) {
    const ref = regimes && regimes.length ? regimes : ['Sans restriction'];
    const r = { total: liste.length, oui: 0, non: 0, attente: 0, presents: 0, adultes: 0, enfants: 0, rep: { oui: { adultes: 0, enfants: 0 }, attente: { adultes: 0, enfants: 0 }, non: { adultes: 0, enfants: 0 } },
      couverts: 0, couvertsEnfants: 0, regimes: {}, allergies: 0, acces: 0, parGroupe: {} };
    for (const x of ref) r.regimes[x] = 0;
    for (const i of liste) {
      const rep = ['oui', 'non'].includes(i.reponse) ? i.reponse : 'attente';
      const age = i.enfant ? 'enfants' : 'adultes';
      r[rep]++; r[age]++; r.rep[rep][age]++;
      if (i.present) r.presents++;
      const grp = (i.groupe || '').trim() || 'Sans groupe';
      const s = (r.parGroupe[grp] ||= { oui: 0, non: 0, attente: 0, total: 0 });
      s.total++; s[rep]++;
      if (rep === 'non') continue;
      r.couverts++;
      if (i.enfant) r.couvertsEnfants++;
      r.regimes[ref.includes(i.regime) ? i.regime : ref[0]]++;
      if (i.allergie) r.allergies++;
      if (i.acces) r.acces++;
    }
    r.tauxReponse = r.total ? Math.round(((r.oui + r.non) / r.total) * 100) : null;
    r.tauxPresence = r.oui ? Math.round((r.presents / r.oui) * 100) : null;
    return r;
  }

  // Saisie rapide : « Prénom Nom ; Société ou service ; Fonction ou e-mail » par ligne (le dernier mot du nom est le
  // nom de famille ; un seul mot = un nom). Une colonne qui contient « @ » est l'e-mail. Doublons exacts ignorés.
  function lireInvitesRapides(texte) {
    const vus = new Set();
    return String(texte || '').split(/\r?\n/).map((l) => l.trim().replace(/ {2,}/g, ' ')).filter(Boolean).map((l) => {
      const [personne, ...reste] = l.split(/[;\t]/).map((s) => s.trim());
      const email = reste.find((s) => s.includes('@')) || '';
      const autres = reste.filter((s) => s && s !== email);
      const mots = personne.split(/\s+/).filter(Boolean);
      const nom = mots.length > 1 ? mots.pop() : (mots.pop() || '');
      return { prenom: mots.join(' ').slice(0, 40), nom: nom.slice(0, 60), champ2: (autres[0] || '').slice(0, 80), champ3: (autres[1] || '').slice(0, 60), email: email.slice(0, 80) };
    }).filter((x) => {
      const cle = `${x.prenom} ${x.nom}`.toLowerCase();
      if (!x.nom || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  }
  // Pages de badges (n par page) des invités ayant répondu oui, triés par nom.
  function pagesBadges(liste, n = 8) {
    const t = trierInvites(liste.filter((i) => i.reponse === 'oui'));
    const pages = [];
    for (let i = 0; i < t.length; i += n) pages.push(t.slice(i, i + n));
    return pages;
  }
  // CSV point-virgule avec BOM (ouvre correctement les accents dans un tableur).
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n') + '\r\n';
  // o : { groupe: libellé de la colonne, modules: { tables, transports, hebergement, badges, enfants }, table(id), trajet(id), chambre(id), avecSensibles }
  function csvInvites(liste, o) {
    const m = o.modules || {};
    const rep = { oui: 'Oui', non: 'Non', attente: 'En attente' };
    const entetes = ['Nom', 'Prénom', o.groupe || 'Groupe', ...(m.badges ? ['Société', 'Fonction'] : []), 'E-mail', 'Réponse', ...(m.enfants ? ['Enfant'] : []), 'Présent',
      ...(m.tables ? ['Table'] : []), ...(m.transports ? ['Aller', 'Retour'] : []), ...(m.hebergement ? ['Chambre'] : []),
      ...(o.avecSensibles ? ['Régime', 'Allergie à signaler', 'Précision allergie', 'Besoin d\'accessibilité', 'Précision accessibilité'] : [])];
    const lignes = trierInvites(liste).map((i) => [i.nom, i.prenom, i.groupe, ...(m.badges ? [i.societe, i.fonction] : []), i.email, rep[i.reponse] || 'En attente', ...(m.enfants ? [i.enfant ? 'Oui' : ''] : []), i.present ? 'Oui' : '',
      ...(m.tables ? [o.table ? o.table(i.tableId) : ''] : []), ...(m.transports ? [o.trajet ? o.trajet(i.allerId) : '', o.trajet ? o.trajet(i.retourId) : ''] : []), ...(m.hebergement ? [o.chambre ? o.chambre(i.chambreId) : ''] : []),
      ...(o.avecSensibles ? [i.regime || 'Non renseigné', i.allergie ? 'Oui' : '', i.allergieDetail || '', i.acces ? 'Oui' : '', i.accesDetail || ''] : [])]);
    return csv([entetes, ...lignes]);
  }
  const estSensible = (i) => Boolean(i.regime || i.allergie || i.allergieDetail || i.acces || i.accesDetail);
  // Efface régime, allergie et accessibilité (cases et précisions) des invités d'un événement ; renvoie le nombre modifié.
  function effacerSensibles(invites, evtId) {
    let n = 0;
    for (const i of invites) {
      if (i.evtId !== evtId || !estSensible(i)) continue;
      Object.assign(i, { regime: '', allergie: false, allergieDetail: '', acces: false, accesDetail: '' });
      n++;
    }
    return n;
  }
  const aSensibles = (invites, evtId) => invites.filter((i) => i.evtId === evtId && estSensible(i)).length;

  // Fiche traiteur : nombres seulement. Repas = séquences de type « repas » du conducteur, triées.
  function traiteur(evt, invites, items, regimes) {
    const s = statsInvites(invites, regimes);
    const repas = programme(items.filter((x) => x.type === 'repas')).map((x) => ({ jour: x.jour, date: ajout(evt.date, x.jour - 1), heure: hm(x.debut), titre: x.titre, lieu: x.lieu || '', couverts: s.couverts }));
    return { couverts: s.couverts, enfants: s.couvertsEnfants, attente: s.attente, oui: s.oui, regimes: Object.entries(s.regimes).filter(([, n]) => n > 0), allergies: s.allergies, acces: s.acces, repas };
  }
  function csvTraiteur(evt, t) {
    return csv([['Événement', evt.nom], ['Lieu', evt.lieu || ''], ['Couverts à prévoir (confirmés + en attente)', t.couverts], ['Dont enfants', t.enfants], ['Dont en attente de réponse', t.attente], [], ['Régime', 'Couverts'],
      ...t.regimes, [], ['Allergies ou intolérances à signaler', t.allergies], ['Les personnes concernées vous contactent directement pour le détail.', ''], [], ['Repas', 'Date', 'Heure', 'Lieu', 'Couverts'],
      ...t.repas.map((r) => [r.titre, dateFr(r.date), r.heure, r.lieu, r.couverts])]);
  }

  // ---------- Plan de table ----------
  function planDeTable(tables, invites) {
    const occ = tables.map((t) => {
      const assis = invites.filter((i) => i.tableId === t.id && concerne(i));
      const n = assis.length;
      return { id: t.id, nom: t.nom, places: t.places, occupees: n, libres: t.places - n, surcapacite: n > t.places, invites: assis.map((i) => i.id) };
    });
    const existe = new Set(tables.map((t) => t.id));
    const aPlacer = trierInvites(invites.filter((i) => concerne(i) && !(i.tableId && existe.has(i.tableId))));
    const nonPlaces = aPlacer.filter((i) => i.reponse === 'oui');
    const declinesPlaces = invites.filter((i) => i.reponse === 'non' && i.tableId && existe.has(i.tableId));
    const alertes = [];
    occ.filter((t) => t.surcapacite).forEach((t) => alertes.push({ type: 'surcapacite', tableId: t.id, texte: `${t.nom} : ${t.occupees} invités pour ${t.places} place${t.places > 1 ? 's' : ''}` }));
    if (nonPlaces.length) alertes.push({ type: 'nonPlaces', texte: `${nonPlaces.length} invité${nonPlaces.length > 1 ? 's' : ''} confirmé${nonPlaces.length > 1 ? 's' : ''} sans table` });
    if (declinesPlaces.length) alertes.push({ type: 'declines', texte: `${declinesPlaces.length} invité${declinesPlaces.length > 1 ? 's' : ''} ayant décliné encore placé${declinesPlaces.length > 1 ? 's' : ''}` });
    return { tables: occ, aPlacer, nonPlaces, declinesPlaces, alertes, places: tables.reduce((s, t) => s + (t.places || 0), 0), occupees: occ.reduce((s, t) => s + t.occupees, 0) };
  }
  // Place un invité sur une table (ou le retire avec tableId = null) ; renvoie une nouvelle liste.
  const placer = (invites, inviteId, tableId) => invites.map((i) => (i.id === inviteId ? { ...i, tableId: tableId || null } : i));

  // ---------- Transports ----------
  // Occupation de chaque trajet par les invités concernés (aller ou retour selon le sens).
  function occupationTrajets(trajets, invites) {
    return trajets.map((t) => {
      const cle = t.sens === 'retour' ? 'retourId' : 'allerId';
      const passagers = trierInvites(invites.filter((p) => concerne(p) && p[cle] === t.id));
      const places = Number(t.places) || 0;
      return { trajet: t, passagers, n: passagers.length, places, libres: places ? places - passagers.length : null, surcharge: places > 0 && passagers.length > places };
    });
  }
  // Concernés sans trajet (« perso » = par ses propres moyens, compte comme réglé ; trajet supprimé = sans trajet).
  function sansTransport(invites, trajets) {
    const ids = new Set(trajets.map((t) => t.id));
    const manque = (v) => v !== 'perso' && !ids.has(v);
    const c = invites.filter(concerne);
    return { aller: trierInvites(c.filter((p) => manque(p.allerId))), retour: trierInvites(c.filter((p) => manque(p.retourId))) };
  }
  // Horaires des trajets face au conducteur : aller qui arrive après la première séquence du jour d'arrivée,
  // retour qui part avant la fin de la dernière séquence du jour de départ. Pauses, temps libre et transferts ignorés.
  const HORS_CONTROLE = ['pause', 'libre', 'transfert'];
  function horairesTrajets(evt, trajets, items) {
    const prog = programme(items.filter((x) => !HORS_CONTROLE.includes(x.type)));
    const res = [];
    for (const t of trajets) {
      if (!estDate(t.date)) continue;
      const jour = ecart(evt.date, t.date) + 1;
      if (jour < 1 || jour > Math.max(1, evt.nbJours || 1)) continue;
      const duJour = prog.filter((x) => x.jour === jour);
      if (!duJour.length) continue;
      if (t.sens !== 'retour') {
        const a = minutes(t.heureArrivee);
        const debut = Math.min(...duJour.map((x) => x.debut));
        if (a !== null && a > debut) res.push({ trajet: t, type: 'arrivee', jour, heure: hm(debut), minutes: a - debut });
      } else {
        const d = minutes(t.heureDepart);
        const fin = Math.max(...duJour.map((x) => x.fin));
        if (d !== null && d < fin) res.push({ trajet: t, type: 'depart', jour, heure: hm(fin), minutes: fin - d });
      }
    }
    return res;
  }

  // ---------- Hébergement ----------
  function occupationChambres(chambres, invites) {
    return chambres.map((c) => {
      const occupants = trierInvites(invites.filter((p) => concerne(p) && p.chambreId === c.id));
      const capacite = Math.max(1, Number(c.capacite) || 1);
      return { chambre: c, occupants, capacite, libres: capacite - occupants.length, surcharge: occupants.length > capacite };
    });
  }
  // Invités concernés qui ont besoin d'une chambre et n'en ont pas (aucun si l'hébergement n'est pas activé).
  function aLoger(evt, invites, chambres) {
    if (!aModule(evt, 'hebergement')) return [];
    const ids = new Set(chambres.map((c) => c.id));
    return trierInvites(invites.filter((p) => concerne(p) && p.hebergement !== false && !ids.has(p.chambreId)));
  }
  // Répartition automatique : les confirmés (oui) à loger remplissent les places libres, dans cet ordre de chambres :
  // une chambre déjà occupée par quelqu'un du même groupe (service, famille…), puis une chambre vide, puis toute place restante.
  // Ceux dont le groupe a déjà une chambre entamée passent d'abord ; ensuite par groupe puis par nom.
  function repartir(evt, invites, chambres) {
    const occ = occupationChambres(chambres, invites);
    const grp = (p) => (p.groupe || '').trim();
    const libres = occ.filter((o) => o.libres > 0).map((o) => ({ id: o.chambre.id, libres: o.libres, groupes: new Set(o.occupants.map(grp)), entamee: o.occupants.length > 0 }));
    const dejaLa = new Set(libres.filter((c) => c.entamee).flatMap((c) => [...c.groupes]));
    const aPlacer = aLoger(evt, invites, chambres).filter((p) => p.reponse === 'oui')
      .sort((a, b) => Number(!dejaLa.has(grp(a))) - Number(!dejaLa.has(grp(b))) || grp(a).localeCompare(grp(b), 'fr') || (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));
    const affectations = {};
    const restants = [];
    for (const p of aPlacer) {
      const s = grp(p);
      const choix = libres.find((c) => c.libres > 0 && c.entamee && c.groupes.has(s))
        || libres.find((c) => c.libres > 0 && !c.entamee)
        || libres.find((c) => c.libres > 0);
      if (!choix) { restants.push(p); continue; }
      affectations[p.id] = choix.id;
      choix.libres--; choix.entamee = true; choix.groupes.add(s);
    }
    return { affectations, restants };
  }

  // ---------- Conducteur (jour J, programme en salles parallèles) ----------
  // Séquences triées (jour, heure) avec début, fin et chevauchement dans le même lieu (sans lieu : entre elles).
  // Deux séquences simultanées dans des lieux différents sont en parallèle : normal.
  function programme(items) {
    const t = items.map((x) => ({ ...x, jour: x.jour || 1, debut: minutes(x.heure) ?? 0 }))
      .sort((a, b) => a.jour - b.jour || a.debut - b.debut || (a.titre || '').localeCompare(b.titre || '', 'fr'));
    const res = t.map((x) => ({ ...x, fin: x.debut + Math.max(0, Number(x.duree) || 0), chevauche: null }));
    const lieu = (x) => (x.lieu || '').trim().toLowerCase();
    for (let i = 0; i < res.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = res[j], b = res[i];
        if (a.jour === b.jour && lieu(a) === lieu(b) && b.debut < a.fin) { b.chevauche = a.id; break; }
      }
    }
    return res;
  }
  // Décale de n minutes la séquence choisie et toutes celles du même jour qui commencent au même moment ou après.
  // Renvoie les nouvelles heures { id: 'HH:MM' } ou une chaîne d'erreur.
  function decaler(items, id, n) {
    const ref = items.find((x) => x.id === id);
    if (!ref || !Number.isInteger(n) || !n) return 'Décalage invalide.';
    const d0 = minutes(ref.heure);
    const jour = ref.jour || 1;
    const res = {};
    for (const x of items) {
      if ((x.jour || 1) !== jour || minutes(x.heure) < d0) continue;
      const d = minutes(x.heure) + n;
      if (d < 0 || d + (Number(x.duree) || 0) > 24 * 60) return 'Le décalage ferait sortir une séquence de la journée.';
      res[x.id] = hm(d);
    }
    return res;
  }
  // Séquences en cours (plusieurs en parallèle possibles) et suivante à une minute donnée d'un jour donné.
  function enCours(items, jour, minute) {
    const c = programme(items).filter((x) => x.jour === jour);
    return { courantes: c.filter((x) => x.debut <= minute && minute < x.fin), suivante: c.find((x) => x.debut > minute) || null };
  }

  // ---------- Synthèse ----------
  const de = (liste, id) => liste.filter((x) => x.evtId === id);
  function resumeEvenement(E, evt, auj, regimes) {
    const taches = de(E.taches, evt.id);
    const st = taches.map((t) => statutTache(t, evt, auj).statut);
    const b = budget(E, evt.id);
    const inv = statsInvites(de(E.invites, evt.id), regimes);
    const ech = echeancier(E, auj, evt.id);
    return {
      jours: ecart(auj, evt.date), rebours: compteRebours(evt, auj), passe: evenementPasse(evt, auj),
      taches: taches.length, faites: st.filter((s) => s === 'faite').length, retard: st.filter((s) => s === 'retard').length, semaine: st.filter((s) => s === 'semaine').length,
      avancement: taches.length ? Math.round((st.filter((s) => s === 'faite').length / taches.length) * 100) : 0,
      budget: b.total, budgetCible: evt.budgetCible || 0, depassements: b.lignes.filter((l) => l.depassement).length, cout: coutParInvite(b.total, inv.oui),
      invites: inv, echeancesRetard: ech.filter((e) => e.etat === 'retard').length, prochaineEcheance: ech[0] || null,
    };
  }
  // Alertes de tous les événements : gravité 0 (rouge) puis 1 (jaune), puis date. Chaque alerte indique la vue
  // (et le volet de l'onglet Invités) où agir. Un événement terminé ne garde que les tâches et paiements en retard,
  // et le rappel d'effacer les données sensibles.
  function alertes(E, auj, regimes) {
    const res = [];
    for (const evt of E.evenements) {
      const add = (gravite, type, vue, d = {}) => res.push({ gravite, type, vue, evt, date: evt.date, ...d });
      const passe = evenementPasse(evt, auj);
      const I = de(E.invites, evt.id);
      const retards = de(E.taches, evt.id).filter((t) => statutTache(t, evt, auj).statut === 'retard');
      if (retards.length) add(0, 'taches', 'retro', { date: retards.map((t) => echeance(t, evt)).sort()[0], n: retards.length });
      for (const e of echeancier(E, auj, evt.id)) {
        if (e.etat === 'avenir' || (passe && e.etat !== 'retard')) continue;
        add(e.etat === 'retard' ? 0 : 1, 'paiement', 'budget', { date: e.echeance.date, contrat: e.contrat, echeance: e.echeance, jours: e.jours });
      }
      if (passe) {
        const n = aSensibles(E.invites, evt.id);
        if (n) add(0, 'sensibles', 'reglages', { n, jours: ecart(finEvenement(evt), auj) });
        continue;
      }
      const b = budget(E, evt.id);
      for (const l of b.lignes.filter((x) => x.depassement)) add(1, 'budget', 'budget', { poste: l.poste, ecart: l.ecart });
      if (evt.budgetCible && b.total.engage > evt.budgetCible) add(0, 'cible', 'budget', { ecart: b.total.engage - evt.budgetCible });
      for (const c of de(E.contrats, evt.id)) {
        const info = infoContrat(c);
        if (info.aPlanifier) add(1, 'planifier', 'budget', { contrat: c, ecart: info.aPlanifier });
      }
      const attente = I.filter((i) => i.reponse === 'attente').length;
      if (attente && estDate(evt.limite)) {
        if (evt.limite < auj) add(0, 'relance', 'invites', { volet: 'liste', n: attente });
        else if (ecart(auj, evt.limite) <= 7) add(1, 'relance-proche', 'invites', { volet: 'liste', n: attente });
      }
      const C = de(E.conducteur, evt.id);
      if (aModule(evt, 'transports')) {
        const T = de(E.trajets, evt.id);
        const sans = sansTransport(I, T);
        if (sans.aller.length) add(sans.aller.some((p) => p.reponse === 'oui') ? 0 : 1, 'sans-aller', 'invites', { volet: 'transports', n: sans.aller.length });
        if (sans.retour.length) add(sans.retour.some((p) => p.reponse === 'oui') ? 0 : 1, 'sans-retour', 'invites', { volet: 'transports', n: sans.retour.length });
        for (const o of occupationTrajets(T, I).filter((x) => x.surcharge)) add(0, 'trajet', 'invites', { volet: 'transports', o });
        for (const h of horairesTrajets(evt, T, C)) add(1, 'horaire', 'invites', { volet: 'transports', h });
      }
      if (aModule(evt, 'hebergement')) {
        const CH = de(E.chambres, evt.id);
        const occ = occupationChambres(CH, I);
        const loger = aLoger(evt, I, CH);
        const libres = occ.reduce((s, o) => s + Math.max(0, o.libres), 0);
        if (loger.length) add(loger.some((p) => p.reponse === 'oui') ? 0 : 1, 'a-loger', 'invites', { volet: 'chambres', n: loger.length, manque: Math.max(0, loger.length - libres) });
        for (const o of occ.filter((x) => x.surcharge)) add(0, 'chambre', 'invites', { volet: 'chambres', o });
      }
      if (aModule(evt, 'tables')) {
        for (const a of planDeTable(de(E.tables, evt.id), I).alertes) add(a.type === 'nonPlaces' ? 1 : 0, 'table', 'invites', { volet: 'tables', texte: a.texte });
      }
      const chev = programme(C).filter((x) => x.chevauche).length;
      if (chev) add(1, 'chevauchement', 'jourj', { n: chev });
    }
    return res.sort((a, b) => a.gravite - b.gravite || a.date.localeCompare(b.date));
  }

  // ---------- Données : normalisation, anciennes versions et copies des templates fusionnés ----------
  const tab = (x) => (Array.isArray(x) ? x : []);
  const texte = (v) => (typeof v === 'string' ? v : '');
  // Pilote événementiel v1 (avant la fusion) : types et catégories d'invités.
  const TYPES_V1 = { seminaire: ['seminaire', ''], salon: ['entreprise', 'salon'], lancement: ['entreprise', 'soiree'], autre: ['entreprise', 'autre'] };
  const CATEGORIES_V1 = { client: 'Client', prospect: 'Prospect', partenaire: 'Partenaire', presse: 'Presse', intervenant: 'Intervenant', collaborateur: 'Collaborateur', vip: 'VIP' };
  const REGIMES_ANCIENS = { 'Autre (voir note)': 'Autre', 'Autre (préciser)': 'Autre' };
  const STATUTS_MARIAGE = { contacter: 'consulte', devis: 'devis', reserve: 'signe', ecarte: 'annule' };
  const STATUTS_SEMINAIRE = { devis: 'devis', engage: 'signe', annule: 'annule' };
  const ROLES_SEMINAIRE = { intervenant: 'Intervenant', organisation: 'Organisation' };

  const etatVide = () => ({ version: 2, structure: '', tutorielVu: false, reglages: { convention: 'TTC' },
    evenements: [], taches: [], postes: [], prestataires: [], contrats: [], invites: [], tables: [], trajets: [], chambres: [], conducteur: [], checklist: [] });

  function normaliserEvenement(e) {
    let type = e.type, format = texte(e.format);
    if (!TYPES.includes(type)) [type, format] = TYPES_V1[type] || ['entreprise', 'autre'];
    const ancien = !e.modules || typeof e.modules !== 'object';
    // Ancien pilote : badges actifs (c'était le seul public), aucune fonction nouvelle imposée.
    const modules = ancien ? { tables: false, transports: false, hebergement: false, badges: true, enfants: false } : { ...modulesParDefaut(type, format, e.nbJours), ...e.modules };
    return { heure: '', lieu: '', client: '', nbJours: 1, budgetCible: 0, notes: '', depart: '', limite: '', ...e, type, format, modules,
      noms: Array.isArray(e.noms) ? [texte(e.noms[0]), texte(e.noms[1])] : ['', ''] };
  }
  function normaliserInvite(i) {
    const v1acces = typeof i.accessibilite === 'string' ? i.accessibilite.trim() : '';
    const groupe = typeof i.groupe === 'string' ? i.groupe : (CATEGORIES_V1[i.categorie] || texte(i.categorie));
    const regime = REGIMES_ANCIENS[i.regime] || texte(i.regime);
    const res = { prenom: '', nom: '', societe: '', fonction: '', email: '', enfant: false, reponse: 'attente', note: '', present: false,
      tableId: null, allerId: '', retourId: '', chambreId: '', hebergement: true, allergie: false, allergieDetail: '', acces: false, accesDetail: '', ...i,
      groupe, regime, acces: Boolean(i.acces || i.accessibilite === true || v1acces), accesDetail: texte(i.accesDetail) || v1acces };
    delete res.categorie; delete res.accessibilite;
    if (!['oui', 'non', 'attente'].includes(res.reponse)) res.reponse = 'attente';
    return res;
  }
  // Tolérant : accepte les données du pilote v1 et toute donnée partielle ; tutorielVu conservé.
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return { ...v, ...d, version: 2, reglages: { ...v.reglages, ...(d.reglages || {}) },
      evenements: tab(d.evenements).filter((e) => e && estDate(e.date)).map(normaliserEvenement),
      taches: tab(d.taches).map((t) => ({ phase: 'cadrage', avant: 0, dateFixe: null, responsable: '', faite: null, note: '', ...t })),
      postes: tab(d.postes).map((p) => ({ prevu: 0, ...p })), prestataires: tab(d.prestataires).map((p) => ({ metier: 'Autre', contact: '', tel: '', email: '', notes: '', ...p })),
      contrats: tab(d.contrats).map((c) => ({ statut: 'consulte', montant: 0, objet: '', documents: '', posteId: null, ...c, echeances: tab(c.echeances) })),
      invites: tab(d.invites).map(normaliserInvite),
      tables: tab(d.tables).map((t) => ({ places: 8, ...t })),
      trajets: tab(d.trajets).map((t) => ({ sens: 'aller', mode: 'train', libelle: '', depart: '', arrivee: '', date: '', heureDepart: '', heureArrivee: '', places: 0, reference: '', ...t })),
      chambres: tab(d.chambres).map((c) => ({ hebergement: '', type: 'individuelle', capacite: 1, note: '', ...c })),
      conducteur: tab(d.conducteur).map((x) => ({ jour: 1, duree: 0, type: '', lieu: '', responsable: '', notes: '', ...x })),
      checklist: tab(d.checklist).map((c) => ({ heure: '', responsable: '', fait: false, ...c })) };
  }

  // Nature d'une copie exportée : 'evenement' (ce template, avant ou après la fusion), 'mariage', 'seminaire', ou null.
  function natureCopie(d) {
    if (!d || typeof d !== 'object') return null;
    if (Array.isArray(d.evenements)) return 'evenement';
    if (Array.isArray(d.seminaires) && Array.isArray(d.participants)) return 'seminaire';
    if (Array.isArray(d.taches) && Array.isArray(d.invites) && ('noms' in d || Array.isArray(d.tables) || Array.isArray(d.jourJ))) return 'mariage';
    return null;
  }
  // Fiche du carnet de prestataires (commune à tous les événements), réutilisée si le nom existe déjà.
  function prestataire(carnet, nom, uid, champs = {}) {
    const n = String(nom || '').trim() || 'Prestataire';
    let p = carnet.find((x) => x.nom.trim().toLowerCase() === n.toLowerCase());
    if (!p) { p = { id: uid(), nom: n, metier: 'Autre', contact: '', tel: '', email: '', notes: '', ...champs }; carnet.push(p); }
    return p;
  }

  // Copie exportée de l'Organisateur de mariage → un événement de type mariage (et ses tables, invités, contrats).
  // carnet : prestataires déjà présents (complétés sur place) ; auj : sert si la copie n'avait pas de date.
  function depuisMariage(d, uid, auj, carnet = []) {
    const noms = Array.isArray(d.noms) ? d.noms.map((n) => String(n || '').trim()).filter(Boolean) : [];
    const date = estDate(d.date) ? d.date : ajout(auj, 365);
    const evt = normaliserEvenement({ id: uid(), nom: noms.length ? `Mariage de ${noms.join(' et ')}` : 'Notre mariage', type: 'mariage', format: '', date, nbJours: 1, lieu: texte(d.lieu),
      budgetCible: Number(d.budgetGlobal) || 0, notes: estDate(d.date) ? '' : 'Date du mariage à fixer : la copie n\'en avait pas.', noms: [texte(d.noms?.[0]), texte(d.noms?.[1])], modules: modulesParDefaut('mariage') });
    const r = { evenements: [evt], taches: [], postes: [], prestataires: carnet, contrats: [], invites: [], tables: [], trajets: [], chambres: [], conducteur: [], checklist: [] };
    for (const t of tab(d.taches)) r.taches.push({ id: uid(), evtId: evt.id, titre: texte(t.titre) || 'Tâche', phase: texte(t.categorie) || 'cadrage', avant: Number(t.avant) || 0, dateFixe: estDate(t.date) ? t.date : null, responsable: '', faite: estDate(t.fait) ? t.fait : null, note: texte(t.note) });
    const postes = new Map();
    for (const p of tab(d.postes)) { const n = { id: uid(), evtId: evt.id, nom: texte(p.nom) || 'Poste', prevu: Number(p.prevu) || 0 }; postes.set(p.id, n.id); r.postes.push(n); }
    for (const p of tab(d.prestataires)) {
      const fiche = prestataire(carnet, p.nom, uid, { notes: texte(p.contact) });
      r.contrats.push({ id: uid(), evtId: evt.id, prestaId: fiche.id, posteId: postes.get(p.posteId) || null, objet: texte(p.note), montant: Number(p.devis) || 0, statut: STATUTS_MARIAGE[p.statut] || 'consulte', documents: '',
        echeances: tab(p.paiements).map((x) => ({ id: uid(), libelle: texte(x.libelle) || 'Paiement', montant: Number(x.montant) || 0, date: estDate(x.echeance) ? x.echeance : null, payeLe: estDate(x.paye) ? x.paye : null })) });
    }
    const groupes = new Map(tab(d.groupes).map((gr) => [gr.id, texte(gr.nom)]));
    const tables = new Map();
    for (const t of tab(d.tables)) { const n = { id: uid(), evtId: evt.id, nom: texte(t.nom) || 'Table', places: Number(t.places) || 8 }; tables.set(t.id, n.id); r.tables.push(n); }
    for (const i of tab(d.invites)) {
      const allergies = texte(i.allergies).trim();
      r.invites.push(normaliserInvite({ id: uid(), evtId: evt.id, prenom: '', nom: texte(i.nom) || 'Invité', groupe: groupes.get(i.groupeId) || '', enfant: Boolean(i.enfant), reponse: i.reponse,
        regime: i.regime === 'Sans restriction' ? '' : texte(i.regime), allergie: Boolean(allergies), allergieDetail: allergies, tableId: tables.get(i.tableId) || null }));
    }
    for (const x of tab(d.jourJ)) r.checklist.push({ id: uid(), evtId: evt.id, libelle: texte(x.titre) || 'Point', heure: texte(x.heure), responsable: texte(x.qui), fait: Boolean(x.fait) });
    return r;
  }

  // Copie exportée du template Séminaire / offsite → un événement de type séminaire par séminaire.
  function depuisSeminaire(d, uid, auj, carnet = []) {
    const r = { evenements: [], taches: [], postes: [], prestataires: carnet, contrats: [], invites: [], tables: [], trajets: [], chambres: [], conducteur: [], checklist: [] };
    const ids = new Map();
    const id = (ancien) => { if (!ids.has(ancien)) ids.set(ancien, uid()); return ids.get(ancien); };
    for (const s of tab(d.seminaires).filter((x) => estDate(x.date))) {
      r.evenements.push(normaliserEvenement({ id: id(s.id), nom: texte(s.nom) || 'Séminaire', type: 'seminaire', format: '', date: s.date, nbJours: Number(s.nbJours) || 1, lieu: texte(s.lieu), depart: texte(s.depart),
        limite: estDate(s.limite) ? s.limite : '', budgetCible: Number(s.budgetCible) || 0, notes: texte(s.notes), modules: modulesParDefaut('seminaire', '', s.nbJours) }));
    }
    const evtIds = new Set(r.evenements.map((e) => e.id));
    const dans = (x) => evtIds.has(ids.get(x.semId));
    for (const t of tab(d.trajets).filter(dans)) r.trajets.push({ ...t, id: id(t.id), evtId: ids.get(t.semId), semId: undefined });
    for (const c of tab(d.chambres).filter(dans)) r.chambres.push({ ...c, id: id(c.id), evtId: ids.get(c.semId), semId: undefined });
    const lien = (v) => (v === 'perso' ? 'perso' : v && ids.has(v) ? ids.get(v) : '');
    for (const p of tab(d.participants).filter(dans)) {
      r.invites.push(normaliserInvite({ id: uid(), evtId: ids.get(p.semId), prenom: texte(p.prenom), nom: texte(p.nom) || 'Participant', groupe: texte(p.service), fonction: ROLES_SEMINAIRE[p.role] || '', email: texte(p.email),
        reponse: p.reponse, hebergement: p.hebergement !== false, allerId: lien(p.allerId), retourId: lien(p.retourId), chambreId: lien(p.chambreId), regime: texte(p.regime), allergie: Boolean(p.allergie), acces: Boolean(p.accessibilite), note: texte(p.note) }));
    }
    for (const x of tab(d.sessions).filter(dans)) r.conducteur.push({ id: uid(), evtId: ids.get(x.semId), jour: Number(x.jour) || 1, heure: texte(x.heure) || '09:00', duree: Number(x.duree) || 0, titre: texte(x.titre) || 'Session', type: texte(x.type), lieu: texte(x.salle), responsable: texte(x.animateur), notes: texte(x.notes) });
    for (const p of tab(d.postes).filter(dans)) r.postes.push({ id: id(p.id), evtId: ids.get(p.semId), nom: texte(p.nom) || 'Poste', prevu: Number(p.prevu) || 0 });
    for (const x of tab(d.depenses).filter(dans)) {
      const fiche = prestataire(carnet, x.fournisseur || 'Fournisseur', uid);
      const montant = Number(x.montant) || 0, paye = Number(x.paye) || 0, statut = STATUTS_SEMINAIRE[x.statut] || 'devis';
      const echeances = [];
      if (paye > 0) echeances.push({ id: uid(), libelle: 'Déjà payé (repris)', montant: paye, date: null, payeLe: auj });
      if (statut === 'signe' && montant > paye && estDate(x.echeance)) echeances.push({ id: uid(), libelle: 'Reste à payer', montant: montant - paye, date: x.echeance, payeLe: null });
      r.contrats.push({ id: uid(), evtId: ids.get(x.semId), prestaId: fiche.id, posteId: x.posteId && ids.has(x.posteId) ? ids.get(x.posteId) : null, objet: texte(x.objet), montant, statut, documents: '', echeances });
    }
    for (const k of ['trajets', 'chambres']) r[k].forEach((x) => { delete x.semId; });
    return r;
  }
  // Ajoute une copie convertie (depuisMariage, depuisSeminaire) aux données ; renvoie le nombre d'événements ajoutés.
  function ajouterImport(E, imp) {
    for (const k of ['evenements', 'taches', 'postes', 'contrats', 'invites', 'tables', 'trajets', 'chambres', 'conducteur', 'checklist']) E[k].push(...imp[k]);
    E.prestataires = imp.prestataires;
    return imp.evenements.length;
  }

  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.EVT = {
    iso, versDate, ajout, ecart, estDate, dateFr, minutes, hm, lireMontant, eur, champMontant, decouper,
    TYPES, MODULES, modulesParDefaut, aModule, cleModele, cleConducteur,
    finEvenement, evenementPasse, nuits, compteRebours, echeance, statutTache, periode, libelleRelatif, tachesDepuisModele, chargeResponsables,
    infoContrat, budget, coutParInvite, echeancier,
    concerne, nomComplet, trierInvites, groupesDe, statsInvites, lireInvitesRapides, pagesBadges, champCsv, csvInvites, estSensible, effacerSensibles, aSensibles, traiteur, csvTraiteur,
    planDeTable, placer, occupationTrajets, sansTransport, horairesTrajets, occupationChambres, aLoger, repartir,
    programme, decaler, enCours, resumeEvenement, alertes,
    etatVide, normaliser, natureCopie, depuisMariage, depuisSeminaire, ajouterImport, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
