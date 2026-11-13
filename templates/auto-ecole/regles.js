// Règles métier de la gestion d'auto-école : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/auto-ecole.test.mjs).
// Aucune fonction ne lit la date du jour : elle est toujours passée en paramètre (auj).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois ; le jour est borné à la fin du mois (31 janvier + 1 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mois = total % 12;
    const fin = new Date(an, mois + 1, 0).getDate();
    return `${an}-${deux(mois + 1)}-${deux(Math.min(j, fin))}`;
  }
  // Jour de la semaine : 1 = lundi … 7 = dimanche.
  const jourSemaine = (s) => { const j = versDate(s).getDay(); return j === 0 ? 7 : j; };
  const lundi = (s) => ajout(s, 1 - jourSemaine(s));
  const mois = (s) => s.slice(0, 7);

  // ---------- Heures « HH:MM » ↔ minutes depuis minuit ----------
  const estHeure = (h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  const minutes = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const hhmm = (m) => `${deux(Math.floor(m / 60))}:${deux(m % 60)}`;

  // Plages de disponibilité : « 08:00-12:00, 14:00-19:00 » → [[480, 720], [840, 1140]].
  // Chaîne vide → aucune plage. Lève une erreur lisible si une plage est mal écrite ou se chevauche.
  function lirePlages(texte) {
    const t = String(texte || '').trim();
    if (!t) return [];
    const plages = t.split(/[,;]/).map((p) => p.trim()).filter(Boolean).map((p) => {
      const m = p.match(/^(\d{1,2})[:h](\d{2})\s*[-–à]+\s*(\d{1,2})[:h](\d{2})$/);
      if (!m) throw new Error(`Plage illisible : « ${p} » (écris par exemple 08:00-12:00).`);
      const d = Number(m[1]) * 60 + Number(m[2]), f = Number(m[3]) * 60 + Number(m[4]);
      if (Number(m[2]) > 59 || Number(m[4]) > 59 || f > 24 * 60) throw new Error(`Heure invalide dans « ${p} ».`);
      if (f <= d) throw new Error(`La plage « ${p} » finit avant de commencer.`);
      return [d, f];
    }).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < plages.length; i++) if (plages[i][0] < plages[i - 1][1]) throw new Error('Deux plages se chevauchent.');
    return plages;
  }
  const ecrirePlages = (p) => (p || []).map(([d, f]) => `${hhmm(d)}-${hhmm(f)}`).join(', ');
  const dureePlages = (p) => (p || []).reduce((s, [d, f]) => s + (f - d), 0);

  // ---------- Leçons ----------
  // Une leçon occupe [debut, debut + duree[ le jour date. Les leçons annulées n'occupent rien.
  const debutMin = (l) => minutes(l.debut);
  const finMin = (l) => debutMin(l) + Number(l.duree || 0);
  const occupe = (l) => l.statut !== 'annulee';
  const chevauchent = (a, b) => a.date === b.date && debutMin(a) < finMin(b) && debutMin(b) < finMin(a);
  const heures = (l) => Number(l.duree || 0) / 60;
  // La leçon compte dans les heures consommées par l'élève (faite, ou absence non excusée si décomptée).
  const decompte = (l, reglages) => l.statut === 'faite' || (l.statut === 'absent' && !!reglages?.decompteAbsence);

  // Leçons en conflit avec l (même moniteur, même véhicule ou même élève), l exclue.
  function conflits(l, lecons) {
    if (!occupe(l)) return [];
    const res = [];
    for (const x of lecons) {
      if (x.id === l.id || !occupe(x) || !chevauchent(l, x)) continue;
      const motifs = [];
      if (l.moniteurId && x.moniteurId === l.moniteurId) motifs.push('moniteur');
      if (l.vehiculeId && x.vehiculeId === l.vehiculeId) motifs.push('vehicule');
      if (l.eleveId && x.eleveId === l.eleveId) motifs.push('eleve');
      if (motifs.length) res.push({ lecon: x, motifs });
    }
    return res;
  }

  const absentLe = (moniteur, date) => (moniteur?.absences || []).some((a) => a.debut <= date && date <= (a.fin || a.debut));
  // La leçon tient-elle dans une plage du moniteur ce jour-là (et hors absence) ?
  function dansDispo(l, moniteur) {
    if (!moniteur || absentLe(moniteur, l.date)) return false;
    const plages = moniteur.dispos?.[jourSemaine(l.date)] || [];
    return plages.some(([d, f]) => d <= debutMin(l) && finMin(l) <= f);
  }
  function dansOuverture(l, reglages) {
    if (!(reglages.joursOuverts || []).includes(jourSemaine(l.date))) return false;
    return minutes(reglages.ouverture) <= debutMin(l) && finMin(l) <= minutes(reglages.fermeture);
  }

  // Contrôle complet d'une leçon avant enregistrement.
  // Renvoie { erreurs: [texte], conflits: [...], horsDispo: bool, horsOuverture: bool }.
  // Les conflits et les champs invalides bloquent toujours ; hors disponibilité ou hors ouverture
  // bloquent sauf si forcer est vrai.
  function verifierLecon(l, etat, forcer = false, noms = {}) {
    const erreurs = [];
    if (!l.eleveId) erreurs.push('Choisis un élève.');
    if (!l.moniteurId) erreurs.push('Choisis un moniteur.');
    if (!estDate(l.date)) erreurs.push('Date invalide.');
    if (!estHeure(l.debut)) erreurs.push('Heure de début invalide (HH:MM).');
    const d = Number(l.duree);
    if (!Number.isInteger(d) || d < 15 || d > 480) erreurs.push('Durée : entre 15 et 480 minutes.');
    if (erreurs.length) return { erreurs, conflits: [], horsDispo: false, horsOuverture: false };
    if (finMin(l) > 24 * 60) return { erreurs: ['La leçon doit finir avant minuit.'], conflits: [], horsDispo: false, horsOuverture: false };
    const c = conflits(l, etat.lecons || []);
    const nom = (k, id) => (noms[k] ? noms[k](id) : id);
    c.forEach(({ lecon: x, motifs }) => {
      const qui = motifs.map((m) => ({ moniteur: `moniteur ${nom('moniteur', x.moniteurId)}`, vehicule: `véhicule ${nom('vehicule', x.vehiculeId)}`, eleve: `élève ${nom('eleve', x.eleveId)}` }[m])).join(', ');
      erreurs.push(`Conflit (${qui}) avec la leçon de ${x.debut} à ${hhmm(finMin(x))} : ${nom('eleve', x.eleveId)} avec ${nom('moniteur', x.moniteurId)}.`);
    });
    const moniteur = (etat.moniteurs || []).find((m) => m.id === l.moniteurId);
    const horsDispo = occupe(l) && !dansDispo(l, moniteur);
    const horsOuverture = occupe(l) && !dansOuverture(l, etat.reglages);
    if (!forcer && horsDispo) erreurs.push(absentLe(moniteur, l.date) ? 'Le moniteur est absent ce jour-là (coche « Forcer » pour enregistrer quand même).' : 'Hors des disponibilités du moniteur (coche « Forcer » pour enregistrer quand même).');
    if (!forcer && horsOuverture) erreurs.push('Hors des jours ou horaires d\'ouverture (coche « Forcer » pour enregistrer quand même).');
    return { erreurs, conflits: c, horsDispo, horsOuverture };
  }

  // ---------- Élèves : solde d'heures et solde financier ----------
  const arrondi = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
  function soldeEleve(eleveId, etat, auj) {
    const achats = (etat.achats || []).filter((a) => a.eleveId === eleveId);
    const paiements = (etat.paiements || []).filter((p) => p.eleveId === eleveId);
    const lecons = (etat.lecons || []).filter((l) => l.eleveId === eleveId);
    const achetees = arrondi(achats.reduce((s, a) => s + Number(a.heures || 0), 0));
    const faites = arrondi(lecons.filter((l) => decompte(l, etat.reglages)).reduce((s, l) => s + heures(l), 0));
    const prevues = lecons.filter((l) => l.statut === 'prevue');
    const planifiees = arrondi(prevues.reduce((s, l) => s + heures(l), 0));
    const facture = arrondi(achats.reduce((s, a) => s + Number(a.montant || 0), 0));
    const paye = arrondi(paiements.reduce((s, p) => s + Number(p.montant || 0), 0));
    const passees = lecons.filter((l) => decompte(l, etat.reglages)).map((l) => l.date).sort();
    const avenir = prevues.filter((l) => l.date >= auj).map((l) => `${l.date} ${l.debut}`).sort();
    return {
      achetees, faites, planifiees,
      restantes: arrondi(achetees - faites),
      aPlanifier: arrondi(achetees - faites - planifiees),
      facture, paye, du: arrondi(facture - paye),
      aPointer: prevues.filter((l) => l.date < auj).length,
      derniere: passees.at(-1) || null,
      prochaine: avenir[0] || null,
    };
  }

  // Progression des compétences : acquises / total (liste des réglages).
  function progression(eleve, competences) {
    const total = competences.length;
    const acquises = competences.filter((c) => eleve.competences?.[c]).length;
    return { acquises, total, taux: total ? Math.round((acquises / total) * 100) : 0 };
  }

  // ---------- Véhicules ----------
  function kmActuel(v, etat) {
    let km = Number(v.kmEntree || 0);
    for (const r of etat.releves || []) if (r.vehiculeId === v.id) km = Math.max(km, Number(r.km || 0));
    for (const i of etat.interventionsV || []) if (i.vehiculeId === v.id && i.km) km = Math.max(km, Number(i.km));
    return km;
  }
  // Un relevé est refusé s'il est inférieur à un relevé antérieur ou supérieur à un relevé postérieur.
  function releveValide(v, etat, date, km) {
    const points = [
      { date: v.dateEntree || '0000-00-00', km: Number(v.kmEntree || 0) },
      ...(etat.releves || []).filter((r) => r.vehiculeId === v.id).map((r) => ({ date: r.date, km: Number(r.km) })),
      ...(etat.interventionsV || []).filter((i) => i.vehiculeId === v.id && i.km).map((i) => ({ date: i.date, km: Number(i.km) })),
    ];
    if (!Number.isFinite(km) || km < 0) return 'Kilométrage invalide.';
    const avant = points.filter((p) => p.date <= date).reduce((m, p) => Math.max(m, p.km), 0);
    const apres = points.filter((p) => p.date > date).reduce((m, p) => Math.min(m, p.km), Infinity);
    if (km < avant) return `Kilométrage inférieur à un relevé antérieur (${avant} km).`;
    if (km > apres) return `Kilométrage supérieur à un relevé postérieur (${apres} km).`;
    return null;
  }

  // Échéance d'entretien : la première atteinte (km ou date) compte.
  function entretien(v, etat, auj, reglages) {
    const ik = Number(v.entretienKm || 0), im = Number(v.entretienMois || 0);
    if (!ik && !im) return { etat: 'inconnu', echeanceKm: null, echeanceDate: null };
    const derniers = (etat.interventionsV || []).filter((i) => i.vehiculeId === v.id && i.type === 'entretien').sort((a, b) => a.date.localeCompare(b.date));
    const ref = derniers.at(-1);
    const refDate = ref?.date || v.dateEntree || auj;
    const refKm = ref?.km ? Number(ref.km) : Number(v.kmEntree || 0);
    const echeanceKm = ik ? refKm + ik : null;
    const echeanceDate = im ? ajoutMois(refDate, im) : null;
    const km = kmActuel(v, etat);
    const aj = reglages?.alerteJours ?? 30, ak = reglages?.alerteKm ?? 1000;
    let e = 'ok';
    if ((echeanceKm !== null && km >= echeanceKm) || (echeanceDate && echeanceDate <= auj)) e = 'retard';
    else if ((echeanceKm !== null && echeanceKm - km <= ak) || (echeanceDate && ecart(auj, echeanceDate) <= aj)) e = 'proche';
    return { etat: e, echeanceKm, echeanceDate, km, resteKm: echeanceKm !== null ? echeanceKm - km : null };
  }

  // Contrôle technique : date limite saisie (dernière intervention CT qui en porte une, sinon fiche).
  function controle(v, etat, auj, reglages) {
    const cts = (etat.interventionsV || []).filter((i) => i.vehiculeId === v.id && i.type === 'ct' && estDate(i.prochainCT)).sort((a, b) => a.date.localeCompare(b.date));
    const date = cts.at(-1)?.prochainCT || (estDate(v.ctProchain) ? v.ctProchain : null);
    if (!date) return { etat: 'inconnu', date: null };
    const aj = reglages?.alerteJours ?? 30;
    // La date limite est le dernier jour valable : en retard le lendemain.
    if (date < auj) return { etat: 'retard', date, jours: ecart(date, auj) };
    return { etat: ecart(auj, date) <= aj ? 'proche' : 'ok', date, jours: ecart(auj, date) };
  }
  // Proposition de date limite après un contrôle, si une périodicité (mois) est réglée : date + n mois − 1 jour.
  const proposerCT = (date, periodicite) => (periodicite && estDate(date) ? ajout(ajoutMois(date, Number(periodicite)), -1) : null);

  // Coût par heure de conduite d'un véhicule sur [debut, fin] (dates incluses).
  function coutVehicule(v, etat, debut, fin) {
    const interv = (etat.interventionsV || []).filter((i) => i.vehiculeId === v.id && i.date >= debut && i.date <= fin);
    const couts = arrondi(interv.reduce((s, i) => s + Number(i.cout || 0), 0));
    const d0 = v.dateEntree && v.dateEntree > debut ? v.dateEntree : debut;
    const jours = d0 <= fin ? ecart(d0, fin) + 1 : 0;
    const fixe = arrondi(Number(v.coutMensuel || 0) * jours * 12 / 365.25);
    const h = arrondi((etat.lecons || []).filter((l) => l.vehiculeId === v.id && l.date >= debut && l.date <= fin && decompte(l, etat.reglages)).reduce((s, l) => s + heures(l), 0));
    const total = arrondi(couts + fixe);
    return { couts, fixe, total, heures: h, parHeure: h > 0 ? arrondi(total / h) : null };
  }

  // ---------- Occupation d'une semaine (lundi donné) ----------
  function occupation(lundiStr, etat) {
    const R = etat.reglages;
    const jours = Array.from({ length: 7 }, (_, i) => ajout(lundiStr, i));
    const fin = jours[6];
    const lecons = (etat.lecons || []).filter((l) => occupe(l) && l.date >= lundiStr && l.date <= fin);
    const ouvert = (R.joursOuverts || []).length * (minutes(R.fermeture) - minutes(R.ouverture)) / 60;
    const taux = (h, dispo) => (dispo > 0 ? Math.round((h / dispo) * 100) : null);
    const vehicules = (etat.vehicules || []).filter((v) => v.actif !== false).map((v) => {
      const h = arrondi(lecons.filter((l) => l.vehiculeId === v.id).reduce((s, l) => s + heures(l), 0));
      return { id: v.id, heures: h, dispo: ouvert, taux: taux(h, ouvert) };
    });
    const moniteurs = (etat.moniteurs || []).filter((m) => m.actif !== false).map((m) => {
      const dispo = arrondi(jours.reduce((s, j) => s + (absentLe(m, j) ? 0 : dureePlages(m.dispos?.[jourSemaine(j)])), 0) / 60);
      const h = arrondi(lecons.filter((l) => l.moniteurId === m.id).reduce((s, l) => s + heures(l), 0));
      return { id: m.id, heures: h, dispo, taux: taux(h, dispo) };
    });
    return { vehicules, moniteurs };
  }

  // ---------- Heures vendues et faites par mois (n derniers mois, mois courant compris) ----------
  function parMois(etat, auj, n = 6) {
    const liste = Array.from({ length: n }, (_, i) => mois(ajoutMois(`${mois(auj)}-01`, i - n + 1)));
    return liste.map((m) => ({
      mois: m,
      vendues: arrondi((etat.achats || []).filter((a) => mois(a.date) === m).reduce((s, a) => s + Number(a.heures || 0), 0)),
      faites: arrondi((etat.lecons || []).filter((l) => mois(l.date) === m && decompte(l, etat.reglages)).reduce((s, l) => s + heures(l), 0)),
      encaisse: arrondi((etat.paiements || []).filter((p) => mois(p.date) === m).reduce((s, p) => s + Number(p.montant || 0), 0)),
    }));
  }

  // ---------- Alertes (triées : retard d'abord, puis par date) ----------
  function alertes(etat, auj) {
    const res = [];
    const R = etat.reglages;
    for (const v of (etat.vehicules || []).filter((x) => x.actif !== false)) {
      const c = controle(v, etat, auj, R);
      if (c.etat === 'retard') res.push({ niveau: 'retard', type: 'ct', id: v.id, date: c.date, texte: `${v.nom} : contrôle technique dépassé depuis le ${dateFr(c.date)}` });
      else if (c.etat === 'proche') res.push({ niveau: 'proche', type: 'ct', id: v.id, date: c.date, texte: `${v.nom} : contrôle technique avant le ${dateFr(c.date)}` });
      else if (c.etat === 'inconnu') res.push({ niveau: 'info', type: 'ct', id: v.id, date: '9999', texte: `${v.nom} : date limite du contrôle technique non saisie` });
      const e = entretien(v, etat, auj, R);
      if (e.etat === 'retard' || e.etat === 'proche') {
        const quoi = [e.echeanceKm !== null ? `${e.echeanceKm.toLocaleString('fr-FR')} km` : '', e.echeanceDate ? `le ${dateFr(e.echeanceDate)}` : ''].filter(Boolean).join(' ou ');
        res.push({ niveau: e.etat, type: 'entretien', id: v.id, date: e.echeanceDate || auj, texte: `${v.nom} : entretien ${e.etat === 'retard' ? 'dépassé' : 'à prévoir'} (${quoi})` });
      }
    }
    for (const el of (etat.eleves || []).filter((x) => x.statut !== 'termine')) {
      const s = soldeEleve(el.id, etat, auj);
      if (s.restantes < 0) res.push({ niveau: 'retard', type: 'heures', id: el.id, date: auj, texte: `${el.nom} : ${Math.abs(s.restantes)} h faites au-delà des heures achetées` });
      else if (s.aPlanifier < 0) res.push({ niveau: 'proche', type: 'heures', id: el.id, date: auj, texte: `${el.nom} : ${Math.abs(s.aPlanifier)} h planifiées au-delà du forfait` });
      else if (s.achetees > 0 && s.restantes === 0 && s.planifiees === 0) res.push({ niveau: 'proche', type: 'heures', id: el.id, date: auj, texte: `${el.nom} : forfait épuisé` });
      if (s.du > 0) res.push({ niveau: s.du > 0 && s.faites >= s.achetees && s.achetees > 0 ? 'retard' : 'proche', type: 'paiement', id: el.id, date: auj, texte: `${el.nom} : reste ${s.du.toLocaleString('fr-FR')} € à encaisser` });
      if (s.aPointer) res.push({ niveau: 'proche', type: 'pointage', id: el.id, date: auj, texte: `${el.nom} : ${s.aPointer} leçon${s.aPointer > 1 ? 's' : ''} passée${s.aPointer > 1 ? 's' : ''} à pointer` });
    }
    const ordre = { retard: 0, proche: 1, info: 2 };
    return res.sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || a.date.localeCompare(b.date) || a.texte.localeCompare(b.texte));
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const nomDe = (liste, id) => (liste || []).find((x) => x.id === id)?.nom || '';
  const STATUTS = { prevue: 'Prévue', faite: 'Faite', absent: 'Élève absent', annulee: 'Annulée' };

  function csvEleves(etat, auj) {
    const ent = ['Élève', 'Statut', 'Boîte', 'Inscription', 'Heures achetées', 'Heures faites', 'Heures planifiées', 'Heures restantes', 'Facturé (€)', 'Payé (€)', 'Reste dû (€)', 'Compétences acquises', 'Dernière leçon', 'Prochaine leçon'];
    const comp = etat.reglages.competences || [];
    const lignes = [...(etat.eleves || [])].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => {
      const s = soldeEleve(e.id, etat, auj);
      const p = progression(e, comp);
      return [e.nom, e.statut === 'termine' ? 'Terminé' : 'Actif', e.boite === 'auto' ? 'Automatique' : 'Manuelle', dateFr(e.inscription), s.achetees, s.faites, s.planifiees, s.restantes, s.facture, s.paye, s.du, `${p.acquises}/${p.total}`, dateFr(s.derniere), s.prochaine ? `${dateFr(s.prochaine.slice(0, 10))} ${s.prochaine.slice(11)}` : ''];
    });
    return versCsv([ent, ...lignes]);
  }

  function csvLecons(etat, debut, fin) {
    const ent = ['Date', 'Début', 'Fin', 'Durée (min)', 'Élève', 'Moniteur', 'Véhicule', 'Statut', 'Note'];
    const lignes = (etat.lecons || []).filter((l) => (!debut || l.date >= debut) && (!fin || l.date <= fin))
      .sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut))
      .map((l) => [dateFr(l.date), l.debut, hhmm(finMin(l)), Number(l.duree), nomDe(etat.eleves, l.eleveId), nomDe(etat.moniteurs, l.moniteurId), nomDe(etat.vehicules, l.vehiculeId), STATUTS[l.statut] || l.statut, l.note || '']);
    return versCsv([ent, ...lignes]);
  }

  function csvVehicules(etat, auj) {
    const debut = ajout(ajoutMois(auj, -12), 1);
    const ent = ['Véhicule', 'Immatriculation', 'Boîte', 'Kilométrage', 'Contrôle technique avant le', 'Entretien à (km)', 'Entretien avant le', 'Coûts 12 mois (€)', 'Heures 12 mois', 'Coût par heure (€)'];
    const lignes = (etat.vehicules || []).map((v) => {
      const c = controle(v, etat, auj, etat.reglages), e = entretien(v, etat, auj, etat.reglages), k = coutVehicule(v, etat, debut, auj);
      return [v.nom, v.immat || '', v.boite === 'auto' ? 'Automatique' : 'Manuelle', kmActuel(v, etat), dateFr(c.date), e.echeanceKm ?? '', dateFr(e.echeanceDate), k.total, k.heures, k.parHeure ?? ''];
    });
    return versCsv([ent, ...lignes]);
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, jourSemaine, lundi, mois,
    estHeure, minutes, hhmm, lirePlages, ecrirePlages, dureePlages,
    debutMin, finMin, occupe, chevauchent, heures, decompte, conflits, absentLe, dansDispo, dansOuverture, verifierLecon,
    arrondi, soldeEleve, progression, kmActuel, releveValide, entretien, controle, proposerCT, coutVehicule,
    occupation, parMois, alertes, champCsv, csvEleves, csvLecons, csvVehicules, taille, STATUTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
