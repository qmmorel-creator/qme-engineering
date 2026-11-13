// Règles métier du pilote événementiel : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.EVT) et par les tests (outils/templates/evenementiel.test.mjs).
// Toute fonction qui dépend du jour reçoit la date « aujourd'hui » en paramètre. Montants en centimes.
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

  // ---------- Montants ----------
  // « 1 250,50 € », « 1250.5 », « 12 » → centimes entiers ; vide → 0 ; illisible → null.
  function lireMontant(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
    const s = String(v ?? '').replace(/[\s  €]/g, '').replace(',', '.');
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
  // Valeur à afficher dans un champ de saisie (« 1250,5 »).
  const champMontant = (c) => (c || c === 0 ? String(c / 100).replace('.', ',') : '');
  // Découpe un montant en acompte (pourcentage saisi) et solde ; le reste de l'arrondi va au solde.
  function decouper(montant, pct) {
    if (!(pct > 0 && pct < 100)) return null;
    const acompte = Math.round((montant * pct) / 100);
    return [acompte, montant - acompte];
  }

  // ---------- Événements ----------
  const finEvenement = (evt) => ajout(evt.date, Math.max(1, evt.nbJours || 1) - 1);
  const evenementPasse = (evt, auj) => finEvenement(evt) < auj;
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

  // Tâches d'un modèle [titre, phase, avant] pour un événement.
  // mode pour les échéances déjà passées : 'garder' (en retard), 'aujourdhui' (date fixe = auj), 'ignorer'.
  // Les titres déjà présents dans l'événement ne sont pas dupliqués.
  function tachesDepuisModele(lignes, evt, auj, mode, existantes, uid) {
    const deja = new Set((existantes || []).filter((t) => t.evtId === evt.id).map((t) => t.titre.trim().toLowerCase()));
    const res = [];
    let passees = 0;
    for (const [titre, phase, avant] of lignes) {
      if (deja.has(titre.toLowerCase())) continue;
      const e = ajout(evt.date, -avant);
      const passee = e < auj;
      if (passee) passees++;
      if (passee && mode === 'ignorer') continue;
      res.push({ id: uid(), evtId: evt.id, titre, phase, avant, dateFixe: passee && mode === 'aujourdhui' ? auj : null, responsable: '', faite: null, note: '' });
    }
    return { taches: res, passees };
  }

  // Tâches ouvertes et en retard par responsable (tous événements à venir ou de l'événement donné).
  function chargeResponsables(E, auj, evtId) {
    const evts = new Map(E.evenements.map((e) => [e.id, e]));
    const m = new Map();
    for (const t of E.taches) {
      const evt = evts.get(t.evtId);
      if (!evt || t.faite || (evtId && t.evtId !== evtId)) continue;
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
  function statsInvites(liste, regimes) {
    const r = { total: liste.length, oui: 0, non: 0, attente: 0, presents: 0, parCategorie: {}, regimes: {}, accessibilite: [] };
    for (const i of liste) {
      r[i.reponse in r ? i.reponse : 'attente']++;
      if (i.present) r.presents++;
      const c = (r.parCategorie[i.categorie] ||= { oui: 0, non: 0, attente: 0, total: 0 });
      c.total++; c[i.reponse in c ? i.reponse : 'attente']++;
      if (i.reponse !== 'non') {
        const reg = i.regime || (regimes ? regimes[0] : 'Sans restriction');
        r.regimes[reg] = (r.regimes[reg] || 0) + 1;
        if ((i.accessibilite || '').trim()) r.accessibilite.push(i);
      }
    }
    r.couverts = r.oui + r.attente;
    r.tauxPresence = r.oui ? Math.round((r.presents / r.oui) * 100) : null;
    return r;
  }
  // « Prénom Nom ; Société ; Fonction » par ligne → invités (le dernier mot du nom est le nom de famille).
  function lireInvitesRapides(texte) {
    return String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [personne, societe = '', fonction = ''] = l.split(/[;\t]/).map((s) => s.trim());
      const mots = personne.split(/\s+/).filter(Boolean);
      const nom = mots.length > 1 ? mots.pop() : (mots.pop() || '');
      return { prenom: mots.join(' '), nom, societe, fonction };
    }).filter((x) => x.nom);
  }
  const trierInvites = (liste) => [...liste].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'));
  // Pages de badges (n par page) des invités ayant répondu oui, triés par nom.
  function pagesBadges(liste, n = 8) {
    const t = trierInvites(liste.filter((i) => i.reponse === 'oui'));
    const pages = [];
    for (let i = 0; i < t.length; i += n) pages.push(t.slice(i, i + n));
    return pages;
  }
  // CSV point-virgule avec BOM (ouvre correctement les accents dans un tableur).
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function csvInvites(liste, nomCategorie, avecSensibles) {
    const entetes = ['Nom', 'Prénom', 'Société', 'Fonction', 'E-mail', 'Catégorie', 'Réponse', 'Présent', ...(avecSensibles ? ['Régime', 'Accessibilité'] : [])];
    const rep = { oui: 'Oui', non: 'Non', attente: 'En attente' };
    const lignes = trierInvites(liste).map((i) => [i.nom, i.prenom, i.societe, i.fonction, i.email, nomCategorie(i.categorie), rep[i.reponse] || 'En attente', i.present ? 'Oui' : '', ...(avecSensibles ? [i.regime, i.accessibilite] : [])]);
    return '﻿' + [entetes, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n') + '\r\n';
  }
  // Efface régimes et besoins d'accessibilité des invités d'un événement ; renvoie le nombre d'invités modifiés.
  function effacerSensibles(invites, evtId) {
    let n = 0;
    for (const i of invites) {
      if (i.evtId !== evtId || (!i.regime && !i.accessibilite)) continue;
      i.regime = ''; i.accessibilite = ''; n++;
    }
    return n;
  }

  // ---------- Conducteur ----------
  const minutes = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  const hm = (n) => `${deux(Math.floor(n / 60))}:${deux(n % 60)}`;
  // Séquences triées (jour, heure) avec début, fin, chevauchement (même jour, même lieu ou sans lieu).
  function conducteur(items) {
    const t = items.map((x) => ({ ...x, jour: x.jour || 1, debut: minutes(x.heure) ?? 0 }))
      .sort((a, b) => a.jour - b.jour || a.debut - b.debut || (a.ordre || 0) - (b.ordre || 0));
    const res = t.map((x) => ({ ...x, fin: x.debut + Math.max(0, Number(x.duree) || 0), chevauche: null }));
    for (let i = 0; i < res.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = res[j], b = res[i];
        const memeLieu = !a.lieu || !b.lieu || a.lieu.trim().toLowerCase() === b.lieu.trim().toLowerCase();
        if (a.jour === b.jour && memeLieu && b.debut < a.fin) { b.chevauche = a.id; break; }
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
  // Séquence en cours et suivante à une minute donnée d'un jour donné.
  function enCours(items, jour, minute) {
    const c = conducteur(items).filter((x) => x.jour === jour);
    return { courante: c.filter((x) => x.debut <= minute && minute < x.fin).at(-1) || null, suivante: c.find((x) => x.debut > minute) || null };
  }

  // ---------- Tableau de bord ----------
  function resumeEvenement(E, evt, auj) {
    const taches = E.taches.filter((t) => t.evtId === evt.id);
    const st = taches.map((t) => statutTache(t, evt, auj).statut);
    const b = budget(E, evt.id);
    const inv = statsInvites(E.invites.filter((i) => i.evtId === evt.id));
    const ech = echeancier(E, auj, evt.id);
    return {
      jours: ecart(auj, evt.date), rebours: compteRebours(evt, auj), passe: evenementPasse(evt, auj),
      taches: taches.length, faites: st.filter((s) => s === 'faite').length, retard: st.filter((s) => s === 'retard').length, semaine: st.filter((s) => s === 'semaine').length,
      avancement: taches.length ? Math.round((st.filter((s) => s === 'faite').length / taches.length) * 100) : 0,
      budget: b.total, budgetCible: evt.budgetCible || 0, depassements: b.lignes.filter((l) => l.depassement).length,
      invites: inv, echeancesRetard: ech.filter((e) => e.etat === 'retard').length, prochaineEcheance: ech[0] || null,
    };
  }
  // Alertes transverses des événements non terminés : gravité 0 (rouge) puis 1, puis date.
  function alertes(E, auj) {
    const res = [];
    for (const evt of E.evenements) {
      if (evenementPasse(evt, auj) && !E.taches.some((t) => t.evtId === evt.id && !t.faite)) continue;
      const retards = E.taches.filter((t) => t.evtId === evt.id && statutTache(t, evt, auj).statut === 'retard');
      if (retards.length) res.push({ gravite: 0, type: 'taches', evt, date: retards.map((t) => echeance(t, evt)).sort()[0], n: retards.length });
      const b = budget(E, evt.id);
      for (const l of b.lignes.filter((x) => x.depassement)) res.push({ gravite: 1, type: 'budget', evt, date: evt.date, poste: l.poste, ecart: l.ecart });
      if (evt.budgetCible && b.total.engage > evt.budgetCible) res.push({ gravite: 0, type: 'cible', evt, date: evt.date, ecart: b.total.engage - evt.budgetCible });
      for (const c of E.contrats.filter((x) => x.evtId === evt.id)) {
        const info = infoContrat(c);
        if (info.aPlanifier) res.push({ gravite: 1, type: 'planifier', evt, date: evt.date, contrat: c, ecart: info.aPlanifier });
      }
    }
    for (const e of echeancier(E, auj)) {
      if (e.etat === 'avenir') continue;
      res.push({ gravite: e.etat === 'retard' ? 0 : 1, type: 'paiement', evt: E.evenements.find((x) => x.id === e.contrat.evtId), date: e.echeance.date, contrat: e.contrat, echeance: e.echeance, jours: e.jours });
    }
    return res.filter((a) => a.evt).sort((a, b) => a.gravite - b.gravite || a.date.localeCompare(b.date));
  }

  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.EVT = {
    iso, versDate, ajout, ecart, estDate, dateFr, lireMontant, eur, champMontant, decouper,
    finEvenement, evenementPasse, compteRebours, echeance, statutTache, periode, libelleRelatif, tachesDepuisModele, chargeResponsables,
    infoContrat, budget, echeancier, statsInvites, lireInvitesRapides, trierInvites, pagesBadges, champCsv, csvInvites, effacerSensibles,
    minutes, hm, conducteur, decaler, enCours, resumeEvenement, alertes, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
