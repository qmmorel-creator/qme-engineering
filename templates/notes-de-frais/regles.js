// Notes de frais QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.NDF) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers),
// distances en kilomètres (une décimale au plus).
(function (racine) {
  'use strict';

  const STATUTS = ['brouillon', 'soumis', 'rembourse'];
  const TYPES_VEHICULE = ['voiture', 'moto', 'cyclo'];
  const LIB_STATUT = { brouillon: 'Brouillon', soumis: 'Soumis', rembourse: 'Remboursé' };
  const LIB_TYPE = { voiture: 'Voiture', moto: 'Moto ou scooter', cyclo: 'Cyclomoteur' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const moisDe = (s) => s.slice(0, 7);
  const anneeDe = (s) => Number(s.slice(0, 4));
  function ajoutMoisCle(cle, n) {
    const [a, m] = cle.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12);
    return `${an}-${deux(total - an * 12 + 1)}`;
  }
  const joursDansAnnee = (a) => ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 366 : 365);

  // ---------- Montants et distances ----------
  // « 12,99 », « 12.99 € », « 1 234,5 », « 9 » → centimes ; null si vide ou illisible.
  // Les montants négatifs ne sont acceptés que sur demande (régularisation kilométrique).
  function lireMontant(saisie, { negatif = false } = {}) {
    let s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.').replace('−', '-');
    let signe = 1;
    if (s.startsWith('-')) { if (!negatif) return null; signe = -1; s = s.slice(1); }
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return signe * Math.round(Number(s) * 100);
  }
  // 1299 → « 12,99 € » ; 120000 → « 1 200,00 € » (espace fine insécable).
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const ent = Math.floor(n / 100), dec = n % 100;
    const arrondi = centimes ? ent : Math.round(n / 100);
    const milliers = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const texte = centimes ? `${milliers},${deux(dec)}` : milliers;
    return `${neg ? '−' : signe && n ? '+' : ''}${texte} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)},${deux(Math.abs(c) % 100)}`);

  // « 42 », « 42,5 », « 1 250 km » → kilomètres (une décimale) ; null si vide, illisible, nul ou excessif.
  function lireKm(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(/km$/i, '').replace(',', '.');
    if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
    const n = Math.round(Number(s) * 10) / 10;
    return n > 0 && n <= 5000 ? n : null;
  }
  const arrondiKm = (n) => Math.round(n * 10) / 10;
  // 1234.5 → « 1 234,5 km » ; 12 → « 12 km ».
  function km(n) {
    const v = arrondiKm(n || 0);
    const [e, d] = String(v).split('.');
    return `${e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${d ? `,${d}` : ''} km`;
  }
  // Distance d'un trajet : aller simple, ou aller-retour (double).
  const kmTrajet = (t) => arrondiKm((Number(t.km) || 0) * (t.allerRetour ? 2 : 1));

  // ---------- Frais ----------
  // Montant hors taxe déduit de la TVA SAISIE (jamais calculée par l'application) ; null sans TVA saisie.
  const horsTaxe = (f) => (f.tva === null || f.tva === undefined ? null : f.montant - f.tva);

  // ---------- Barème kilométrique ----------
  // Barème des trajets d'une année : celui de l'année, sinon le plus récent des années précédentes
  // (provisoire : le barème de l'année n'est publié qu'au printemps suivant), sinon le plus ancien.
  function baremePour(baremes, annee) {
    const liste = (baremes || []).filter((b) => b && Number.isFinite(b.annee)).sort((x, y) => x.annee - y.annee);
    if (!liste.length) return { bareme: null, exact: false };
    const exact = liste.find((b) => b.annee === annee);
    if (exact) return { bareme: exact, exact: true };
    const avant = liste.filter((b) => b.annee < annee).pop();
    return { bareme: avant || liste[0], exact: false };
  }

  // Ligne du barème d'un véhicule : première ligne dont le plafond de puissance couvre la sienne, sinon la dernière.
  function ligneBareme(bareme, v) {
    const type = TYPES_VEHICULE.includes(v.type) ? v.type : 'voiture';
    const lignes = bareme?.[type] || [];
    if (!lignes.length) return null;
    if (type === 'cyclo') return { index: 0, ...lignes[0] };
    const cv = Math.max(1, Number(v.cv) || 1);
    const i = lignes.findIndex((l) => cv <= l.cv);
    const index = i === -1 ? lignes.length - 1 : i;
    return { index, ...lignes[index] };
  }

  // Tranche de la distance annuelle d : 0 (jusqu'au premier seuil inclus), 1, ou 2 (au-delà du second).
  function tranche(bareme, type, d) {
    const [s1, s2] = bareme?.seuils?.[type] || [Infinity, Infinity];
    return d <= s1 ? 0 : d <= s2 ? 1 : 2;
  }

  // Indemnité annuelle d'un véhicule pour une distance annuelle totale d (en km) :
  // d × a + b de la tranche où tombe d (la formule s'applique à toute la distance, pas par morceaux),
  // majorée du pourcentage prévu pour les véhicules électriques si le barème en prévoit un.
  function indemnite(bareme, v, d) {
    const l = ligneBareme(bareme, v);
    if (!l || !(d > 0)) return { montant: 0, tranche: 0, a: l ? l.tranches[0][0] : 0, b: 0, majoration: 0 };
    const t = tranche(bareme, v.type, d);
    const [a, b] = l.tranches[t];
    const majoration = v.electrique ? Math.max(0, Number(bareme.majorationElectrique) || 0) : 0;
    const montant = Math.round((d * a + b) * 100 * (1 + majoration / 100));
    return { montant, tranche: t, a, b, majoration };
  }

  // Taux provisoire (centimes par km) pour valoriser chaque trajet au fil de l'eau :
  // taux moyen du barème à la distance annuelle estimée du véhicule, sinon taux de la première tranche.
  function tauxProvisoire(bareme, v) {
    const est = Number(v.kmEstimes) || 0;
    if (est > 0) return indemnite(bareme, v, est).montant / est;
    const l = ligneBareme(bareme, v);
    if (!l) return 0;
    const majoration = v.electrique ? Math.max(0, Number(bareme.majorationElectrique) || 0) : 0;
    return l.tranches[0][0] * 100 * (1 + majoration / 100);
  }

  const trajetsDe = (trajets, idVehicule, annee) => (trajets || []).filter((t) => t.vehicule === idVehicule && anneeDe(t.date) === annee).sort((x, y) => x.date.localeCompare(y.date));

  // Montant provisoire de chaque trajet (Map id → centimes), avec le taux de son véhicule et de son année.
  function valeursTrajets(E) {
    const res = new Map();
    const taux = new Map();
    for (const t of E.trajets || []) {
      const v = (E.vehicules || []).find((x) => x.id === t.vehicule);
      if (!v) { res.set(t.id, 0); continue; }
      const cle = `${v.id}:${anneeDe(t.date)}`;
      if (!taux.has(cle)) { const { bareme } = baremePour(E.baremes, anneeDe(t.date)); taux.set(cle, bareme ? tauxProvisoire(bareme, v) : 0); }
      res.set(t.id, Math.round(kmTrajet(t) * taux.get(cle)));
    }
    return res;
  }

  // Bilan annuel d'un véhicule : distance cumulée, indemnité exacte du barème, montant déjà valorisé
  // au fil de l'eau (trajets × taux provisoire), régularisation à prévoir, et projection de l'année en cours.
  function bilanVehicule(E, v, annee, auj) {
    const { bareme, exact } = baremePour(E.baremes, annee);
    const liste = trajetsDe(E.trajets, v.id, annee);
    const valeurs = valeursTrajets({ ...E, vehicules: [v], trajets: liste });
    const distance = arrondiKm(liste.reduce((s, t) => s + kmTrajet(t), 0));
    const exacte = bareme ? indemnite(bareme, v, distance) : { montant: 0, tranche: 0, a: 0, b: 0, majoration: 0 };
    const provisoire = liste.reduce((s, t) => s + (valeurs.get(t.id) || 0), 0);
    const regul = (E.frais || []).filter((f) => f.cat === 'regularisation' && f.vehicule === v.id && f.annee === annee);
    const dejaRegularise = regul.reduce((s, f) => s + f.montant, 0);
    const taux = bareme ? tauxProvisoire(bareme, v) : 0;
    const seuils = bareme?.seuils?.[v.type] || [];
    const prochainSeuil = seuils.find((s) => distance <= s);
    let projection = null;
    if (auj && anneeDe(auj) === annee && distance > 0) {
      const ecoules = ecart(`${annee}-01-01`, auj) + 1;
      const total = joursDansAnnee(annee);
      if (ecoules < total) {
        const d = arrondiKm((distance * total) / ecoules);
        projection = { distance: d, montant: bareme ? indemnite(bareme, v, d).montant : 0, tranche: bareme ? tranche(bareme, v.type, d) : 0 };
      }
    }
    return {
      vehicule: v.id, annee, bareme, baremeExact: exact, trajets: liste.length, distance,
      exacte: exacte.montant, tranche: exacte.tranche, a: exacte.a, b: exacte.b, majoration: exacte.majoration,
      taux, provisoire, dejaRegularise, regularisation: exacte.montant - provisoire - dejaRegularise,
      avantSeuil: prochainSeuil === undefined ? null : arrondiKm(prochainSeuil - distance), projection,
    };
  }

  // ---------- Notes mensuelles ----------
  // Statut d'un ensemble d'éléments : vide, brouillon, partiel (brouillons et soumis mêlés), soumis, rembourse.
  function statutEnsemble(elements) {
    if (!elements.length) return 'vide';
    const n = (s) => elements.filter((e) => e.statut === s).length;
    if (n('brouillon') === elements.length) return 'brouillon';
    if (n('brouillon')) return 'partiel';
    if (n('rembourse') === elements.length) return 'rembourse';
    return 'soumis';
  }

  // Note d'un mois (« AAAA-MM ») : frais et trajets du mois, totaux TTC, TVA saisie, indemnités, statut.
  function noteMois(E, cle) {
    const valeurs = valeursTrajets(E);
    const frais = (E.frais || []).filter((f) => moisDe(f.date) === cle).sort((x, y) => x.date.localeCompare(y.date) || x.cat.localeCompare(y.cat));
    const trajets = (E.trajets || []).filter((t) => moisDe(t.date) === cle).sort((x, y) => x.date.localeCompare(y.date)).map((t) => ({ ...t, distance: kmTrajet(t), montant: valeurs.get(t.id) || 0 }));
    const elements = [...frais, ...trajets];
    const somme = (l, f = () => true) => l.filter(f).reduce((s, x) => s + x.montant, 0);
    const ttc = somme(frais);
    const tva = frais.reduce((s, f) => s + (f.tva || 0), 0);
    const ik = somme(trajets);
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, somme(elements, (e) => e.statut === s)]));
    const parCat = new Map();
    for (const f of frais) parCat.set(f.cat, (parCat.get(f.cat) || 0) + f.montant);
    return {
      mois: cle, frais, trajets, ttc, tva, ik, total: ttc + ik, distance: arrondiKm(trajets.reduce((s, t) => s + t.distance, 0)),
      sansTva: frais.filter((f) => f.tva === null && f.cat !== 'regularisation').length,
      justificatifsManquants: frais.filter((f) => f.justificatif !== 'oui' && f.cat !== 'regularisation').length,
      parStatut, parCat: [...parCat.entries()].map(([cat, montant]) => ({ cat, montant })).sort((x, y) => y.montant - x.montant),
      statut: statutEnsemble(elements),
      soumisLe: elements.map((e) => e.soumisLe).filter(Boolean).sort().pop() || null,
      rembourseLe: elements.map((e) => e.rembourseLe).filter(Boolean).sort().pop() || null,
    };
  }

  // Mois qui ont au moins un frais ou un trajet, du plus récent au plus ancien.
  function moisAvecDonnees(E) {
    const s = new Set([...(E.frais || []), ...(E.trajets || [])].map((x) => moisDe(x.date)));
    return [...s].sort().reverse();
  }

  // Passe tous les éléments d'un mois d'un statut à l'autre (brouillon → soumis, soumis → rembourse),
  // en datant le changement. Modifie E ; renvoie le nombre d'éléments changés.
  function changerStatutMois(E, cle, de, vers, date) {
    let n = 0;
    for (const x of [...(E.frais || []), ...(E.trajets || [])]) {
      if (moisDe(x.date) !== cle || x.statut !== de) continue;
      appliquerStatut(x, vers, date);
      n++;
    }
    return n;
  }
  // Statut d'un élément avec ses dates : soumis garde sa date de soumission, remboursé ses deux dates.
  function appliquerStatut(x, statut, date) {
    x.statut = statut;
    if (statut === 'brouillon') { x.soumisLe = null; x.rembourseLe = null; }
    if (statut === 'soumis') { x.soumisLe = x.soumisLe || date; x.rembourseLe = null; }
    if (statut === 'rembourse') { x.soumisLe = x.soumisLe || date; x.rembourseLe = x.rembourseLe || date; }
    return x;
  }

  // ---------- Alertes ----------
  // À faire : mois passés avec des brouillons, justificatifs manquants, remboursements en retard
  // (soumis depuis plus de « delai » jours), barème provisoire pour l'année en cours.
  function alertes(E, auj, delai = 30) {
    const l = [];
    const moisCourant = moisDe(auj);
    for (const cle of moisAvecDonnees(E)) {
      if (cle >= moisCourant) continue;
      const n = noteMois(E, cle);
      const nb = [...n.frais, ...n.trajets].filter((x) => x.statut === 'brouillon');
      if (nb.length) l.push({ type: 'a-soumettre', mois: cle, nb: nb.length, montant: nb.reduce((s, x) => s + x.montant, 0) });
    }
    const manquants = (E.frais || []).filter((f) => f.justificatif !== 'oui' && f.cat !== 'regularisation' && f.statut !== 'rembourse');
    if (manquants.length) l.push({ type: 'justificatif', nb: manquants.length, ids: manquants.map((f) => f.id), montant: manquants.reduce((s, f) => s + f.montant, 0) });
    const valeurs = valeursTrajets(E);
    const retards = [...(E.frais || []).map((f) => ({ ...f, montant: f.montant })), ...(E.trajets || []).map((t) => ({ ...t, montant: valeurs.get(t.id) || 0 }))]
      .filter((x) => x.statut === 'soumis' && x.soumisLe && ecart(x.soumisLe, auj) > delai);
    if (retards.length) {
      const parMois = new Map();
      for (const x of retards) { const c = moisDe(x.date); const m = parMois.get(c) || { mois: c, nb: 0, montant: 0, soumisLe: x.soumisLe }; m.nb++; m.montant += x.montant; if (x.soumisLe < m.soumisLe) m.soumisLe = x.soumisLe; parMois.set(c, m); }
      for (const m of [...parMois.values()].sort((x, y) => x.mois.localeCompare(y.mois))) l.push({ type: 'retard', ...m, jours: ecart(m.soumisLe, auj) });
    }
    const annee = anneeDe(auj);
    if ((E.trajets || []).some((t) => anneeDe(t.date) === annee) && !baremePour(E.baremes, annee).exact) l.push({ type: 'bareme', annee, utilise: baremePour(E.baremes, annee).bareme?.annee ?? null });
    return l;
  }

  // ---------- Totaux d'une année ----------
  function totauxAnnee(E, annee) {
    const mois = Array.from({ length: 12 }, (_, i) => noteMois(E, `${annee}-${deux(i + 1)}`));
    const parCat = new Map();
    for (const n of mois) for (const c of n.parCat) parCat.set(c.cat, (parCat.get(c.cat) || 0) + c.montant);
    const somme = (k) => mois.reduce((s, n) => s + n[k], 0);
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, mois.reduce((t, n) => t + n.parStatut[s], 0)]));
    return {
      annee, mois: mois.map((n) => ({ mois: n.mois, frais: n.ttc, ik: n.ik, total: n.total, statut: n.statut })),
      ttc: somme('ttc'), tva: somme('tva'), ik: somme('ik'), total: somme('total'), distance: arrondiKm(somme('distance')), parStatut,
      parCat: [...parCat.entries()].map(([cat, montant]) => ({ cat, montant })).filter((c) => c.montant > 0).sort((x, y) => y.montant - x.montant || x.cat.localeCompare(y.cat)),
    };
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const centimesOuNull = (v, negatif = false) => { if (v === null || v === undefined || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && (negatif || n >= 0) ? n : null; };
  const statutValide = (x) => {
    const statut = STATUTS.includes(x.statut) ? x.statut : 'brouillon';
    return { statut, soumisLe: statut === 'brouillon' ? null : dateOuNull(x.soumisLe), rembourseLe: statut === 'rembourse' ? dateOuNull(x.rembourseLe) : null };
  };

  function normaliserFrais(x, auj) {
    const f = x && typeof x === 'object' ? x : {};
    const cat = String(f.cat || 'autres');
    const regul = cat === 'regularisation';
    const montant = centimesOuNull(f.montant, regul) ?? 0;
    const tva = regul ? null : centimesOuNull(f.tva);
    return {
      id: String(f.id || nouvelId()), date: dateOuNull(f.date) || auj, cat,
      montant, tva: tva === null ? null : Math.min(tva, montant),
      description: texte(f.description, 120), mission: texte(f.mission, 80),
      justificatif: f.justificatif === 'oui' ? 'oui' : 'non', reference: texte(f.reference, 120),
      ...statutValide(f),
      ...(regul ? { vehicule: String(f.vehicule || ''), annee: entier(f.annee, 2000, 2100, anneeDe(auj)) } : {}),
    };
  }

  function normaliserTrajet(x, auj) {
    const t = x && typeof x === 'object' ? x : {};
    return {
      id: String(t.id || nouvelId()), date: dateOuNull(t.date) || auj, vehicule: String(t.vehicule || ''),
      depart: texte(t.depart, 80), arrivee: texte(t.arrivee, 80), km: lireKm(t.km) ?? 1, allerRetour: !!t.allerRetour,
      motif: texte(t.motif, 120), mission: texte(t.mission, 80), ...statutValide(t),
    };
  }

  function normaliserVehicule(x) {
    const v = x && typeof x === 'object' ? x : {};
    const type = TYPES_VEHICULE.includes(v.type) ? v.type : 'voiture';
    return {
      id: String(v.id || nouvelId()), nom: texte(v.nom || LIB_TYPE[type], 60), type,
      cv: type === 'cyclo' ? 1 : entier(v.cv, 1, 50, 5), electrique: !!v.electrique,
      kmEstimes: entier(v.kmEstimes, 0, 200000, 0), archive: !!v.archive,
    };
  }

  const nombre = (v, d = 0) => { if (v === null || v === undefined || v === '') return d; const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : d; };
  function normaliserBareme(x, modele) {
    const b = x && typeof x === 'object' ? x : {};
    const m = modele || {};
    const lignes = (type) => (m[type] || []).map((ml, i) => {
      const l = (b[type] || [])[i] || ml;
      return { cv: ml.cv, tranches: [0, 1, 2].map((k) => [nombre(l.tranches?.[k]?.[0], ml.tranches[k][0]), nombre(l.tranches?.[k]?.[1], ml.tranches[k][1])]) };
    });
    const seuils = (type) => { const s = b.seuils?.[type] || m.seuils?.[type] || [0, 0]; return [entier(s[0], 1, 1e6, m.seuils[type][0]), entier(s[1], 1, 1e6, m.seuils[type][1])]; };
    return {
      id: String(b.id || nouvelId()), annee: entier(b.annee, 2000, 2100, m.annee || 2025),
      libelle: texte(b.libelle || `Barème des trajets ${b.annee || ''}`.trim(), 120), source: texte(b.source, 600), adresse: texte(b.adresse, 200),
      publieLe: dateOuNull(b.publieLe), releveLe: dateOuNull(b.releveLe), verifie: !!b.verifie,
      majorationElectrique: Math.min(100, nombre(b.majorationElectrique, 0)),
      seuils: { voiture: seuils('voiture'), moto: seuils('moto'), cyclo: seuils('cyclo') },
      voiture: lignes('voiture'), moto: lignes('moto'), cyclo: lignes('cyclo'),
    };
  }

  const etatVide = (base) => ({
    version: 1, prenom: '', nom: '', structure: '', profil: 'salarie',
    reglages: { delaiRemboursement: 30 },
    frais: [], trajets: [], vehicules: [],
    baremes: (base?.baremes || []).map((b) => normaliserBareme(b, b)),
  });

  function normaliser(d, auj, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const modele = base?.baremes?.[0];
    const baremes = (Array.isArray(d.baremes) && d.baremes.length ? d.baremes : v.baremes).map((b) => normaliserBareme(b, modele || b));
    return {
      ...v, ...d,
      prenom: texte(d.prenom, 40), nom: texte(d.nom, 80), structure: texte(d.structure, 80),
      profil: d.profil === 'independant' ? 'independant' : 'salarie',
      reglages: { ...v.reglages, ...(d.reglages || {}), delaiRemboursement: entier(d.reglages?.delaiRemboursement, 1, 180, 30) },
      frais: (Array.isArray(d.frais) ? d.frais : []).map((f) => normaliserFrais(f, auj)),
      trajets: (Array.isArray(d.trajets) ? d.trajets : []).map((t) => normaliserTrajet(t, auj)),
      vehicules: (Array.isArray(d.vehicules) ? d.vehicules : []).map(normaliserVehicule),
      baremes,
    };
  }

  // ---------- Exports ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const kmCsv = (n) => String(arrondiKm(n)).replace('.', ',');
  // Une ligne par frais et par trajet (filtrés par « garder »), séparateur point-virgule, BOM UTF-8.
  function versCsv(E, nomCat, garder = () => true) {
    const valeurs = valeursTrajets(E);
    const vehicule = (id) => (E.vehicules || []).find((v) => v.id === id);
    const tete = ['Type', 'Date', 'Catégorie', 'Description', 'Mission ou client', 'Montant TTC', 'TVA saisie', 'Montant HT', 'Kilomètres', 'Véhicule', 'Justificatif fourni', 'Référence du justificatif', 'Statut', 'Soumis le', 'Remboursé le'];
    const lignes = [
      ...(E.frais || []).filter(garder).map((f) => ({ date: f.date, l: ['Frais', f.date, nomCat(f.cat), f.description, f.mission, nombreCsv(f.montant), nombreCsv(f.tva), nombreCsv(horsTaxe(f)), '', f.vehicule ? vehicule(f.vehicule)?.nom || '' : '', f.cat === 'regularisation' ? '' : (f.justificatif === 'oui' ? 'Oui' : 'Non'), f.reference, LIB_STATUT[f.statut], f.soumisLe || '', f.rembourseLe || ''] })),
      ...(E.trajets || []).filter(garder).map((t) => ({ date: t.date, l: ['Indemnité kilométrique', t.date, 'Trajet', `${t.depart} → ${t.arrivee}${t.allerRetour ? ' (aller-retour)' : ''}${t.motif ? ` · ${t.motif}` : ''}`, t.mission, nombreCsv(valeurs.get(t.id) || 0), '', '', kmCsv(kmTrajet(t)), vehicule(t.vehicule)?.nom || '', '', '', LIB_STATUT[t.statut], t.soumisLe || '', t.rembourseLe || ''] })),
    ].sort((x, y) => x.date.localeCompare(y.date)).map((x) => x.l);
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.NDF = {
    STATUTS, TYPES_VEHICULE, LIB_STATUT, LIB_TYPE,
    iso, versDate, ajout, ecart, estDate, moisDe, anneeDe, ajoutMoisCle, joursDansAnnee,
    lireMontant, euros, saisieMontant, lireKm, arrondiKm, km, kmTrajet, horsTaxe,
    baremePour, ligneBareme, tranche, indemnite, tauxProvisoire, trajetsDe, valeursTrajets, bilanVehicule,
    statutEnsemble, noteMois, moisAvecDonnees, changerStatutMois, appliquerStatut, alertes, totauxAnnee,
    nouvelId, normaliserFrais, normaliserTrajet, normaliserVehicule, normaliserBareme, etatVide, normaliser, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
