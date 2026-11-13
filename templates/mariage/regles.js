// Organisateur de mariage QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.MRG) et par les tests Node (vm).
// Toutes les fonctions datées reçoivent la date de référence `ref` (AAAA-MM-JJ) : jamais la date du jour.
// Montants en centimes entiers.
(function (racine) {
  'use strict';

  // ---------- Montants ----------
  function versCentimes(texte) {
    if (texte === null || texte === undefined) return null;
    let s = String(texte).replace(/[\s  €]/g, '').replace(/^\+/, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const [e, d = ''] = s.split('.');
    return Number(e) * 100 + Number((d + '00').slice(0, 2));
  }
  const groupeMilliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function euros(c) {
    const neg = c < 0; const a = Math.abs(Math.round(c));
    const e = Math.floor(a / 100), d = a % 100;
    return `${neg ? '−' : ''}${groupeMilliers(e)}${d ? `,${String(d).padStart(2, '0')}` : ''} €`;
  }
  function eurosRonds(c) {
    const neg = c < 0; const a = Math.round(Math.abs(c) / 100);
    return `${neg ? '−' : ''}${groupeMilliers(a)} €`;
  }

  // ---------- Dates (calendrier, sans fuseau) ----------
  const valideIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const jourNum = (s) => { const [a, m, j] = s.split('-').map(Number); return Date.UTC(a, m - 1, j) / 86400000; };
  const versIso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const ajoutJours = (s, n) => versIso(jourNum(s) + n);
  const ecartJours = (de, a) => jourNum(a) - jourNum(de);

  // Jours restants jusqu'au mariage (négatif une fois passé).
  const joursAvant = (dateMariage, ref) => ecartJours(ref, dateMariage);

  // ---------- Rétroplanning ----------
  // Échéance : date fixe, sinon date du mariage − `avant` jours.
  function echeance(tache, dateMariage) {
    if (valideIso(tache.date)) return tache.date;
    if (!valideIso(dateMariage)) return null;
    return ajoutJours(dateMariage, -(Number(tache.avant) || 0));
  }

  function statutTache(tache, dateMariage, ref) {
    if (tache.fait) return 'fait';
    const e = echeance(tache, dateMariage);
    if (!e) return 'avenir';
    const d = ecartJours(ref, e);
    if (d < 0) return 'retard';
    if (d <= 7) return 'semaine';
    return 'avenir';
  }

  // Période d'après le nombre de jours avant le mariage (bornes basses incluses, triées décroissantes).
  function indexPeriode(jours, periodes) {
    const i = periodes.findIndex((p) => jours >= p.min);
    return i < 0 ? periodes.length - 1 : i;
  }

  // Tâches enrichies (échéance, statut, période), triées par échéance puis titre.
  function planning(taches, dateMariage, ref, periodes) {
    return taches.map((t) => {
      const e = echeance(t, dateMariage);
      const avant = e && valideIso(dateMariage) ? ecartJours(e, dateMariage) : Number(t.avant) || 0;
      return { ...t, echeance: e, statut: statutTache(t, dateMariage, ref), periode: indexPeriode(avant, periodes), joursRestants: e ? ecartJours(ref, e) : null };
    }).sort((a, b) => (a.echeance || '').localeCompare(b.echeance || '') || a.titre.localeCompare(b.titre, 'fr'));
  }

  function bilanTaches(liste) {
    const r = { total: liste.length, fait: 0, retard: 0, semaine: 0, avenir: 0 };
    liste.forEach((t) => { r[t.statut] += 1; });
    r.taux = r.total ? Math.round((r.fait / r.total) * 100) : 0;
    return r;
  }

  // Décalage proposé à la saisie : mois et semaines → jours (1 mois = 30 jours, 1 semaine = 7 jours).
  const enJours = (mois, semaines) => (Number(mois) || 0) * 30 + (Number(semaines) || 0) * 7;
  function libelleAvant(j) {
    if (j === 0) return 'le jour J';
    const a = Math.abs(j);
    const txt = a >= 60 && a % 30 === 0 ? `${a / 30} mois` : a >= 14 && a % 7 === 0 ? `${a / 7} semaines` : `${a} jour${a > 1 ? 's' : ''}`;
    return j > 0 ? `${txt} avant` : `${txt} après`;
  }

  // ---------- Budget ----------
  const somme = (l, f) => l.reduce((s, x) => s + (f(x) || 0), 0);
  const payeDe = (p) => somme(p.paiements || [], (x) => (x.paye ? x.montant : 0));

  function budgetParPoste(postes, prestataires) {
    const lignes = postes.map((po) => {
      const ps = prestataires.filter((p) => p.posteId === po.id);
      const engage = somme(ps.filter((p) => p.statut === 'reserve'), (p) => p.devis);
      const paye = somme(ps, payeDe);
      const prevu = po.prevu || 0;
      return { id: po.id, nom: po.nom, prevu, engage, paye, reste: Math.max(engage, paye) - paye, ecart: engage - prevu, depasse: prevu > 0 && engage > prevu, nbPrestataires: ps.length };
    });
    const t = { prevu: somme(lignes, (l) => l.prevu), engage: somme(lignes, (l) => l.engage), paye: somme(lignes, (l) => l.paye), reste: somme(lignes, (l) => l.reste) };
    // Prestataires sans poste (poste supprimé) : comptés à part.
    const orphelins = prestataires.filter((p) => !postes.some((po) => po.id === p.posteId));
    if (orphelins.length) {
      const engage = somme(orphelins.filter((p) => p.statut === 'reserve'), (p) => p.devis);
      const paye = somme(orphelins, payeDe);
      lignes.push({ id: null, nom: 'Sans poste', prevu: 0, engage, paye, reste: Math.max(engage, paye) - paye, ecart: engage, depasse: false, nbPrestataires: orphelins.length });
      t.engage += engage; t.paye += paye; t.reste += Math.max(engage, paye) - paye;
    }
    return { lignes, total: t };
  }

  // Paiements non réglés, triés par échéance (sans date en dernier).
  function echeancesAVenir(prestataires, ref) {
    const l = [];
    prestataires.forEach((p) => (p.paiements || []).forEach((x) => {
      if (!x.paye) l.push({ ...x, prestataireId: p.id, prestataire: p.nom, retard: valideIso(x.echeance) && x.echeance < ref, jours: valideIso(x.echeance) ? ecartJours(ref, x.echeance) : null });
    }));
    return l.sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  }

  // ---------- Invités ----------
  function statsInvites(invites) {
    const r = { total: invites.length, adultes: 0, enfants: 0, oui: { adultes: 0, enfants: 0 }, attente: { adultes: 0, enfants: 0 }, non: { adultes: 0, enfants: 0 }, regimes: {}, allergies: [] };
    invites.forEach((i) => {
      const age = i.enfant ? 'enfants' : 'adultes';
      r[age] += 1;
      const rep = r[i.reponse] ? i.reponse : 'attente';
      r[rep][age] += 1;
      if (rep !== 'non') {
        const reg = i.regime || 'Sans restriction';
        if (reg !== 'Sans restriction') r.regimes[reg] = (r.regimes[reg] || 0) + 1;
        if (i.allergies && String(i.allergies).trim()) r.allergies.push({ id: i.id, nom: i.nom, allergies: String(i.allergies).trim() });
      }
    });
    r.couverts = r.oui.adultes + r.oui.enfants + r.attente.adultes + r.attente.enfants;
    r.confirmes = r.oui.adultes + r.oui.enfants;
    return r;
  }

  // Saisie rapide : un nom par ligne, lignes vides et doublons exacts ignorés.
  function nomsDepuisTexte(texte) {
    const vus = new Set();
    return String(texte || '').split(/\r?\n/).map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => {
      if (!s || vus.has(s.toLowerCase())) return false;
      vus.add(s.toLowerCase());
      return true;
    }).map((s) => s.slice(0, 60));
  }

  // ---------- Plan de table ----------
  function planDeTable(tables, invites) {
    const occ = tables.map((t) => {
      const assis = invites.filter((i) => i.tableId === t.id && i.reponse !== 'non');
      const n = assis.length;
      return { id: t.id, nom: t.nom, places: t.places, occupees: n, libres: t.places - n, surcapacite: n > t.places, invites: assis.map((i) => i.id) };
    });
    const existe = new Set(tables.map((t) => t.id));
    const aPlacer = invites.filter((i) => i.reponse !== 'non' && !(i.tableId && existe.has(i.tableId)));
    const nonPlaces = aPlacer.filter((i) => i.reponse === 'oui');
    const declinesPlaces = invites.filter((i) => i.reponse === 'non' && i.tableId && existe.has(i.tableId));
    const alertes = [];
    occ.filter((t) => t.surcapacite).forEach((t) => alertes.push({ type: 'surcapacite', tableId: t.id, texte: `${t.nom} : ${t.occupees} invités pour ${t.places} place${t.places > 1 ? 's' : ''}` }));
    if (nonPlaces.length) alertes.push({ type: 'nonPlaces', texte: `${nonPlaces.length} invité${nonPlaces.length > 1 ? 's' : ''} confirmé${nonPlaces.length > 1 ? 's' : ''} sans table` });
    if (declinesPlaces.length) alertes.push({ type: 'declines', texte: `${declinesPlaces.length} invité${declinesPlaces.length > 1 ? 's' : ''} ayant décliné encore placé${declinesPlaces.length > 1 ? 's' : ''}` });
    return { tables: occ, aPlacer, nonPlaces, declinesPlaces, alertes, places: somme(tables, (t) => t.places), occupees: somme(occ, (t) => t.occupees) };
  }

  // Place un invité sur une table (ou le retire avec tableId = null) ; renvoie une nouvelle liste.
  const placer = (invites, inviteId, tableId) => invites.map((i) => (i.id === inviteId ? { ...i, tableId: tableId || null } : i));

  // Retire régimes et allergies (à faire après le mariage).
  const effacerSante = (invites) => invites.map((i) => ({ ...i, regime: 'Sans restriction', allergies: '' }));

  racine.MRG = {
    versCentimes, euros, eurosRonds, valideIso, ajoutJours, ecartJours, joursAvant,
    echeance, statutTache, indexPeriode, planning, bilanTaches, enJours, libelleAvant,
    budgetParPoste, echeancesAVenir, statsInvites, nomsDepuisTexte, planDeTable, placer, effacerSante,
  };
})(typeof window !== 'undefined' ? window : globalThis);
