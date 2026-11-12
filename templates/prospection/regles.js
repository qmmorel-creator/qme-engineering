// Règles métier du pipeline de prospection : fonctions pures, sans DOM ni stockage.
// Chargé par le navigateur (window.PRS_REGLES) et par les tests (outils/templates/prospection.test.mjs).
// Dates au format AAAA-MM-JJ, calculées en UTC pour éviter les décalages d'heure d'été.
(function (racine) {
  'use strict';

  const deux = (n) => String(n).padStart(2, '0');
  const isoUTC = (d) => `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
  const versUTC = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)); };
  const plusJours = (s, n) => { const d = versUTC(s); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d); };
  const ecartJours = (de, a) => Math.round((versUTC(a) - versUTC(de)) / 86400000);
  // Ajout de mois en restant sur le dernier jour du mois si besoin (31/01 + 1 mois = 28 ou 29/02).
  function plusMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total % 12;
    const dernier = new Date(Date.UTC(an, mo + 1, 0)).getUTCDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, dernier))}`;
  }
  const lundi = (s) => plusJours(s, -((versUTC(s).getUTCDay() + 6) % 7));
  const copie = (o) => JSON.parse(JSON.stringify(o));

  // ---------- Étapes ----------
  const etapesPipeline = (etapes) => etapes.filter((e) => !e.hors);
  const rang = (etapes, id) => etapesPipeline(etapes).findIndex((e) => e.id === id);
  const etapeDe = (etapes, id) => etapes.find((e) => e.id === id) || null;
  const estFini = (p, etapes) => !!(p.oppose || etapeDe(etapes, p.etape)?.fin);

  // ---------- Cadences ----------
  const cadenceDe = (cadences, id) => cadences.find((c) => c.id === id) || null;

  // Relance attendue (index, total, canal, script) ou null si pas de cadence en cours.
  function relanceCourante(p, cadences) {
    if (!p.cadence) return null;
    const c = cadenceDe(cadences, p.cadence.id);
    if (!c || p.cadence.pas >= c.relances.length) return null;
    const r = c.relances[p.cadence.pas];
    return { index: p.cadence.pas, total: c.relances.length, canal: r.canal, script: r.script, delai: r.delai, cadence: c };
  }

  // Cadence menée jusqu'au bout sans réponse : plus aucune date de relance.
  function cadenceTerminee(p, cadences, etapes) {
    if (!p.cadence || estFini(p, etapes)) return false;
    const c = cadenceDe(cadences, p.cadence.id);
    return !!c && p.cadence.pas >= c.relances.length;
  }

  // Date de la prochaine relance (ou de la prochaine action datée à la main), null si aucune.
  function prochaineRelance(p, cadences, etapes) {
    if (estFini(p, etapes)) return null;
    let d = null;
    if (p.cadence) {
      const r = relanceCourante(p, cadences);
      if (r) d = plusJours(p.cadence.pas === 0 || !p.cadence.dernier ? p.cadence.debut : p.cadence.dernier, r.delai);
    } else d = p.action || null;
    if (d && p.reporteAu && p.reporteAu > d) d = p.reporteAu;
    return d;
  }

  function demarrerCadence(p, cadenceId, date) {
    p.cadence = { id: cadenceId, debut: date, pas: 0, dernier: null };
    p.action = null; p.reporteAu = null;
    return p;
  }

  // ---------- Événements ----------
  function noter(p, ev) { (p.historique ||= []).push(ev); }
  function monter(p, etapes, id) { const r = rang(etapes, id); if (r > (p.etapeMax ?? 0)) p.etapeMax = r; }

  // Message envoyé : la cadence avance d'un pas ; un prospect « À contacter » devient « Contacté ».
  function enregistrerEnvoi(prospect, cadences, etapes, { date, canal, texte = '', delaiAction = 7 }) {
    const p = copie(prospect);
    noter(p, { date, type: 'envoi', canal: canal || p.canal, texte });
    if (p.cadence) {
      const c = cadenceDe(cadences, p.cadence.id);
      if (c && p.cadence.pas < c.relances.length) { p.cadence.pas += 1; p.cadence.dernier = date; }
    } else if (!estFini(p, etapes)) p.action = plusJours(date, delaiAction);
    p.reporteAu = null;
    if (p.etape === 'cible') { p.etape = 'contacte'; monter(p, etapes, 'contacte'); }
    return p;
  }

  // Changement d'étape : démarre, garde ou arrête la cadence selon l'étape.
  function changerEtape(prospect, cible, etapes, { date, motif = null, action = null, cadenceDefaut = 'premier', delaiAction = 7 }) {
    const p = copie(prospect);
    const e = etapeDe(etapes, cible);
    if (!e || p.oppose) return p;
    const avant = p.etape;
    p.etape = cible;
    if (!e.hors) monter(p, etapes, cible);
    noter(p, { date, type: 'etape', de: avant, etape: cible, ...(motif ? { motif } : {}) });
    p.reporteAu = null;
    p.motif = cible === 'perdu' ? (motif || 'autre') : null;
    if (e.fin) { p.cadence = null; p.action = null; return p; }
    if (e.cadence === 'garder') {
      if (!p.cadence) demarrerCadence(p, cadenceDefaut, date);
    } else if (e.cadence) demarrerCadence(p, e.cadence, date);
    else { p.cadence = null; p.action = action || plusJours(date, delaiAction); }
    return p;
  }

  // Réponse reçue : un prospect qui n'avait pas encore répondu passe « En échange ».
  function enregistrerReponse(prospect, etapes, { date, canal, texte = '', delaiAction = 2 }) {
    let p = copie(prospect);
    noter(p, { date, type: 'recu', canal: canal || p.canal, texte });
    if (['cible', 'contacte'].includes(p.etape) || p.etape === 'perdu') p = changerEtape(p, 'echange', etapes, { date, delaiAction });
    else if (!estFini(p, etapes) && !p.cadence) { p.action = plusJours(date, delaiAction); p.reporteAu = null; }
    return p;
  }

  // Recontacter un prospect perdu ou dont la cadence est terminée : nouvelle cadence dès aujourd'hui.
  function recontacter(prospect, etapes, cadenceId, date) {
    const p = copie(prospect);
    if (p.oppose) return p;
    const etape = (p.etapeMax ?? 0) >= 1 ? 'contacte' : 'cible';
    noter(p, { date, type: 'etape', de: p.etape, etape, recontact: true });
    p.etape = etape; p.motif = null;
    return demarrerCadence(p, cadenceId, date);
  }

  // Opposition : arrêt définitif, ne garde que le minimum pour ne pas recontacter.
  function opposer(p, date) {
    return { id: p.id, prenom: p.prenom || '', nom: p.nom || '', organisation: p.organisation || '', canal: p.canal,
      creeLe: p.creeLe, etape: p.etape, etapeMax: p.etapeMax ?? 0, oppose: date, cadence: null, action: null,
      reporteAu: null, coordonnee: '', notes: '', fonction: '', source: '', historique: [] };
  }

  const normaliserNom = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function doublonOppose(prospects, { prenom, nom, organisation }) {
    const cle = [prenom, nom, organisation].map(normaliserNom).join('|');
    if (cle === '||') return null;
    return prospects.find((x) => x.oppose && [x.prenom, x.nom, x.organisation].map(normaliserNom).join('|') === cle) || null;
  }

  // ---------- Scripts ----------
  const CLES = { 'prénom': 'prenom', prenom: 'prenom', nom: 'nom', organisation: 'organisation', fonction: 'fonction',
    'mon prénom': 'monPrenom', 'mon prenom': 'monPrenom', 'mon activité': 'monActivite', 'mon activite': 'monActivite' };
  // Remplace les variables ; une variable vide reste visible entre crochets pour ne pas envoyer un trou.
  function remplirScript(texte, valeurs) {
    const manquantes = [];
    const resultat = String(texte || '').replace(/\{([^{}]{1,30})\}/g, (tout, nomVar) => {
      const cle = CLES[nomVar.trim().toLowerCase()];
      if (!cle) return tout;
      const v = String(valeurs[cle] ?? '').trim();
      if (v) return v;
      if (!manquantes.includes(nomVar.trim())) manquantes.push(nomVar.trim());
      return `[${nomVar.trim()}]`;
    });
    return { texte: resultat, manquantes };
  }

  // ---------- Listes ----------
  function aRelancer(prospects, cadences, etapes, aujourdhui) {
    return prospects.map((p) => ({ p, date: prochaineRelance(p, cadences, etapes) }))
      .filter((x) => x.date && x.date <= aujourdhui)
      .map((x) => ({ ...x, retard: ecartJours(x.date, aujourdhui) }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.p.organisation || '').localeCompare(b.p.organisation || ''));
  }

  function aVenir(prospects, cadences, etapes, aujourdhui, jours = 7) {
    const fin = plusJours(aujourdhui, jours);
    return prospects.map((p) => ({ p, date: prochaineRelance(p, cadences, etapes) }))
      .filter((x) => x.date && x.date > aujourdhui && x.date <= fin)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // RGPD : dernière date de référence = création ou dernier message reçu du prospect.
  function dateReference(p) {
    const recus = (p.historique || []).filter((h) => h.type === 'recu').map((h) => h.date).sort();
    const r = recus.at(-1);
    return r && r > p.creeLe ? r : p.creeLe;
  }
  function aRevoirRgpd(p, aujourdhui, mois = 36) {
    if (p.oppose || p.etape === 'gagne' || !p.creeLe) return false;
    return plusMois(dateReference(p), mois) <= aujourdhui;
  }

  // ---------- Chiffres ----------
  const dansPeriode = (prospects, depuis) => (depuis ? prospects.filter((p) => (p.creeLe || '') >= depuis) : prospects);

  // Entonnoir : prospects ayant atteint chaque étape (l'étape la plus avancée est gardée après un « Perdu »).
  function entonnoir(prospects, etapes) {
    const E = etapesPipeline(etapes);
    const atteint = E.map((_, k) => prospects.filter((p) => (p.etapeMax ?? 0) >= k).length);
    return E.map((e, k) => ({
      id: e.id, nom: e.nom, atteint: atteint[k],
      passage: k < E.length - 1 && atteint[k] ? atteint[k + 1] / atteint[k] : null,
      depuisDebut: atteint[0] ? atteint[k] / atteint[0] : null,
    }));
  }

  // Par canal : taux de réponse, de rendez-vous et de gain rapportés aux prospects contactés.
  function parCanal(prospects, etapes, canaux) {
    const r = (id) => rang(etapes, id);
    return canaux.map((c) => {
      const liste = prospects.filter((p) => p.canal === c.id);
      const n = (k) => liste.filter((p) => (p.etapeMax ?? 0) >= k).length;
      const contactes = n(r('contacte')), reponses = n(r('echange')), rdv = n(r('rdv')), gagnes = n(r('gagne'));
      const taux = (x) => (contactes ? x / contactes : null);
      return { id: c.id, nom: c.nom, total: liste.length, contactes, reponses, rdv, gagnes,
        tauxReponse: taux(reponses), tauxRdv: taux(rdv), tauxGain: taux(gagnes) };
    }).filter((x) => x.total);
  }

  // Activité des N dernières semaines (lundi au dimanche) : messages envoyés et réponses reçues.
  function activite(prospects, aujourdhui, semaines = 8) {
    const debut = plusJours(lundi(aujourdhui), -7 * (semaines - 1));
    const liste = Array.from({ length: semaines }, (_, i) => ({ debut: plusJours(debut, 7 * i), envois: 0, reponses: 0 }));
    for (const p of prospects) for (const h of p.historique || []) {
      if (h.date < debut || h.date > aujourdhui || !['envoi', 'recu'].includes(h.type)) continue;
      const i = Math.floor(ecartJours(debut, h.date) / 7);
      if (liste[i]) liste[i][h.type === 'envoi' ? 'envois' : 'reponses'] += 1;
    }
    return liste;
  }

  // Saisie groupée : « Prénom Nom ; Organisation ; Fonction », une ligne par prospect.
  function lireLignes(texte) {
    return String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [personne = '', organisation = '', fonction = ''] = l.split(/[;\t]/).map((s) => s.trim());
      const mots = personne.split(/\s+/).filter(Boolean);
      return { prenom: mots[0] || '', nom: mots.slice(1).join(' '), organisation, fonction };
    }).filter((x) => x.prenom || x.organisation);
  }

  racine.PRS_REGLES = {
    plusJours, plusMois, ecartJours, lundi, rang, etapesPipeline, estFini, relanceCourante, cadenceTerminee,
    prochaineRelance, demarrerCadence, enregistrerEnvoi, enregistrerReponse, changerEtape, recontacter, opposer,
    doublonOppose, remplirScript, aRelancer, aVenir, dateReference, aRevoirRgpd, dansPeriode, entonnoir, parCanal,
    activite, lireLignes,
  };
})(typeof window !== 'undefined' ? window : globalThis);
