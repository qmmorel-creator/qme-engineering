// Demandes d'achat et fournitures QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ACH) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ ». Montants en euros (nombres), saisis par l'utilisateur : aucun prix intégré.
// Toute modification passe par appliquer(etat, action) : la même fonction sert à l'action locale et au rejeu
// des actions sur la version du serveur quand un autre appareil a écrit entre-temps (conflit 409).
(function (racine) {
  'use strict';

  const STATUTS = ['demandee', 'validee', 'refusee', 'commandee', 'annulee'];
  // États affichés : le statut enregistré, précisé par les réceptions d'une demande commandée.
  const ETATS = ['demandee', 'validee', 'commandee', 'partielle', 'recue', 'refusee', 'annulee'];
  const LIB_ETAT = { demandee: 'À valider', validee: 'À commander', commandee: 'Commandée', partielle: 'Reçue en partie', recue: 'Reçue', refusee: 'Refusée', annulee: 'Annulée' };
  const URGENCES = ['normale', 'urgente', 'bloquante'];
  const COLLECTIONS = ['articles', 'fournisseurs', 'services'];
  const MAX = { articles: 400, fournisseurs: 60, services: 40, lignes: 20 };
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ajoutMois = (s, n) => { const d = versDate(s); const j = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(j, fin)); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // Exercice budgétaire : désigné par l'année où il commence. debut = mois de début (1 à 12).
  function exercice(date, debut = 1) {
    const a = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
    return m >= debut ? a : a - 1;
  }
  const bornesExercice = (annee, debut = 1) => { const d = `${annee}-${deux(debut)}-01`; return [d, ajoutMois(d, 12)]; };
  const libelleExercice = (annee, debut = 1) => (debut === 1 ? String(annee) : `${annee}-${annee + 1}`);

  // ---------- Montants ----------
  const arrondi = (n) => Math.round(n * 100) / 100;
  const euros = (n, { centimes = true } = {}) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const s = (centimes ? arrondi(n) : Math.round(n)).toLocaleString('fr-FR', { minimumFractionDigits: centimes && n % 1 ? 2 : 0, maximumFractionDigits: centimes ? 2 : 0 });
    return `${s.replace(/ | /g, ' ')} €`;
  };
  const pct = (t) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${Math.round(t)} %`);
  const lireNombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

  // ---------- Une demande ----------
  const recu = (d) => Math.min(d.quantite, (d.receptions || []).reduce((s, r) => s + r.qte, 0));
  const reste = (d) => Math.max(0, d.quantite - recu(d));
  function etatDemande(d) {
    if (d.statut !== 'commandee') return d.statut;
    const r = recu(d);
    if (r >= d.quantite) return 'recue';
    if (d.solde) return r > 0 ? 'recue' : 'annulee';
    return r > 0 ? 'partielle' : 'commandee';
  }
  const prixUnitaire = (d) => (d.prixReel !== null && d.prixReel !== undefined ? d.prixReel : d.prix);
  const montantEstime = (d) => (d.prix === null || d.prix === undefined ? null : arrondi(d.quantite * d.prix));
  // Consommé : ce qui a été reçu, au prix réel s'il est connu. Engagé : ce qui est validé ou commandé et pas encore
  // reçu (reliquat abandonné exclu). En attente : demandes pas encore validées.
  function montants(d) {
    const e = etatDemande(d);
    const p = prixUnitaire(d);
    const r = recu(d);
    const sansPrix = p === null || p === undefined;
    const consomme = sansPrix ? 0 : arrondi(r * p);
    const engage = !sansPrix && ['validee', 'commandee', 'partielle'].includes(e) ? arrondi(reste(d) * p) : 0;
    const attente = e === 'demandee' && !sansPrix ? arrondi(d.quantite * p) : 0;
    return { etat: e, consomme, engage, attente, sansPrix: sansPrix && !['refusee', 'annulee'].includes(e) };
  }

  // ---------- Budget par service ----------
  // Une demande compte sur l'exercice de sa date de création.
  function budgetService(etat, serviceId, annee) {
    const debut = etat.reglages.debutExercice;
    const s = (etat.services || []).find((x) => x.id === serviceId);
    const budget = s && s.budgets && Number.isFinite(s.budgets[annee]) ? s.budgets[annee] : null;
    const r = { service: serviceId, annee, budget, consomme: 0, engage: 0, attente: 0, sansPrix: 0, nb: 0 };
    for (const d of etat.demandes || []) {
      if (d.service !== serviceId || exercice(d.creeLe, debut) !== annee) continue;
      const m = montants(d);
      r.consomme += m.consomme; r.engage += m.engage; r.attente += m.attente; if (m.sansPrix) r.sansPrix++;
      if (!['refusee', 'annulee'].includes(m.etat)) r.nb++;
    }
    r.consomme = arrondi(r.consomme); r.engage = arrondi(r.engage); r.attente = arrondi(r.attente);
    r.disponible = budget === null ? null : arrondi(budget - r.consomme - r.engage);
    r.taux = budget ? ((r.consomme + r.engage) / budget) * 100 : null;
    r.niveau = budget === null ? 'sans' : r.disponible < 0 ? 'depasse' : r.taux >= 90 ? 'proche' : 'ok';
    return r;
  }
  const budgets = (etat, annee) => (etat.services || []).filter((s) => !s.archive || (etat.demandes || []).some((d) => d.service === s.id && exercice(d.creeLe, etat.reglages.debutExercice) === annee)).map((s) => budgetService(etat, s.id, annee));

  // Effet d'une demande sur le budget de son service si on la valide : { budget, disponibleApres, depasse }.
  function effetBudget(etat, d) {
    const b = budgetService(etat, d.service, exercice(d.creeLe, etat.reglages.debutExercice));
    const m = montantEstime(d);
    if (b.budget === null || m === null) return { budget: b.budget, disponible: b.disponible, disponibleApres: null, depasse: false };
    // Une demande déjà en attente n'est pas encore comptée dans l'engagé.
    const dejaCompte = ['validee', 'commandee'].includes(d.statut);
    const apres = arrondi(b.disponible - (dejaCompte ? 0 : m));
    return { budget: b.budget, disponible: b.disponible, disponibleApres: apres, depasse: apres < 0 };
  }

  // Validation automatique : seuil fixé, prix estimé connu, montant sous le seuil, budget du service suffisant.
  function validationAuto(etat, d) {
    const seuil = etat.reglages.seuil;
    const m = montantEstime(d);
    if (seuil === null || seuil === undefined) return { auto: false, raison: 'Toutes les demandes sont validées par une personne (aucun seuil).' };
    if (m === null) return { auto: false, raison: 'Prix non estimé : la demande attend une validation.' };
    if (m > seuil) return { auto: false, raison: `Au-dessus du seuil de ${euros(seuil)} : la demande attend une validation.` };
    if (effetBudget(etat, d).depasse) return { auto: false, raison: 'Le budget du service serait dépassé : la demande attend une validation.' };
    return { auto: true, raison: `Sous le seuil de ${euros(seuil)} et dans le budget du service : validée automatiquement.` };
  }

  // ---------- Numéros ----------
  // DA-2026-007 (demande), BC-2026-003 (bon de commande) : numéro suivant de l'année, sans trou réutilisé.
  function numeroSuivant(liste, prefixe, annee) {
    const re = new RegExp(`^${prefixe}-${annee}-(\\d+)$`);
    const max = (liste || []).reduce((m, x) => { const r = re.exec(x.numero || ''); return r ? Math.max(m, Number(r[1])) : m; }, 0);
    return `${prefixe}-${annee}-${String(max + 1).padStart(3, '0')}`;
  }

  // ---------- Normalisation (tolérante aux anciennes versions) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(max, Math.max(min, n)) : defaut; };
  const montantOuNull = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) || n < 0 ? null : arrondi(Math.min(n, 1e7)); };
  const quantite = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) || n <= 0 ? 1 : Math.min(100000, Math.round(n * 100) / 100); };

  function normaliserArticle(x, i = 0) {
    const r = x && typeof x === 'object' ? x : {};
    return {
      id: texte(r.id, 40) || nouvelId(), nom: texte(r.nom, 90).trim() || `Article ${i + 1}`, categorie: texte(r.categorie, 30) || 'autre',
      unite: texte(r.unite, 20).trim() || 'pièce', fournisseur: r.fournisseur ? texte(r.fournisseur, 40) : null, reference: texte(r.reference, 40),
      prix: montantOuNull(r.prix), archive: !!r.archive,
    };
  }
  function normaliserFournisseur(x, i = 0) {
    const r = x && typeof x === 'object' ? x : {};
    return {
      id: texte(r.id, 40) || nouvelId(), nom: texte(r.nom, 80).trim() || `Fournisseur ${i + 1}`, contact: texte(r.contact, 160),
      delai: entier(r.delai, 0, 365, null), minimum: montantOuNull(r.minimum), note: texte(r.note, 300), archive: !!r.archive,
    };
  }
  function normaliserService(x, i = 0) {
    const r = x && typeof x === 'object' ? x : {};
    const budgets = {};
    if (r.budgets && typeof r.budgets === 'object') for (const [a, v] of Object.entries(r.budgets)) { const n = montantOuNull(v); if (/^\d{4}$/.test(a) && n !== null) budgets[a] = n; }
    return { id: texte(r.id, 40) || nouvelId(), nom: texte(r.nom, 60).trim() || `Service ${i + 1}`, responsable: texte(r.responsable, 60), couleur: entier(r.couleur, 0, 7, i % 8), budgets, archive: !!r.archive };
  }
  function normaliserDemande(x, auj) {
    const r = x && typeof x === 'object' ? x : {};
    const creeLe = estDate(r.creeLe) ? r.creeLe : auj;
    const q = quantite(r.quantite);
    const receptions = (Array.isArray(r.receptions) ? r.receptions : []).map((y) => ({ id: texte(y?.id, 40) || nouvelId(), date: estDate(y?.date) ? y.date : creeLe, qte: quantite(y?.qte), par: texte(y?.par, 60) })).slice(0, 50);
    return {
      id: texte(r.id, 60) || nouvelId(), numero: texte(r.numero, 20), groupe: r.groupe ? texte(r.groupe, 40) : null, creeLe,
      par: texte(r.par, 60), service: texte(r.service, 40), article: r.article ? texte(r.article, 40) : null,
      libelle: texte(r.libelle, 120).trim() || 'Article', categorie: texte(r.categorie, 30) || 'autre', unite: texte(r.unite, 20).trim() || 'pièce',
      quantite: q, prix: montantOuNull(r.prix), fournisseur: r.fournisseur ? texte(r.fournisseur, 40) : null,
      urgence: URGENCES.includes(r.urgence) ? r.urgence : 'normale', motif: texte(r.motif, 200), note: texte(r.note, 300),
      statut: STATUTS.includes(r.statut) ? r.statut : 'demandee', auto: !!r.auto,
      validePar: texte(r.validePar, 60), valideLe: estDate(r.valideLe) ? r.valideLe : null, motifRefus: texte(r.motifRefus, 200),
      annuleLe: estDate(r.annuleLe) ? r.annuleLe : null, commande: r.commande ? texte(r.commande, 40) : null,
      receptions, solde: !!r.solde, prixReel: montantOuNull(r.prixReel),
    };
  }
  function normaliserCommande(x, auj) {
    const r = x && typeof x === 'object' ? x : {};
    return {
      id: texte(r.id, 40) || nouvelId(), numero: texte(r.numero, 20), fournisseur: r.fournisseur ? texte(r.fournisseur, 40) : null,
      date: estDate(r.date) ? r.date : auj, par: texte(r.par, 60), reference: texte(r.reference, 60), note: texte(r.note, 300),
      demandes: (Array.isArray(r.demandes) ? r.demandes : []).map((y) => texte(y, 60)).filter(Boolean),
    };
  }
  const DEFAUT_REGLAGES = { seuil: 100, debutExercice: 1, relance: 3, taxe: 'HT' };
  function reglagesDe(g = {}, d = DEFAUT_REGLAGES) {
    return {
      seuil: g.seuil === undefined ? d.seuil : montantOuNull(g.seuil),
      debutExercice: entier(g.debutExercice, 1, 12, d.debutExercice),
      relance: entier(g.relance, 1, 60, d.relance),
      taxe: g.taxe === 'TTC' ? 'TTC' : g.taxe === 'HT' ? 'HT' : d.taxe,
    };
  }
  function etatVide(defauts = {}) {
    return { version: 1, organisation: '', adresse: '', reglages: reglagesDe(defauts.reglages || {}, DEFAUT_REGLAGES), services: [], fournisseurs: [], articles: [], demandes: [], commandes: [] };
  }
  function normaliser(d, auj, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const liste = (x) => (Array.isArray(x) ? x : []);
    return {
      version: 1, ...(d.majLe ? { majLe: d.majLe } : {}),
      organisation: texte(d.organisation, 80), adresse: texte(d.adresse, 300),
      reglages: reglagesDe(d.reglages || {}, v.reglages),
      services: liste(d.services).slice(0, MAX.services).map(normaliserService),
      fournisseurs: liste(d.fournisseurs).slice(0, MAX.fournisseurs).map(normaliserFournisseur),
      articles: liste(d.articles).slice(0, MAX.articles).map(normaliserArticle),
      demandes: liste(d.demandes).map((x) => normaliserDemande(x, auj)),
      commandes: liste(d.commandes).map((x) => normaliserCommande(x, auj)),
    };
  }
  // Catalogue de départ depuis la base (catégories choisies).
  const catalogueDeBase = (base, categories) => base.articles.filter(([c]) => !categories || categories.includes(c)).map(([categorie, nom, unite], i) => normaliserArticle({ id: `b${i}`, nom, categorie, unite }, i));

  // ---------- Fournisseur d'une demande ----------
  const fournisseurDe = (etat, d) => d.fournisseur || (d.article && (etat.articles || []).find((a) => a.id === d.article)?.fournisseur) || null;

  // ---------- Actions ----------
  // appliquer(etat, action) → { ok, etat, erreur, info }. Ne modifie jamais l'entrée.
  // Actions : creer { demandes: [...] } · valider { id, par, le } · refuser { id, par, le, motif } · annuler { id, par, le }
  // · reouvrir { id } · modifier { id, champs } · commander { commande } · recevoir { id, reception, prixReel? }
  // · solder { id, le } · supprimer { id } · maj { coll, obj } · retirer { coll, id } · reglages { valeur } · remplacer { etat }.
  const FOND = ['quantite', 'article', 'libelle', 'categorie', 'unite', 'service', 'urgence', 'motif'];
  const LIBRES = ['prix', 'fournisseur', 'note'];
  function appliquer(source, a) {
    const e = JSON.parse(JSON.stringify(source));
    const non = (erreur) => ({ ok: false, etat: source, erreur });
    const oui = (info = null) => ({ ok: true, etat: e, erreur: null, info });
    const dem = (id) => e.demandes.find((x) => x.id === id);
    const qui = (d) => `${d.numero || 'La demande'}${d.libelle ? ` (${d.libelle})` : ''}`;
    switch (a && a.type) {
      case 'creer': {
        const ajoutees = [];
        for (const x of a.demandes || []) {
          if (dem(x.id)) continue; // déjà là (action rejouée deux fois)
          const d = JSON.parse(JSON.stringify(x));
          const annee = Number(d.creeLe.slice(0, 4));
          if (!d.numero || e.demandes.some((y) => y.numero === d.numero)) d.numero = numeroSuivant(e.demandes, 'DA', annee);
          e.demandes.push(d); ajoutees.push(d.id);
        }
        return oui({ ajoutees });
      }
      case 'valider': case 'refuser': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        if (d.statut !== 'demandee') return non(`${qui(d)} est déjà ${LIB_ETAT[etatDemande(d)].toLowerCase()}${d.validePar ? ` (${d.validePar})` : ''}.`);
        if (a.type === 'refuser' && !String(a.motif || '').trim()) return non('Indique le motif du refus : la personne qui a demandé le verra.');
        d.statut = a.type === 'valider' ? 'validee' : 'refusee';
        d.validePar = texte(a.par, 60); d.valideLe = a.le; d.auto = false;
        d.motifRefus = a.type === 'refuser' ? texte(a.motif, 200).trim() : '';
        return oui();
      }
      case 'annuler': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        if (!['demandee', 'validee'].includes(d.statut)) return non(`${qui(d)} est ${LIB_ETAT[etatDemande(d)].toLowerCase()} : elle ne peut plus être annulée.`);
        d.statut = 'annulee'; d.annuleLe = a.le;
        return oui();
      }
      case 'reouvrir': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        if (!['refusee', 'annulee'].includes(d.statut)) return non(`${qui(d)} n'est ni refusée ni annulée.`);
        Object.assign(d, { statut: 'demandee', validePar: '', valideLe: null, motifRefus: '', annuleLe: null, auto: false });
        return oui();
      }
      case 'modifier': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        const champs = a.champs || {};
        const fond = Object.keys(champs).filter((k) => FOND.includes(k) && JSON.stringify(champs[k]) !== JSON.stringify(d[k]));
        if (fond.length && d.statut !== 'demandee') return non(`${qui(d)} est déjà ${LIB_ETAT[etatDemande(d)].toLowerCase()} : seuls le prix, le fournisseur et la note se modifient encore.`);
        if (!['demandee', 'validee'].includes(d.statut) && Object.keys(champs).some((k) => LIBRES.includes(k) && k !== 'note')) return non(`${qui(d)} est déjà commandée : le prix réel se saisit à la réception.`);
        for (const k of [...FOND, ...LIBRES]) if (k in champs) d[k] = champs[k];
        return oui();
      }
      case 'commander': {
        const c = JSON.parse(JSON.stringify(a.commande));
        if (e.commandes.some((x) => x.id === c.id)) return oui({ deja: true });
        const gardees = [], ecartees = [];
        for (const id of c.demandes) {
          const d = dem(id);
          if (d && d.statut === 'validee' && fournisseurDe(e, d) === c.fournisseur) gardees.push(d); else ecartees.push(d ? qui(d) : 'une demande supprimée');
        }
        if (!gardees.length) return non(`Aucune des demandes de ce bon n'est encore à commander (${ecartees.join(', ')}).`);
        c.demandes = gardees.map((d) => d.id);
        if (!c.numero || e.commandes.some((x) => x.numero === c.numero)) c.numero = numeroSuivant(e.commandes, 'BC', Number(c.date.slice(0, 4)));
        for (const d of gardees) { d.statut = 'commandee'; d.commande = c.id; d.fournisseur = c.fournisseur; }
        e.commandes.push(c);
        return oui({ ecartees, numero: c.numero });
      }
      case 'recevoir': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        const rc = a.reception;
        if (d.receptions.some((x) => x.id === rc.id)) return oui({ deja: true });
        const et = etatDemande(d);
        if (!['commandee', 'partielle'].includes(et)) return non(`${qui(d)} est ${LIB_ETAT[et].toLowerCase()} : rien à réceptionner.`);
        const q = Math.min(rc.qte, reste(d));
        if (!(q > 0)) return non('Indique une quantité reçue.');
        d.receptions.push({ ...rc, qte: q });
        if (a.prixReel !== undefined && a.prixReel !== null) d.prixReel = a.prixReel;
        return oui({ qte: q, complete: reste(d) === 0 });
      }
      case 'solder': {
        const d = dem(a.id);
        if (!d) return non('Cette demande a été supprimée sur un autre appareil.');
        if (!['commandee', 'partielle'].includes(etatDemande(d))) return non(`${qui(d)} n'attend plus de livraison.`);
        d.solde = true; d.annuleLe = a.le;
        return oui();
      }
      case 'supprimer': {
        const d = dem(a.id);
        if (!d) return oui({ deja: true });
        if (d.commande) return non(`${qui(d)} figure sur un bon de commande : annule-la plutôt.`);
        e.demandes = e.demandes.filter((x) => x.id !== a.id);
        return oui();
      }
      case 'maj': {
        if (!COLLECTIONS.includes(a.coll)) return non('Collection inconnue.');
        const l = e[a.coll];
        const i = l.findIndex((x) => x.id === a.obj.id);
        if (i < 0 && l.length >= MAX[a.coll]) return non(`${MAX[a.coll]} au plus.`);
        if (i >= 0) l[i] = JSON.parse(JSON.stringify(a.obj)); else l.push(JSON.parse(JSON.stringify(a.obj)));
        return oui();
      }
      case 'retirer': {
        if (!COLLECTIONS.includes(a.coll)) return non('Collection inconnue.');
        const champ = { articles: 'article', fournisseurs: 'fournisseur', services: 'service' }[a.coll];
        if (e.demandes.some((d) => d[champ] === a.id) || (a.coll === 'fournisseurs' && e.commandes.some((c) => c.fournisseur === a.id))) return non('Des demandes y sont rattachées : archive-le plutôt, l\'historique reste.');
        e[a.coll] = e[a.coll].filter((x) => x.id !== a.id);
        if (a.coll === 'fournisseurs') e.articles.forEach((x) => { if (x.fournisseur === a.id) x.fournisseur = null; });
        return oui();
      }
      case 'reglages': {
        const v = a.valeur || {};
        if ('organisation' in v) e.organisation = v.organisation;
        if ('adresse' in v) e.adresse = v.adresse;
        if (v.reglages) e.reglages = { ...e.reglages, ...v.reglages };
        return oui();
      }
      case 'remplacer': {
        const n = JSON.parse(JSON.stringify(a.etat));
        if (e.majLe) n.majLe = e.majLe; else delete n.majLe;
        return { ok: true, etat: n, erreur: null, info: null };
      }
      default: return non('Action inconnue.');
    }
  }

  // ---------- Synchronisation : rejouer les actions locales sur la version du serveur ----------
  // Chaque action est rejouée avec appliquer : celles devenues impossibles (demande validée ou commandée entre-temps
  // sur un autre appareil, supprimée…) sont refusées et signalées. Les numéros en double sont renumérotés.
  function rejouer(serveur, ops) {
    let e = JSON.parse(JSON.stringify(serveur));
    const refusees = [], acceptees = [];
    for (const op of ops || []) {
      const r = appliquer(e, op);
      if (r.ok) { e = r.etat; acceptees.push(op); } else refusees.push({ op, erreur: r.erreur });
    }
    return { etat: e, refusees, acceptees };
  }

  // ---------- À commander : regroupement par fournisseur ----------
  const cleLigne = (d) => (d.article ? `a:${d.article}` : `l:${d.libelle.toLocaleLowerCase('fr')}|${d.unite}`);
  // Lignes d'un bon : demandes du même article fusionnées (quantités additionnées, services listés).
  function lignesBon(etat, demandes) {
    const m = new Map();
    for (const d of demandes) {
      const k = cleLigne(d);
      const art = d.article ? (etat.articles || []).find((a) => a.id === d.article) : null;
      if (!m.has(k)) m.set(k, { cle: k, libelle: d.libelle, reference: art?.reference || '', unite: d.unite, quantite: 0, montant: 0, sansPrix: false, services: [], demandes: [], urgence: 'normale' });
      const l = m.get(k);
      l.quantite = arrondi(l.quantite + d.quantite);
      const p = prixUnitaire(d);
      if (p === null || p === undefined) l.sansPrix = true; else l.montant = arrondi(l.montant + d.quantite * p);
      if (d.service && !l.services.includes(d.service)) l.services.push(d.service);
      l.demandes.push(d.id);
      if (URGENCES.indexOf(d.urgence) > URGENCES.indexOf(l.urgence)) l.urgence = d.urgence;
    }
    return [...m.values()].map((l) => ({ ...l, prix: !l.sansPrix && l.quantite ? arrondi(l.montant / l.quantite) : null }))
      .sort((a, b) => URGENCES.indexOf(b.urgence) - URGENCES.indexOf(a.urgence) || a.libelle.localeCompare(b.libelle, 'fr'));
  }
  // Groupes de demandes validées par fournisseur (null : fournisseur à choisir).
  function aCommander(etat) {
    const groupes = new Map();
    for (const d of etat.demandes || []) {
      if (d.statut !== 'validee') continue;
      const f = fournisseurDe(etat, d);
      if (!groupes.has(f)) groupes.set(f, []);
      groupes.get(f).push(d);
    }
    return [...groupes.entries()].map(([fournisseur, demandes]) => {
      const lignes = lignesBon(etat, demandes);
      const four = (etat.fournisseurs || []).find((x) => x.id === fournisseur) || null;
      const total = arrondi(lignes.reduce((s, l) => s + l.montant, 0));
      return {
        fournisseur, demandes: demandes.map((d) => d.id), lignes, total, sansPrix: lignes.filter((l) => l.sansPrix).length,
        urgentes: demandes.filter((d) => d.urgence !== 'normale').length,
        sousMinimum: four && four.minimum !== null && total < four.minimum ? arrondi(four.minimum - total) : 0,
        plusAncienne: demandes.map((d) => d.valideLe || d.creeLe).sort()[0],
      };
    }).sort((a, b) => (a.fournisseur === null) - (b.fournisseur === null) || b.urgentes - a.urgentes || a.plusAncienne.localeCompare(b.plusAncienne));
  }

  // État d'un bon de commande : 'commandee' | 'partielle' | 'recue' ; date de livraison attendue ; retard.
  function etatCommande(etat, c, auj) {
    const ds = c.demandes.map((id) => (etat.demandes || []).find((d) => d.id === id)).filter(Boolean);
    const etats = ds.map(etatDemande);
    const fini = (x) => ['recue', 'annulee'].includes(x);
    const st = !ds.length ? 'recue' : etats.every(fini) ? 'recue' : etats.some((x) => x === 'partielle' || x === 'recue') ? 'partielle' : 'commandee';
    const four = (etat.fournisseurs || []).find((x) => x.id === c.fournisseur);
    const attendue = four && four.delai !== null ? ajout(c.date, four.delai) : null;
    const total = arrondi(ds.reduce((s, d) => { const p = prixUnitaire(d); return s + (p === null ? 0 : d.quantite * p); }, 0));
    const derniere = ds.flatMap((d) => d.receptions.map((r) => r.date)).sort().pop() || null;
    return { statut: st, demandes: ds, attendue, retard: st !== 'recue' && attendue && auj > attendue ? ecart(attendue, auj) : 0, total, derniere };
  }

  // ---------- Listes et alertes ----------
  const memeNom = (a, b) => !!a && !!b && a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');
  const enAttenteDepuis = (d, auj) => (d.statut === 'demandee' ? ecart(d.creeLe, auj) : 0);
  function aValider(etat, auj) {
    return (etat.demandes || []).filter((d) => d.statut === 'demandee')
      .map((d) => ({ d, attente: ecart(d.creeLe, auj), relance: ecart(d.creeLe, auj) >= etat.reglages.relance, effet: effetBudget(etat, d) }))
      .sort((a, b) => URGENCES.indexOf(b.d.urgence) - URGENCES.indexOf(a.d.urgence) || a.d.creeLe.localeCompare(b.d.creeLe));
  }

  // ---------- Statistiques ----------
  const moyenne = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);
  // Sur [debut, fin[ (date de création des demandes) : nombres, montants, délais moyens en jours, répartitions.
  function statistiques(etat, debut, fin) {
    const ds = (etat.demandes || []).filter((d) => d.creeLe >= debut && d.creeLe < fin);
    const parEtat = Object.fromEntries(ETATS.map((x) => [x, 0]));
    const parCategorie = {}, parService = {}, parArticle = {};
    const dValid = [], dCommande = [], dRecep = [];
    let consomme = 0, engage = 0, auto = 0;
    for (const d of ds) {
      const m = montants(d);
      parEtat[m.etat]++;
      consomme += m.consomme; engage += m.engage;
      if (d.auto) auto++;
      parCategorie[d.categorie] = arrondi((parCategorie[d.categorie] || 0) + m.consomme + m.engage);
      parService[d.service] = arrondi((parService[d.service] || 0) + m.consomme + m.engage);
      if (!['refusee', 'annulee'].includes(m.etat)) { const k = cleLigne(d); parArticle[k] = parArticle[k] || { libelle: d.libelle, unite: d.unite, quantite: 0, nb: 0 }; parArticle[k].quantite = arrondi(parArticle[k].quantite + d.quantite); parArticle[k].nb++; }
      if (d.valideLe && !d.auto && ['validee', 'refusee', 'commandee'].includes(d.statut)) dValid.push(ecart(d.creeLe, d.valideLe));
      const c = d.commande ? (etat.commandes || []).find((x) => x.id === d.commande) : null;
      if (c && d.valideLe) dCommande.push(Math.max(0, ecart(d.valideLe, c.date)));
      if (c && m.etat === 'recue' && d.receptions.length) dRecep.push(Math.max(0, ecart(c.date, d.receptions.map((r) => r.date).sort().pop())));
    }
    const decidees = ds.filter((d) => d.valideLe).length; // validées (y compris automatiquement) ou refusées
    // Consommé par mois (date de réception) sur la période.
    const mois = [];
    for (let m = `${debut.slice(0, 7)}-01`; m < fin; m = ajoutMois(m, 1)) mois.push({ mois: m.slice(0, 7), consomme: 0 });
    for (const d of etat.demandes || []) {
      const p = prixUnitaire(d);
      if (p === null || p === undefined) continue;
      for (const r of d.receptions) { const x = mois.find((y) => y.mois === r.date.slice(0, 7)); if (x) x.consomme = arrondi(x.consomme + r.qte * p); }
    }
    return {
      nb: ds.length, parEtat, consomme: arrondi(consomme), engage: arrondi(engage), auto,
      tauxRefus: decidees ? (parEtat.refusee / decidees) * 100 : null,
      urgentes: ds.filter((d) => d.urgence !== 'normale').length,
      delaiValidation: moyenne(dValid), delaiCommande: moyenne(dCommande), delaiReception: moyenne(dRecep),
      parCategorie, parService, mois,
      topArticles: Object.values(parArticle).sort((a, b) => b.nb - a.nb || b.quantite - a.quantite).slice(0, 10),
    };
  }

  // ---------- RGPD ----------
  // Efface les noms (demandeur, valideur, réceptions) des demandes créées avant « avant » et terminées.
  function anonymiser(etat, avant) {
    const e = JSON.parse(JSON.stringify(etat));
    let n = 0;
    for (const d of e.demandes) {
      if (d.creeLe >= avant || !['recue', 'refusee', 'annulee'].includes(etatDemande(d))) continue;
      if (d.par || d.validePar || d.receptions.some((r) => r.par)) { d.par = ''; d.validePar = ''; d.receptions.forEach((r) => { r.par = ''; }); n++; }
    }
    for (const c of e.commandes) if (c.date < avant) c.par = '';
    return { etat: e, n };
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (n) => (n === null || n === undefined ? '' : String(arrondi(n)).replace('.', ','));
  function versCsv(etat) {
    const nom = (coll, id) => (etat[coll] || []).find((x) => x.id === id)?.nom || '';
    const tete = ['Numéro', 'Date', 'Demandé par', 'Service', 'Article', 'Catégorie', 'Quantité', 'Unité', 'Prix unitaire estimé', 'Montant estimé', 'Urgence', 'Motif', 'État', 'Validé ou refusé par', 'Le', 'Motif du refus', 'Fournisseur', 'Bon de commande', 'Quantité reçue', 'Prix unitaire réel', 'Consommé', 'Engagé'];
    const lignes = [...etat.demandes].sort((a, b) => a.creeLe.localeCompare(b.creeLe) || a.numero.localeCompare(b.numero)).map((d) => {
      const m = montants(d);
      const c = d.commande ? etat.commandes.find((x) => x.id === d.commande) : null;
      return [d.numero, d.creeLe, d.par, nom('services', d.service), d.libelle, d.categorie, nombreCsv(d.quantite), d.unite, nombreCsv(d.prix), nombreCsv(montantEstime(d)), d.urgence, d.motif, LIB_ETAT[m.etat], d.auto ? 'Validation automatique' : d.validePar, d.valideLe || '', d.motifRefus, nom('fournisseurs', fournisseurDe(etat, d)), c?.numero || '', nombreCsv(recu(d)), nombreCsv(d.prixReel), nombreCsv(m.consomme), nombreCsv(m.engage)];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.ACH = {
    STATUTS, ETATS, LIB_ETAT, URGENCES, COLLECTIONS, MAX, MOIS,
    iso, versDate, ajout, ajoutMois, ecart, estDate, exercice, bornesExercice, libelleExercice,
    arrondi, euros, pct, lireNombre,
    recu, reste, etatDemande, prixUnitaire, montantEstime, montants, budgetService, budgets, effetBudget, validationAuto,
    numeroSuivant, nouvelId, normaliserArticle, normaliserFournisseur, normaliserService, normaliserDemande, normaliserCommande,
    reglagesDe, etatVide, normaliser, catalogueDeBase, fournisseurDe,
    appliquer, rejouer, lignesBon, aCommander, etatCommande,
    memeNom, enAttenteDepuis, aValider, statistiques, anonymiser, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
