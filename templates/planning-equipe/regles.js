// Planning d'équipe et staffing QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.EQP) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Charges et capacités en heures.
// Une affectation donne « heures » par semaine d'une personne à un projet ou un poste, du « debut » au
// « fin » inclus ; ces heures se répartissent sur les jours travaillés de la personne. La capacité d'une
// semaine = capacité hebdomadaire de la personne, moins ses jours non travaillés, les fériés chômés et
// ses absences. Une affectation qui tombe pendant une absence reste comptée : c'est un conflit à régler.
(function (racine) {
  'use strict';

  const TYPES_PROJET = ['projet', 'poste'];
  const STATUTS_PROJET = ['actif', 'pause', 'termine'];
  const LIB_STATUT = { actif: 'Actif', pause: 'En pause', termine: 'Terminé' };
  const COMPTE = ['actif']; // statuts de projet dont les affectations comptent dans la charge
  const EPS = 0.05;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const jourSemaine = (s) => versDate(s).getDay(); // 0 = dimanche … 6 = samedi
  const lundiDe = (s) => ajout(s, -((jourSemaine(s) + 6) % 7));
  const min = (a, b) => (a < b ? a : b);
  const max = (a, b) => (a > b ? a : b);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j, joursDansMois(an, mo)))}`;
  }
  // Numéro de semaine ISO 8601 (la semaine 1 contient le premier jeudi de l'année).
  function numeroSemaine(s) {
    const jeudi = ajout(lundiDe(s), 3);
    const premier = `${jeudi.slice(0, 4)}-01-01`;
    return Math.floor(ecart(premier, jeudi) / 7) + 1;
  }
  // Lundis des semaines qui touchent un mois (« AAAA-MM »).
  function semainesDuMois(mois) {
    const debut = `${mois}-01`;
    const fin = `${mois}-${deux(joursDansMois(Number(mois.slice(0, 4)), Number(mois.slice(5, 7))))}`;
    const res = [];
    for (let l = lundiDe(debut); l <= fin; l = ajout(l, 7)) res.push(l);
    return res;
  }
  const arrondi1 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;
  const nombre = (x) => { const v = arrondi1(x); return (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',').replace('-', '−'); };
  // « 17,5 », « 17.5 » → 17.5 ; null si vide ou illisible.
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Number(s);
  }

  // ---------- Jours fériés (France) ----------
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  // Les 11 fêtes légales (art. L3133-1 du Code du travail) et les 2 jours propres à l'Alsace-Moselle.
  const FERIES = [
    ['jan1', 'Jour de l\'an'], ['lundiPaques', 'Lundi de Pâques'], ['mai1', 'Fête du Travail'], ['mai8', 'Victoire 1945'],
    ['ascension', 'Ascension'], ['lundiPentecote', 'Lundi de Pentecôte'], ['juil14', 'Fête nationale'], ['aout15', 'Assomption'],
    ['nov1', 'Toussaint'], ['nov11', 'Armistice 1918'], ['dec25', 'Noël'], ['vendrediSaint', 'Vendredi saint (Alsace-Moselle)'], ['dec26', 'Saint-Étienne (Alsace-Moselle)'],
  ];
  const NOM_FERIE = Object.fromEntries(FERIES);
  function feries(annee) {
    const p = paques(annee);
    const fixe = (m, j) => `${annee}-${deux(m)}-${deux(j)}`;
    const dates = {
      jan1: fixe(1, 1), lundiPaques: ajout(p, 1), mai1: fixe(5, 1), mai8: fixe(5, 8), ascension: ajout(p, 39),
      lundiPentecote: ajout(p, 50), juil14: fixe(7, 14), aout15: fixe(8, 15), nov1: fixe(11, 1), nov11: fixe(11, 11),
      dec25: fixe(12, 25), vendrediSaint: ajout(p, -2), dec26: fixe(12, 26),
    };
    return FERIES.map(([id, nom]) => ({ id, nom, date: dates[id] })).sort((x, y) => x.date.localeCompare(y.date));
  }
  const cacheFeries = new Map();
  function ferieChome(date, reg) {
    const an = Number(date.slice(0, 4));
    const cle = `${an}|${(reg.feriesChomes || []).join(',')}`;
    if (!cacheFeries.has(cle)) {
      if (cacheFeries.size > 200) cacheFeries.clear();
      const choisis = new Set(reg.feriesChomes || []);
      cacheFeries.set(cle, new Map(feries(an).filter((f) => choisis.has(f.id)).map((f) => [f.date, f])));
    }
    return cacheFeries.get(cle).get(date) || null;
  }

  // ---------- Personnes, capacité ----------
  const actif = (p, date) => (!p.entree || p.entree <= date) && (!p.sortie || p.sortie >= date);
  const actifSemaine = (p, lundi) => (!p.entree || p.entree <= ajout(lundi, 6)) && (!p.sortie || p.sortie >= lundi);
  const joursDe = (p) => (p.jours && p.jours.length ? p.jours : [1, 2, 3, 4, 5]);
  // La personne travaille ce jour-là : jour de sa semaine type, présente dans l'entreprise, pas un férié chômé.
  const travailleLe = (p, date, reg) => joursDe(p).includes(jourSemaine(date)) && actif(p, date) && !ferieChome(date, reg);
  const heuresJour = (p) => (Number(p.capacite) || 0) / joursDe(p).length;
  const couvre = (x, date) => x.debut <= date && date <= x.fin;
  const seChevauchent = (a, b) => a.debut <= b.fin && b.debut <= a.fin;
  // Part de la journée d'absence (0, 0,5 ou 1) et l'absence en cause.
  function absenceLe(absences, pid, date) {
    let part = 0, abs = null;
    for (const a of absences) {
      if (a.personne !== pid || !couvre(a, date)) continue;
      let x = 1;
      if (a.debut === a.fin && (a.demiDebut || a.demiFin)) x = 0.5;
      else if ((a.demiDebut && date === a.debut) || (a.demiFin && date === a.fin)) x = 0.5;
      if (x > part) { part = x; abs = a; }
    }
    return { part: Math.min(1, part), absence: abs };
  }
  const projetCompte = (etat, id) => { const pr = etat.projets.find((x) => x.id === id); return !!pr && COMPTE.includes(pr.statut); };

  // Bilan d'une personne pour la semaine qui commence au lundi donné.
  // « affectations » permet de simuler une affectation en cours de saisie (aperçu).
  function bilanSemaine(etat, p, lundi, { affectations = etat.affectations } = {}) {
    const reg = etat.reglages;
    const h = heuresJour(p);
    const siennes = affectations.filter((a) => a.personne === p.id && a.fin >= lundi && a.debut <= ajout(lundi, 6) && projetCompte(etat, a.projet));
    const absences = etat.absences.filter((a) => a.personne === p.id && a.fin >= lundi && a.debut <= ajout(lundi, 6));
    const res = { personne: p.id, lundi, nominale: 0, capacite: 0, charge: 0, chargeAbsence: 0, joursAbsents: 0, parProjet: {}, jours: [], absences: [] };
    for (let i = 0; i < 7; i++) {
      const d = ajout(lundi, i);
      const travail = travailleLe(p, d, reg);
      const { part, absence } = absenceLe(absences, p.id, d);
      const jour = { date: d, travail, ferie: ferieChome(d, reg), part: travail ? part : 0, absence: travail && part ? absence : null, capacite: 0, charge: 0, projets: {} };
      if (travail) {
        jour.capacite = h * (1 - part);
        res.nominale += h;
        res.joursAbsents += part;
        for (const a of siennes) {
          if (!couvre(a, d)) continue;
          const x = (Number(a.heures) || 0) / joursDe(p).length;
          jour.charge += x;
          jour.projets[a.projet] = (jour.projets[a.projet] || 0) + x;
          res.parProjet[a.projet] = (res.parProjet[a.projet] || 0) + x;
          res.chargeAbsence += x * part;
        }
        if (absence && !res.absences.includes(absence)) res.absences.push(absence);
      }
      res.capacite += jour.capacite;
      res.charge += jour.charge;
      res.jours.push(jour);
    }
    for (const k of ['nominale', 'capacite', 'charge', 'chargeAbsence', 'joursAbsents']) res[k] = Math.round(res[k] * 100) / 100;
    for (const k of Object.keys(res.parProjet)) res.parProjet[k] = Math.round(res.parProjet[k] * 100) / 100;
    res.libre = Math.max(0, Math.round((res.capacite - res.charge) * 100) / 100);
    res.taux = res.capacite > 0 ? res.charge / res.capacite : (res.charge > 0 ? Infinity : 0);
    const presente = actifSemaine(p, lundi) && res.nominale > 0;
    if (!presente) res.etat = res.charge > 0 ? 'surcharge' : 'inactif';
    else if (res.capacite <= EPS && res.charge <= EPS) res.etat = 'absent';
    else if (res.charge > res.capacite * (reg.seuilSurcharge / 100) + EPS) res.etat = 'surcharge';
    else if (res.taux * 100 < reg.seuilDisponible) res.etat = 'disponible';
    else res.etat = 'plein';
    return res;
  }

  // Charge planifiée moyenne sur les 12 semaines qui finissent à celle du lundi donné.
  function moyenne12(etat, p, lundi) {
    let total = 0;
    for (let k = 11; k >= 0; k--) total += bilanSemaine(etat, p, ajout(lundi, -7 * k)).charge;
    return Math.round((total / 12) * 100) / 100;
  }

  // ---------- Projets et postes à couvrir ----------
  const actifProjetSemaine = (pr, lundi) => pr.statut === 'actif' && (!pr.debut || pr.debut <= ajout(lundi, 6)) && (!pr.fin || pr.fin >= lundi);
  // Besoin de la semaine : besoin hebdomadaire au prorata des jours d'ouverture couverts par le projet
  // (fériés chômés exclus) ; couvert : heures planifiées hors absences des personnes affectées.
  function couverture(etat, pr, lundi) {
    const reg = etat.reglages;
    const ouverture = reg.joursOuverture;
    let jo = 0;
    for (let i = 0; i < 7; i++) {
      const d = ajout(lundi, i);
      if (ouverture.includes(jourSemaine(d)) && !ferieChome(d, reg) && (!pr.debut || pr.debut <= d) && (!pr.fin || pr.fin >= d)) jo++;
    }
    const besoin = actifProjetSemaine(pr, lundi) && pr.besoin > 0 ? Math.round((pr.besoin * jo / ouverture.length) * 100) / 100 : 0;
    let affecte = 0, couvert = 0;
    const personnes = {};
    const competences = [];
    for (const a of etat.affectations) {
      if (a.projet !== pr.id || a.fin < lundi || a.debut > ajout(lundi, 6)) continue;
      const p = etat.personnes.find((x) => x.id === a.personne);
      if (!p) continue;
      const b = bilanSemaine(etat, p, lundi, { affectations: [a] });
      if (!(pr.statut === 'actif')) continue;
      let couv = 0;
      for (const j of b.jours) couv += (j.projets[pr.id] || 0) * (1 - j.part);
      affecte += b.charge;
      couvert += couv;
      personnes[p.id] = (personnes[p.id] || 0) + b.charge;
      // Signalé seulement si la personne n'a AUCUNE des compétences demandées (une équipe se complète).
      const manquantes = pr.competences.some((c) => p.competences.includes(c)) ? [] : [...pr.competences];
      if (manquantes.length && b.charge > 0 && !competences.some((x) => x.personne === p.id)) competences.push({ personne: p.id, manquantes, affectation: a.id });
    }
    affecte = Math.round(affecte * 100) / 100;
    couvert = Math.round(couvert * 100) / 100;
    const manque = besoin > 0 ? Math.max(0, Math.round((besoin - couvert) * 100) / 100) : 0;
    return { projet: pr.id, lundi, besoin, affecte, couvert, manque, trou: manque > 0.5, personnes, competences };
  }

  // ---------- Alertes ----------
  // Sur nbSemaines à partir du lundi donné : surcharge, affectation pendant une absence, plafond hebdomadaire,
  // moyenne sur 12 semaines, besoin non couvert, compétence manquante. Semaines consécutives regroupées.
  const GRAVITE = { surcharge: 1, absence: 2, plafond: 3, moyenne: 4, trou: 5, competence: 6 };
  function alertes(etat, lundi, nbSemaines = 4) {
    const reg = etat.reglages;
    const brutes = [];
    for (let k = 0; k < nbSemaines; k++) {
      const l = ajout(lundi, 7 * k);
      for (const p of etat.personnes) {
        if (!actifSemaine(p, l)) continue;
        const b = bilanSemaine(etat, p, l);
        if (b.etat === 'surcharge' && b.charge > 0) brutes.push({ type: 'surcharge', cle: p.id, personne: p.id, lundi: l, valeur: b.capacite > 0 ? Math.round(b.taux * 100) : null, charge: b.charge, capacite: b.capacite });
        if (b.chargeAbsence > EPS) brutes.push({ type: 'absence', cle: p.id, personne: p.id, lundi: l, valeur: b.chargeAbsence, absences: b.absences.map((a) => a.id) });
        if (reg.plafondSemaine > 0 && b.charge > reg.plafondSemaine + EPS) brutes.push({ type: 'plafond', cle: p.id, personne: p.id, lundi: l, valeur: b.charge });
        if (reg.plafondMoyen > 0 && b.charge > 0) { const m = moyenne12(etat, p, l); if (m > reg.plafondMoyen + EPS) brutes.push({ type: 'moyenne', cle: p.id, personne: p.id, lundi: l, valeur: m }); }
      }
      for (const pr of etat.projets) {
        if (!actifProjetSemaine(pr, l)) continue;
        const c = couverture(etat, pr, l);
        if (c.trou) brutes.push({ type: 'trou', cle: pr.id, projet: pr.id, lundi: l, valeur: c.manque, besoin: c.besoin });
        for (const x of c.competences) brutes.push({ type: 'competence', cle: `${pr.id}|${x.personne}`, projet: pr.id, personne: x.personne, lundi: l, valeur: x.manquantes.length, manquantes: x.manquantes, affectation: x.affectation });
      }
    }
    const res = [];
    for (const x of brutes) {
      const der = res.find((r) => r.type === x.type && r.cle === x.cle && ajout(r.fin, 7) === x.lundi);
      if (der) { der.fin = x.lundi; der.semaines += 1; if (x.valeur > der.valeur) der.valeur = x.valeur; }
      else res.push({ ...x, debut: x.lundi, fin: x.lundi, semaines: 1 });
    }
    return res.sort((a, b) => a.debut.localeCompare(b.debut) || GRAVITE[a.type] - GRAVITE[b.type]);
  }

  // ---------- Disponibilités ----------
  // Personnes présentes la semaine donnée, triées par heures libres ; filtres : compétence, rôle, heures libres minimum.
  function disponibles(etat, lundi, { competence = '', role = '', heuresMin = 0 } = {}) {
    return etat.personnes.filter((p) => actifSemaine(p, lundi) && (!role || p.role === role))
      .map((p) => ({ personne: p, bilan: bilanSemaine(etat, p, lundi), competence: !competence || p.competences.includes(competence) }))
      .filter((x) => x.competence)
      .map((x) => ({ ...x, disponible: x.bilan.libre >= Math.max(0.5, heuresMin) && x.bilan.etat !== 'surcharge' }))
      .sort((a, b) => Number(b.disponible) - Number(a.disponible) || b.bilan.libre - a.bilan.libre || a.personne.prenom.localeCompare(b.personne.prenom));
  }

  // Taux de charge de l'équipe (personnes présentes) sur une semaine.
  function equipeSemaine(etat, lundi) {
    let charge = 0, capacite = 0;
    const bilans = etat.personnes.filter((p) => actifSemaine(p, lundi)).map((p) => bilanSemaine(etat, p, lundi));
    for (const b of bilans) { charge += b.charge; capacite += b.capacite; }
    return { charge: Math.round(charge * 10) / 10, capacite: Math.round(capacite * 10) / 10, taux: capacite > 0 ? charge / capacite : 0, bilans };
  }

  // Aperçu d'une affectation en cours de saisie : bilan de la personne semaine par semaine (12 au plus).
  function apercuAffectation(etat, aff) {
    const p = etat.personnes.find((x) => x.id === aff.personne);
    const pr = etat.projets.find((x) => x.id === aff.projet);
    if (!p || !estDate(aff.debut) || !estDate(aff.fin) || aff.fin < aff.debut) return null;
    const affs = [...etat.affectations.filter((x) => x.id !== aff.id), aff];
    const semaines = [];
    for (let l = lundiDe(aff.debut); l <= aff.fin && semaines.length < 12; l = ajout(l, 7)) semaines.push(bilanSemaine(etat, p, l, { affectations: affs }));
    let n = 0;
    for (let l = lundiDe(aff.debut); l <= aff.fin; l = ajout(l, 7)) n++;
    const absences = etat.absences.filter((a) => a.personne === p.id && seChevauchent(a, aff));
    const manquantes = pr && !pr.competences.some((c) => p.competences.includes(c)) ? [...pr.competences] : [];
    const horsPeriode = pr && ((pr.debut && aff.debut < pr.debut) || (pr.fin && aff.fin > pr.fin));
    return { semaines, total: n, absences, manquantes, horsPeriode, surcharges: semaines.filter((b) => b.etat === 'surcharge').length };
  }

  // ---------- Fusion des saisies de plusieurs managers ----------
  // base : dernier état reçu du serveur ; local : état modifié sur cet appareil ; serveur : version plus récente
  // écrite par un autre appareil. Par élément (identifiant) : ajouté, modifié ou supprimé ici l'emporte ; le
  // reste vient du serveur. Réglages et nom de l'entreprise : la valeur locale si elle a changé ici.
  const COLLECTIONS = ['competences', 'personnes', 'projets', 'affectations', 'absences'];
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
    for (const k of ['entreprise', 'reglages']) if (!meme(base?.[k], local?.[k])) res[k] = JSON.parse(JSON.stringify(local[k]));
    return res;
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const present = (v) => v !== '' && v !== null && v !== undefined;
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && present(v) ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const decimal = (v, mini, maxi, defaut) => { const n = Number(v); return Number.isFinite(n) && present(v) ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  const ids = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => texte(x, 40)).filter(Boolean))] : []);
  const joursValides = (v, defaut) => { const j = Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : []; return j.length ? j : defaut; };

  const normaliserCompetence = (x) => ({ id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 40) || 'Compétence' });
  function normaliserPersonne(x) {
    return {
      id: texte(x?.id, 40) || nouvelId(), prenom: texte(x?.prenom, 40), nom: texte(x?.nom, 60), role: texte(x?.role, 50),
      competences: ids(x?.competences), capacite: decimal(x?.capacite, 0, 80, 35), jours: joursValides(x?.jours, [1, 2, 3, 4, 5]),
      entree: dateOuNull(x?.entree), sortie: dateOuNull(x?.sortie), efface: !!x?.efface,
    };
  }
  function normaliserProjet(x, i = 0, nbCouleurs = 7) {
    const debut = dateOuNull(x?.debut);
    let fin = dateOuNull(x?.fin);
    if (debut && fin && fin < debut) fin = debut;
    return {
      id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 60) || 'Projet', type: TYPES_PROJET.includes(x?.type) ? x.type : 'projet',
      client: texte(x?.client, 60), couleur: entier(x?.couleur, 0, nbCouleurs - 1, i % nbCouleurs), debut, fin,
      besoin: decimal(x?.besoin, 0, 2000, 0), competences: ids(x?.competences),
      statut: STATUTS_PROJET.includes(x?.statut) ? x.statut : 'actif', note: texte(x?.note, 200),
    };
  }
  function normaliserAffectation(x) {
    const debut = dateOuNull(x?.debut) || dateOuNull(x?.fin) || '2026-01-05';
    let fin = dateOuNull(x?.fin) || debut;
    if (fin < debut) fin = debut;
    return {
      id: texte(x?.id, 40) || nouvelId(), personne: texte(x?.personne, 40), projet: texte(x?.projet, 40), debut, fin,
      heures: decimal(x?.heures, 0, 80, 0), note: texte(x?.note, 120), par: texte(x?.par, 40), majLe: dateOuNull(x?.majLe),
    };
  }
  function normaliserAbsence(x, types = ['conges', 'formation', 'autre']) {
    const debut = dateOuNull(x?.debut) || dateOuNull(x?.fin) || '2026-01-05';
    let fin = dateOuNull(x?.fin) || debut;
    if (fin < debut) fin = debut;
    return {
      id: texte(x?.id, 40) || nouvelId(), personne: texte(x?.personne, 40), type: types.includes(x?.type) ? x.type : 'autre', debut, fin,
      demiDebut: !!x?.demiDebut, demiFin: !!x?.demiFin, note: texte(x?.note, 120), par: texte(x?.par, 40),
    };
  }
  function normaliserReglages(r, dv) {
    r = r || {};
    const plafond = (v, d) => decimal(v, 0, 80, d);
    return {
      capaciteDefaut: decimal(r.capaciteDefaut, 0, 80, dv.capaciteDefaut),
      seuilSurcharge: decimal(r.seuilSurcharge, 50, 200, dv.seuilSurcharge),
      seuilDisponible: decimal(r.seuilDisponible, 0, 100, dv.seuilDisponible),
      plafondSemaine: plafond(r.plafondSemaine, dv.plafondSemaine),
      plafondMoyen: plafond(r.plafondMoyen, dv.plafondMoyen),
      joursOuverture: joursValides(r.joursOuverture, dv.joursOuverture),
      feriesChomes: Array.isArray(r.feriesChomes) ? r.feriesChomes.filter((id) => NOM_FERIE[id]) : dv.feriesChomes,
      verifieLe: dateOuNull(r.verifieLe) || dv.verifieLe,
    };
  }
  const DV = { capaciteDefaut: 35, seuilSurcharge: 100, seuilDisponible: 80, plafondSemaine: 48, plafondMoyen: 44, joursOuverture: [1, 2, 3, 4, 5], feriesChomes: FERIES.slice(0, 11).map((f) => f[0]), verifieLe: null };
  // « defauts » : { reglages, couleurs, typesAbsence } tirés de la base intégrée (donnees.js).
  function etatVide(defauts = {}) {
    const dv = { ...DV, ...JSON.parse(JSON.stringify(defauts.reglages || {})) };
    return { version: 1, entreprise: '', reglages: normaliserReglages(dv, dv), competences: [], personnes: [], projets: [], affectations: [], absences: [] };
  }
  function normaliser(d, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const nb = (defauts.couleurs || []).length || 7;
    const types = (defauts.typesAbsence || []).map((t) => t.id);
    return {
      ...v, ...d,
      entreprise: texte(d.entreprise, 80),
      reglages: normaliserReglages(d.reglages, v.reglages),
      competences: (Array.isArray(d.competences) ? d.competences : []).map(normaliserCompetence),
      personnes: (Array.isArray(d.personnes) ? d.personnes : []).map(normaliserPersonne),
      projets: (Array.isArray(d.projets) ? d.projets : []).map((x, i) => normaliserProjet(x, i, nb)),
      affectations: (Array.isArray(d.affectations) ? d.affectations : []).map(normaliserAffectation),
      absences: (Array.isArray(d.absences) ? d.absences : []).map((x) => normaliserAbsence(x, types.length ? types : undefined)),
    };
  }

  // ---------- RGPD ----------
  // Effacement : prénom et nom remplacés, notes vidées ; affectations et absences gardées (sans note) pour
  // que la charge passée reste juste. Suppression : la personne, ses affectations et ses absences retirées.
  function effacerPersonne(etat, id, rang = 1) {
    const e = JSON.parse(JSON.stringify(etat));
    const p = e.personnes.find((x) => x.id === id);
    if (!p) return e;
    Object.assign(p, { prenom: 'Personne', nom: `effacée ${rang}`, efface: true });
    e.absences.forEach((a) => { if (a.personne === id) a.note = ''; });
    e.affectations.forEach((a) => { if (a.personne === id) a.note = ''; });
    return e;
  }
  function supprimerPersonne(etat, id) {
    const e = JSON.parse(JSON.stringify(etat));
    e.personnes = e.personnes.filter((p) => p.id !== id);
    e.affectations = e.affectations.filter((a) => a.personne !== id);
    e.absences = e.absences.filter((a) => a.personne !== id);
    return e;
  }
  // Données d'une personne (droit d'accès) : fiche, compétences, affectations, absences.
  function donneesPersonne(etat, id, auj, typesAbsence = []) {
    const p = etat.personnes.find((x) => x.id === id);
    if (!p) return null;
    const nomC = (c) => etat.competences.find((x) => x.id === c)?.nom || c;
    const nomP = (pid) => etat.projets.find((x) => x.id === pid)?.nom || '';
    return {
      exporteLe: auj,
      personne: { prenom: p.prenom, nom: p.nom, role: p.role, capaciteHebdo: p.capacite, joursTravailles: joursDe(p), entree: p.entree, sortie: p.sortie, competences: p.competences.map(nomC) },
      affectations: etat.affectations.filter((a) => a.personne === id).map((a) => ({ projet: nomP(a.projet), debut: a.debut, fin: a.fin, heuresParSemaine: a.heures, note: a.note })),
      absences: etat.absences.filter((a) => a.personne === id).map((a) => ({ type: typesAbsence.find((t) => t.id === a.type)?.nom || a.type, debut: a.debut, fin: a.fin, demiDebut: a.demiDebut, demiFin: a.demiFin, note: a.note })),
    };
  }

  // ---------- Exports CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (x) => String(arrondi1(x)).replace('.', ',');
  const versCsvLignes = (tete, lignes) => '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  function affectationsCsv(etat) {
    const nomPers = (id) => { const p = etat.personnes.find((x) => x.id === id); return p ? [p.prenom, p.nom, p.role] : ['', '', '']; };
    const lignes = [...etat.affectations].sort((a, b) => a.debut.localeCompare(b.debut)).map((a) => {
      const pr = etat.projets.find((x) => x.id === a.projet);
      return [...nomPers(a.personne), pr?.nom || '', pr?.type === 'poste' ? 'Poste' : 'Projet', a.debut, a.fin, nombreCsv(a.heures), a.note, a.par];
    });
    return versCsvLignes(['Prénom', 'Nom', 'Rôle', 'Projet ou poste', 'Type', 'Du', 'Au', 'Heures par semaine', 'Note', 'Saisie par'], lignes);
  }
  // Charge planifiée et capacité par personne et par semaine (n semaines à partir d'un lundi).
  function chargeCsv(etat, lundi, n = 12) {
    const semaines = Array.from({ length: n }, (_, k) => ajout(lundi, 7 * k));
    const tete = ['Prénom', 'Nom', 'Rôle', ...semaines.flatMap((l) => [`S${numeroSemaine(l)} (${l}) charge h`, `S${numeroSemaine(l)} capacité h`])];
    const lignes = etat.personnes.filter((p) => semaines.some((l) => actifSemaine(p, l))).map((p) => [p.prenom, p.nom, p.role, ...semaines.flatMap((l) => { const b = bilanSemaine(etat, p, l); return [nombreCsv(b.charge), nombreCsv(b.capacite)]; })]);
    return versCsvLignes(tete, lignes);
  }

  racine.EQP = {
    TYPES_PROJET, STATUTS_PROJET, LIB_STATUT, FERIES, NOM_FERIE, COLLECTIONS,
    iso, versDate, ajout, ecart, ajoutMois, joursDansMois, estDate, jourSemaine, lundiDe, numeroSemaine, semainesDuMois, arrondi1, nombre, lireNombre,
    paques, feries, ferieChome,
    actif, actifSemaine, joursDe, travailleLe, heuresJour, couvre, seChevauchent, absenceLe,
    bilanSemaine, moyenne12, actifProjetSemaine, couverture, alertes, disponibles, equipeSemaine, apercuAffectation, fusionner,
    nouvelId, normaliserCompetence, normaliserPersonne, normaliserProjet, normaliserAffectation, normaliserAbsence, normaliserReglages, etatVide, normaliser,
    effacerPersonne, supprimerPersonne, donneesPersonne, affectationsCsv, chargeCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
