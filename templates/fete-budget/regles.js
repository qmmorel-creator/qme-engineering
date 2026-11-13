// FêteBudget · règles métier pures (aucun accès au DOM ni au stockage). window.FTB, testé par
// outils/templates/fete-budget.test.mjs. Montants en centimes entiers.
// Besoin = quantité par adulte (formule) × (adultes + enfants × coefficient enfant) [× durée si par heure],
// arrondi à l'unité supérieure puis au conditionnement ; quantité modifiable (ajustement).
// Montant retenu d'une dépense = réel s'il est saisi, sinon prévu. Budget restant = budget − retenu.
// Répartition : chaque participant doit (total payé × ses parts ÷ total des parts) ; les soldes sont
// réglés par un minimum de virements (le plus gros débiteur rembourse le plus gros créancier).
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const STATUTS = ['attente', 'confirme', 'decline'];

  // ---------- Invités ----------
  function compte(invites, base = 'attendus') {
    const pris = invites.filter((i) => (base === 'confirmes' ? i.statut === 'confirme' : i.statut !== 'decline'));
    return {
      adultes: pris.filter((i) => i.type === 'adulte').length, enfants: pris.filter((i) => i.type === 'enfant').length, total: pris.length,
      confirmes: invites.filter((i) => i.statut === 'confirme').length, attente: invites.filter((i) => i.statut === 'attente').length, declines: invites.filter((i) => i.statut === 'decline').length,
    };
  }

  // ---------- Besoins ----------
  function besoin(b, formule, c, duree, ajustement) {
    const ratio = b.q[formule] || 0;
    const brut = b.enfantSeul ? b.enfant * c.enfants : ratio * (c.adultes + c.enfants * (b.enfant ?? 1));
    const calcule = O.arrondi(brut * (b.parHeure ? duree : 1), 2);
    const quantite = ajustement?.quantite ?? (b.unite === 'g' || b.unite === 'L' || b.unite === 'kg' ? calcule : Math.ceil(calcule - 1e-9));
    const nbCond = b.cond ? Math.ceil(quantite / b.cond - 1e-9) : null;
    const prix = ajustement?.prix ?? null; // centimes par conditionnement (ou par unité sans conditionnement)
    const unitesAchat = b.cond ? nbCond : Math.ceil(quantite - 1e-9);
    return { besoin: b, calcule, quantite, ajuste: ajustement?.quantite !== undefined && ajustement?.quantite !== null, nbCond, prix, cout: prix === null ? null : prix * unitesAchat, actif: quantite > 0 };
  }
  function besoins(e) {
    const c = compte(e.invites, e.evenement.base);
    return B().besoins.map((b) => besoin(b, e.evenement.formule, c, e.evenement.duree, e.ajustements[b.id])).filter((x) => x.actif || x.ajuste);
  }

  // ---------- Budget ----------
  function budget(e) {
    const c = compte(e.invites, e.evenement.base);
    if (e.evenement.budgetMode === 'parPersonne') return e.evenement.budgetParPersonne === null ? null : e.evenement.budgetParPersonne * c.total;
    return e.evenement.budgetGlobal;
  }
  const dansScenario = (d, s) => !d.scenarios.length || d.scenarios.includes(s);
  const retenu = (d) => d.reel ?? d.prevu ?? 0;
  function totaux(e, scenarioId = e.scenarioActif) {
    const ds = e.depenses.filter((d) => dansScenario(d, scenarioId));
    const parCat = B().categories.map((cat) => {
      const l = ds.filter((d) => d.categorie === cat.id);
      return { categorie: cat.id, nb: l.length, prevu: l.reduce((s, d) => s + (d.prevu || 0), 0), reel: l.reduce((s, d) => s + (d.reel || 0), 0), retenu: l.reduce((s, d) => s + retenu(d), 0), aPayer: l.filter((d) => d.reel === null).length };
    }).filter((x) => x.nb);
    const c = compte(e.invites, e.evenement.base);
    const tot = { prevu: ds.reduce((s, d) => s + (d.prevu || 0), 0), reel: ds.reduce((s, d) => s + (d.reel || 0), 0), retenu: ds.reduce((s, d) => s + retenu(d), 0) };
    const bud = budget(e);
    return {
      depenses: ds, parCat, ...tot, budget: bud, restant: bud === null ? null : bud - tot.retenu, depasse: bud !== null && tot.retenu > bud,
      parPersonne: c.total ? Math.round(tot.retenu / c.total) : null, ecart: tot.reel - ds.filter((d) => d.reel !== null).reduce((s, d) => s + (d.prevu || 0), 0),
      personnes: c.total,
    };
  }
  function comparaison(e) {
    return e.scenarios.map((s) => { const t = totaux(e, s.id); return { scenario: s, retenu: t.retenu, prevu: t.prevu, restant: t.restant, parPersonne: t.parPersonne, parCat: Object.fromEntries(t.parCat.map((x) => [x.categorie, x.retenu])) }; });
  }

  // ---------- Répartition entre participants ----------
  // Dépenses réelles (ou prévues si aucune réelle) payées par chaque participant.
  function repartition(e, scenarioId = e.scenarioActif) {
    const ps = e.participants;
    if (!ps.length) return { soldes: [], virements: [], total: 0 };
    const ds = e.depenses.filter((d) => dansScenario(d, scenarioId) && d.payePar && ps.some((p) => p.id === d.payePar) && d.reel !== null);
    const total = ds.reduce((s, d) => s + d.reel, 0);
    const parts = ps.reduce((s, p) => s + p.parts, 0) || 1;
    // Quote-part au centime, le reste d'arrondi attribué aux premiers participants (somme exacte).
    const brutes = ps.map((p) => (total * p.parts) / parts);
    const quotes = brutes.map(Math.floor);
    let reste = total - quotes.reduce((s, x) => s + x, 0);
    const ordre = brutes.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of ordre) { if (reste <= 0) break; quotes[i]++; reste--; }
    const soldes = ps.map((p, i) => { const paye = ds.filter((d) => d.payePar === p.id).reduce((s, d) => s + d.reel, 0); return { id: p.id, nom: p.nom, parts: p.parts, paye, doit: quotes[i], solde: paye - quotes[i] }; });
    const deb = soldes.filter((s) => s.solde < 0).map((s) => ({ ...s, r: -s.solde }));
    const cre = soldes.filter((s) => s.solde > 0).map((s) => ({ ...s, r: s.solde }));
    const virements = [];
    while (deb.length && cre.length) {
      deb.sort((a, b) => b.r - a.r || a.nom.localeCompare(b.nom)); cre.sort((a, b) => b.r - a.r || a.nom.localeCompare(b.nom));
      const d = deb[0], c = cre[0], m = Math.min(d.r, c.r);
      virements.push({ de: d.id, deNom: d.nom, a: c.id, aNom: c.nom, montant: m });
      d.r -= m; c.r -= m;
      if (!d.r) deb.shift();
      if (!c.r) cre.shift();
    }
    return { soldes, virements, total };
  }

  // ---------- Préparation ----------
  function taches(e) {
    const base = B().preparation.map(([j, texte], i) => ({ id: `p${i}`, j, texte, perso: false }));
    const toutes = [...base, ...e.tachesPerso.map((t) => ({ ...t, perso: true }))];
    return toutes.map((t) => ({ ...t, date: e.evenement.date ? O.ajout(e.evenement.date, t.j) : null, faite: !!e.faites[t.id] })).sort((a, b) => a.j - b.j || a.texte.localeCompare(b.texte));
  }

  // ---------- Normalisation ----------
  const montant = (v) => (v === null || v === undefined || v === '' ? null : O.entier(v, 0, 1e9, null));
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const ev = d.evenement || {};
    const scenarios = O.tableau(d.scenarios).slice(0, 6).map((s) => ({ id: O.idValide(s?.id), nom: O.texte(s?.nom, 60) || 'Scénario' }));
    if (!scenarios.length) scenarios.push({ id: 'base', nom: 'Scénario principal' });
    const participants = O.tableau(d.participants).slice(0, 40).map((p) => ({ id: O.idValide(p?.id), nom: O.texte(p?.nom, 60) || 'Participant', parts: O.nombre(p?.parts, 0.5, 20, 1) }));
    const ids = new Set(B().besoins.map((b) => b.id));
    const ajustements = {};
    for (const [k, a] of Object.entries(d.ajustements && typeof d.ajustements === 'object' ? d.ajustements : {})) {
      if (!ids.has(k) || !a) continue;
      const q = O.nombre(a.quantite, 0, 1e6, null), p = montant(a.prix);
      if (q !== null || p !== null) ajustements[k] = { quantite: q, prix: p };
    }
    const faites = {};
    for (const [k, val] of Object.entries(d.faites && typeof d.faites === 'object' ? d.faites : {})) if (/^[\w-]{1,40}$/.test(k) && val) faites[k] = true;
    return {
      ...d, version: 1,
      evenement: {
        nom: O.texte(ev.nom, 80) || 'Ma fête', type: O.choix(ev.type, B().types.map((t) => t.id), 'autre'), formule: O.choix(ev.formule, B().formules.map((f) => f.id), 'buffet'),
        date: O.dateOuNull(ev.date), heure: /^\d{2}:\d{2}$/.test(ev.heure || '') ? ev.heure : '', duree: O.nombre(ev.duree, 0.5, 48, 4), lieu: O.texte(ev.lieu, 120),
        budgetMode: O.choix(ev.budgetMode, ['global', 'parPersonne'], 'global'), budgetGlobal: montant(ev.budgetGlobal), budgetParPersonne: montant(ev.budgetParPersonne),
        base: O.choix(ev.base, ['attendus', 'confirmes'], 'attendus'),
      },
      invites: O.tableau(d.invites).slice(0, 500).map((i) => ({ id: O.idValide(i?.id), nom: O.texte(i?.nom, 60) || 'Invité', type: O.choix(i?.type, ['adulte', 'enfant'], 'adulte'), statut: O.choix(i?.statut, STATUTS, 'attente'), note: O.texte(i?.note, 200) })),
      participants, scenarios, scenarioActif: scenarios.some((s) => s.id === d.scenarioActif) ? d.scenarioActif : scenarios[0].id,
      depenses: O.tableau(d.depenses).slice(0, 500).map((x) => ({
        id: O.idValide(x?.id), categorie: O.choix(x?.categorie, B().categories.map((c) => c.id), 'divers'), libelle: O.texte(x?.libelle, 100) || 'Dépense',
        prevu: montant(x?.prevu), reel: montant(x?.reel), payePar: participants.some((p) => p.id === x?.payePar) ? x.payePar : null,
        scenarios: O.tableau(x?.scenarios).filter((s) => scenarios.some((y) => y.id === s)), note: O.texte(x?.note, 200),
      })),
      ajustements, faites,
      tachesPerso: O.tableau(d.tachesPerso).slice(0, 60).map((t) => ({ id: O.idValide(t?.id), j: O.entier(t?.j, -365, 60, 0), texte: O.texte(t?.texte, 120) || 'Tâche' })),
    };
  }
  function etatVide() {
    return { version: 1, evenement: { nom: 'Ma fête', type: 'autre', formule: 'buffet', date: null, heure: '', duree: 4, lieu: '', budgetMode: 'global', budgetGlobal: null, budgetParPersonne: null, base: 'attendus' },
      invites: [], participants: [], scenarios: [{ id: 'base', nom: 'Scénario principal' }], scenarioActif: 'base', depenses: [], ajustements: {}, faites: {}, tachesPerso: [] };
  }

  // ---------- Exports CSV ----------
  const nomCat = (id) => B().categories.find((c) => c.id === id)?.nom || '';
  function csvDepenses(e) {
    const nomP = (id) => e.participants.find((p) => p.id === id)?.nom || '';
    return [['Catégorie', 'Dépense', 'Prévu (€)', 'Réel (€)', 'Retenu (€)', 'Payé par', 'Scénarios', 'Note'],
      ...e.depenses.map((d) => [nomCat(d.categorie), d.libelle, O.centimesCsv(d.prevu), O.centimesCsv(d.reel), O.centimesCsv(retenu(d)), nomP(d.payePar), d.scenarios.length ? d.scenarios.map((s) => e.scenarios.find((x) => x.id === s)?.nom).join(' + ') : 'Tous', d.note])];
  }
  function csvInvites(e) {
    const LIB = { attente: 'En attente', confirme: 'Confirmé', decline: 'Décliné' };
    return [['Nom', 'Adulte ou enfant', 'Réponse', 'Note'], ...e.invites.map((i) => [i.nom, i.type === 'adulte' ? 'Adulte' : 'Enfant', LIB[i.statut], i.note])];
  }
  function csvCourses(e) {
    return [['Catégorie', 'Article', 'Quantité', 'Unité', 'À acheter', 'Prix unitaire (€)', 'Coût estimé (€)'],
      ...besoins(e).map((x) => [nomCat(x.besoin.categorie), x.besoin.nom, O.nombreCsv(x.quantite), x.besoin.unite, x.nbCond ? (/\s/.test(x.besoin.uc) ? `${x.nbCond} × ${x.besoin.uc}` : `${x.nbCond} ${x.besoin.uc}`) : '', O.centimesCsv(x.prix), O.centimesCsv(x.cout)])];
  }

  racine.FTB = { STATUTS, compte, besoin, besoins, budget, dansScenario, retenu, totaux, comparaison, repartition, taches, normaliser, etatVide, csvDepenses, csvInvites, csvCourses };
})(typeof window !== 'undefined' ? window : globalThis);
