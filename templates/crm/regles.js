// Règles métier du CRM freelance : fonctions pures, sans DOM ni état global.
// Chargé dans le navigateur avant app.js (globalThis.CRM_REGLES) et dans les tests Node.
// Suivi seulement : ce n'est ni un logiciel de facturation ni un logiciel comptable.
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

  // Dernier échange noté, sinon date de création.
  function dernierEchange(contact, echanges) {
    let d = null;
    for (const e of echanges || []) if (e.contactId === contact.id && (!d || e.date > d)) d = e.date;
    return d;
  }

  // Un contact est « actif » s'il a une affaire ouverte ou un projet gagné pas encore terminé.
  function estActif(contact, projets, etapes) {
    if (contact.archive) return false;
    return (projets || []).some((p) => p.contactId === contact.id
      && (etapeOuverte(etapes, p.etape) || (p.etape === 'gagne' && p.avancement !== 'termine')));
  }

  // Prochaines actions dues (date <= aujourd'hui), les plus anciennes d'abord.
  function actionsDues(contacts, auj) {
    return (contacts || []).filter((c) => !c.archive && c.prochaine?.date && c.prochaine.date <= auj)
      .map((c) => ({ contact: c, retard: ecart(c.prochaine.date, auj) }))
      .sort((a, b) => a.contact.prochaine.date.localeCompare(b.contact.prochaine.date) || String(a.contact.nom).localeCompare(String(b.contact.nom), 'fr'));
  }

  // Actions prévues après aujourd'hui et dans les `jours` jours.
  function actionsAVenir(contacts, auj, jours = 7) {
    const fin = ajout(auj, jours);
    return (contacts || []).filter((c) => !c.archive && c.prochaine?.date && c.prochaine.date > auj && c.prochaine.date <= fin)
      .sort((a, b) => a.prochaine.date.localeCompare(b.prochaine.date));
  }

  const sansAction = (contacts, projets, etapes) => (contacts || []).filter((c) => !c.prochaine?.date && estActif(c, projets, etapes));

  // Propose la prochaine action : type et date (depuis + délai de la base).
  function proposerAction(actions, id, depuis) {
    const a = (actions || []).find((x) => x.id === id);
    if (!a) return null;
    return { type: a.id, date: ajout(depuis, a.delai), note: '' };
  }
  const suiteDe = (actions, id) => (actions || []).find((x) => x.id === id)?.suite || null;

  // RGPD : date à partir de laquelle la durée de conservation court (référentiel CNIL).
  // Prospect : dernier échange, sinon création. Client : dernier échange, document ou encaissement.
  function dateReference(contact, echanges, documents, projets) {
    let d = contact.creeLe || null;
    const plusRecent = (x) => { if (x && (!d || x > d)) d = x; };
    plusRecent(dernierEchange(contact, echanges));
    for (const doc of documents || []) {
      if (doc.contactId !== contact.id) continue;
      plusRecent(doc.date);
      for (const p of doc.paiements || []) plusRecent(p.date);
    }
    for (const p of projets || []) if (p.contactId === contact.id) plusRecent(p.maj || p.creeLe);
    return d;
  }

  // À revoir : aucune affaire en cours, aucun solde dû, et durée de conservation écoulée.
  function aRevoirRGPD(contact, { echanges, documents, projets, etapes }, auj, ans = 3) {
    if (!ans || ans <= 0) return false;
    if (estActif(contact, projets, etapes)) return false;
    if ((documents || []).some((d) => d.contactId === contact.id && factureActive(d) && solde(d) > 0.005)) return false;
    if (contact.prochaine?.date && contact.prochaine.date >= auj) return false;
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

  globalThis.CRM_REGLES = {
    iso, versDate, ajout, ecart, moisDe, ajoutMois, ajoutAns,
    arrondi, ttc, encaisse, solde, partHT, estFacture, estDevis, factureActive,
    echeance, statutFacture, statutDevis, statutDocument, joursRetard, devisARelancer, facturesEnRetard,
    statutContact, dernierEchange, estActif, actionsDues, actionsAVenir, sansAction, proposerAction, suiteDe,
    dateReference, aRevoirRGPD,
    caParMois, caParClient, synthese, tauxTransformation, pipeline, montantOuvert, etapeSuivante,
    numeroSuivant, factureDepuisDevis,
  };
})();
