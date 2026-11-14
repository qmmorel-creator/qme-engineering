// Planificateur de voyage QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.VYG) et par les tests Node (vm).
// Dépenses partagées : moteur commun avec le budget commun (templates/budget-commun/regles.js, window.BCM),
// chargé AVANT ce fichier : répartition au centime, soldes, nombre minimal de remboursements.
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers).
// Une nuit porte la date du soir : un hébergement occupe les nuits de son arrivée (incluse) à son départ
// (exclu) ; un voyage du 10 au 14 compte 5 jours et 4 nuits (10, 11, 12, 13).
(function (racine) {
  'use strict';
  const BCM = racine.BCM;
  if (!BCM) throw new Error('Le moteur des dépenses partagées (budget-commun/regles.js) doit être chargé avant.');

  const STATUTS = ['aReserver', 'reserve'];
  const LIB_STATUT = { aReserver: 'À réserver', reserve: 'Réservé', libre: 'Sans réservation' };
  const STATUTS_ACTIVITE = ['libre', 'aReserver', 'reserve'];
  const MAX_VOYAGEURS = 20;
  const URGENT_JOURS = 14;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const maxDate = (a, b) => (a > b ? a : b);
  const minDate = (a, b) => (a < b ? a : b);
  // Liste des dates de debut à fin (incluses).
  function dates(debut, fin) {
    if (!estDate(debut) || !estDate(fin) || fin < debut) return [];
    const n = ecart(debut, fin);
    return Array.from({ length: Math.min(n, 400) + 1 }, (_, i) => ajout(debut, i));
  }

  // ---------- Montants ----------
  const { versCentimes, euros } = BCM;
  // Saisie d'un prix : vide → 0 ; illisible ou négatif → null.
  function lireMontant(saisie) {
    if (!String(saisie ?? '').trim()) return 0;
    const c = versCentimes(saisie);
    return c === null || c < 0 ? null : c;
  }
  const saisieMontant = (c) => (!c ? '' : `${Math.floor(c / 100)},${deux(c % 100)}`);
  const montant = (c) => (Number.isInteger(c) && c > 0 ? c : 0);

  // ---------- Identifiants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const texte = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const date = (v) => (estDate(v) ? v : '');
  const heure = (v) => (estHeure(v) ? v : '');
  const statut = (v, liste = STATUTS, defaut = 'aReserver') => (liste.includes(v) ? v : defaut);
  const horo = (v) => (typeof v === 'string' ? v : '');

  const normaliserVoyageur = (v = {}) => ({ id: texte(v.id, 40) || nouvelId(), nom: texte(v.nom, 40) || 'Voyageur', modifLe: horo(v.modifLe) });
  function normaliserEtape(e = {}) {
    let arrivee = date(e.arrivee), depart = date(e.depart);
    if (arrivee && depart && depart < arrivee) [arrivee, depart] = [depart, arrivee];
    return { id: texte(e.id, 40) || nouvelId(), lieu: texte(e.lieu, 80) || 'Étape', arrivee, depart: depart || arrivee, note: texte(e.note, 500), modifLe: horo(e.modifLe) };
  }
  function normaliserNuit(h = {}) {
    let arrivee = date(h.arrivee), depart = date(h.depart);
    if (arrivee && depart && depart < arrivee) [arrivee, depart] = [depart, arrivee];
    if (arrivee && (!depart || depart === arrivee)) depart = ajout(arrivee, 1);
    const m = montant(h.montant);
    return {
      id: texte(h.id, 40) || nouvelId(), nom: texte(h.nom, 80) || 'Hébergement', adresse: texte(h.adresse, 200),
      arrivee, depart, statut: statut(h.statut), montant: m, acompte: Math.min(montant(h.acompte), m), solde: !!h.solde,
      note: texte(h.note, 500), modifLe: horo(h.modifLe),
    };
  }
  function normaliserTransport(t = {}) {
    return {
      id: texte(t.id, 40) || nouvelId(), date: date(t.date), heure: heure(t.heure), mode: texte(t.mode, 20) || 'autre',
      de: texte(t.de, 80), vers: texte(t.vers, 80), statut: statut(t.statut), prix: montant(t.prix), ref: texte(t.ref, 80),
      note: texte(t.note, 500), modifLe: horo(t.modifLe),
    };
  }
  function normaliserActivite(a = {}) {
    return {
      id: texte(a.id, 40) || nouvelId(), date: date(a.date), heure: heure(a.heure), titre: texte(a.titre, 100) || 'Activité',
      lieu: texte(a.lieu, 100), statut: statut(a.statut, STATUTS_ACTIVITE, 'libre'), prix: montant(a.prix), note: texte(a.note, 500),
      modifLe: horo(a.modifLe),
    };
  }
  function normaliserDepense(d = {}, voyageurs = [], postes = []) {
    const ids = voyageurs.map((v) => v.id);
    const r = d.repartition || {};
    const mode = BCM.MODES.includes(r.mode) ? r.mode : 'egale';
    const participants = (Array.isArray(r.participants) ? r.participants : ids).filter((id) => ids.includes(id));
    const dep = {
      id: texte(d.id, 40) || nouvelId(), date: date(d.date), libelle: texte(d.libelle, 100) || 'Dépense', montant: montant(d.montant),
      poste: postes.some((p) => p.id === d.poste) ? d.poste : 'divers', payeur: ids.includes(d.payeur) ? d.payeur : (ids[0] || ''),
      repartition: { mode: mode === 'prorata' ? 'egale' : mode, participants: participants.length ? participants : ids, ...(r.parts ? { parts: r.parts } : {}), ...(r.montants ? { montants: r.montants } : {}) },
      quotes: d.quotes && typeof d.quotes === 'object' ? d.quotes : null, lien: texte(d.lien, 40), note: texte(d.note, 300), modifLe: horo(d.modifLe),
    };
    dep.quotes = quotesDepense(dep, voyageurs);
    return dep;
  }
  const normaliserVirement = (v = {}) => ({ id: texte(v.id, 40) || nouvelId(), date: date(v.date), de: texte(v.de, 40), a: texte(v.a, 40), montant: montant(v.montant), modifLe: horo(v.modifLe) });
  const normaliserCase = (c = {}) => ({ id: texte(c.id, 40) || nouvelId(), texte: texte(c.texte, 120) || 'Élément', liste: texte(c.liste, 30), detail: texte(c.detail, 300), qui: texte(c.qui, 40), fait: !!c.fait, modifLe: horo(c.modifLe) });

  function etatVide() {
    return {
      version: 1,
      voyage: { nom: '', destination: '', debut: '', fin: '', note: '', modifLe: '' },
      budget: { prevus: {}, modifLe: '' },
      voyageurs: [], etapes: [], nuits: [], transports: [], activites: [], depenses: [], virements: [],
      bagages: [], documents: [], archives: [], supprimes: {},
    };
  }

  function normaliser(d, postes = []) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    const v = d.voyage || {};
    let debut = date(v.debut), fin = date(v.fin);
    if (debut && fin && fin < debut) [debut, fin] = [fin, debut];
    e.voyage = { nom: texte(v.nom, 80), destination: texte(v.destination, 80), debut, fin: fin || debut, note: texte(v.note, 1000), modifLe: horo(v.modifLe) };
    const prevus = {};
    for (const [k, c] of Object.entries(d.budget?.prevus || {})) if (postes.some((p) => p.id === k) && montant(c)) prevus[k] = montant(c);
    e.budget = { prevus, modifLe: horo(d.budget?.modifLe) };
    const tab = (x) => (Array.isArray(x) ? x : []);
    e.voyageurs = tab(d.voyageurs).slice(0, MAX_VOYAGEURS).map(normaliserVoyageur);
    e.etapes = tab(d.etapes).map(normaliserEtape);
    e.nuits = tab(d.nuits).map(normaliserNuit);
    e.transports = tab(d.transports).map(normaliserTransport);
    e.activites = tab(d.activites).map(normaliserActivite);
    e.depenses = tab(d.depenses).map((x) => normaliserDepense(x, e.voyageurs, postes)).filter((x) => x.montant > 0);
    e.virements = tab(d.virements).map(normaliserVirement).filter((x) => x.montant > 0 && x.de && x.a && x.de !== x.a);
    e.bagages = tab(d.bagages).map(normaliserCase);
    e.documents = tab(d.documents).map(normaliserCase);
    e.archives = tab(d.archives).slice(-50).map((a) => ({ id: texte(a.id, 40) || nouvelId(), nom: texte(a.nom, 80), debut: date(a.debut), fin: date(a.fin), voyageurs: Math.max(0, Math.round(Number(a.voyageurs) || 0)), prevu: montant(a.prevu), reel: montant(a.reel), modifLe: horo(a.modifLe) }));
    e.supprimes = d.supprimes && typeof d.supprimes === 'object' ? { ...d.supprimes } : {};
    if (typeof d.majLe === 'string') e.majLe = d.majLe;
    return e;
  }

  // ---------- Voyage : durée, avancement ----------
  const nbJours = (v) => (estDate(v.debut) && estDate(v.fin) ? ecart(v.debut, v.fin) + 1 : 0);
  const nbNuits = (v) => Math.max(0, nbJours(v) - 1);
  // avant (J−n), pendant (jour k sur n), apres, ou sansDates.
  function phase(v, auj) {
    if (!estDate(v.debut) || !estDate(v.fin)) return { etat: 'sansDates' };
    if (auj < v.debut) return { etat: 'avant', joursAvant: ecart(auj, v.debut) };
    if (auj > v.fin) return { etat: 'apres', joursApres: ecart(v.fin, auj) };
    return { etat: 'pendant', jour: ecart(v.debut, auj) + 1, total: nbJours(v) };
  }

  // ---------- Nuits et hébergements ----------
  const nuitsHebergement = (h) => (h.arrivee && h.depart ? Math.max(0, ecart(h.arrivee, h.depart)) : 0);
  const couvre = (h, d) => !!h.arrivee && h.arrivee <= d && d < h.depart;
  const resteAPayer = (h) => (h.statut === 'reserve' && !h.solde ? Math.max(0, h.montant - h.acompte) : 0);
  // Pour chaque nuit du voyage : hébergements qui la couvrent et état
  // (sans : aucun toit ; aReserver ; reserve ; double : deux hébergements la même nuit).
  function couverture(etat) {
    const v = etat.voyage;
    if (!nbNuits(v)) return [];
    return dates(v.debut, ajout(v.fin, -1)).map((d) => {
      const h = etat.nuits.filter((x) => couvre(x, d));
      const statut = !h.length ? 'sans' : h.length > 1 ? 'double' : h[0].statut;
      return { date: d, hebergements: h, etape: etapeDeLaNuit(etat, d), statut };
    });
  }
  // Nuits hors des dates du voyage (avant le départ, après le retour).
  const horsVoyage = (etat) => etat.nuits.filter((h) => h.arrivee && estDate(etat.voyage.debut) && estDate(etat.voyage.fin) && (h.arrivee < etat.voyage.debut || h.depart > etat.voyage.fin));
  function resumeNuits(etat) {
    const c = couverture(etat);
    const n = (s) => c.filter((x) => x.statut === s).length;
    return { total: c.length, reserve: n('reserve'), aReserver: n('aReserver'), sans: n('sans'), double: n('double'), detail: c };
  }

  // ---------- Étapes ----------
  const trierEtapes = (l) => [...l].sort((a, b) => (a.arrivee || '9').localeCompare(b.arrivee || '9') || a.lieu.localeCompare(b.lieu));
  const nuitsEtape = (e) => (e.arrivee && e.depart ? Math.max(0, ecart(e.arrivee, e.depart)) : 0);
  const etapeDeLaNuit = (etat, d) => trierEtapes(etat.etapes).find((e) => e.arrivee && e.arrivee <= d && d < e.depart) || null;
  const etapesDuJour = (etat, d) => trierEtapes(etat.etapes).filter((e) => e.arrivee && e.arrivee <= d && d <= e.depart);
  // Étapes qui partagent au moins une nuit (erreur de saisie probable).
  function etapesChevauchantes(etat) {
    const l = trierEtapes(etat.etapes).filter((e) => nuitsEtape(e) > 0);
    const res = [];
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (l[j].arrivee < l[i].depart) res.push([l[i].id, l[j].id]);
    return res;
  }

  // ---------- Programme jour par jour ----------
  const parHeure = (a, b) => (a.heure || '99:99').localeCompare(b.heure || '99:99');
  function programmeJour(etat, d) {
    const v = etat.voyage;
    return {
      date: d,
      numero: estDate(v.debut) ? ecart(v.debut, d) + 1 : null,
      etapes: etapesDuJour(etat, d),
      nuit: { etape: etapeDeLaNuit(etat, d), hebergements: etat.nuits.filter((h) => couvre(h, d)), dernier: d === v.fin },
      arrivees: etat.nuits.filter((h) => h.arrivee === d),
      departs: etat.nuits.filter((h) => h.depart === d),
      transports: etat.transports.filter((t) => t.date === d).sort(parHeure),
      activites: etat.activites.filter((a) => a.date === d).sort(parHeure),
    };
  }
  function programme(etat) {
    return dates(etat.voyage.debut, etat.voyage.fin).map((d) => programmeJour(etat, d));
  }
  // Éléments datés hors du voyage, ou sans date : montrés à part pour ne rien perdre.
  function horsProgramme(etat) {
    const { debut, fin } = etat.voyage;
    const dehors = (d) => !d || !estDate(debut) || d < debut || d > fin;
    return { transports: etat.transports.filter((t) => dehors(t.date)), activites: etat.activites.filter((a) => dehors(a.date)) };
  }

  // ---------- Itinéraire en texte ----------
  const libMode = (modes, id) => (modes.find(([k]) => k === id) || [id, id])[1];
  function itineraire(etat, modes = []) {
    const etapes = trierEtapes(etat.etapes).filter((e) => e.arrivee);
    const transports = [...etat.transports].filter((t) => t.date).sort((a, b) => a.date.localeCompare(b.date) || parHeure(a, b));
    const elements = [
      ...etapes.map((e) => ({ type: 'etape', date: e.arrivee, ordre: 1, e })),
      ...transports.map((t) => ({ type: 'transport', date: t.date, ordre: 0, t })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || (a.t && b.t ? parHeure(a.t, b.t) : 0));
    return elements.map((x) => (x.type === 'etape'
      ? { type: 'etape', id: x.e.id, date: x.e.arrivee, lieu: x.e.lieu, nuits: nuitsEtape(x.e), depart: x.e.depart, hebergements: etat.nuits.filter((h) => h.arrivee && h.arrivee < x.e.depart && x.e.arrivee < h.depart) }
      : { type: 'transport', id: x.t.id, date: x.t.date, mode: libMode(modes, x.t.mode), de: x.t.de, vers: x.t.vers, heure: x.t.heure, statut: x.t.statut }));
  }
  // Une ligne : « Lyon → (Train) → Turin · 2 nuits → (Voiture) → Côme · 3 nuits »
  function cheminTexte(etat, modes = []) {
    const morceaux = [];
    const it = itineraire(etat, modes);
    it.forEach((x, i) => {
      if (x.type === 'transport') {
        if (!morceaux.length && x.de) morceaux.push(x.de);
        morceaux.push(`(${x.mode})`);
        if (i === it.length - 1 && x.vers) morceaux.push(x.vers); // trajet du retour
      } else morceaux.push(`${x.lieu}${x.nuits ? ` · ${x.nuits} nuit${x.nuits > 1 ? 's' : ''}` : ''}`);
    });
    return morceaux.join(' → ');
  }
  // Itinéraire complet à copier ou imprimer (texte brut, aucun lien).
  function itineraireTexte(etat, modes = [], fmt = (d) => d) {
    const v = etat.voyage;
    const lignes = [`${v.nom || 'Voyage'}${v.destination ? ` · ${v.destination}` : ''}`];
    if (v.debut) lignes.push(`Du ${fmt(v.debut)} au ${fmt(v.fin)} · ${nbJours(v)} jours, ${nbNuits(v)} nuits`);
    lignes.push('', cheminTexte(etat, modes), '');
    for (const j of programme(etat)) {
      lignes.push(`Jour ${j.numero} · ${fmt(j.date)}${j.etapes.length ? ` · ${j.etapes.map((e) => e.lieu).join(' → ')}` : ''}`);
      for (const t of j.transports) lignes.push(`  ${t.heure || '--:--'} ${libMode(modes, t.mode)} ${t.de || ''} → ${t.vers || ''}${t.ref ? ` (réf. ${t.ref})` : ''} · ${LIB_STATUT[t.statut]}`);
      for (const a of j.activites) lignes.push(`  ${a.heure || '--:--'} ${a.titre}${a.lieu ? `, ${a.lieu}` : ''}${a.statut !== 'libre' ? ` · ${LIB_STATUT[a.statut]}` : ''}`);
      const h = j.nuit.hebergements;
      if (!j.nuit.dernier) lignes.push(`  Nuit : ${h.length ? h.map((x) => `${x.nom}${x.adresse ? `, ${x.adresse}` : ''} (${LIB_STATUT[x.statut].toLowerCase()})`).join(' + ') : 'hébergement à trouver'}`);
    }
    return lignes.join('\n');
  }

  // ---------- À réserver, à payer ----------
  function aReserver(etat, auj) {
    const l = [
      ...etat.nuits.filter((h) => h.statut === 'aReserver').map((h) => ({ type: 'nuit', id: h.id, date: h.arrivee, titre: h.nom, montant: h.montant })),
      ...etat.transports.filter((t) => t.statut === 'aReserver').map((t) => ({ type: 'transport', id: t.id, date: t.date, titre: `${t.de || '?'} → ${t.vers || '?'}`, montant: t.prix })),
      ...etat.activites.filter((a) => a.statut === 'aReserver').map((a) => ({ type: 'activite', id: a.id, date: a.date, titre: a.titre, montant: a.prix })),
    ];
    return l.map((x) => ({ ...x, joursAvant: x.date ? ecart(auj, x.date) : null, urgent: !!x.date && ecart(auj, x.date) <= URGENT_JOURS }))
      .sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  }
  const aPayer = (etat) => etat.nuits.filter((h) => resteAPayer(h) > 0).map((h) => ({ id: h.id, nom: h.nom, date: h.arrivee, reste: resteAPayer(h) })).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));

  // ---------- Budget prévu et réel ----------
  // Prévu par poste : somme du plan (hébergements, transports, activités) + montant prévu saisi à la main.
  // Réel par poste : dépenses saisies. Engagé : ce qui est déjà réservé dans le plan.
  function budget(etat, postes) {
    const plan = {
      nuits: etat.nuits.reduce((s, h) => s + h.montant, 0),
      transports: etat.transports.reduce((s, t) => s + t.prix, 0),
      activites: etat.activites.reduce((s, a) => s + a.prix, 0),
    };
    const engage = etat.nuits.filter((h) => h.statut === 'reserve').reduce((s, h) => s + h.montant, 0)
      + etat.transports.filter((t) => t.statut === 'reserve').reduce((s, t) => s + t.prix, 0)
      + etat.activites.filter((a) => a.statut === 'reserve').reduce((s, a) => s + a.prix, 0);
    const lignes = postes.map((p) => {
      const duPlan = p.auto ? plan[p.auto] : 0;
      const saisi = etat.budget.prevus[p.id] || 0;
      const reel = etat.depenses.filter((d) => d.poste === p.id).reduce((s, d) => s + d.montant, 0);
      const prevu = duPlan + saisi;
      return { id: p.id, nom: p.nom, couleur: p.couleur, duPlan, saisi, prevu, reel, ecart: reel - prevu, depasse: reel > prevu && prevu > 0, sansPrevu: reel > 0 && prevu === 0 };
    });
    const prevu = lignes.reduce((s, l) => s + l.prevu, 0), reel = lignes.reduce((s, l) => s + l.reel, 0);
    const n = etat.voyageurs.length || 1;
    return { lignes, prevu, reel, ecart: reel - prevu, engage, parPersonnePrevu: Math.round(prevu / n), parPersonneReel: Math.round(reel / n), voyageurs: etat.voyageurs.length };
  }

  // ---------- Dépenses partagées (moteur commun BCM) ----------
  const membres = (etat) => etat.voyageurs.map((v) => ({ id: v.id, revenu: null }));
  const quotesDepense = (d, voyageurs) => BCM.quotesDepense(d, voyageurs.map((v) => ({ id: v.id, revenu: null })));
  const repartir = (montantC, voyageurs, mode, options) => BCM.repartir(montantC, voyageurs.map((v) => ({ id: v.id, revenu: null })), mode, options);
  const soldes = (etat) => BCM.soldes(membres(etat), etat.depenses, etat.virements);
  // Qui doit quoi : remboursements à faire, en nombre minimal.
  const quiDoitQuoi = (etat) => BCM.equilibrer(soldes(etat));
  // Par voyageur : ce qu'il a payé, sa part des dépenses, son solde.
  function parVoyageur(etat) {
    const s = soldes(etat);
    return etat.voyageurs.map((v) => {
      let paye = 0, part = 0;
      for (const d of etat.depenses) {
        if (d.payeur === v.id) paye += d.montant;
        part += quotesDepense(d, etat.voyageurs)[v.id] || 0;
      }
      return { id: v.id, nom: v.nom, paye, part, solde: s[v.id] || 0 };
    });
  }
  // Dépense créée depuis un élément du plan (hébergement, transport, activité).
  function depenseDepuis(type, el, payeur, voyageurs) {
    const poste = { nuit: 'hebergement', transport: 'transport', activite: 'activites' }[type];
    const dateD = type === 'nuit' ? el.arrivee : el.date;
    const libelle = type === 'nuit' ? el.nom : type === 'transport' ? `${el.de || ''} → ${el.vers || ''}`.trim() : el.titre;
    const m = type === 'nuit' ? el.montant : el.prix;
    return { date: dateD, libelle, montant: m, poste, payeur, lien: el.id, repartition: { mode: 'egale', participants: voyageurs.map((v) => v.id) } };
  }
  const depenseLiee = (etat, id) => etat.depenses.find((d) => d.lien === id) || null;
  // Un voyageur ne peut être retiré que s'il n'apparaît dans aucune dépense ni aucun remboursement.
  const voyageurUtilise = (etat, id) => etat.depenses.some((d) => d.payeur === id || (d.quotes?.[id] || 0) > 0) || etat.virements.some((v) => v.de === id || v.a === id);

  // ---------- Bagages et documents ----------
  const sansAccent = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // Ajoute les éléments des listes choisies, sans doublon (même texte, sans accents ni casse).
  function genererBagages(listes, existants, choix) {
    const deja = new Set(existants.map((b) => sansAccent(b.texte)));
    const res = [];
    for (const l of listes) {
      if (!choix.includes(l.id)) continue;
      for (const t of l.items) {
        if (deja.has(sansAccent(t))) continue;
        deja.add(sansAccent(t));
        res.push(normaliserCase({ texte: t, liste: l.id }));
      }
    }
    return res;
  }
  const genererDocuments = (base) => base.map(([t, detail]) => normaliserCase({ texte: t, detail }));
  const progression = (l) => ({ fait: l.filter((x) => x.fait).length, total: l.length, pct: l.length ? Math.round((l.filter((x) => x.fait).length / l.length) * 100) : 0 });

  // ---------- Archivage : on garde un résumé, on repart d'un voyage vide ----------
  function archiver(etat, postes, horodatage = '') {
    const b = budget(etat, postes);
    const e = etatVide();
    e.voyageurs = etat.voyageurs.map((v) => ({ ...v }));
    e.archives = [...etat.archives, { id: nouvelId(), nom: etat.voyage.nom || etat.voyage.destination || 'Voyage', debut: etat.voyage.debut, fin: etat.voyage.fin, voyageurs: etat.voyageurs.length, prevu: b.prevu, reel: b.reel, modifLe: horodatage }];
    // Les listes restent (cases décochées) : elles resservent au prochain voyage.
    e.bagages = etat.bagages.map((x) => ({ ...x, fait: false, modifLe: horodatage }));
    e.documents = etat.documents.map((x) => ({ ...x, fait: false, modifLe: horodatage }));
    return e;
  }

  // ---------- Fusion (conflit entre deux appareils) ----------
  // Même règle que le budget commun : union des deux versions, la modification la plus récente l'emporte,
  // une suppression ne l'emporte que si elle est postérieure à la dernière modification.
  const COLLECTIONS = ['voyageurs', 'etapes', 'nuits', 'transports', 'activites', 'depenses', 'virements', 'bagages', 'documents', 'archives'];
  const OBJETS = ['voyage', 'budget'];
  function fusionner(local, serveur) {
    if (!serveur) return { etat: local, conflits: 0 };
    if (!local) return { etat: serveur, conflits: 0 };
    const supprimes = { ...(serveur.supprimes || {}) };
    for (const [id, t] of Object.entries(local.supprimes || {})) if (!supprimes[id] || t > supprimes[id]) supprimes[id] = t;
    const etat = { ...serveur, ...local, supprimes };
    let conflits = 0;
    for (const cle of COLLECTIONS) {
      const a = Array.isArray(local[cle]) ? local[cle] : [], b = Array.isArray(serveur[cle]) ? serveur[cle] : [];
      const parId = new Map(), ordre = [];
      for (const x of b) { parId.set(x.id, x); ordre.push(x.id); }
      for (const x of a) {
        const y = parId.get(x.id);
        if (!y) { parId.set(x.id, x); ordre.push(x.id); continue; }
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
        conflits++;
        if ((x.modifLe || '') >= (y.modifLe || '')) parId.set(x.id, x);
      }
      etat[cle] = ordre.map((id) => parId.get(id)).filter((x) => { const t = supprimes[x.id]; return !t || t < (x.modifLe || ''); });
    }
    for (const cle of OBJETS) {
      const x = local[cle], y = serveur[cle];
      etat[cle] = x && y ? ((x.modifLe || '') >= (y.modifLe || '') ? x : y) : (x || y);
    }
    delete etat.majLe;
    return { etat, conflits };
  }

  // ---------- Export CSV des dépenses ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c / 100).toFixed(2).replace('.', ',');
  function versCsv(etat, postes) {
    const nom = (id) => etat.voyageurs.find((v) => v.id === id)?.nom || '';
    const tete = ['Date', 'Libellé', 'Poste', 'Montant', 'Payé par', ...etat.voyageurs.map((v) => `Part ${v.nom}`), 'Note'];
    const lignes = [...etat.depenses].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((d) => {
      const q = quotesDepense(d, etat.voyageurs);
      return [d.date, d.libelle, postes.find((p) => p.id === d.poste)?.nom || d.poste, nombreCsv(d.montant), nom(d.payeur), ...etat.voyageurs.map((v) => nombreCsv(q[v.id] || 0)), d.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.VYG = {
    STATUTS, LIB_STATUT, STATUTS_ACTIVITE, MAX_VOYAGEURS, URGENT_JOURS, COLLECTIONS,
    iso, versDate, ajout, ecart, estDate, estHeure, dates, maxDate, minDate,
    lireMontant, saisieMontant, euros, versCentimes, nouvelId, sansAccent,
    normaliserVoyageur, normaliserEtape, normaliserNuit, normaliserTransport, normaliserActivite, normaliserDepense, normaliserVirement, normaliserCase,
    etatVide, normaliser, nbJours, nbNuits, phase,
    nuitsHebergement, couvre, resteAPayer, couverture, horsVoyage, resumeNuits,
    trierEtapes, nuitsEtape, etapeDeLaNuit, etapesDuJour, etapesChevauchantes,
    programmeJour, programme, horsProgramme, libMode, itineraire, cheminTexte, itineraireTexte,
    aReserver, aPayer, budget, quotesDepense, repartir, soldes, quiDoitQuoi, parVoyageur, depenseDepuis, depenseLiee, voyageurUtilise,
    genererBagages, genererDocuments, progression, archiver, fusionner, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
