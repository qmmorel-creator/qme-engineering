// Règles métier de « CRM et prospection » : fonctions pures, sans DOM ni état global.
// Chargé dans le navigateur avant app.js (globalThis.CRM_REGLES) et dans les tests Node.
// Suivi seulement : ce n'est ni un logiciel de facturation ni un logiciel comptable, et l'application
// n'envoie aucun message elle-même (les scripts sont copiés et envoyés par l'utilisateur).
(() => {
  'use strict';

  // ---------- Dates (chaînes AAAA-MM-JJ, comparables directement) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + Number(n || 0)); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const moisDe = (s) => String(s).slice(0, 7);
  const ajoutMois = (mois, n) => { const [a, m] = mois.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}`; };
  // Même jour n années plus tard (29 février → 28 février si besoin).
  const ajoutAns = (s, n) => {
    const [a, m, j] = String(s).split('-').map(Number);
    const fin = new Date(a + n, m, 0).getDate();
    return `${a + n}-${deux(m)}-${deux(Math.min(j, fin))}`;
  };

  // ---------- Montants ----------
  const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const nombre = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const ttc = (doc) => arrondi(nombre(doc?.ht) * (1 + nombre(doc?.tva) / 100));
  const encaisse = (doc) => arrondi((doc?.paiements || []).reduce((s, p) => s + nombre(p.montant), 0));
  const solde = (doc) => arrondi(ttc(doc) - encaisse(doc));
  // Part hors taxes d'un encaissement (chiffre d'affaires encaissé).
  const partHT = (doc, montant) => { const t = ttc(doc); return t ? arrondi(nombre(montant) * nombre(doc.ht) / t) : 0; };

  const estFacture = (d) => d && d.type === 'facture';
  const estDevis = (d) => d && d.type === 'devis';
  const factureActive = (d) => estFacture(d) && d.statut !== 'annulee' && d.statut !== 'brouillon';

  // ---------- Statuts des documents ----------
  const echeance = (doc, delaiDefaut = 30) => doc.echeance || ajout(doc.date, doc.delai ?? delaiDefaut);

  // annulee · brouillon · payee · retard · partielle · a-encaisser
  function statutFacture(doc, auj, delaiDefaut = 30) {
    if (doc.statut === 'annulee') return 'annulee';
    if (doc.statut === 'brouillon') return 'brouillon';
    const s = solde(doc);
    if (s <= 0.005) return 'payee';
    if (echeance(doc, delaiDefaut) < auj) return 'retard';
    return encaisse(doc) > 0 ? 'partielle' : 'a-encaisser';
  }

  // brouillon · envoye · accepte · refuse · expire (envoyé dont la validité est dépassée)
  function statutDevis(doc, auj) {
    const s = doc.statut || 'brouillon';
    if (s === 'envoye' && doc.validite && doc.validite < auj) return 'expire';
    return s;
  }

  const statutDocument = (doc, auj, delaiDefaut) => (estDevis(doc) ? statutDevis(doc, auj) : statutFacture(doc, auj, delaiDefaut));

  const joursRetard = (doc, auj, delaiDefaut = 30) => Math.max(0, ecart(echeance(doc, delaiDefaut), auj));

  // Devis envoyés (non expirés) depuis au moins `jours` jours, sans réponse.
  function devisARelancer(documents, auj, jours = 7) {
    return (documents || []).filter((d) => estDevis(d) && statutDevis(d, auj) === 'envoye' && ecart(d.date, auj) >= jours)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function facturesEnRetard(documents, auj, delaiDefaut = 30) {
    return (documents || []).filter((d) => estFacture(d) && statutFacture(d, auj, delaiDefaut) === 'retard')
      .sort((a, b) => echeance(a, delaiDefaut).localeCompare(echeance(b, delaiDefaut)));
  }

  // ---------- Contacts ----------
  const etapeOuverte = (etapes, id) => !!(etapes || []).find((e) => e.id === id)?.ouverte;

  function statutContact(contact, projets, documents) {
    if (contact.archive) return 'archive';
    const client = (documents || []).some((d) => d.contactId === contact.id && factureActive(d))
      || (projets || []).some((p) => p.contactId === contact.id && p.etape === 'gagne');
    return client ? 'client' : 'prospect';
  }

  // Dernier échange noté (sauf, si `sansEnvois`, les messages envoyés par l'utilisateur sans réponse).
  function dernierEchange(contact, echanges, sansEnvois = false) {
    let d = null;
    for (const e of echanges || []) if (e.contactId === contact.id && !(sansEnvois && e.sens === 'envoye') && (!d || e.date > d)) d = e.date;
    return d;
  }

  // Un contact est « actif » s'il a une affaire ouverte ou un projet gagné pas encore terminé.
  function estActif(contact, projets, etapes) {
    if (contact.archive) return false;
    return (projets || []).some((p) => p.contactId === contact.id
      && (etapeOuverte(etapes, p.etape) || (p.etape === 'gagne' && p.avancement !== 'termine')));
  }

  // ---------- Cadences de relance ----------
  // Une cadence est une suite de messages (délai en jours depuis le précédent, canal, script). Le contact en
  // suit une au plus : contact.cadence = { id, debut, pas, dernier, reporteAu }. Tant qu'elle court, sa
  // prochaine action est la relance attendue ; sinon, c'est la prochaine action datée à la main (contact.prochaine).
  const cadenceDe = (cadences, id) => (cadences || []).find((c) => c.id === id) || null;

  // Relance attendue (index, total, canal, script, délai, cadence) ou null.
  function relanceCourante(contact, cadences) {
    const k = contact?.cadence;
    if (!k || contact.oppose) return null;
    const c = cadenceDe(cadences, k.id);
    if (!c || k.pas >= c.relances.length) return null;
    const r = c.relances[k.pas];
    return { index: k.pas, total: c.relances.length, canal: r.canal, script: r.script || null, delai: Number(r.delai) || 0, cadence: c };
  }

  // Cadence menée jusqu'au bout sans réponse (ou supprimée) : plus aucune relance prévue.
  function cadenceTerminee(contact, cadences) {
    if (!contact?.cadence || contact.oppose || contact.archive) return false;
    return !relanceCourante(contact, cadences);
  }

  // Date de la relance attendue : délai compté depuis le message précédent réellement envoyé
  // (ou depuis le début de la cadence pour le premier), repoussée par un report.
  function dateRelance(contact, cadences) {
    const r = relanceCourante(contact, cadences);
    if (!r) return null;
    const k = contact.cadence;
    let d = ajout(k.pas === 0 || !k.dernier ? k.debut : k.dernier, r.delai);
    if (k.reporteAu && k.reporteAu > d) d = k.reporteAu;
    return d;
  }

  // Prochaine action d'un contact : relance de cadence en cours, sinon action datée à la main.
  // { type, date, note, relance? } ; null si archivé, opposé, sans rien de prévu ou cadence terminée.
  function prochaineDe(contact, cadences) {
    if (!contact || contact.archive || contact.oppose) return null;
    if (contact.cadence) {
      const r = relanceCourante(contact, cadences);
      return r ? { type: 'relance-cadence', date: dateRelance(contact, cadences), note: '', relance: r } : null;
    }
    return contact.prochaine?.date ? contact.prochaine : null;
  }

  // Prochaines actions dues (date <= aujourd'hui), les plus anciennes d'abord.
  function actionsDues(contacts, auj, cadences = []) {
    return (contacts || []).map((c) => ({ contact: c, action: prochaineDe(c, cadences) }))
      .filter((x) => x.action && x.action.date <= auj)
      .map((x) => ({ ...x, retard: ecart(x.action.date, auj) }))
      .sort((a, b) => a.action.date.localeCompare(b.action.date) || String(a.contact.nom).localeCompare(String(b.contact.nom), 'fr'));
  }

  // Contacts dont la prochaine action tombe après aujourd'hui et dans les `jours` jours.
  function actionsAVenir(contacts, auj, jours = 7, cadences = []) {
    const fin = ajout(auj, jours);
    return (contacts || []).map((c) => ({ c, d: prochaineDe(c, cadences)?.date }))
      .filter((x) => x.d && x.d > auj && x.d <= fin)
      .sort((a, b) => a.d.localeCompare(b.d)).map((x) => x.c);
  }

  // Affaire en cours mais rien de prévu (une cadence terminée est listée à part).
  const sansAction = (contacts, projets, etapes, cadences = []) => (contacts || [])
    .filter((c) => !prochaineDe(c, cadences) && !cadenceTerminee(c, cadences) && estActif(c, projets, etapes));

  function demarrerCadence(contact, cadenceId, date) {
    return { ...contact, cadence: { id: cadenceId, debut: date, pas: 0, dernier: null, reporteAu: null } };
  }
  const arreterCadence = (contact) => ({ ...contact, cadence: null });

  // Message de la cadence envoyé : la cadence avance d'un pas, la relance suivante part de cette date.
  function enregistrerEnvoi(contact, cadences, date) {
    const r = relanceCourante(contact, cadences);
    if (!r) return contact;
    return { ...contact, cadence: { ...contact.cadence, pas: contact.cadence.pas + 1, dernier: date, reporteAu: null } };
  }

  // Report de la relance (ou de l'action datée) à une date.
  function reporter(contact, cadences, date) {
    if (contact.cadence && relanceCourante(contact, cadences)) return { ...contact, cadence: { ...contact.cadence, reporteAu: date } };
    return contact.prochaine ? { ...contact, prochaine: { ...contact.prochaine, date } } : contact;
  }

  // Frise d'une cadence : jour cumulé de chaque relance (J0, J+3, J+7…).
  function frise(cadence) {
    let j = 0;
    return (cadence?.relances || []).map((r) => { j += Number(r.delai) || 0; return { jour: j, canal: r.canal, script: r.script || null }; });
  }

  // ---------- Étapes des affaires ----------
  // Rang dans l'entonnoir (étapes hors entonnoir exclues), -1 si inconnue.
  const rang = (etapes, id) => (etapes || []).filter((e) => !e.hors).findIndex((e) => e.id === id);
  // Anciennes étapes du CRM freelance (avant la fusion du 22/11/2026).
  const ANCIENNES_ETAPES = { piste: 'cible', qualifie: 'rdv' };
  const etapeActuelle = (id) => ANCIENNES_ETAPES[id] || id;

  // Changement d'étape d'une affaire : garde l'étape la plus avancée atteinte (chiffres de conversion).
  function changerEtape(projet, cible, etapes, date, motif = '') {
    const p = { ...projet, etape: cible, maj: date };
    const k = rang(etapes, cible);
    if (k > (p.etapeMax ?? 0)) p.etapeMax = k;
    if (cible === 'gagne') p.avancement = projet.etape === 'gagne' ? projet.avancement : 'a-venir';
    else p.avancement = null;
    p.motif = cible === 'perdu' ? (motif || projet.motif || '') : '';
    return p;
  }

  // Effet d'une entrée dans l'étape sur la cadence du contact : 'garder', 'arreter' ou { demarrer: id }.
  function effetCadence(etapes, id) {
    const e = (etapes || []).find((x) => x.id === id);
    if (!e) return 'garder';
    if (e.cadence === 'garder') return 'garder';
    return e.cadence ? { demarrer: e.cadence } : 'arreter';
  }

  // ---------- Opposition à la prospection ----------
  // Arrêt définitif : plus aucune relance, coordonnées et notes effacées ; nom et organisation gardés pour
  // ne pas recontacter la personne (liste d'opposition recommandée par la CNIL).
  function opposer(contact, date) {
    return { ...contact, oppose: date, archive: true, email: '', tel: '', notes: '', fonction: '', prochaine: null, cadence: null };
  }
  const normaliserNom = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function doublonOppose(contacts, { nom, entreprise }) {
    const cle = `${normaliserNom(nom)}|${normaliserNom(entreprise)}`;
    if (cle === '|') return null;
    return (contacts || []).find((x) => x.oppose && `${normaliserNom(x.nom)}|${normaliserNom(x.entreprise)}` === cle) || null;
  }

  // ---------- Scripts ----------
  const CLES = { 'prénom': 'prenom', prenom: 'prenom', nom: 'nom', organisation: 'organisation', fonction: 'fonction',
    'mon prénom': 'monPrenom', 'mon prenom': 'monPrenom', 'mon activité': 'monActivite', 'mon activite': 'monActivite' };
  // Valeurs des variables pour un contact (« Prénom Nom » : le premier mot est le prénom).
  function valeursScript(contact, { monPrenom = '', monActivite = '' } = {}) {
    const mots = String(contact?.nom || '').trim().split(/\s+/).filter(Boolean);
    return { prenom: mots[0] || '', nom: mots.slice(1).join(' '), organisation: contact?.entreprise || '', fonction: contact?.fonction || '', monPrenom, monActivite };
  }
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

  // Saisie groupée : « Prénom Nom ; Organisation ; Fonction », une ligne par contact.
  function lireLignes(texte) {
    return String(texte || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [nom = '', entreprise = '', fonction = ''] = l.split(/[;\t]/).map((s) => s.trim());
      return { nom: nom.replace(/\s+/g, ' '), entreprise, fonction };
    }).filter((x) => x.nom || x.entreprise);
  }

  // Propose la prochaine action : type et date (depuis + délai de la base).
  function proposerAction(actions, id, depuis) {
    const a = (actions || []).find((x) => x.id === id);
    if (!a) return null;
    return { type: a.id, date: ajout(depuis, a.delai), note: '' };
  }
  const suiteDe = (actions, id) => (actions || []).find((x) => x.id === id)?.suite || null;

  // RGPD : date à partir de laquelle la durée de conservation court (référentiel CNIL).
  // Prospect : dernier contact venant de lui (un message envoyé sans réponse ne compte pas), sinon création.
  // Client : dernier échange, document ou encaissement.
  function dateReference(contact, echanges, documents, projets) {
    let d = contact.creeLe || null;
    const plusRecent = (x) => { if (x && (!d || x > d)) d = x; };
    plusRecent(dernierEchange(contact, echanges, true));
    for (const doc of documents || []) {
      if (doc.contactId !== contact.id) continue;
      plusRecent(doc.date);
      for (const p of doc.paiements || []) plusRecent(p.date);
    }
    for (const p of projets || []) if (p.contactId === contact.id) plusRecent(p.maj || p.creeLe);
    return d;
  }

  // À revoir : aucune affaire en cours, aucun solde dû, et durée de conservation écoulée.
  function aRevoirRGPD(contact, { echanges, documents, projets, etapes, cadences }, auj, ans = 3) {
    if (!ans || ans <= 0 || contact.oppose) return false;
    if (estActif(contact, projets, etapes)) return false;
    if ((documents || []).some((d) => d.contactId === contact.id && factureActive(d) && solde(d) > 0.005)) return false;
    const p = prochaineDe(contact, cadences);
    if (p?.date && p.date >= auj) return false;
    const ref = dateReference(contact, echanges, documents, projets);
    return !!ref && ajoutAns(ref, ans) <= auj;
  }

  // ---------- Chiffres ----------
  // n mois se terminant par `dernierMois` (AAAA-MM) : facturé HT (date de facture) et encaissé HT (date d'encaissement).
  function caParMois(documents, dernierMois, n = 12) {
    const mois = Array.from({ length: n }, (_, i) => ajoutMois(dernierMois, i - n + 1));
    const index = new Map(mois.map((m, i) => [m, i]));
    const res = mois.map((m) => ({ mois: m, facture: 0, encaisse: 0 }));
    for (const d of documents || []) {
      if (!factureActive(d)) continue;
      const i = index.get(moisDe(d.date));
      if (i !== undefined) res[i].facture += nombre(d.ht);
      for (const p of d.paiements || []) {
        const k = index.get(moisDe(p.date));
        if (k !== undefined) res[k].encaisse += partHT(d, p.montant);
      }
    }
    return res.map((r) => ({ ...r, facture: arrondi(r.facture), encaisse: arrondi(r.encaisse) }));
  }

  // Par client pour une année : facturé HT, encaissé HT, reste dû TTC (factures de l'année), part du facturé.
  function caParClient(documents, contacts, annee) {
    const a = String(annee);
    const lignes = new Map();
    const ligne = (id) => {
      if (!lignes.has(id)) {
        const c = (contacts || []).find((x) => x.id === id);
        lignes.set(id, { contactId: id, nom: c ? c.nom : 'Contact supprimé', entreprise: c?.entreprise || '', facture: 0, encaisse: 0, reste: 0 });
      }
      return lignes.get(id);
    };
    for (const d of documents || []) {
      if (!factureActive(d)) continue;
      if (d.date.startsWith(a)) { const l = ligne(d.contactId); l.facture += nombre(d.ht); l.reste += Math.max(0, solde(d)); }
      for (const p of d.paiements || []) if (String(p.date).startsWith(a)) ligne(d.contactId).encaisse += partHT(d, p.montant);
    }
    const liste = [...lignes.values()].map((l) => ({ ...l, facture: arrondi(l.facture), encaisse: arrondi(l.encaisse), reste: arrondi(l.reste) }));
    const total = liste.reduce((s, l) => s + l.facture, 0);
    return liste.map((l) => ({ ...l, part: total ? Math.round((l.facture / total) * 1000) / 10 : 0 }))
      .sort((x, y) => y.facture - x.facture || y.encaisse - x.encaisse || x.nom.localeCompare(y.nom, 'fr'));
  }

  // Tuiles : encaissé HT du mois, reste à encaisser TTC, dont en retard.
  function synthese(documents, auj, delaiDefaut = 30) {
    const m = moisDe(auj);
    let encaisseMois = 0, reste = 0, retard = 0, nbRetard = 0, nbAEncaisser = 0;
    for (const d of documents || []) {
      if (!factureActive(d)) continue;
      for (const p of d.paiements || []) if (moisDe(p.date) === m) encaisseMois += partHT(d, p.montant);
      const s = solde(d);
      if (s > 0.005) {
        reste += s; nbAEncaisser++;
        if (echeance(d, delaiDefaut) < auj) { retard += s; nbRetard++; }
      }
    }
    return { encaisseMois: arrondi(encaisseMois), reste: arrondi(reste), retard: arrondi(retard), nbRetard, nbAEncaisser };
  }

  // Devis acceptés / (acceptés + refusés). null si aucun devis tranché.
  function tauxTransformation(documents, annee) {
    const devis = (documents || []).filter((d) => estDevis(d) && (!annee || d.date.startsWith(String(annee))));
    const acceptes = devis.filter((d) => d.statut === 'accepte').length;
    const tranches = acceptes + devis.filter((d) => d.statut === 'refuse').length;
    return tranches ? Math.round((acceptes / tranches) * 100) : null;
  }

  // Nombre et montant estimé des affaires par étape.
  function pipeline(projets, etapes) {
    return (etapes || []).map((e) => {
      const liste = (projets || []).filter((p) => p.etape === e.id);
      return { etape: e.id, nombre: liste.length, montant: arrondi(liste.reduce((s, p) => s + nombre(p.montant), 0)) };
    });
  }
  const montantOuvert = (projets, etapes) => arrondi((projets || []).filter((p) => etapeOuverte(etapes, p.etape)).reduce((s, p) => s + nombre(p.montant), 0));

  // Étape suivante dans l'ordre des étapes ouvertes, puis « gagne ».
  function etapeSuivante(etapes, id) {
    const ouvertes = (etapes || []).filter((e) => e.ouverte).map((e) => e.id);
    const i = ouvertes.indexOf(id);
    if (i < 0) return null;
    return ouvertes[i + 1] || 'gagne';
  }

  // ---------- Conversion (prospection) ----------
  const dansPeriode = (projets, depuis) => (depuis ? (projets || []).filter((p) => (p.creeLe || '') >= depuis) : (projets || []));

  // Entonnoir : affaires ayant atteint chaque étape (l'étape la plus avancée est gardée après « Perdu »).
  function entonnoir(projets, etapes) {
    const E = (etapes || []).filter((e) => !e.hors);
    const atteint = E.map((_, k) => (projets || []).filter((p) => (p.etapeMax ?? 0) >= k).length);
    return E.map((e, k) => ({
      id: e.id, nom: e.nom, atteint: atteint[k],
      passage: k < E.length - 1 && atteint[k] ? atteint[k + 1] / atteint[k] : null,
      depuisDebut: atteint[0] ? atteint[k] / atteint[0] : null,
    }));
  }

  // Par canal principal du contact : taux de réponse, de rendez-vous et de gain rapportés aux affaires contactées.
  function parCanal(projets, contacts, etapes, canaux) {
    const canalDe = new Map((contacts || []).map((c) => [c.id, c.canal]));
    const k = (id) => rang(etapes, id);
    return (canaux || []).map((c) => {
      const liste = (projets || []).filter((p) => canalDe.get(p.contactId) === c.id);
      const n = (r) => liste.filter((p) => (p.etapeMax ?? 0) >= r).length;
      const contactes = n(k('contacte')), reponses = n(k('echange')), rdv = n(k('rdv')), gagnes = n(k('gagne'));
      const taux = (x) => (contactes ? x / contactes : null);
      return { id: c.id, nom: c.nom, total: liste.length, contactes, reponses, rdv, gagnes,
        tauxReponse: taux(reponses), tauxRdv: taux(rdv), tauxGain: taux(gagnes) };
    }).filter((x) => x.total);
  }

  const lundi = (s) => { const d = versDate(s); return ajout(s, -((d.getDay() + 6) % 7)); };
  // Activité des N dernières semaines (lundi au dimanche) : messages envoyés et réponses reçues.
  function activite(echanges, auj, semaines = 8) {
    const debut = ajout(lundi(auj), -7 * (semaines - 1));
    const liste = Array.from({ length: semaines }, (_, i) => ({ debut: ajout(debut, 7 * i), envois: 0, reponses: 0 }));
    for (const e of echanges || []) {
      if (!e.sens || e.date < debut || e.date > auj) continue;
      const i = Math.floor(ecart(debut, e.date) / 7);
      if (liste[i]) liste[i][e.sens === 'recu' ? 'reponses' : 'envois'] += 1;
    }
    return liste;
  }

  const motifsPerte = (projets) => {
    const m = new Map();
    for (const p of projets || []) if (p.etape === 'perdu') m.set(p.motif || 'Autre', (m.get(p.motif || 'Autre') || 0) + 1);
    return [...m.entries()].map(([motif, n]) => ({ motif, n })).sort((a, b) => b.n - a.n || a.motif.localeCompare(b.motif, 'fr'));
  };

  // Numéro suggéré : D-2026-001, F-2026-002…
  function numeroSuivant(documents, type, annee) {
    const p = `${type === 'devis' ? 'D' : 'F'}-${annee}-`;
    let max = 0;
    for (const d of documents || []) {
      if (d.type !== type || !String(d.numero || '').startsWith(p)) continue;
      const n = parseInt(String(d.numero).slice(p.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return p + String(max + 1).padStart(3, '0');
  }

  // Facture préremplie depuis un devis accepté.
  function factureDepuisDevis(devis, { id, numero, date, delai }) {
    return {
      id, type: 'facture', numero, contactId: devis.contactId, projetId: devis.projetId || null, devisId: devis.id,
      date, objet: devis.objet, ht: nombre(devis.ht), tva: nombre(devis.tva), delai, statut: 'envoyee', paiements: [],
    };
  }

  // ---------- Données : normalisation tolérante et reprises ----------
  const liste = (x) => (Array.isArray(x) ? x : []);
  const copie = (o) => JSON.parse(JSON.stringify(o));
  function etatVide(B) {
    return {
      version: 2, nom: '', tutorielVu: false,
      reglages: { delaiPaiement: B.reperes.delaiPaiement.defaut, tva: null, relanceDevis: 7, conservationAns: B.reperes.conservation.ans, monActivite: '', cadenceDefaut: 'premier' },
      contacts: [], echanges: [], projets: [], documents: [], scripts: copie(B.scripts), cadences: copie(B.cadences),
    };
  }
  // Lit toute version des données (CRM freelance d'avant la fusion compris) sans rien perdre :
  // champs inconnus gardés, nouveaux champs ajoutés, anciennes étapes converties.
  function normaliser(d, B) {
    const v = etatVide(B);
    if (!d || typeof d !== 'object') return v;
    const projets = liste(d.projets).map((p) => {
      const etape = etapeActuelle(p.etape || 'cible');
      const k = rang(B.etapes, etape);
      // Ancienne affaire sans étape maximale : l'étape actuelle (gagnée : tout l'entonnoir) ; perdue : au moins contactée.
      const max = Number.isInteger(p.etapeMax) ? p.etapeMax : (k >= 0 ? k : rang(B.etapes, 'contacte'));
      return { ...p, etape, etapeMax: max };
    });
    return {
      ...v, ...d, version: 2,
      tutorielVu: !!d.tutorielVu,
      reglages: { ...v.reglages, ...(d.reglages || {}) },
      contacts: liste(d.contacts).map((c) => ({ fonction: '', canal: '', cadence: null, oppose: null, ...c })),
      echanges: liste(d.echanges), projets,
      documents: liste(d.documents).map((x) => ({ ...x, paiements: liste(x.paiements) })),
      scripts: Array.isArray(d.scripts) ? d.scripts : v.scripts,
      cadences: Array.isArray(d.cadences) && d.cadences.length ? d.cadences : v.cadences,
    };
  }

  // Copie exportée du « Pipeline de prospection B2B » (fusionné le 22/11/2026) : chaque prospect devient un contact,
  // son historique des échanges, et une affaire « Premier contrat » à son étape. Scripts et cadences repris.
  function depuisPipeline(d, B, { id = () => Math.random().toString(36).slice(2, 10), aujourdhui = '' } = {}) {
    const E = etatVide(B);
    const r = d?.reglages || {};
    E.nom = r.monPrenom || '';
    E.tutorielVu = !!d?.tutorielVu;
    Object.assign(E.reglages, { monActivite: r.monActivite || '', cadenceDefaut: r.cadenceDefaut || 'premier' });
    if (Number(r.conservationMois) > 0) E.reglages.conservationAns = Math.max(1, Math.round(Number(r.conservationMois) / 12));
    if (Array.isArray(d?.scripts)) E.scripts = d.scripts;
    if (Array.isArray(d?.cadences) && d.cadences.length) E.cadences = d.cadences;
    const motifs = { 'sans-reponse': 'Pas de réponse', 'pas-besoin': 'Pas de besoin', 'pas-moment': 'Pas le moment', budget: 'Prix', concurrent: 'Autre prestataire retenu', autre: 'Autre' };
    for (const p of liste(d?.prospects)) {
      const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || p.organisation || 'Sans nom';
      const origine = B.origines.includes(p.source) ? p.source : '';
      const notes = [p.notes, p.coordonnee ? `Coordonnée : ${p.coordonnee}` : '', p.source && !origine ? `Source : ${p.source}` : ''].filter(Boolean).join('\n');
      const c = {
        id: p.id || id(), nom, entreprise: p.organisation || '', fonction: p.fonction || '', email: '', tel: '', origine, canal: p.canal || '',
        notes, creeLe: p.creeLe || aujourdhui, archive: !!p.oppose, oppose: p.oppose || null,
        cadence: p.cadence ? { id: p.cadence.id, debut: p.cadence.debut, pas: p.cadence.pas || 0, dernier: p.cadence.dernier || null, reporteAu: p.reporteAu || null } : null,
        prochaine: !p.cadence && p.action ? { type: 'relance-silence', date: p.reporteAu && p.reporteAu > p.action ? p.reporteAu : p.action, note: '' } : null,
      };
      E.contacts.push(c);
      for (const h of liste(p.historique)) {
        const sens = h.type === 'envoi' ? 'envoye' : h.type === 'recu' ? 'recu' : null;
        if (!sens && h.type !== 'note') continue;
        const type = B.canaux.find((x) => x.id === h.canal)?.echange || 'autre';
        E.echanges.push({ id: id(), contactId: c.id, date: h.date, type: h.type === 'note' ? 'autre' : type, resume: h.texte || '', ...(sens ? { sens } : {}) });
      }
      const etape = B.etapes.some((e) => e.id === p.etape) ? p.etape : 'cible';
      const derniere = liste(p.historique).filter((h) => h.type === 'etape').map((h) => h.date).sort().at(-1);
      E.projets.push({ id: id(), contactId: c.id, titre: 'Premier contrat', etape, etapeMax: Number.isInteger(p.etapeMax) ? p.etapeMax : Math.max(0, rang(B.etapes, etape)),
        montant: 0, creeLe: c.creeLe, maj: derniere || c.creeLe, decision: null, avancement: etape === 'gagne' ? 'a-venir' : null, motif: etape === 'perdu' ? (motifs[p.motif] || 'Autre') : '' });
    }
    return E;
  }

  globalThis.CRM_REGLES = {
    iso, versDate, ajout, ecart, moisDe, ajoutMois, ajoutAns,
    arrondi, ttc, encaisse, solde, partHT, estFacture, estDevis, factureActive,
    echeance, statutFacture, statutDevis, statutDocument, joursRetard, devisARelancer, facturesEnRetard,
    statutContact, dernierEchange, estActif, actionsDues, actionsAVenir, sansAction, proposerAction, suiteDe,
    dateReference, aRevoirRGPD,
    cadenceDe, relanceCourante, cadenceTerminee, dateRelance, prochaineDe, demarrerCadence, arreterCadence, enregistrerEnvoi, reporter, frise,
    rang, etapeActuelle, changerEtape, effetCadence, opposer, doublonOppose, valeursScript, remplirScript, lireLignes,
    caParMois, caParClient, synthese, tauxTransformation, pipeline, montantOuvert, etapeSuivante,
    dansPeriode, entonnoir, parCanal, lundi, activite, motifsPerte,
    numeroSuivant, factureDepuisDevis, etatVide, normaliser, depuisPipeline,
  };
})();
