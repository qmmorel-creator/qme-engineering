// Règles métier des inscriptions associatives : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/inscriptions.test.mjs).
// Toutes les fonctions qui dépendent du jour reçoivent la date « aujourd'hui » en paramètre.
(function (g) {
  'use strict';

  // ---------- Dates locales AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Ajoute n mois ; le 31 janvier + 1 mois donne le dernier jour de février.
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (m - 1) + n;
    const an = a + Math.floor(t / 12), mois = ((t % 12) + 12) % 12;
    const dernier = new Date(an, mois + 1, 0).getDate();
    return `${an}-${deux(mois + 1)}-${deux(Math.min(j, dernier))}`;
  }
  // Jour de la semaine, 0 = lundi.
  const jourSemaine = (s) => (versDate(s).getDay() + 6) % 7;
  // Âge révolu à une date.
  function age(naissance, date) {
    if (!estDate(naissance) || !estDate(date)) return null;
    const [a1, m1, j1] = naissance.split('-').map(Number);
    const [a2, m2, j2] = date.split('-').map(Number);
    let n = a2 - a1;
    if (m2 < m1 || (m2 === m1 && j2 < j1)) n--;
    return n;
  }
  const estMineur = (naissance, date) => { const n = age(naissance, date); return n !== null && n < 18; };

  // ---------- Argent (calculs en centimes entiers) ----------
  const cts = (e) => Math.round((Number(e) || 0) * 100);
  const eur = (c) => Math.round(c) / 100;

  // ---------- Tranches de quotient familial ----------
  // Tranches triées par plafond croissant ; la dernière n'a pas de plafond (max null).
  const trierTranches = (tr) => [...tr].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  function validerTranches(tr) {
    if (!Array.isArray(tr) || !tr.length) return 'Il faut au moins une tranche.';
    if (tr.some((t) => !String(t.nom || '').trim())) return 'Chaque tranche a besoin d\'un nom.';
    const sans = tr.filter((t) => t.max === null || t.max === undefined || t.max === '');
    if (sans.length !== 1) return 'Une seule tranche, la dernière, est sans plafond.';
    const avec = tr.filter((t) => !sans.includes(t)).map((t) => Number(t.max));
    if (avec.some((n) => !Number.isInteger(n) || n < 0)) return 'Les plafonds sont des nombres entiers positifs.';
    const tries = [...avec].sort((a, b) => a - b);
    if (tries.some((n, i) => i && n === tries[i - 1])) return 'Deux tranches ont le même plafond.';
    return null;
  }
  // Tranche d'un quotient : la première dont le plafond est >= qf ; sans quotient, la dernière (tarif plein).
  function trancheDe(qf, tranches) {
    const tr = trierTranches(tranches);
    if (!tr.length) return null;
    if (qf === null || qf === undefined || qf === '' || !Number.isFinite(Number(qf))) return tr.at(-1);
    return tr.find((t) => t.max === null || Number(qf) <= t.max) || tr.at(-1);
  }

  // ---------- Accès ----------
  const membre = (E, id) => E.membres.find((m) => m.id === id);
  const famille = (E, id) => E.familles.find((f) => f.id === id);
  const activite = (E, id) => E.activites.find((a) => a.id === id);
  const creneau = (E, id) => { for (const a of E.activites) { const c = a.creneaux.find((x) => x.id === id); if (c) return { activite: a, creneau: c }; } return null; };
  const familleDeInscription = (E, i) => famille(E, membre(E, i.membreId)?.familleId);

  // Tarif d'une inscription : tarif ajusté s'il est saisi, sinon celui de la tranche de la famille.
  function tarifInscription(E, i) {
    if (i.tarif !== null && i.tarif !== undefined && i.tarif !== '') return Number(i.tarif);
    const a = activite(E, i.activiteId);
    const t = trancheDe(familleDeInscription(E, i)?.qf, E.tranches);
    return Number(a?.tarifs?.[t?.id]) || 0;
  }

  // ---------- Places et liste d'attente ----------
  const ordreFile = (a, b) => a.date.localeCompare(b.date) || (a.ordre || 0) - (b.ordre || 0);
  const duCreneau = (E, creneauId, statut) => E.inscriptions.filter((i) => i.creneauId === creneauId && (!statut || i.statut === statut));
  const fileAttente = (E, creneauId) => duCreneau(E, creneauId, 'attente').sort(ordreFile);
  function occupation(E, creneauId) {
    const c = creneau(E, creneauId)?.creneau;
    const capacite = Math.max(0, Number(c?.capacite) || 0);
    const inscrits = duCreneau(E, creneauId, 'inscrit').length;
    return { capacite, inscrits, attente: duCreneau(E, creneauId, 'attente').length, libres: Math.max(0, capacite - inscrits), taux: capacite ? inscrits / capacite : 0 };
  }
  const statutNouvelle = (E, creneauId) => (occupation(E, creneauId).libres > 0 ? 'inscrit' : 'attente');
  const rangAttente = (E, inscription) => (inscription.statut === 'attente' ? fileAttente(E, inscription.creneauId).findIndex((i) => i.id === inscription.id) + 1 : 0);
  // Inscriptions en attente qui tiennent dans les places libres (dans l'ordre de la file).
  const aPromouvoir = (E, creneauId) => fileAttente(E, creneauId).slice(0, occupation(E, creneauId).libres);
  const dejaInscrit = (E, membreId, creneauId) => E.inscriptions.some((i) => i.membreId === membreId && i.creneauId === creneauId && i.statut !== 'annule');

  // ---------- Dû, échéances, paiements ----------
  function duFamille(E, familleId) {
    const membres = E.membres.filter((m) => m.familleId === familleId);
    const ids = new Set(membres.map((m) => m.id));
    const inscr = E.inscriptions.filter((i) => ids.has(i.membreId) && i.statut === 'inscrit');
    const adh = cts(E.association?.adhesion?.montant);
    const membresInscrits = new Set(inscr.map((i) => i.membreId)).size;
    const adhesion = !adh || !membresInscrits ? 0 : E.association.adhesion.par === 'personne' ? adh * membresInscrits : adh;
    const lignes = inscr.map((i) => ({ inscription: i, montant: cts(tarifInscription(E, i)) }));
    const activites = lignes.reduce((s, l) => s + l.montant, 0);
    return { adhesion: eur(adhesion), activites: eur(activites), total: eur(adhesion + activites), lignes: lignes.map((l) => ({ ...l, montant: eur(l.montant) })) };
  }
  // Total réparti en n échéances égales au centime près (reste sur la première), une par mois.
  function echeancier(total, n, depart) {
    const t = cts(total), k = Math.max(1, Math.min(10, Math.round(Number(n) || 1)));
    if (!depart || t <= 0) return [];
    const base = Math.floor(t / k), reste = t - base * k;
    return Array.from({ length: k }, (_, i) => ({ date: ajoutMois(depart, i), montant: eur(base + (i === 0 ? reste : 0)) }));
  }
  // Date de départ : celle de la famille, sinon sa première inscription retenue, sinon le début de saison.
  function departEcheances(E, familleId) {
    const f = famille(E, familleId);
    if (f?.depart && estDate(f.depart)) return f.depart;
    const ids = new Set(E.membres.filter((m) => m.familleId === familleId).map((m) => m.id));
    const dates = E.inscriptions.filter((i) => ids.has(i.membreId) && i.statut === 'inscrit').map((i) => i.date).sort();
    return dates[0] || E.saison?.debut || null;
  }
  const payeFamille = (E, familleId) => eur(E.paiements.filter((p) => p.familleId === familleId).reduce((s, p) => s + cts(p.montant), 0));

  function situation(E, familleId, auj) {
    const f = famille(E, familleId);
    const du = duFamille(E, familleId);
    const ech = echeancier(du.total, f?.nbEcheances || 1, departEcheances(E, familleId));
    const paye = cts(payeFamille(E, familleId));
    let cumul = 0, echu = 0, depuis = null;
    const echeances = ech.map((e) => {
      cumul += cts(e.montant);
      const passee = e.date < auj;
      if (passee) echu = cumul;
      const couverte = paye >= cumul;
      if (passee && !couverte && !depuis) depuis = e.date;
      return { ...e, couverte, retard: passee && !couverte };
    });
    const total = cts(du.total);
    const prochaine = echeances.find((e) => !e.couverte && !e.retard) || null;
    return { du, total: du.total, paye: eur(paye), reste: eur(total - paye), echu: eur(echu), retard: eur(Math.max(0, echu - paye)), depuis, echeances, prochaine };
  }
  function impayes(E, auj) {
    return E.familles.map((f) => ({ famille: f, s: situation(E, f.id, auj) }))
      .filter((x) => x.s.retard > 0)
      .sort((a, b) => a.s.depuis.localeCompare(b.s.depuis) || b.s.retard - a.s.retard);
  }

  // ---------- Saison, séances ----------
  // Fermetures saisies : « JJ/MM/AAAA - JJ/MM/AAAA Libellé » ou une seule date, une par ligne.
  function lireFermetures(texte) {
    const res = [], erreurs = [];
    String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((l, n) => {
      const m = l.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*(?:-|–|au)\s*(\d{1,2})\/(\d{1,2})\/(\d{4}))?\s*(.*)$/);
      if (!m) { erreurs.push(n + 1); return; }
      const d1 = `${m[3]}-${deux(m[2])}-${deux(m[1])}`;
      const d2 = m[4] ? `${m[6]}-${deux(m[5])}-${deux(m[4])}` : d1;
      if (!estDate(d1) || !estDate(d2) || d2 < d1) { erreurs.push(n + 1); return; }
      res.push({ debut: d1, fin: d2, nom: m[7].trim() });
    });
    return { fermetures: res.sort((a, b) => a.debut.localeCompare(b.debut)), erreurs };
  }
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const ecrireFermetures = (f) => (f || []).map((x) => `${dateFr(x.debut)}${x.fin !== x.debut ? ` - ${dateFr(x.fin)}` : ''}${x.nom ? ` ${x.nom}` : ''}`).join('\n');
  const ferme = (date, fermetures) => (fermetures || []).some((f) => date >= f.debut && date <= f.fin);
  // Séances d'un créneau : chaque jour de la semaine voulu dans la saison, hors fermetures.
  function seances(jour, saison) {
    if (!saison || !estDate(saison.debut) || !estDate(saison.fin)) return [];
    const res = [];
    let d = ajout(saison.debut, (jour - jourSemaine(saison.debut) + 7) % 7);
    for (; d <= saison.fin && res.length < 60; d = ajout(d, 7)) if (!ferme(d, saison.fermetures)) res.push(d);
    return res;
  }
  // Mois couverts par la saison (AAAA-MM).
  function moisSaison(saison) {
    if (!saison || !estDate(saison.debut) || !estDate(saison.fin)) return [];
    const res = [];
    for (let m = `${saison.debut.slice(0, 7)}-01`; m <= saison.fin && res.length < 24; m = ajoutMois(m, 1)) res.push(m.slice(0, 7));
    return res;
  }

  // ---------- Indicateurs ----------
  function indicateurs(E, auj) {
    const creneaux = E.activites.flatMap((a) => a.creneaux.map((c) => ({ activite: a, creneau: c, ...occupation(E, c.id) })));
    const capacite = creneaux.reduce((s, c) => s + c.capacite, 0);
    const inscrits = creneaux.reduce((s, c) => s + c.inscrits, 0);
    const sit = E.familles.map((f) => situation(E, f.id, auj));
    return {
      creneaux,
      inscriptions: E.inscriptions.filter((i) => i.statut === 'inscrit').length,
      attente: E.inscriptions.filter((i) => i.statut === 'attente').length,
      adherents: new Set(E.inscriptions.filter((i) => i.statut === 'inscrit').map((i) => i.membreId)).size,
      capacite, inscrits, remplissage: capacite ? inscrits / capacite : 0,
      complets: creneaux.filter((c) => c.capacite && c.libres === 0).length,
      retard: eur(sit.reduce((s, x) => s + cts(x.retard), 0)),
      famillesRetard: sit.filter((x) => x.retard > 0).length,
      reste: eur(sit.reduce((s, x) => s + Math.max(0, cts(x.reste)), 0)),
      encaisse: eur(sit.reduce((s, x) => s + cts(x.paye), 0)),
      du: eur(sit.reduce((s, x) => s + cts(x.total), 0)),
    };
  }
  // Fiches à compléter : mineur sans responsable légal ou sans contact d'urgence, quotient manquant
  // (avec plusieurs tranches), mentions d'information non remises.
  function aCompleter(E, auj) {
    const res = [];
    const plusieurs = E.tranches.length > 1;
    for (const f of E.familles) {
      const membres = E.membres.filter((m) => m.familleId === f.id);
      const actifs = membres.filter((m) => E.inscriptions.some((i) => i.membreId === m.id && i.statut !== 'annule'));
      if (!actifs.length) continue;
      const mineurs = actifs.filter((m) => estMineur(m.naissance, auj));
      if (mineurs.length && !(f.responsables || []).some((r) => r.nom)) res.push({ famille: f, motif: 'Mineur sans responsable légal' });
      if (mineurs.length && !(f.urgences || []).some((r) => r.tel)) res.push({ famille: f, motif: 'Mineur sans contact d\'urgence' });
      if (plusieurs && (f.qf === null || f.qf === undefined || f.qf === '')) res.push({ famille: f, motif: 'Quotient familial non renseigné (tarif de la dernière tranche)' });
      if (!f.mentionsLe) res.push({ famille: f, motif: 'Mentions d\'information non remises' });
      if (actifs.some((m) => !estDate(m.naissance))) res.push({ famille: f, motif: 'Date de naissance manquante' });
    }
    return res;
  }

  // ---------- Conservation (RGPD) ----------
  // Familles sans inscription en cours dont la dernière saison s'est terminée il y a plus de `ans` ans.
  function aPurger(E, auj, ans) {
    const n = Math.max(1, Math.round(Number(ans) || 3));
    return E.familles.filter((f) => {
      const ids = new Set(E.membres.filter((m) => m.familleId === f.id).map((m) => m.id));
      if (E.inscriptions.some((i) => ids.has(i.membreId) && i.statut !== 'annule')) return false;
      const fin = f.derniereFin || (f.cree && f.cree.slice(0, 10));
      return !!fin && estDate(fin) && ajoutMois(fin, 12 * n) < auj;
    });
  }

  // Nouvelle saison : garde association, tranches, activités, familles et membres ; vide inscriptions et
  // paiements ; mémorise la fin de la saison close pour chaque famille qui y était inscrite.
  function nouvelleSaison(E, saison) {
    const inscrits = new Set(E.inscriptions.filter((i) => i.statut === 'inscrit').map((i) => membre(E, i.membreId)?.familleId));
    return {
      ...E,
      saison: { nom: saison.nom, debut: saison.debut, fin: saison.fin, fermetures: [] },
      familles: E.familles.map((f) => ({ ...f, depart: null, mentionsLe: f.mentionsLe, derniereFin: inscrits.has(f.id) ? E.saison.fin : (f.derniereFin || null) })),
      inscriptions: [],
      paiements: [],
    };
  }
  // Saison proposée : du 1er septembre au 30 juin, celle en cours (ou à venir à partir d'août).
  function saisonProposee(auj) {
    const a = Number(auj.slice(0, 4)), m = Number(auj.slice(5, 7));
    const an = m >= 8 ? a : a - 1;
    return { nom: `${an}-${an + 1}`, debut: `${an}-09-01`, fin: `${an + 1}-06-30` };
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const nombreCsv = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
  const ligneCsv = (l) => l.map(champCsv).join(';');
  const fichierCsv = (entetes, lignes) => `﻿${[entetes, ...lignes].map(ligneCsv).join('\r\n')}\r\n`;
  const LIB_STATUT = { inscrit: 'Inscrit', attente: 'Liste d\'attente', annule: 'Annulé' };
  const horaire = (c) => `${(g.BASE?.jours || [])[c.jour] || ''} ${c.debut}-${c.fin}`.trim();

  function csvInscriptions(E, auj) {
    const entetes = ['Famille', 'Prénom', 'Nom', 'Naissance', 'Âge', 'Mineur', 'Activité', 'Créneau', 'Statut', 'Rang d\'attente', 'Inscrit le', 'Tranche', 'Tarif (€)'];
    const lignes = E.inscriptions.map((i) => {
      const m = membre(E, i.membreId), f = famille(E, m?.familleId), x = creneau(E, i.creneauId);
      return { tri: `${f?.nom || ''} ${m?.prenom || ''} ${x?.activite.nom || ''}`, l: [f?.nom || '', m?.prenom || '', m?.nom || '', dateFr(m?.naissance), age(m?.naissance, auj) ?? '', estMineur(m?.naissance, auj) ? 'Oui' : 'Non',
        x?.activite.nom || '', x ? horaire(x.creneau) : '', LIB_STATUT[i.statut] || i.statut, rangAttente(E, i) || '', dateFr(i.date), trancheDe(f?.qf, E.tranches)?.nom || '', i.statut === 'inscrit' ? nombreCsv(tarifInscription(E, i)) : ''] };
    }).sort((a, b) => a.tri.localeCompare(b.tri, 'fr'));
    return fichierCsv(entetes, lignes.map((x) => x.l));
  }
  function csvSoldes(E, auj) {
    const entetes = ['Famille', 'Quotient familial', 'Tranche', 'Adhésion (€)', 'Activités (€)', 'Total dû (€)', 'Payé (€)', 'Reste (€)', 'En retard (€)', 'Échéances'];
    const lignes = [...E.familles].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((f) => {
      const s = situation(E, f.id, auj);
      return [f.nom, f.qf ?? '', trancheDe(f.qf, E.tranches)?.nom || '', nombreCsv(s.du.adhesion), nombreCsv(s.du.activites), nombreCsv(s.total), nombreCsv(s.paye), nombreCsv(s.reste), nombreCsv(s.retard),
        s.echeances.map((e) => `${dateFr(e.date)} ${nombreCsv(e.montant)}`).join(' / ')];
    });
    return fichierCsv(entetes, lignes);
  }

  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.REGLES = {
    iso, versDate, ajout, ajoutMois, ecart, estDate, jourSemaine, age, estMineur, cts, eur,
    trierTranches, validerTranches, trancheDe, membre, famille, activite, creneau, tarifInscription,
    fileAttente, occupation, statutNouvelle, rangAttente, aPromouvoir, dejaInscrit,
    duFamille, echeancier, departEcheances, payeFamille, situation, impayes,
    lireFermetures, ecrireFermetures, dateFr, ferme, seances, moisSaison, indicateurs, aCompleter, aPurger, nouvelleSaison, saisonProposee,
    champCsv, csvInscriptions, csvSoldes, horaire, LIB_STATUT, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
