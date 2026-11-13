// Règles métier de la gestion de flotte : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/flotte.test.mjs).
// Toutes les fonctions qui dépendent du jour reçoivent la date de référence `auj` (AAAA-MM-JJ).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estDateHeure = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && estDate(s.slice(0, 10)) && Number(s.slice(11, 13)) < 24 && Number(s.slice(14, 16)) < 60;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // Ajoute n mois ; le jour est borné à la fin du mois (31 janvier + 1 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (m - 1) + n;
    const an = a + Math.floor(t / 12), mo = ((t % 12) + 12) % 12;
    const fin = new Date(an, mo + 1, 0).getDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, fin))}`;
  }
  // Mois pleins écoulés de `de` à `a` (0 si a < de + 1 mois).
  function moisPleins(de, a) {
    if (a < de) return 0;
    let n = Math.max(0, (Number(a.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + Number(a.slice(5, 7)) - Number(de.slice(5, 7)) - 1);
    while (ajoutMois(de, n + 1) <= a) n++;
    return n;
  }
  // Lundi de la semaine d'une date.
  const lundi = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));

  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nombre = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const arrondi = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  // Immatriculation : majuscules, tirets normalisés (format libre accepté).
  const immat = (s) => String(s || '').toUpperCase().replace(/[\s_.]+/g, '-').replace(/[^0-9A-Z-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // ---------- Kilométrage ----------
  // Points connus (date, km) d'un véhicule : entrée, relevés, entretiens, retours de réservation.
  function pointsKm(etat, v) {
    const p = [];
    if (v.entree && Number.isFinite(Number(v.kmEntree))) p.push({ date: v.entree, km: Number(v.kmEntree), source: 'entree' });
    for (const r of etat.releves || []) if (r.vehiculeId === v.id) p.push({ date: r.date, km: Number(r.km), source: 'releve', id: r.id });
    for (const e of etat.entretiens || []) if (e.vehiculeId === v.id && e.km != null && e.km !== '') p.push({ date: e.date, km: Number(e.km), source: 'entretien', id: e.id });
    for (const r of etat.reservations || []) if (r.vehiculeId === v.id && r.kmRetour != null && r.kmRetour !== '') p.push({ date: r.fin.slice(0, 10), km: Number(r.kmRetour), source: 'reservation', id: r.id });
    return p.filter((x) => estDate(x.date) && Number.isFinite(x.km)).sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  }
  const kmActuel = (points) => points.reduce((m, p) => Math.max(m, p.km), 0);
  const dernierReleve = (points) => points.reduce((m, p) => (!m || p.date > m ? p.date : m), null);

  // Rythme en km par jour sur la fenêtre (365 jours) ; repli sur tout l'historique ; null si inconnu.
  function rythme(points, auj, fenetre = 365) {
    const dans = (l) => l.filter((p) => p.date <= auj);
    let l = dans(points).filter((p) => p.date >= ajout(auj, -fenetre));
    if (new Set(l.map((p) => p.date)).size < 2) l = dans(points);
    if (l.length < 2) return null;
    const a = l[0], b = l.reduce((m, p) => (p.date > m.date || (p.date === m.date && p.km > m.km) ? p : m), l[0]);
    const j = ecart(a.date, b.date);
    if (j < 1 || b.km < a.km) return null;
    return (b.km - a.km) / j;
  }

  // Un nouveau relevé doit rester cohérent avec les relevés antérieurs et postérieurs.
  function verifierReleve(points, date, km, ignorerId = null) {
    if (!estDate(date)) return 'Date invalide.';
    if (!Number.isFinite(km) || km < 0) return 'Kilométrage invalide.';
    const autres = points.filter((p) => !ignorerId || p.id !== ignorerId);
    const avant = autres.filter((p) => p.date <= date && p.km > km).sort((a, b) => b.km - a.km)[0];
    if (avant) return `Incohérent : ${avant.km.toLocaleString('fr-FR')} km relevés le ${dateFr(avant.date)}${avant.date === date ? '' : ', avant cette date'}.`;
    const apres = autres.filter((p) => p.date > date && p.km < km).sort((a, b) => a.km - b.km)[0];
    if (apres) return `Incohérent : seulement ${apres.km.toLocaleString('fr-FR')} km relevés le ${dateFr(apres.date)}, après cette date.`;
    return null;
  }

  // ---------- Plan d'entretien ----------
  // Plan proposé depuis la base selon l'énergie (copie modifiable).
  function planDefaut(base, codeEnergie) {
    const en = base.energies.find((e) => e.code === codeEnergie);
    const thermique = en ? en.thermique : true;
    return base.entretiens.filter((o) => o.pour === 'tous' || (o.pour === 'thermique' && thermique) || (o.pour === 'electrique' && !thermique))
      .map((o) => ({ id: o.code, code: o.code, nom: o.nom, km: o.km, mois: o.mois }));
  }

  // Échéance d'une opération du plan. alerte : { jours, km }. Renvoie l'état et les deux critères.
  function echeanceEntretien(op, v, entretiens, kmAct, auj, alerte, ry = null) {
    const faits = entretiens.filter((e) => e.vehiculeId === v.id && (e.operations || []).includes(op.id) && estDate(e.date))
      .sort((a, b) => b.date.localeCompare(a.date));
    const dernier = faits[0] || null;
    const refDate = dernier ? dernier.date : (op.depuis || v.entree || v.miseEnCirculation);
    const refKm = dernier && dernier.km !== '' && dernier.km != null ? Number(dernier.km) : (op.depuisKm != null ? Number(op.depuisKm) : Number(v.kmEntree) || 0);
    const echKm = op.km > 0 ? refKm + Number(op.km) : null;
    const echDate = op.mois > 0 && refDate ? ajout(ajoutMois(refDate, Number(op.mois)), 0) : null;
    const kmRestant = echKm === null ? null : echKm - kmAct;
    const joursRestant = echDate === null ? null : ecart(auj, echDate);
    const dateKm = kmRestant === null ? null : kmRestant <= 0 ? auj : ry > 0 ? ajout(auj, Math.ceil(kmRestant / ry)) : null;
    const prevue = [echDate, dateKm].filter(Boolean).sort()[0] || null;
    let etat = 'ok';
    if ((kmRestant !== null && kmRestant <= 0) || (joursRestant !== null && joursRestant < 0)) etat = 'retard';
    else if ((kmRestant !== null && kmRestant <= alerte.km) || (joursRestant !== null && joursRestant <= alerte.jours) || (dateKm && ecart(auj, dateKm) <= alerte.jours)) etat = 'proche';
    if (echKm === null && echDate === null) etat = 'sans';
    return { op, dernier, refDate, refKm, echKm, echDate, kmRestant, joursRestant, dateKm, prevue, etat };
  }

  // ---------- Contrôle technique ----------
  // reglages : { ctPremierMois, ctPeriodiqueMois, ctPollutionMois }. Pour le type AUTRE, la périodicité
  // vient du véhicule (v.ctPremierMois, v.ctMois) ; sans elle, aucune échéance n'est calculée.
  // Échéance = date limite incluse (anniversaire − 1 jour).
  function echeancesCT(v, controles, reglages, base) {
    const autre = v.type === 'AUTRE';
    const premier = autre ? Number(v.ctPremierMois) || 0 : reglages.ctPremierMois;
    const periode = autre ? Number(v.ctMois) || 0 : reglages.ctPeriodiqueMois;
    const cts = controles.filter((c) => c.vehiculeId === v.id && estDate(c.date)).sort((a, b) => a.date.localeCompare(b.date));
    const periodiques = cts.filter((c) => c.nature === 'periodique');
    const res = [];
    let ref = periodiques.at(-1)?.date || null;
    if (!ref && estDate(v.ctDernier)) ref = v.ctDernier;
    if (ref && periode > 0) res.push({ nature: 'periodique', echeance: ajout(ajoutMois(ref, periode), -1), ref });
    else if (!ref && premier > 0 && estDate(v.miseEnCirculation)) res.push({ nature: 'periodique', echeance: ajout(ajoutMois(v.miseEnCirculation, premier), -1), ref: null, premier: true });
    // Contre-visite : la dernière visite à résultat « contre-visite » sans contre-visite favorable ensuite.
    const aRevoir = cts.filter((c) => c.resultat === 'contre-visite').at(-1);
    if (aRevoir && !cts.some((c) => c.nature === 'contre-visite' && c.resultat === 'favorable' && c.date >= aRevoir.date && c.id !== aRevoir.id)) {
      res.push({ nature: 'contre-visite', echeance: estDate(aRevoir.limite) ? aRevoir.limite : aRevoir.date, ref: aRevoir.date });
    }
    // Contrôle complémentaire pollution : camionnettes N1 dont l'énergie n'est pas exemptée.
    const en = base.energies.find((e) => e.code === v.energie);
    if (v.type === 'N1' && !(en && en.exempte) && ref && reglages.ctPollutionMois > 0) {
      const fait = cts.some((c) => c.nature === 'pollution' && c.date > ref && c.resultat !== 'contre-visite');
      if (!fait) res.push({ nature: 'pollution', echeance: ajout(ajoutMois(ref, reglages.ctPollutionMois), -1), ref });
    }
    return res;
  }
  const etatDate = (echeance, auj, jours) => (echeance < auj ? 'retard' : ecart(auj, echeance) <= jours ? 'proche' : 'ok');

  // ---------- Réservations ----------
  // Intervalles [debut, fin[ au format AAAA-MM-JJTHH:MM.
  const chevauche = (a, b) => a.debut < b.fin && b.debut < a.fin;
  function conflits(liste, r) {
    return liste.filter((x) => x.id !== r.id && !x.annulee && chevauche(x, r) && (x.vehiculeId === r.vehiculeId || (r.conducteurId && x.conducteurId === r.conducteurId)));
  }
  // Renvoie un message d'erreur ou null. noms : { vehicule(id), conducteur(id) } pour le message.
  function validerReservation(liste, r, noms = { vehicule: () => 'ce véhicule', conducteur: () => 'ce conducteur' }) {
    if (!r.vehiculeId) return 'Choisis un véhicule.';
    if (!estDateHeure(r.debut) || !estDateHeure(r.fin)) return 'Début et fin : date et heure complètes.';
    if (r.fin <= r.debut) return 'La fin doit suivre le début.';
    const c = conflits(liste, r)[0];
    if (!c) return null;
    const qui = c.vehiculeId === r.vehiculeId ? `${noms.vehicule(c.vehiculeId)} est déjà réservé` : `${noms.conducteur(c.conducteurId)} a déjà une réservation`;
    return `Conflit refusé : ${qui} du ${dateFr(c.debut)} ${c.debut.slice(11)} au ${dateFr(c.fin)} ${c.fin.slice(11)}.`;
  }
  // Réservations qui touchent un jour donné (pour le planning).
  const reservationsDuJour = (liste, jour) => liste.filter((r) => !r.annulee && r.debut.slice(0, 10) <= jour && r.fin > `${jour}T00:00`)
    .sort((a, b) => a.debut.localeCompare(b.debut));
  // Conducteur probable à une date (réservation qui couvre ce jour), pour proposer la désignation.
  function conducteurA(liste, vehiculeId, date) {
    const r = liste.find((x) => !x.annulee && x.vehiculeId === vehiculeId && x.debut.slice(0, 10) <= date && x.fin.slice(0, 10) >= date && x.conducteurId);
    return r ? r.conducteurId : null;
  }

  // ---------- Location longue durée ----------
  // lld : { debut, dureeMois, kmContrat, kmDebut, loyer, prixKmSup }. ry : km/jour (ou null).
  function suiviLLD(lld, kmAct, ry, auj) {
    if (!lld || !estDate(lld.debut) || !(lld.dureeMois > 0)) return null;
    const fin = ajoutMois(lld.debut, Number(lld.dureeMois));
    const joursTotal = Math.max(1, ecart(lld.debut, fin));
    const joursEcoules = Math.min(joursTotal, Math.max(0, ecart(lld.debut, auj)));
    const joursRestants = joursTotal - joursEcoules;
    const kmParcourus = Math.max(0, kmAct - (Number(lld.kmDebut) || 0));
    const kmContrat = Number(lld.kmContrat) || 0;
    const kmAutorises = Math.round(kmContrat * joursEcoules / joursTotal);
    const vitesse = ry ?? (joursEcoules > 0 ? kmParcourus / joursEcoules : 0);
    const kmProjete = Math.round(kmParcourus + vitesse * joursRestants);
    const depassement = kmContrat > 0 ? Math.max(0, kmProjete - kmContrat) : 0;
    const coutDepassement = arrondi(depassement * (Number(lld.prixKmSup) || 0));
    let loyersEchus = 0;
    while (loyersEchus < Number(lld.dureeMois) && ajoutMois(lld.debut, loyersEchus) <= auj) loyersEchus++;
    return { fin, joursTotal, joursEcoules, joursRestants, kmParcourus, kmContrat, kmAutorises, kmProjete, depassement, coutDepassement,
      ecartProrata: kmParcourus - kmAutorises, loyersEchus, loyers: arrondi(loyersEchus * (Number(lld.loyer) || 0)), termine: auj >= fin };
  }

  // ---------- Coûts ----------
  // Coût total d'un véhicule depuis son entrée dans la flotte, jusqu'à `auj`.
  function coutVehicule(etat, v, auj) {
    const pts = pointsKm(etat, v);
    const km = Math.max(0, kmActuel(pts) - (Number(v.kmEntree) || 0));
    const somme = (l) => arrondi(l.reduce((s, x) => s + nombre(x.cout ?? x.montant), 0));
    const duV = (l) => (l || []).filter((x) => x.vehiculeId === v.id && (!x.date || x.date <= auj));
    let detention = 0;
    if (v.detention === 'lld') detention = suiviLLD(v.lld, kmActuel(pts), null, auj)?.loyers || 0;
    else if (nombre(v.prixAchat) > 0 && Number(v.amortMois) > 0 && estDate(v.entree)) {
      detention = arrondi(nombre(v.prixAchat) * Math.min(moisPleins(v.entree, auj), Number(v.amortMois)) / Number(v.amortMois));
    }
    const dep = duV(etat.depenses);
    const parPoste = {};
    for (const d of dep) parPoste[d.poste] = arrondi((parPoste[d.poste] || 0) + nombre(d.montant));
    const depenses = somme(dep);
    const entretien = somme(duV(etat.entretiens));
    const controles = somme(duV(etat.controles));
    const sinistres = somme(duV(etat.sinistres));
    const amendes = arrondi(duV((etat.amendes || []).map((a) => ({ ...a, date: a.dateInfraction }))).reduce((s, a) => s + nombre(a.montant), 0));
    const total = arrondi(detention + depenses + entretien + controles + sinistres);
    return { detention, depenses, parPoste, entretien: arrondi(entretien + controles), entretienSeul: entretien, controles, sinistres, total, km, coutKm: km >= 1 ? arrondi(total / km, 3) : null, amendes };
  }

  // ---------- Amendes ----------
  const echeanceDesignation = (a, jours) => (estDate(a.dateAvis) ? ajout(a.dateAvis, jours) : null);

  // ---------- Alertes ----------
  // Une alerte : { type, etat: retard|proche, vehiculeId, refId, titre, detail, date } ; triées.
  function alertes(etat, base, auj) {
    const rg = etat.reglages;
    const al = { jours: rg.alerteJours, km: rg.alerteKm };
    const out = [];
    for (const v of etat.vehicules.filter((x) => x.actif !== false)) {
      const pts = pointsKm(etat, v);
      const kmA = kmActuel(pts), ry = rythme(pts, auj);
      for (const op of v.plan || []) {
        const e = echeanceEntretien(op, v, etat.entretiens, kmA, auj, al, ry);
        if (e.etat === 'retard' || e.etat === 'proche') {
          const crit = [e.echKm !== null && `${e.echKm.toLocaleString('fr-FR')} km`, e.echDate && dateFr(e.echDate)].filter(Boolean).join(' ou ');
          out.push({ type: 'entretien', etat: e.etat, vehiculeId: v.id, refId: op.id, titre: op.nom, detail: `Échéance : ${crit}, la première atteinte`, date: e.prevue || e.echDate || auj });
        }
      }
      for (const c of echeancesCT(v, etat.controles, rg, base)) {
        const et = etatDate(c.echeance, auj, rg.alerteJours);
        if (et === 'ok') continue;
        const titres = { periodique: c.premier ? 'Premier contrôle technique' : 'Contrôle technique périodique', pollution: 'Contrôle complémentaire pollution', 'contre-visite': 'Contre-visite du contrôle technique' };
        out.push({ type: 'ct', etat: et, vehiculeId: v.id, refId: c.nature, titre: titres[c.nature], detail: `À faire au plus tard le ${dateFr(c.echeance)}`, date: c.echeance });
      }
      if (v.detention === 'lld') {
        const s = suiviLLD(v.lld, kmA, ry, auj);
        if (s && !s.termine && s.depassement > 0) out.push({ type: 'lld', etat: s.ecartProrata > 0 ? 'retard' : 'proche', vehiculeId: v.id, refId: 'lld', titre: 'Location : dépassement kilométrique projeté', detail: `≈ ${s.depassement.toLocaleString('fr-FR')} km au-delà du contrat${s.coutDepassement ? `, ≈ ${s.coutDepassement.toLocaleString('fr-FR')} €` : ''}`, date: s.fin });
        if (s && !s.termine && ecart(auj, s.fin) <= 90) out.push({ type: 'lld-fin', etat: 'proche', vehiculeId: v.id, refId: 'lld-fin', titre: 'Fin du contrat de location', detail: `Le ${dateFr(s.fin)} : prépare la restitution ou le renouvellement`, date: s.fin });
      }
      const der = dernierReleve(pts);
      if (der && ecart(der, auj) > rg.releveAncienJours) out.push({ type: 'releve', etat: 'proche', vehiculeId: v.id, refId: 'releve', titre: 'Relevé kilométrique ancien', detail: `Dernier relevé le ${dateFr(der)} : les échéances au km sont estimées`, date: ajout(der, rg.releveAncienJours) });
    }
    for (const a of etat.amendes || []) {
      if (a.statut !== 'a-designer') continue;
      const ech = echeanceDesignation(a, rg.designationJours);
      if (!ech) continue;
      out.push({ type: 'amende', etat: ech < auj ? 'retard' : 'proche', vehiculeId: a.vehiculeId, refId: a.id, titre: 'Amende : conducteur à désigner', detail: `Avant le ${dateFr(ech)} (avis du ${dateFr(a.dateAvis)})`, date: ech });
    }
    for (const s of etat.sinistres || []) {
      if (s.statut === 'clos') continue;
      out.push({ type: 'sinistre', etat: 'proche', vehiculeId: s.vehiculeId, refId: s.id, titre: 'Sinistre en cours', detail: s.description || 'Dossier à suivre', date: s.date });
    }
    const rang = { retard: 0, proche: 1 };
    return out.sort((a, b) => rang[a.etat] - rang[b.etat] || (a.date || '').localeCompare(b.date || ''));
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;

  function csvVehicules(etat, base, auj) {
    const rg = etat.reglages;
    const entetes = ['Immatriculation', 'Libellé', 'Type', 'Énergie', 'Mise en circulation', 'Détention', 'Km actuel', 'Km depuis l\'entrée', 'Prochain entretien', 'Échéance entretien', 'Prochain contrôle technique', 'Coût total', 'Coût au km', 'Amendes (pour mémoire)'];
    const lignes = etat.vehicules.map((v) => {
      const pts = pointsKm(etat, v), kmA = kmActuel(pts), ry = rythme(pts, auj);
      const ents = (v.plan || []).map((op) => echeanceEntretien(op, v, etat.entretiens, kmA, auj, { jours: rg.alerteJours, km: rg.alerteKm }, ry)).filter((e) => e.prevue).sort((a, b) => a.prevue.localeCompare(b.prevue));
      const ct = echeancesCT(v, etat.controles, rg, base).sort((a, b) => a.echeance.localeCompare(b.echeance))[0];
      const c = coutVehicule(etat, v, auj);
      return [v.immat, v.libelle, base.types.find((t) => t.code === v.type)?.court || v.type, base.energies.find((e) => e.code === v.energie)?.nom || v.energie, dateFr(v.miseEnCirculation),
        v.detention === 'lld' ? 'Location longue durée' : 'Achat', kmA, c.km, ents[0]?.op.nom || '', dateFr(ents[0]?.prevue), ct ? dateFr(ct.echeance) : '', c.total, c.coutKm ?? '', c.amendes];
    });
    return versCsv([entetes, ...lignes]);
  }

  function csvCouts(etat, base, auj) {
    const v = (id) => etat.vehicules.find((x) => x.id === id);
    const poste = (c) => base.postes.find((p) => p.code === c)?.nom || c;
    const lignes = [];
    for (const d of etat.depenses || []) lignes.push([d.date, v(d.vehiculeId)?.immat, poste(d.poste), d.libelle || '', nombre(d.montant)]);
    for (const e of etat.entretiens || []) lignes.push([e.date, v(e.vehiculeId)?.immat, 'Entretien', [e.prestataire, e.note].filter(Boolean).join(' · '), nombre(e.cout)]);
    for (const c of etat.controles || []) lignes.push([c.date, v(c.vehiculeId)?.immat, 'Contrôle technique', c.centre || '', nombre(c.cout)]);
    for (const s of etat.sinistres || []) lignes.push([s.date, v(s.vehiculeId)?.immat, 'Sinistre (reste à charge)', s.description || '', nombre(s.cout)]);
    for (const x of etat.vehicules) {
      if (x.detention !== 'lld' || !x.lld?.loyer) continue;
      const s = suiviLLD(x.lld, 0, null, auj);
      for (let k = 0; s && k < s.loyersEchus; k++) lignes.push([ajoutMois(x.lld.debut, k), x.immat, 'Loyer de location', `Échéance ${k + 1} / ${x.lld.dureeMois}`, nombre(x.lld.loyer)]);
    }
    lignes.sort((a, b) => a[0].localeCompare(b[0]) || String(a[1]).localeCompare(String(b[1])));
    return versCsv([['Date', 'Immatriculation', 'Poste', 'Libellé', 'Montant'], ...lignes.filter((l) => l[0] <= auj).map((l) => [dateFr(l[0]), ...l.slice(1)])]);
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, estDateHeure, dateFr, ajoutMois, moisPleins, lundi, plat, nombre, arrondi, immat,
    pointsKm, kmActuel, dernierReleve, rythme, verifierReleve, planDefaut, echeanceEntretien, echeancesCT, etatDate,
    chevauche, conflits, validerReservation, reservationsDuJour, conducteurA, suiviLLD, coutVehicule, echeanceDesignation,
    alertes, champCsv, csvVehicules, csvCouts, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
