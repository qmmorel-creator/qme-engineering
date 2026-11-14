// Règles métier du template séminaire / offsite : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.SMN) et par les tests (outils/templates/seminaire.test.mjs).
// Toute fonction qui dépend du jour reçoit la date « aujourd'hui » en paramètre. Montants en centimes.
// Socle repris du pilote événementiel (templates/evenementiel/regles.js) : dates, montants, conducteur, budget.
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
  // « 1 250,50 € », « 1250.5 », « 12 » → centimes entiers ; vide → 0 ; illisible → null.
  function lireMontant(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
    const s = String(v ?? '').replace(/[\s  €]/g, '').replace(',', '.');
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

  // ---------- Séminaire ----------
  const finSeminaire = (s) => ajout(s.date, Math.max(1, s.nbJours || 1) - 1);
  const nuits = (s) => Math.max(1, s.nbJours || 1) - 1;
  const seminairePasse = (s, auj) => finSeminaire(s) < auj;
  // « J-12 », « Jour 1 », « Jour 2 », « Terminé ».
  function compteRebours(s, auj) {
    const n = ecart(auj, s.date);
    if (n > 0) return `J-${n}`;
    if (auj <= finSeminaire(s)) return `Jour ${1 - n}`;
    return 'Terminé';
  }

  // ---------- Participants ----------
  // Concerné = on prévoit pour lui (transport, chambre, couvert) : oui ou en attente.
  const concerne = (p) => p.reponse === 'oui' || p.reponse === 'attente';
  const nomComplet = (p) => `${p.prenom || ''} ${p.nom || ''}`.trim();
  const trier = (liste) => [...liste].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));

  // Statistiques des réponses et comptage AGRÉGÉ des données sensibles (aucun nom).
  // regimes : liste fermée ; « non renseigné » est compté comme le premier régime (« Sans restriction »).
  function statsParticipants(liste, regimes) {
    const r = { total: liste.length, oui: 0, non: 0, attente: 0, couverts: 0, allergies: 0, accessibilite: 0, regimes: {}, parService: {} };
    const ref = regimes || ['Sans restriction'];
    for (const x of ref) r.regimes[x] = 0;
    for (const p of liste) {
      const rep = ['oui', 'non'].includes(p.reponse) ? p.reponse : 'attente';
      r[rep]++;
      const svc = (p.service || '').trim() || 'Sans service';
      const s = (r.parService[svc] ||= { oui: 0, non: 0, attente: 0, total: 0 });
      s.total++; s[rep]++;
      if (!concerne(p)) continue;
      r.couverts++;
      const reg = ref.includes(p.regime) ? p.regime : ref[0];
      r.regimes[reg]++;
      if (p.allergie) r.allergies++;
      if (p.accessibilite) r.accessibilite++;
    }
    r.tauxReponse = r.total ? Math.round(((r.oui + r.non) / r.total) * 100) : null;
    return r;
  }

  // Fiche traiteur : nombres seulement. Repas = sessions de type « repas » du programme, triées.
  function traiteur(sem, participants, sessions, regimes) {
    const s = statsParticipants(participants, regimes);
    const repas = programme(sessions.filter((x) => x.type === 'repas')).map((x) => ({ jour: x.jour, date: ajout(sem.date, x.jour - 1), heure: hm(x.debut), titre: x.titre, salle: x.salle || '', couverts: s.couverts }));
    return { couverts: s.couverts, attente: s.attente, oui: s.oui, regimes: Object.entries(s.regimes).filter(([, n]) => n > 0), allergies: s.allergies, accessibilite: s.accessibilite, repas };
  }
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n') + '\r\n';
  function csvTraiteur(sem, t) {
    const lignes = [['Séminaire', sem.nom], ['Lieu', sem.lieu || ''], ['Couverts à prévoir (confirmés + en attente)', t.couverts], ['Dont en attente de réponse', t.attente], [], ['Régime', 'Couverts'],
      ...t.regimes, [], ['Allergies ou intolérances à signaler', t.allergies], ['Les personnes concernées vous contactent directement pour le détail.', ''], [], ['Repas', 'Date', 'Heure', 'Lieu', 'Couverts'],
      ...t.repas.map((r) => [r.titre, dateFr(r.date), r.heure, r.salle, r.couverts])];
    return csv(lignes);
  }

  // CSV des participants : données sensibles exclues sauf demande explicite.
  function csvParticipants(liste, o) {
    const rep = { oui: 'Oui', non: 'Non', attente: 'En attente' };
    const entetes = ['Nom', 'Prénom', 'Service', 'E-mail', 'Rôle', 'Réponse', 'Aller', 'Retour', 'Chambre', ...(o.avecSensibles ? ['Régime', 'Allergie à signaler', 'Accessibilité'] : [])];
    const lignes = trier(liste).map((p) => [p.nom, p.prenom, p.service, p.email, o.role(p.role), rep[p.reponse] || 'En attente', o.trajet(p.allerId), o.trajet(p.retourId), o.chambre(p.chambreId),
      ...(o.avecSensibles ? [p.regime || 'Non renseigné', p.allergie ? 'Oui' : '', p.accessibilite ? 'Oui' : ''] : [])]);
    return csv([entetes, ...lignes]);
  }

  // « Prénom Nom ; Service ; e-mail » par ligne (le dernier mot du nom est le nom de famille).
  function lireParticipantsRapides(texte) {
    return String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [personne, service = '', email = ''] = l.split(/[;\t]/).map((s) => s.trim());
      const mots = personne.split(/\s+/).filter(Boolean);
      const nom = mots.length > 1 ? mots.pop() : (mots.pop() || '');
      return { prenom: mots.join(' '), nom, service, email };
    }).filter((x) => x.nom);
  }

  // Efface régime, allergie et accessibilité des participants d'un séminaire ; renvoie le nombre modifié.
  function effacerSensibles(participants, semId) {
    let n = 0;
    for (const p of participants) {
      if (p.semId !== semId || (!p.regime && !p.allergie && !p.accessibilite)) continue;
      p.regime = ''; p.allergie = false; p.accessibilite = false; n++;
    }
    return n;
  }
  const aSensibles = (participants, semId) => participants.filter((p) => p.semId === semId && (p.regime || p.allergie || p.accessibilite)).length;

  // ---------- Transports ----------
  // Occupation de chaque trajet par les participants concernés (aller ou retour selon le sens).
  function occupationTrajets(trajets, participants) {
    return trajets.map((t) => {
      const cle = t.sens === 'retour' ? 'retourId' : 'allerId';
      const passagers = trier(participants.filter((p) => concerne(p) && p[cle] === t.id));
      const places = Number(t.places) || 0;
      return { trajet: t, passagers, n: passagers.length, places, libres: places ? places - passagers.length : null, surcharge: places > 0 && passagers.length > places };
    });
  }
  // Concernés sans trajet (« perso » = par ses propres moyens, compte comme réglé ; trajet supprimé = sans trajet).
  function sansTransport(participants, trajets) {
    const ids = new Set(trajets.map((t) => t.id));
    const manque = (v) => v !== 'perso' && !ids.has(v);
    const c = participants.filter(concerne);
    return { aller: trier(c.filter((p) => manque(p.allerId))), retour: trier(c.filter((p) => manque(p.retourId))) };
  }
  // Horaires des trajets face au programme : aller qui arrive après la première session du jour d'arrivée,
  // retour qui part avant la fin de la dernière session du jour de départ. Pauses, temps libre et transferts ignorés.
  const HORS_CONTROLE = ['pause', 'libre', 'transfert'];
  function horairesTrajets(sem, trajets, sessions) {
    const prog = programme(sessions.filter((x) => !HORS_CONTROLE.includes(x.type)));
    const res = [];
    for (const t of trajets) {
      if (!estDate(t.date)) continue;
      const jour = ecart(sem.date, t.date) + 1;
      if (jour < 1 || jour > Math.max(1, sem.nbJours || 1)) continue;
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
  function occupationChambres(chambres, participants) {
    return chambres.map((c) => {
      const occupants = trier(participants.filter((p) => concerne(p) && p.chambreId === c.id));
      const capacite = Math.max(1, Number(c.capacite) || 1);
      return { chambre: c, occupants, capacite, libres: capacite - occupants.length, surcharge: occupants.length > capacite };
    });
  }
  // Participants concernés qui ont besoin d'une chambre et n'en ont pas (aucun si le séminaire n'a pas de nuit).
  function aLoger(sem, participants, chambres) {
    if (!nuits(sem)) return [];
    const ids = new Set(chambres.map((c) => c.id));
    return trier(participants.filter((p) => concerne(p) && p.hebergement !== false && !ids.has(p.chambreId)));
  }
  // Répartition automatique : les confirmés (oui) à loger remplissent les places libres, dans cet ordre de chambres :
  // une chambre déjà occupée par un collègue du même service, puis une chambre vide, puis toute place restante.
  // Ceux dont le service a déjà une chambre entamée passent d'abord ; ensuite par service puis par nom.
  // Renvoie { affectations: { participantId: chambreId }, restants: [participants sans place] }.
  function repartir(sem, participants, chambres) {
    const occ = occupationChambres(chambres, participants);
    const svc = (p) => (p.service || '').trim();
    const libres = occ.filter((o) => o.libres > 0).map((o) => ({ id: o.chambre.id, libres: o.libres, services: new Set(o.occupants.map(svc)), entamee: o.occupants.length > 0 }));
    const dejaLa = new Set(libres.filter((c) => c.entamee).flatMap((c) => [...c.services]));
    const aPlacer = aLoger(sem, participants, chambres).filter((p) => p.reponse === 'oui')
      .sort((a, b) => Number(!dejaLa.has(svc(a))) - Number(!dejaLa.has(svc(b))) || svc(a).localeCompare(svc(b), 'fr') || (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));
    const affectations = {};
    const restants = [];
    for (const p of aPlacer) {
      const s = svc(p);
      const choix = libres.find((c) => c.libres > 0 && c.entamee && c.services.has(s))
        || libres.find((c) => c.libres > 0 && !c.entamee)
        || libres.find((c) => c.libres > 0);
      if (!choix) { restants.push(p); continue; }
      affectations[p.id] = choix.id;
      choix.libres--; choix.entamee = true; choix.services.add(s);
    }
    return { affectations, restants };
  }

  // ---------- Programme ----------
  // Sessions triées (jour, heure) avec début, fin, chevauchement dans la même salle (sans salle : entre elles).
  function programme(items) {
    const t = items.map((x) => ({ ...x, jour: x.jour || 1, debut: minutes(x.heure) ?? 0 }))
      .sort((a, b) => a.jour - b.jour || a.debut - b.debut || (a.titre || '').localeCompare(b.titre || '', 'fr'));
    const res = t.map((x) => ({ ...x, fin: x.debut + Math.max(0, Number(x.duree) || 0), chevauche: null }));
    const salle = (x) => (x.salle || '').trim().toLowerCase();
    for (let i = 0; i < res.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = res[j], b = res[i];
        if (a.jour === b.jour && salle(a) === salle(b) && b.debut < a.fin) { b.chevauche = a.id; break; }
      }
    }
    return res;
  }
  // Décale de n minutes la session choisie et celles du même jour qui commencent au même moment ou après.
  function decaler(items, id, n) {
    const ref = items.find((x) => x.id === id);
    if (!ref || !Number.isInteger(n) || !n) return 'Décalage invalide.';
    const d0 = minutes(ref.heure);
    const jour = ref.jour || 1;
    const res = {};
    for (const x of items) {
      if ((x.jour || 1) !== jour || minutes(x.heure) < d0) continue;
      const d = minutes(x.heure) + n;
      if (d < 0 || d + (Number(x.duree) || 0) > 24 * 60) return 'Le décalage ferait sortir une session de la journée.';
      res[x.id] = hm(d);
    }
    return res;
  }
  function enCours(items, jour, minute) {
    const c = programme(items).filter((x) => x.jour === jour);
    return { courantes: c.filter((x) => x.debut <= minute && minute < x.fin), suivante: c.find((x) => x.debut > minute) || null };
  }

  // ---------- Budget ----------
  const engageDe = (d) => (d.statut === 'engage' ? d.montant || 0 : 0);
  // Par poste : prévu (saisi), engagé (dépenses engagées), payé (déjà payé, même annulée), reste, écart.
  function budget(E, semId) {
    const postes = E.postes.filter((p) => p.semId === semId);
    const depenses = E.depenses.filter((d) => d.semId === semId);
    const ligne = (poste, liste) => {
      const prevu = poste ? poste.prevu || 0 : 0;
      const engage = liste.reduce((s, d) => s + engageDe(d), 0);
      const paye = liste.reduce((s, d) => s + (d.paye || 0), 0);
      const ecartP = engage - prevu;
      return { poste, prevu, engage, paye, reste: Math.max(engage, paye) - paye, ecart: ecartP, depassement: prevu > 0 && ecartP > 0, nb: liste.length };
    };
    const ids = new Set(postes.map((p) => p.id));
    const lignes = postes.map((p) => ligne(p, depenses.filter((d) => d.posteId === p.id)));
    const orphelines = depenses.filter((d) => !d.posteId || !ids.has(d.posteId));
    const nonAffecte = orphelines.length ? ligne(null, orphelines) : null;
    const tout = [...lignes, ...(nonAffecte ? [nonAffecte] : [])];
    const total = ['prevu', 'engage', 'paye', 'reste'].reduce((o, k) => ({ ...o, [k]: tout.reduce((s, l) => s + l[k], 0) }), {});
    total.ecart = total.engage - total.prevu;
    return { lignes, nonAffecte, total };
  }
  // Coût par participant confirmé, arrondi au centime ; null si aucun confirmé.
  const coutParticipant = (total, nbConfirmes) => (nbConfirmes > 0 ? { prevu: Math.round(total.prevu / nbConfirmes), engage: Math.round(total.engage / nbConfirmes) } : null);
  // Paiements à venir : dépenses engagées avec un reste à payer et une échéance ; retard si passée, proche à 14 jours.
  function paiements(E, auj, semId) {
    const res = [];
    for (const d of E.depenses) {
      if ((semId && d.semId !== semId) || d.statut !== 'engage' || !estDate(d.echeance)) continue;
      const reste = (d.montant || 0) - (d.paye || 0);
      if (reste <= 0) continue;
      const n = ecart(auj, d.echeance);
      res.push({ depense: d, reste, jours: n, etat: n < 0 ? 'retard' : n <= 14 ? 'proche' : 'avenir' });
    }
    return res.sort((a, b) => a.depense.echeance.localeCompare(b.depense.echeance));
  }

  // ---------- Synthèse ----------
  const de = (liste, id) => liste.filter((x) => x.semId === id);
  function resume(E, sem, auj, regimes) {
    const P = de(E.participants, sem.id), T = de(E.trajets, sem.id), C = de(E.chambres, sem.id), S = de(E.sessions, sem.id);
    const stats = statsParticipants(P, regimes);
    const b = budget(E, sem.id);
    const sans = sansTransport(P, T);
    const occC = occupationChambres(C, P);
    return {
      rebours: compteRebours(sem, auj), passe: seminairePasse(sem, auj), nuits: nuits(sem), stats,
      sansAller: sans.aller, sansRetour: sans.retour, trajets: occupationTrajets(T, P), horaires: horairesTrajets(sem, T, S),
      chambres: occC, aLoger: aLoger(sem, P, C), places: occC.reduce((s, o) => s + o.capacite, 0), placesLibres: occC.reduce((s, o) => s + Math.max(0, o.libres), 0),
      programme: programme(S), budget: b, cout: coutParticipant(b.total, stats.oui), paiements: paiements(E, auj, sem.id), sensibles: aSensibles(E.participants, sem.id),
    };
  }
  // Alertes d'un séminaire : gravité 0 (rouge) puis 1 (jaune) ; chaque alerte indique la vue où agir.
  function alertes(E, sem, auj, regimes) {
    const r = resume(E, sem, auj, regimes);
    const res = [];
    const add = (gravite, type, vue, d = {}) => res.push({ gravite, type, vue, ...d });
    if (r.passe) {
      if (r.sensibles) add(0, 'sensibles', 'reglages', { n: r.sensibles, jours: ecart(finSeminaire(sem), auj) });
      for (const p of r.paiements.filter((x) => x.etat === 'retard')) add(0, 'paiement', 'budget', { p });
      return res.sort((a, b) => a.gravite - b.gravite);
    }
    if (sem.limite && sem.limite < auj && r.stats.attente) add(0, 'relance', 'participants', { n: r.stats.attente });
    else if (r.stats.attente && sem.limite && ecart(auj, sem.limite) <= 7) add(1, 'relance-proche', 'participants', { n: r.stats.attente });
    if (r.sansAller.length) add(r.sansAller.some((p) => p.reponse === 'oui') ? 0 : 1, 'sans-aller', 'logistique', { n: r.sansAller.length });
    if (r.sansRetour.length) add(r.sansRetour.some((p) => p.reponse === 'oui') ? 0 : 1, 'sans-retour', 'logistique', { n: r.sansRetour.length });
    if (r.aLoger.length) add(r.aLoger.some((p) => p.reponse === 'oui') ? 0 : 1, 'a-loger', 'hebergement', { n: r.aLoger.length, manque: Math.max(0, r.aLoger.length - r.placesLibres) });
    for (const o of r.chambres.filter((x) => x.surcharge)) add(0, 'chambre', 'hebergement', { o });
    for (const o of r.trajets.filter((x) => x.surcharge)) add(0, 'trajet', 'logistique', { o });
    for (const h of r.horaires) add(1, 'horaire', 'logistique', { h });
    const chev = r.programme.filter((x) => x.chevauche);
    if (chev.length) add(1, 'chevauchement', 'programme', { n: chev.length });
    for (const l of r.budget.lignes.filter((x) => x.depassement)) add(1, 'budget', 'budget', { l });
    if (sem.budgetCible && r.budget.total.engage > sem.budgetCible) add(0, 'cible', 'budget', { ecart: r.budget.total.engage - sem.budgetCible });
    for (const p of r.paiements.filter((x) => x.etat !== 'avenir')) add(p.etat === 'retard' ? 0 : 1, 'paiement', 'budget', { p });
    return res.sort((a, b) => a.gravite - b.gravite);
  }

  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.SMN = {
    iso, versDate, ajout, ecart, estDate, dateFr, minutes, hm, lireMontant, eur, champMontant,
    finSeminaire, nuits, seminairePasse, compteRebours,
    concerne, nomComplet, trier, statsParticipants, traiteur, champCsv, csvTraiteur, csvParticipants, lireParticipantsRapides, effacerSensibles, aSensibles,
    occupationTrajets, sansTransport, horairesTrajets, occupationChambres, aLoger, repartir,
    programme, decaler, enCours, budget, coutParticipant, paiements, resume, alertes, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
