// Bénévoles et planning des créneaux QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.BNV) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ », heures « HH:MM ». Un créneau dont la fin est avant (ou égale à) son début
// passe minuit et finit le lendemain. Les instants sont comptés en minutes depuis le 01/01/1970 (heure locale
// théorique, sans changement d'heure : les durées restent celles affichées sur le planning).
// Les repères de repos et d'heures sont des choix de l'association (Réglages), pas des règles légales.
(function (racine) {
  'use strict';

  const STATUTS_DISPO = ['dispo', 'partiel', 'absent'];
  const LIB_DISPO = { dispo: 'Disponible', partiel: 'Disponible en partie', absent: 'Indisponible', inconnu: 'Sans réponse' };
  const TYPES_CONFLIT = ['double', 'indispo', 'repos', 'jour', 'max', 'competence'];
  const LIB_CONFLIT = { double: 'Double affectation', indispo: 'Indisponible', repos: 'Sans pause', jour: 'Trop d\'heures dans la journée', max: 'Au-delà de son maximum', competence: 'Compétence manquante' };
  const COLLECTIONS = ['competences', 'postes', 'benevoles', 'evenements', 'dispos', 'creneaux', 'affectations'];

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const jourIndex = (s) => { const [a, m, j] = s.split('-').map(Number); return Math.round(Date.UTC(a, m - 1, j) / 86400000); };
  const minutes = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  // Bornes absolues d'un créneau ou d'une plage { date, debut, fin } en minutes.
  function bornes(x) {
    const a = jourIndex(x.date) * 1440 + minutes(x.debut);
    let b = jourIndex(x.date) * 1440 + minutes(x.fin);
    if (b <= a) b += 1440;
    return { a, b };
  }
  const duree = (x) => { const { a, b } = bornes(x); return b - a; };
  const chevauche = (x, y) => { const p = bornes(x), q = bornes(y); return p.a < q.b && q.a < p.b; };
  const couvrePlage = (plage, c) => { const p = bornes(plage), q = bornes(c); return p.a <= q.a && p.b >= q.b; };
  const trierCreneaux = (a, b) => bornes(a).a - bornes(b).a || bornes(a).b - bornes(b).b;
  // « 2 h », « 1 h 30 », « 45 min »
  function heuresTexte(min) {
    const m = Math.round(min);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${deux(r)}` : `${h} h`;
  }
  const heuresDecimales = (min) => Math.round((min / 60) * 100) / 100;
  // « 17,5 », « 17.5 » → 17.5 ; null si vide ou illisible.
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Number(s);
  }

  // ---------- Accès ----------
  const trouver = (etat, coll, id) => etat[coll].find((x) => x.id === id) || null;
  const creneauxEvenement = (etat, evId) => etat.creneaux.filter((c) => c.evenement === evId).sort(trierCreneaux);
  const affectesCreneau = (etat, cid, affs = etat.affectations) => affs.filter((a) => a.creneau === cid);
  // Créneaux d'un bénévole (sur un événement ou sur tous), triés.
  function creneauxDe(etat, bid, evId = null, affs = etat.affectations) {
    const ids = new Set(affs.filter((a) => a.benevole === bid).map((a) => a.creneau));
    return etat.creneaux.filter((c) => ids.has(c.id) && (!evId || c.evenement === evId)).sort(trierCreneaux);
  }
  const dispoDe = (etat, bid, evId) => etat.dispos.find((d) => d.benevole === bid && d.evenement === evId) || null;

  // Disponibilité d'un bénévole pour un créneau : oui, non (indisponible), hors (pas sur ses plages), inconnu.
  function dispoPour(etat, bid, c) {
    const d = dispoDe(etat, bid, c.evenement);
    if (!d) return 'inconnu';
    if (d.statut === 'absent') return 'non';
    if (d.statut === 'dispo') return 'oui';
    return d.plages.some((p) => couvrePlage(p, c)) ? 'oui' : 'hors';
  }

  // ---------- Couverture des créneaux ----------
  function couverture(etat, c, affs = etat.affectations) {
    const affectes = affectesCreneau(etat, c.id, affs).map((a) => a.benevole);
    const n = affectes.length;
    return { creneau: c.id, besoin: c.besoin, affectes, nombre: n, manque: Math.max(0, c.besoin - n), surplus: Math.max(0, n - c.besoin) };
  }
  function bilanEvenement(etat, evId, affs = etat.affectations) {
    const cr = creneauxEvenement(etat, evId);
    let besoin = 0, pourvu = 0, minutesTotal = 0;
    const benevoles = new Set();
    const trous = [];
    for (const c of cr) {
      const v = couverture(etat, c, affs);
      besoin += c.besoin;
      pourvu += Math.min(c.besoin, v.nombre);
      minutesTotal += v.nombre * duree(c);
      v.affectes.forEach((b) => benevoles.add(b));
      if (v.manque > 0) trous.push({ creneau: c, manque: v.manque });
    }
    return { creneaux: cr.length, besoin, pourvu, manque: besoin - pourvu, taux: besoin ? pourvu / besoin : 1, trous, benevoles: benevoles.size, minutes: minutesTotal };
  }

  // ---------- Conflits ----------
  // Pour un bénévole sur un événement : chevauchements, indisponibilité, enchaînement sans pause, trop d'heures
  // dans la journée, au-delà de son maximum pour l'événement, compétence demandée par le poste qu'il n'a pas.
  function conflitsBenevole(etat, bid, evId, affs = etat.affectations) {
    const reg = etat.reglages;
    const b = trouver(etat, 'benevoles', bid);
    const cr = creneauxDe(etat, bid, evId, affs);
    const res = [];
    for (let i = 0; i < cr.length; i++) {
      for (let j = i + 1; j < cr.length; j++) {
        if (chevauche(cr[i], cr[j])) res.push({ type: 'double', benevole: bid, creneaux: [cr[i].id, cr[j].id] });
      }
    }
    for (const c of cr) {
      const d = dispoPour(etat, bid, c);
      if (d === 'non' || d === 'hors') res.push({ type: 'indispo', benevole: bid, creneaux: [c.id], raison: d });
    }
    // Enchaînements : créneaux séparés de moins de reposMin minutes (ou qui se chevauchent) mis bout à bout.
    if (reg.maxContinu > 0 && cr.length) {
      let chaine = [cr[0]], fin = bornes(cr[0]).b, debut = bornes(cr[0]).a;
      const clore = () => { if (fin - debut > reg.maxContinu * 60 && chaine.length > 1) res.push({ type: 'repos', benevole: bid, creneaux: chaine.map((c) => c.id), minutes: fin - debut }); };
      for (const c of cr.slice(1)) {
        const { a, b: z } = bornes(c);
        if (a - fin < reg.reposMin) { chaine.push(c); fin = Math.max(fin, z); } else { clore(); chaine = [c]; debut = a; fin = z; }
      }
      clore();
    }
    if (reg.maxJour > 0) {
      const parJour = new Map();
      for (const c of cr) { const l = parJour.get(c.date) || []; l.push(c); parJour.set(c.date, l); }
      for (const [date, l] of parJour) {
        const m = l.reduce((s, c) => s + duree(c), 0);
        if (m > reg.maxJour * 60) res.push({ type: 'jour', benevole: bid, creneaux: l.map((c) => c.id), date, minutes: m });
      }
    }
    const d = dispoDe(etat, bid, evId);
    if (d && d.maxHeures > 0) {
      const m = cr.reduce((s, c) => s + duree(c), 0);
      if (m > d.maxHeures * 60) res.push({ type: 'max', benevole: bid, creneaux: cr.map((c) => c.id), minutes: m, maxHeures: d.maxHeures });
    }
    if (b) {
      for (const c of cr) {
        const p = trouver(etat, 'postes', c.poste);
        if (p?.competence && !b.competences.includes(p.competence)) res.push({ type: 'competence', benevole: bid, creneaux: [c.id], competence: p.competence });
      }
    }
    return res;
  }
  function conflits(etat, evId, affs = etat.affectations) {
    const ids = new Set(creneauxEvenement(etat, evId).map((c) => c.id));
    const bids = [...new Set(affs.filter((a) => ids.has(a.creneau)).map((a) => a.benevole))];
    return bids.flatMap((bid) => conflitsBenevole(etat, bid, evId, affs))
      .sort((x, y) => TYPES_CONFLIT.indexOf(x.type) - TYPES_CONFLIT.indexOf(y.type));
  }
  // Créneaux touchés par un conflit : id → types.
  function creneauxEnConflit(liste) {
    const m = new Map();
    for (const x of liste) for (const c of x.creneaux) { const k = `${c}|${x.benevole}`; m.set(k, [...(m.get(k) || []), x.type]); }
    return m;
  }

  // ---------- Heures ----------
  function heuresBenevole(etat, bid, { evenement = null, annee = null, depuis = null } = {}) {
    return creneauxDe(etat, bid, evenement).filter((c) => (!annee || c.date.startsWith(String(annee))) && (!depuis || c.date >= depuis)).reduce((s, c) => s + duree(c), 0);
  }

  // ---------- Suggestions ----------
  // Pour un créneau : chaque bénévole (non effacé, pas déjà sur ce créneau) avec ce qui l'empêche (bloquant)
  // ou ce qui mérite réflexion (réserves). Sans réserve : suggéré. Classement : poste préféré, puis le moins
  // d'heures sur l'événement (équité), puis le moins d'heures sur les 12 derniers mois.
  function candidats(etat, cid, { affectations = etat.affectations, aujourdhui = null } = {}) {
    const c = trouver(etat, 'creneaux', cid);
    if (!c) return [];
    const p = trouver(etat, 'postes', c.poste);
    const deja = new Set(affectesCreneau(etat, cid, affectations).map((a) => a.benevole));
    const depuis = aujourdhui ? ajout(aujourdhui, -365) : null;
    const res = [];
    for (const b of etat.benevoles) {
      if (b.efface || deja.has(b.id)) continue;
      const bloquant = [], reserves = [];
      const d = dispoPour(etat, b.id, c);
      if (d === 'non') bloquant.push('indisponible');
      else if (d === 'hors') bloquant.push('pas sur ses plages');
      else if (d === 'inconnu') reserves.push('sans réponse');
      const siens = creneauxDe(etat, b.id, c.evenement, affectations);
      if (siens.some((x) => chevauche(x, c))) bloquant.push('déjà sur un créneau à la même heure');
      const essai = [...affectations, { id: '_essai', creneau: cid, benevole: b.id }];
      const nouveaux = conflitsBenevole(etat, b.id, c.evenement, essai).filter((x) => x.creneaux.includes(cid));
      if (nouveaux.some((x) => x.type === 'repos')) reserves.push('pas de pause');
      if (nouveaux.some((x) => x.type === 'jour')) reserves.push('trop d\'heures ce jour-là');
      if (nouveaux.some((x) => x.type === 'max')) reserves.push('au-delà de son maximum');
      if (p?.competence && !b.competences.includes(p.competence)) reserves.push('sans la compétence demandée');
      if (b.evites.includes(c.poste)) reserves.push('préfère éviter ce poste');
      const heuresEv = siens.reduce((s, x) => s + duree(x), 0);
      res.push({ benevole: b.id, dispo: d, bloquant, reserves, ok: !bloquant.length && !reserves.length, prefere: b.preferes.includes(c.poste), competence: !!p?.competence && b.competences.includes(p.competence), heuresEv, heuresAn: heuresBenevole(etat, b.id, { depuis }), prenom: b.prenom });
    }
    const rang = (x) => (x.bloquant.length ? 2 : x.reserves.length ? 1 : 0);
    return res.sort((x, y) => rang(x) - rang(y) || Number(y.prefere) - Number(x.prefere) || Number(y.competence) - Number(x.competence) || x.heuresEv - y.heuresEv || x.heuresAn - y.heuresAn || x.prenom.localeCompare(y.prenom));
  }
  // Candidats retenus par la suggestion automatique : sans réserve, ou « sans réponse » seul si le réglage le permet.
  const retenu = (x, sansReponse) => !x.bloquant.length && (x.ok || (sansReponse && x.reserves.length === 1 && x.reserves[0] === 'sans réponse'));

  // Remplissage automatique des trous d'un événement, sans rien modifier : renvoie les affectations à ajouter.
  // À chaque tour, le créneau qui a le moins de candidats possibles passe en premier (le plus difficile à
  // pourvoir), et reçoit le premier candidat du classement (préférence, équité).
  function remplir(etat, evId, { aujourdhui = null, par = '', le = null, ids = null } = {}) {
    const sansReponse = !!etat.reglages.sansReponse;
    const affs = [...etat.affectations];
    const ajouts = [];
    const cr = creneauxEvenement(etat, evId);
    let n = 0;
    for (let tour = 0; tour < 2000; tour++) {
      let meilleur = null;
      for (const c of cr) {
        if (couverture(etat, c, affs).manque <= 0) continue;
        const liste = candidats(etat, c.id, { affectations: affs, aujourdhui }).filter((x) => retenu(x, sansReponse));
        if (!liste.length) continue;
        if (!meilleur || liste.length < meilleur.liste.length) meilleur = { c, liste };
      }
      if (!meilleur) break;
      const a = { id: ids ? ids() : `auto${n++}`, creneau: meilleur.c.id, benevole: meilleur.liste[0].benevole, par, le, auto: true };
      affs.push(a); ajouts.push(a);
    }
    const reste = cr.reduce((s, c) => s + couverture(etat, c, affs).manque, 0);
    return { ajouts, reste };
  }

  // ---------- Plannings imprimables ----------
  function parPoste(etat, evId) {
    const jours = new Map();
    for (const c of creneauxEvenement(etat, evId)) {
      if (!jours.has(c.date)) jours.set(c.date, new Map());
      const m = jours.get(c.date);
      if (!m.has(c.poste)) m.set(c.poste, []);
      m.get(c.poste).push({ ...couverture(etat, c), creneau: c });
    }
    const ordrePoste = (id) => etat.postes.findIndex((p) => p.id === id);
    return [...jours.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, m]) => ({ date, postes: [...m.entries()].sort(([a], [b]) => ordrePoste(a) - ordrePoste(b)).map(([poste, creneaux]) => ({ poste, creneaux })) }));
  }
  function parPersonne(etat, evId) {
    const ids = new Set(creneauxEvenement(etat, evId).map((c) => c.id));
    const bids = [...new Set(etat.affectations.filter((a) => ids.has(a.creneau)).map((a) => a.benevole))];
    return bids.map((bid) => ({ benevole: bid, creneaux: creneauxDe(etat, bid, evId), minutes: heuresBenevole(etat, bid, { evenement: evId }) }))
      .sort((x, y) => (trouver(etat, 'benevoles', x.benevole)?.prenom || '').localeCompare(trouver(etat, 'benevoles', y.benevole)?.prenom || ''));
  }

  // ---------- Message à copier ----------
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateTexte = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`; };
  const heureTexte = (hm) => hm.replace(':', ' h ').replace(/ h 00$/, ' h');
  function datesEvenement(ev) {
    if (!ev.fin || ev.fin === ev.debut) return dateTexte(ev.debut);
    return `du ${dateTexte(ev.debut)} au ${dateTexte(ev.fin)}`;
  }
  function message(etat, bid, evId, modele) {
    const b = trouver(etat, 'benevoles', bid), ev = trouver(etat, 'evenements', evId);
    if (!b || !ev) return '';
    const cr = creneauxDe(etat, bid, evId);
    const lignes = cr.map((c) => {
      const p = trouver(etat, 'postes', c.poste);
      return `- ${dateTexte(c.date)}, ${heureTexte(c.debut)} à ${heureTexte(c.fin)} : ${p?.nom || 'Poste'}${p?.consigne ? ` (${p.consigne})` : ''}`;
    }).join('\n') || '- aucun créneau pour l\'instant';
    const reg = etat.reglages;
    const valeurs = {
      prenom: b.prenom, evenement: ev.nom, lieu: ev.lieu || 'lieu à préciser', dates: datesEvenement(ev), creneaux: lignes,
      total: heuresTexte(cr.reduce((s, c) => s + duree(c), 0)), contact: ev.responsable || reg.contact || 'le responsable des bénévoles',
      signature: reg.signature || etat.association || '', consignes: ev.consignes ? `\n${ev.consignes}\n` : '',
    };
    const texte = String(modele || '').replace(/\{(\w+)\}/g, (m, k) => (k in valeurs ? valeurs[k] : m));
    return texte.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- Statistiques ----------
  function statistiques(etat, { annee = null, evenement = null } = {}) {
    const garder = (c) => (!evenement || c.evenement === evenement) && (!annee || c.date.startsWith(String(annee)));
    const cr = etat.creneaux.filter(garder);
    const ids = new Set(cr.map((c) => c.id));
    const parB = new Map(), parP = new Map();
    for (const a of etat.affectations) {
      if (!ids.has(a.creneau)) continue;
      const c = cr.find((x) => x.id === a.creneau);
      const m = duree(c);
      const x = parB.get(a.benevole) || { benevole: a.benevole, minutes: 0, creneaux: 0, evenements: new Set() };
      x.minutes += m; x.creneaux += 1; x.evenements.add(c.evenement); parB.set(a.benevole, x);
      const y = parP.get(c.poste) || { poste: c.poste, minutes: 0, creneaux: 0 };
      y.minutes += m; y.creneaux += 1; parP.set(c.poste, y);
    }
    const benevoles = [...parB.values()].map((x) => ({ ...x, evenements: x.evenements.size })).sort((a, b) => b.minutes - a.minutes);
    const postes = [...parP.values()].sort((a, b) => b.minutes - a.minutes);
    const total = benevoles.reduce((s, x) => s + x.minutes, 0);
    const besoin = cr.reduce((s, c) => s + c.besoin, 0);
    const pourvu = cr.reduce((s, c) => s + Math.min(c.besoin, couverture(etat, c).nombre), 0);
    const actifs = benevoles.length;
    // Part des heures faite par le quart le plus investi (repère d'équité : plus c'est haut, plus la charge repose sur peu de monde).
    const quart = Math.max(1, Math.ceil(actifs / 4));
    const partQuart = total ? benevoles.slice(0, quart).reduce((s, x) => s + x.minutes, 0) / total : 0;
    return { benevoles, postes, total, actifs, besoin, pourvu, taux: besoin ? pourvu / besoin : 1, moyenne: actifs ? total / actifs : 0, partQuart, evenements: new Set(cr.map((c) => c.evenement)).size };
  }

  // ---------- Événements ----------
  // Créneaux tirés d'un modèle de la base : posteIds = { nomDuPoste: id }. Jour -1 = la veille du début.
  function creneauxDepuisModele(modele, ev, posteIds, ids) {
    return modele.creneaux.filter(([nom]) => posteIds[nom]).map(([nom, j, debut, fin, besoin]) => normaliserCreneau({ id: ids(), evenement: ev.id, poste: posteIds[nom], date: ajout(ev.debut, j), debut, fin, besoin }));
  }
  // Copie d'un événement à une autre date (l'année suivante) : postes et créneaux décalés, sans affectations ni réponses.
  function dupliquerEvenement(etat, evId, debut, ids, nom = null) {
    const ev = trouver(etat, 'evenements', evId);
    if (!ev || !estDate(debut)) return null;
    const dec = ecart(ev.debut, debut);
    const nouvel = normaliserEvenement({ ...ev, id: ids(), nom: nom || ev.nom, debut, fin: ev.fin ? ajout(ev.fin, dec) : null });
    const creneaux = creneauxEvenement(etat, evId).map((c) => normaliserCreneau({ ...c, id: ids(), evenement: nouvel.id, date: ajout(c.date, dec) }));
    return { evenement: nouvel, creneaux };
  }
  // Supprimer un événement retire ses créneaux, leurs affectations et les réponses des bénévoles.
  function supprimerEvenement(etat, evId) {
    const e = JSON.parse(JSON.stringify(etat));
    const ids = new Set(e.creneaux.filter((c) => c.evenement === evId).map((c) => c.id));
    e.evenements = e.evenements.filter((x) => x.id !== evId);
    e.creneaux = e.creneaux.filter((c) => c.evenement !== evId);
    e.affectations = e.affectations.filter((a) => !ids.has(a.creneau));
    e.dispos = e.dispos.filter((d) => d.evenement !== evId);
    return e;
  }

  // ---------- Fusion des saisies de plusieurs responsables ----------
  // base : dernier état reçu du serveur ; local : état modifié sur cet appareil ; serveur : version plus récente
  // écrite par un autre appareil. Par élément : ajouté, modifié ou supprimé ici l'emporte ; le reste vient du
  // serveur. Deux responsables qui affectent la même personne au même moment : les deux affectations restent
  // et apparaissent en conflit (double affectation) ; la même affectation saisie deux fois n'est gardée qu'une fois.
  function fusionner(base, local, serveur) {
    const res = JSON.parse(JSON.stringify(serveur));
    const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const c of COLLECTIONS) {
      const B = new Map((base?.[c] || []).map((x) => [x.id, x]));
      const L = new Map((local?.[c] || []).map((x) => [x.id, x]));
      let liste = res[c] || [];
      for (const [id, x] of L) {
        if (!B.has(id) || !meme(B.get(id), x)) {
          const i = liste.findIndex((y) => y.id === id);
          if (i >= 0) liste[i] = JSON.parse(JSON.stringify(x)); else liste.push(JSON.parse(JSON.stringify(x)));
        }
      }
      for (const id of B.keys()) if (!L.has(id)) liste = liste.filter((y) => y.id !== id);
      res[c] = liste;
    }
    for (const k of ['association', 'reglages', 'message']) if (!meme(base?.[k], local?.[k])) res[k] = JSON.parse(JSON.stringify(local[k]));
    return res;
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const present = (v) => v !== '' && v !== null && v !== undefined;
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && present(v) ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const decimal = (v, mini, maxi, defaut) => { const n = Number(v); return Number.isFinite(n) && present(v) ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const heure = (v, d) => (estHeure(v) ? v : d);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const ids = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => texte(x, 40)).filter(Boolean))] : []);

  const normaliserCompetence = (x) => ({ id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 50) || 'Compétence' });
  const normaliserPoste = (x, i = 0, nb = 7) => ({
    id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 60) || 'Poste', famille: texte(x?.famille, 30), couleur: entier(x?.couleur, 0, nb - 1, i % nb),
    competence: texte(x?.competence, 40), consigne: texte(x?.consigne, 240),
  });
  const normaliserBenevole = (x) => ({
    id: texte(x?.id, 40) || nouvelId(), prenom: texte(x?.prenom, 40), nom: texte(x?.nom, 60), telephone: texte(x?.telephone, 30), email: texte(x?.email, 80),
    competences: ids(x?.competences), preferes: ids(x?.preferes), evites: ids(x?.evites), note: texte(x?.note, 200),
    ajouteLe: dateOuNull(x?.ajouteLe), efface: !!x?.efface,
  });
  function normaliserEvenement(x) {
    const debut = dateOuNull(x?.debut) || '2026-06-01';
    let fin = dateOuNull(x?.fin) || debut;
    if (fin < debut) fin = debut;
    return { id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 80) || 'Événement', lieu: texte(x?.lieu, 80), debut, fin, responsable: texte(x?.responsable, 80), consignes: texte(x?.consignes, 400), note: texte(x?.note, 200) };
  }
  function normaliserPlage(x) {
    return { date: dateOuNull(x?.date) || '2026-06-01', debut: heure(x?.debut, '08:00'), fin: heure(x?.fin, '18:00') };
  }
  const normaliserDispo = (x) => ({
    id: texte(x?.id, 40) || nouvelId(), benevole: texte(x?.benevole, 40), evenement: texte(x?.evenement, 40),
    statut: STATUTS_DISPO.includes(x?.statut) ? x.statut : 'dispo', plages: (Array.isArray(x?.plages) ? x.plages : []).slice(0, 20).map(normaliserPlage),
    maxHeures: x?.maxHeures === null || x?.maxHeures === undefined || x?.maxHeures === '' ? null : decimal(x.maxHeures, 0, 72, null), note: texte(x?.note, 120),
  });
  const normaliserCreneau = (x) => ({
    id: texte(x?.id, 40) || nouvelId(), evenement: texte(x?.evenement, 40), poste: texte(x?.poste, 40), date: dateOuNull(x?.date) || '2026-06-01',
    debut: heure(x?.debut, '09:00'), fin: heure(x?.fin, '12:00'), besoin: entier(x?.besoin, 0, 200, 1), note: texte(x?.note, 120),
  });
  const normaliserAffectation = (x) => ({ id: texte(x?.id, 40) || nouvelId(), creneau: texte(x?.creneau, 40), benevole: texte(x?.benevole, 40), par: texte(x?.par, 40), le: dateOuNull(x?.le), auto: !!x?.auto });
  function normaliserReglages(r, dv) {
    r = r || {};
    return {
      reposMin: entier(r.reposMin, 0, 240, dv.reposMin), maxContinu: decimal(r.maxContinu, 0, 24, dv.maxContinu), maxJour: decimal(r.maxJour, 0, 24, dv.maxJour),
      sansReponse: typeof r.sansReponse === 'boolean' ? r.sansReponse : dv.sansReponse, conservationMois: entier(r.conservationMois, 1, 120, dv.conservationMois),
      contact: texte(r.contact ?? dv.contact, 120), signature: texte(r.signature ?? dv.signature, 120),
    };
  }
  const DV = { reposMin: 30, maxContinu: 4, maxJour: 8, sansReponse: false, conservationMois: 24, contact: '', signature: '' };
  function etatVide(defauts = {}) {
    const dv = { ...DV, ...JSON.parse(JSON.stringify(defauts.reglages || {})) };
    return { version: 1, association: '', message: defauts.message || '', reglages: normaliserReglages(dv, dv), competences: [], postes: [], benevoles: [], evenements: [], dispos: [], creneaux: [], affectations: [] };
  }
  function normaliser(d, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const nb = (defauts.couleurs || []).length || 7;
    const liste = (k, f) => (Array.isArray(d[k]) ? d[k] : []).map(f);
    const e = {
      ...v, ...d,
      association: texte(d.association, 80), message: typeof d.message === 'string' && d.message.trim() ? d.message.slice(0, 2000) : v.message,
      reglages: normaliserReglages(d.reglages, v.reglages),
      competences: liste('competences', normaliserCompetence), postes: liste('postes', (x, i) => normaliserPoste(x, i, nb)), benevoles: liste('benevoles', normaliserBenevole),
      evenements: liste('evenements', normaliserEvenement), dispos: liste('dispos', normaliserDispo), creneaux: liste('creneaux', normaliserCreneau), affectations: liste('affectations', normaliserAffectation),
    };
    // Une seule réponse par bénévole et par événement, une seule affectation par bénévole et par créneau.
    const vus = new Set();
    e.dispos = e.dispos.filter((x) => { const k = `${x.benevole}|${x.evenement}`; if (vus.has(k)) return false; vus.add(k); return true; });
    const cr = new Set(e.creneaux.map((c) => c.id)), bn = new Set(e.benevoles.map((b) => b.id));
    const vus2 = new Set();
    e.affectations = e.affectations.filter((a) => { const k = `${a.benevole}|${a.creneau}`; if (vus2.has(k) || !cr.has(a.creneau) || !bn.has(a.benevole)) return false; vus2.add(k); return true; });
    return e;
  }

  // ---------- RGPD ----------
  // Effacement : prénom remplacé, nom, coordonnées, préférences et note vidés ; affectations gardées pour que les
  // heures des événements passés restent justes. Suppression : le bénévole, ses réponses et ses affectations retirés.
  function effacerBenevole(etat, id, rang = 1) {
    const e = JSON.parse(JSON.stringify(etat));
    const b = e.benevoles.find((x) => x.id === id);
    if (!b) return e;
    Object.assign(b, { prenom: 'Bénévole', nom: `effacé ${rang}`, telephone: '', email: '', note: '', competences: [], preferes: [], evites: [], efface: true });
    e.dispos = e.dispos.filter((d) => d.benevole !== id);
    return e;
  }
  function supprimerBenevole(etat, id) {
    const e = JSON.parse(JSON.stringify(etat));
    e.benevoles = e.benevoles.filter((b) => b.id !== id);
    e.dispos = e.dispos.filter((d) => d.benevole !== id);
    e.affectations = e.affectations.filter((a) => a.benevole !== id);
    return e;
  }
  // Données d'un bénévole (droit d'accès, art. 15).
  function donneesBenevole(etat, id, auj) {
    const b = trouver(etat, 'benevoles', id);
    if (!b) return null;
    const nomC = (c) => trouver(etat, 'competences', c)?.nom || c;
    const nomP = (p) => trouver(etat, 'postes', p)?.nom || p;
    const nomE = (ev) => trouver(etat, 'evenements', ev)?.nom || '';
    return {
      exporteLe: auj,
      benevole: { prenom: b.prenom, nom: b.nom, telephone: b.telephone, email: b.email, competences: b.competences.map(nomC), postesPreferes: b.preferes.map(nomP), postesAEviter: b.evites.map(nomP), note: b.note, ajouteLe: b.ajouteLe },
      disponibilites: etat.dispos.filter((d) => d.benevole === id).map((d) => ({ evenement: nomE(d.evenement), statut: LIB_DISPO[d.statut], plages: d.plages, maxHeures: d.maxHeures, note: d.note })),
      creneaux: creneauxDe(etat, id).map((c) => ({ evenement: nomE(c.evenement), poste: nomP(c.poste), date: c.date, debut: c.debut, fin: c.fin })),
    };
  }
  // Bénévoles sans aucun créneau depuis « mois » mois (ni à venir), et ajoutés avant : à effacer selon la durée
  // choisie par l'association.
  function inactifs(etat, auj, mois) {
    const d = new Date(versDate(auj)); d.setMonth(d.getMonth() - mois);
    const limite = iso(d);
    return etat.benevoles.filter((b) => !b.efface && (!b.ajouteLe || b.ajouteLe < limite) && !creneauxDe(etat, b.id).some((c) => c.date >= limite));
  }

  // ---------- Exports CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const versCsv = (tete, lignes) => '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nb = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  function planningCsv(etat, evId) {
    const lignes = [];
    for (const c of creneauxEvenement(etat, evId)) {
      const p = trouver(etat, 'postes', c.poste);
      const v = couverture(etat, c);
      const noms = v.affectes.map((bid) => trouver(etat, 'benevoles', bid));
      for (const b of noms) lignes.push([c.date, c.debut, c.fin, p?.nom || '', c.besoin, b.prenom, b.nom, b.telephone]);
      for (let i = 0; i < v.manque; i++) lignes.push([c.date, c.debut, c.fin, p?.nom || '', c.besoin, 'À pourvoir', '', '']);
    }
    return versCsv(['Date', 'Début', 'Fin', 'Poste', 'Besoin', 'Prénom', 'Nom', 'Téléphone'], lignes);
  }
  function heuresCsv(etat, filtre = {}) {
    const s = statistiques(etat, filtre);
    return versCsv(['Prénom', 'Nom', 'Créneaux', 'Événements', 'Heures'], s.benevoles.map((x) => { const b = trouver(etat, 'benevoles', x.benevole); return [b?.prenom || '', b?.nom || '', x.creneaux, x.evenements, nb(x.minutes / 60)]; }));
  }
  function annuaireCsv(etat) {
    const nomC = (c) => trouver(etat, 'competences', c)?.nom || '';
    const nomP = (p) => trouver(etat, 'postes', p)?.nom || '';
    return versCsv(['Prénom', 'Nom', 'Téléphone', 'E-mail', 'Compétences', 'Postes préférés', 'Note'], etat.benevoles.filter((b) => !b.efface).map((b) => [b.prenom, b.nom, b.telephone, b.email, b.competences.map(nomC).join(', '), b.preferes.map(nomP).join(', '), b.note]));
  }

  racine.BNV = {
    STATUTS_DISPO, LIB_DISPO, TYPES_CONFLIT, LIB_CONFLIT, COLLECTIONS,
    iso, versDate, ajout, ecart, estDate, estHeure, minutes, bornes, duree, chevauche, couvrePlage, trierCreneaux, heuresTexte, heuresDecimales, lireNombre, dateTexte, heureTexte, datesEvenement,
    trouver, creneauxEvenement, affectesCreneau, creneauxDe, dispoDe, dispoPour, couverture, bilanEvenement,
    conflitsBenevole, conflits, creneauxEnConflit, heuresBenevole, candidats, retenu, remplir, parPoste, parPersonne, message, statistiques,
    creneauxDepuisModele, dupliquerEvenement, supprimerEvenement, fusionner,
    nouvelId, normaliserCompetence, normaliserPoste, normaliserBenevole, normaliserEvenement, normaliserPlage, normaliserDispo, normaliserCreneau, normaliserAffectation, normaliserReglages, etatVide, normaliser,
    effacerBenevole, supprimerBenevole, donneesBenevole, inactifs, planningCsv, heuresCsv, annuaireCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
