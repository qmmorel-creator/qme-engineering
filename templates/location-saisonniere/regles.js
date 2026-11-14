// Location saisonnière QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.SJR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers),
// commissions en pour cent (15.5 = 15,5 %). Une réservation occupe les nuits de son arrivée (incluse) à
// son départ (exclu) : un départ et une arrivée le même jour ne se chevauchent pas.
(function (racine) {
  'use strict';

  const STATUTS = ['confirmee', 'option', 'annulee'];
  const LIB_STATUT = { confirmee: 'Confirmée', option: 'Option', annulee: 'Annulée' };
  const LIB_SEJOUR = { aVenir: 'À venir', arrivee: 'Arrivée aujourd\'hui', enCours: 'En cours', depart: 'Départ aujourd\'hui', termine: 'Terminé', annule: 'Annulé' };
  const LIB_PAIEMENT = { solde: 'Soldé', soldeDu: 'Solde non reçu', acompteAttendu: 'Acompte attendu', acompteRecu: 'Acompte reçu', rien: 'Rien à encaisser', annulee: 'Annulée' };
  const CANAL_DIRECT = 'direct';
  const MAX_LOGEMENTS = 10;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const debutMois = (s) => `${s.slice(0, 7)}-01`;
  function moisSuivant(s, n = 1) {
    const a = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)) - 1 + n;
    const an = a + Math.floor(m / 12), mo = ((m % 12) + 12) % 12 + 1;
    return `${an}-${deux(mo)}-01`;
  }
  const maxDate = (a, b) => (a > b ? a : b);
  const minDate = (a, b) => (a < b ? a : b);

  // ---------- Montants ----------
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  function euros(c, { centimes = true } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const ent = Math.floor(n / 100), dec = n % 100;
    const arrondi = centimes ? ent : Math.round(n / 100);
    const milliers = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${neg ? '−' : ''}${centimes ? `${milliers},${deux(dec)}` : milliers} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${Math.floor(c / 100)},${deux(c % 100)}`);
  // « 15,5 », « 3 % » → 15.5 ; null si vide ou illisible ; borné à 0–100.
  function lirePct(saisie) {
    const s = String(saisie ?? '').replace(/[\s %]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 100 ? Math.round(n * 100) / 100 : null;
  }
  const pct = (t, dec = 1) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${t.toFixed(dec).replace('.', ',')} %`);
  const saisiePct = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
  // Partage un total en parts proportionnelles à des poids, au centime, sans perte (arrondis cumulés).
  function repartir(total, poids) {
    const somme = poids.reduce((s, p) => s + p, 0);
    if (!somme) return poids.map((_, i) => (i === poids.length - 1 ? total : 0));
    let cumul = 0, precedent = 0;
    return poids.map((p) => { cumul += p; const v = Math.round((total * cumul) / somme); const part = v - precedent; precedent = v; return part; });
  }

  // ---------- Réservations : nuits, chevauchements ----------
  const nuits = (r) => Math.max(0, ecart(r.arrivee, r.depart));
  const estActive = (r) => r.statut !== 'annulee';
  const personnes = (r) => (r.adultes || 0) + (r.enfants || 0);
  // Nuits d'une réservation comprises dans [debut, fin[ (fin exclue).
  const nuitsDansPeriode = (r, debut, fin) => Math.max(0, ecart(maxDate(r.arrivee, debut), minDate(r.depart, fin)));
  // Deux séjours du même logement se chevauchent s'ils partagent au moins une nuit.
  const chevauche = (a, b) => a.id !== b.id && a.logement === b.logement && estActive(a) && estActive(b) && a.arrivee < b.depart && b.arrivee < a.depart;
  // Chevauchements présents dans les données (saisies sur deux appareils, import, options).
  // « bloquant » : deux réservations confirmées ; sinon une option entre en conflit.
  function conflits(reservations) {
    const l = (reservations || []).filter(estActive).sort((x, y) => x.arrivee.localeCompare(y.arrivee) || x.id.localeCompare(y.id));
    const res = [];
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        if (chevauche(l[i], l[j])) res.push({ a: l[i], b: l[j], bloquant: l[i].statut === 'confirmee' && l[j].statut === 'confirmee' });
      }
    }
    return res;
  }
  const enConflit = (r, reservations) => (reservations || []).some((x) => chevauche(r, x));
  // Contrôle avant enregistrement : une réservation confirmée ne peut pas chevaucher une autre réservation
  // confirmée du même logement. Une option peut chevaucher (elle est alors signalée).
  function controlerChevauchement(candidat, reservations) {
    const autres = (reservations || []).filter((x) => chevauche(candidat, x));
    const bloquante = candidat.statut === 'confirmee' ? autres.find((x) => x.statut === 'confirmee') : null;
    return { ok: !bloquante, bloquante: bloquante || null, signales: autres };
  }

  // ---------- Argent d'une réservation ----------
  const canalDe = (r, canaux) => (canaux || []).find((c) => c.id === r.canal) || null;
  const logementDe = (r, logements) => (logements || []).find((l) => l.id === r.logement) || null;
  const brut = (r) => (r.hebergement || 0) + (r.menage || 0);
  // Commission du canal : montant saisi, sinon pourcentage du canal appliqué au brut (hébergement + ménage).
  function commission(r, canal) {
    if (Number.isFinite(r.commission) && r.commission !== null) return r.commission;
    const p = Number(canal?.commission) || 0;
    return Math.round((brut(r) * p) / 100);
  }
  const net = (r, canal) => brut(r) - commission(r, canal);
  // Tarif de la taxe de séjour par personne et par nuit : celui du logement, sinon celui des Réglages.
  // null = non renseigné (aucun barème n'est intégré : chaque commune fixe le sien).
  const tarifTaxe = (logement, reglages) => (Number.isFinite(logement?.taxe) ? logement.taxe : Number.isFinite(reglages?.taxeDefaut) ? reglages.taxeDefaut : null);
  // Taxe de séjour d'un séjour : personnes imposables × nuits × tarif. Mineurs exonérés si l'option est cochée.
  function taxeSejour(r, logement, reglages) {
    const tarif = tarifTaxe(logement, reglages);
    const imposables = (r.adultes || 0) + (reglages?.exonererMineurs === false ? (r.enfants || 0) : 0);
    if (!estActive(r)) return { montant: 0, tarif, imposables, nonRenseigne: false };
    if (tarif === null) return { montant: 0, tarif: null, imposables, nonRenseigne: true };
    return { montant: imposables * nuits(r) * tarif, tarif, imposables, nonRenseigne: false };
  }
  // Ce que le propriétaire doit encaisser : net du canal, plus la taxe s'il la collecte lui-même.
  function aRecevoir(r, ctx) {
    if (!estActive(r)) return 0;
    const canal = canalDe(r, ctx.canaux);
    const taxe = r.taxeParCanal ? 0 : taxeSejour(r, logementDe(r, ctx.logements), ctx.reglages).montant;
    return net(r, canal) + taxe;
  }
  const paiementsTries = (r) => [...(r.paiements || [])].sort((x, y) => x.date.localeCompare(y.date));
  const recu = (r, jusqua) => paiementsTries(r).filter((p) => !jusqua || p.date <= jusqua).reduce((s, p) => s + p.montant, 0);
  const acompteAttendu = (r, ctx) => Math.round((aRecevoir(r, ctx) * (Number(ctx.reglages?.acomptePct) || 0)) / 100);
  const dateSolde = (r, reglages) => ajout(r.arrivee, -Math.max(0, Number(reglages?.soldeJours) || 0));
  // État des paiements : soldé, solde non reçu (date du solde passée), acompte attendu, acompte reçu.
  function etatPaiement(r, ctx, auj) {
    if (!estActive(r)) return 'annulee';
    const du = aRecevoir(r, ctx);
    const deja = recu(r, auj);
    if (du <= 0) return 'rien';
    if (deja >= du) return 'solde';
    if (auj >= dateSolde(r, ctx.reglages)) return 'soldeDu';
    if (deja < acompteAttendu(r, ctx)) return 'acompteAttendu';
    return 'acompteRecu';
  }

  // ---------- Séjour au jour J ----------
  function etatSejour(r, auj) {
    if (!estActive(r)) return 'annule';
    if (auj < r.arrivee) return 'aVenir';
    if (auj === r.arrivee) return 'arrivee';
    if (auj < r.depart) return 'enCours';
    if (auj === r.depart) return 'depart';
    return 'termine';
  }
  // Réservation qui occupe le logement la nuit du jour J.
  const occupeLaNuit = (r, jour) => estActive(r) && r.statut === 'confirmee' && r.arrivee <= jour && jour < r.depart;

  // ---------- Ménage entre deux séjours ----------
  // Un ménage par séjour confirmé, le jour du départ, à finir avant la prochaine arrivée dans le logement.
  //  etat : fait, enRetard (départ passé, non fait), aujourdhui, aVenir ;
  //  serre : la prochaine arrivée a lieu le jour même du départ.
  function menages(reservations, auj) {
    const conf = (reservations || []).filter((r) => r.statut === 'confirmee');
    return conf.map((r) => {
      const suivante = conf.filter((x) => x.logement === r.logement && x.id !== r.id && x.arrivee >= r.depart).sort((x, y) => x.arrivee.localeCompare(y.arrivee))[0] || null;
      const etat = r.menageFait ? 'fait' : r.depart < auj ? 'enRetard' : r.depart === auj ? 'aujourdhui' : 'aVenir';
      return { reservation: r, logement: r.logement, date: r.depart, suivante, avant: suivante?.arrivee || null, serre: !!suivante && suivante.arrivee === r.depart, etat };
    }).sort((x, y) => x.date.localeCompare(y.date) || (x.avant || '9').localeCompare(y.avant || '9'));
  }

  // ---------- Ventilation par mois et statistiques ----------
  // Chaque nuit est rattachée à son mois ; hébergement, ménage, commission et taxe sont répartis au prorata
  // des nuits (au centime, sans perte). Une réservation d'une nuit reste entière dans son mois.
  function ventiler(r, ctx) {
    const n = nuits(r);
    if (!estActive(r) || !n) return [];
    const mois = [];
    for (let m = debutMois(r.arrivee); m < r.depart; m = moisSuivant(m)) mois.push({ mois: m.slice(0, 7), nuits: nuitsDansPeriode(r, m, moisSuivant(m)) });
    const poids = mois.map((x) => x.nuits);
    const canal = canalDe(r, ctx.canaux);
    const t = taxeSejour(r, logementDe(r, ctx.logements), ctx.reglages).montant;
    const champs = { hebergement: r.hebergement || 0, menage: r.menage || 0, commission: commission(r, canal), taxe: t };
    const parts = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, repartir(v, poids)]));
    return mois.map((x, i) => ({ ...x, hebergement: parts.hebergement[i], menage: parts.menage[i], commission: parts.commission[i], taxe: parts.taxe[i] }));
  }
  const cumulVide = () => ({ nuits: 0, hebergement: 0, menage: 0, brut: 0, commission: 0, net: 0, taxe: 0, taxeToi: 0, taxeCanal: 0, sejours: 0 });
  function ajouter(c, v, r) {
    c.nuits += v.nuits; c.hebergement += v.hebergement; c.menage += v.menage; c.commission += v.commission; c.taxe += v.taxe;
    if (r.taxeParCanal) c.taxeCanal += v.taxe; else c.taxeToi += v.taxe;
    c.brut = c.hebergement + c.menage; c.net = c.brut - c.commission;
  }
  // Statistiques sur [debut, fin[ (premiers jours de mois : un mois, une année…) : seules les réservations
  // confirmées comptent.
  //  occupation = nuits vendues / (logements × jours) ; prix moyen = hébergement / nuits (hors ménage).
  function stats(ctx, debut, fin, { logement = null } = {}) {
    const total = cumulVide();
    const parCanal = new Map(), parLogement = new Map();
    const logs = (ctx.logements || []).filter((l) => !logement || l.id === logement);
    for (const r of ctx.reservations || []) {
      if (r.statut !== 'confirmee' || (logement && r.logement !== logement)) continue;
      const lignes = ventiler(r, ctx).filter((v) => `${v.mois}-01` >= debut && `${v.mois}-01` < fin);
      if (!lignes.length) continue;
      const c = parCanal.get(r.canal) || cumulVide();
      const l = parLogement.get(r.logement) || cumulVide();
      for (const v of lignes) { ajouter(total, v, r); ajouter(c, v, r); ajouter(l, v, r); }
      if (r.arrivee >= debut && r.arrivee < fin) { total.sejours++; c.sejours++; l.sejours++; }
      parCanal.set(r.canal, c); parLogement.set(r.logement, l);
    }
    const jours = ecart(debut, fin);
    const dispo = logs.length * jours;
    const fin2 = (c, nb) => ({ ...c, dispo: nb * jours, occupation: nb * jours ? (c.nuits / (nb * jours)) * 100 : null, prixMoyen: c.nuits ? Math.round(c.hebergement / c.nuits) : null });
    return {
      ...fin2(total, logs.length), debut, fin, jours, dispo,
      parCanal: [...parCanal.entries()].map(([id, c]) => ({ canal: id, ...fin2(c, logs.length) })).sort((a, b) => b.brut - a.brut),
      parLogement: logs.map((lg) => ({ logement: lg.id, ...fin2(parLogement.get(lg.id) || cumulVide(), 1) })),
    };
  }
  // Statistiques des 12 mois d'une année civile.
  function parMois(ctx, annee) {
    const l = [];
    for (let m = 1; m <= 12; m++) { const d = `${annee}-${deux(m)}-01`; l.push({ mois: d.slice(0, 7), ...stats(ctx, d, moisSuivant(d)) }); }
    return l;
  }
  // Mois d'une année sans aucune nuit réservée (dans la période où des logements existent).
  const moisVides = (ctx, annee) => parMois(ctx, annee).filter((m) => !m.nuits).map((m) => m.mois);

  // ---------- Tableau du jour ----------
  function jour(ctx, auj) {
    const rs = (ctx.reservations || []).filter(estActive);
    const conf = rs.filter((r) => r.statut === 'confirmee');
    const dans = (d, n) => d >= auj && d <= ajout(auj, n);
    const tri = (k) => (a, b) => a[k].localeCompare(b[k]);
    const paiements = conf.map((r) => ({ r, etat: etatPaiement(r, ctx, auj), reste: Math.max(0, aRecevoir(r, ctx) - recu(r, auj)) }));
    const m = menages(rs, auj);
    return {
      occupes: conf.filter((r) => occupeLaNuit(r, auj)),
      arrivees: conf.filter((r) => r.arrivee === auj),
      departs: conf.filter((r) => r.depart === auj),
      prochainesArrivees: conf.filter((r) => r.arrivee > auj && dans(r.arrivee, 7)).sort(tri('arrivee')),
      options: rs.filter((r) => r.statut === 'option' && r.depart > auj).sort(tri('arrivee')),
      menagesAFaire: m.filter((x) => x.etat === 'enRetard' || x.etat === 'aujourdhui'),
      menagesAVenir: m.filter((x) => x.etat === 'aVenir' && x.date <= ajout(auj, 14)),
      soldesDus: paiements.filter((p) => p.etat === 'soldeDu').sort((a, b) => a.r.arrivee.localeCompare(b.r.arrivee)),
      acomptesAttendus: paiements.filter((p) => p.etat === 'acompteAttendu' && p.r.depart > auj).sort((a, b) => a.r.arrivee.localeCompare(b.r.arrivee)),
      aEncaisser: paiements.filter((p) => p.r.depart >= ajout(auj, -90)).reduce((s, p) => s + p.reste, 0),
      conflits: conflits(rs),
    };
  }

  // ---------- Normalisation (tolérante aux anciennes versions) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(max, Math.max(min, n)) : defaut; };
  const centimes = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const pctOuNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100 ? null : Math.round(Number(v) * 100) / 100);
  const texte = (v, n) => String(v ?? '').slice(0, n);

  function normaliserLogement(x, i = 0) {
    const l = x && typeof x === 'object' ? x : {};
    return { id: texte(l.id, 40) || nouvelId(), nom: texte(l.nom, 60).trim() || `Logement ${i + 1}`, capacite: entier(l.capacite, 1, 30, 4), menage: centimes(l.menage) ?? 0, taxe: centimes(l.taxe), note: texte(l.note, 300) };
  }
  function normaliserCanal(x) {
    const c = x && typeof x === 'object' ? x : {};
    const direct = c.id === CANAL_DIRECT;
    return { id: texte(c.id, 40) || nouvelId(), nom: direct ? (texte(c.nom, 40).trim() || 'Direct') : (texte(c.nom, 40).trim() || 'Canal'), commission: pctOuNull(c.commission) ?? 0, collecteTaxe: !!c.collecteTaxe };
  }
  function normaliserReservation(x, auj) {
    const r = x && typeof x === 'object' ? x : {};
    const arrivee = dateOuNull(r.arrivee) || auj;
    let depart = dateOuNull(r.depart) || ajout(arrivee, 1);
    if (depart <= arrivee) depart = ajout(arrivee, 1);
    return {
      id: texte(r.id, 40) || nouvelId(), logement: texte(r.logement, 40), arrivee, depart,
      voyageur: texte(r.voyageur, 80), adultes: entier(r.adultes, 0, 30, 2), enfants: entier(r.enfants, 0, 30, 0),
      canal: texte(r.canal, 40) || CANAL_DIRECT, statut: STATUTS.includes(r.statut) ? r.statut : 'confirmee',
      hebergement: centimes(r.hebergement) ?? 0, menage: centimes(r.menage) ?? 0, commission: centimes(r.commission),
      taxeParCanal: !!r.taxeParCanal,
      paiements: (Array.isArray(r.paiements) ? r.paiements : []).map((p) => ({ id: texte(p?.id, 40) || nouvelId(), date: dateOuNull(p?.date) || arrivee, montant: centimes(p?.montant) ?? 0, note: texte(p?.note, 120) })).filter((p) => p.montant > 0),
      menageFait: dateOuNull(r.menageFait), note: texte(r.note, 300), efface: !!r.efface,
    };
  }
  function etatVide(defauts = {}) {
    const d = JSON.parse(JSON.stringify(defauts));
    return {
      version: 1, activite: '',
      reglages: { taxeDefaut: null, exonererMineurs: true, acomptePct: 30, soldeJours: 0, verifieLe: null, ...(d.reglages || {}) },
      logements: [], canaux: (d.canaux || [{ id: CANAL_DIRECT, nom: 'Direct', commission: 0, collecteTaxe: false }]).map(normaliserCanal),
      reservations: [],
    };
  }
  function normaliser(d, auj, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const r = d.reglages || {};
    const dv = v.reglages;
    const canaux = (Array.isArray(d.canaux) ? d.canaux : v.canaux).map(normaliserCanal);
    if (!canaux.some((c) => c.id === CANAL_DIRECT)) canaux.unshift(normaliserCanal({ id: CANAL_DIRECT, nom: 'Direct' }));
    return {
      version: 1, ...(d.majLe ? { majLe: d.majLe } : {}),
      activite: texte(d.activite, 80),
      reglages: {
        taxeDefaut: r.taxeDefaut === undefined ? dv.taxeDefaut : centimes(r.taxeDefaut),
        exonererMineurs: r.exonererMineurs === undefined ? dv.exonererMineurs : !!r.exonererMineurs,
        acomptePct: pctOuNull(r.acomptePct) ?? dv.acomptePct,
        soldeJours: entier(r.soldeJours, 0, 120, dv.soldeJours),
        verifieLe: dateOuNull(r.verifieLe) || dv.verifieLe,
      },
      logements: (Array.isArray(d.logements) ? d.logements : []).slice(0, MAX_LOGEMENTS).map(normaliserLogement),
      canaux,
      reservations: (Array.isArray(d.reservations) ? d.reservations : []).map((x) => normaliserReservation(x, auj)),
    };
  }

  // ---------- RGPD : données des voyageurs ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Le nom devient « Voyageur effacé », la note et les notes de paiement sont vidées ; dates, nombres de
  // personnes et montants restent (statistiques, comptabilité). Renvoie un nouvel état.
  function effacerVoyageur(etat, id) {
    const e = clone(etat);
    const r = e.reservations.find((x) => x.id === id);
    if (r) { Object.assign(r, { voyageur: 'Voyageur effacé', note: '', efface: true }); r.paiements.forEach((p) => { p.note = ''; }); }
    return e;
  }
  // Effacement groupé des séjours terminés avant une date (départ strictement avant). Renvoie { etat, n }.
  function effacerAnciens(etat, avant) {
    let e = clone(etat), n = 0;
    for (const r of etat.reservations) if (r.depart < avant && !r.efface) { e = effacerVoyageur(e, r.id); n++; }
    return { etat: e, n };
  }
  // Suppression d'un logement : seulement s'il n'a plus de réservation.
  const peutSupprimerLogement = (etat, id) => !etat.reservations.some((r) => r.logement === id);

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(etat, auj) {
    const tete = ['Logement', 'Voyageur', 'Arrivée', 'Départ', 'Nuits', 'Adultes', 'Enfants', 'Canal', 'Statut', 'Hébergement', 'Ménage', 'Brut', 'Commission', 'Net', 'Taxe de séjour', 'Taxe collectée par', 'À recevoir', 'Reçu', 'Reste', 'Paiement', 'Ménage fait le', 'Note'];
    const lignes = [...etat.reservations].sort((a, b) => a.arrivee.localeCompare(b.arrivee)).map((r) => {
      const canal = canalDe(r, etat.canaux);
      const lg = logementDe(r, etat.logements);
      const t = taxeSejour(r, lg, etat.reglages);
      const du = aRecevoir(r, etat);
      const actif = estActive(r);
      return [lg?.nom || '', r.voyageur, r.arrivee, r.depart, nuits(r), r.adultes, r.enfants, canal?.nom || '', LIB_STATUT[r.statut],
        nombreCsv(r.hebergement), nombreCsv(r.menage), nombreCsv(actif ? brut(r) : 0), nombreCsv(actif ? commission(r, canal) : 0), nombreCsv(actif ? net(r, canal) : 0),
        t.nonRenseigne ? 'tarif non renseigné' : nombreCsv(t.montant), r.taxeParCanal ? (canal?.nom || 'Canal') : 'Toi',
        nombreCsv(du), nombreCsv(recu(r, auj)), nombreCsv(Math.max(0, du - recu(r, auj))), LIB_PAIEMENT[etatPaiement(r, etat, auj)], r.menageFait || '', r.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.SJR = {
    STATUTS, LIB_STATUT, LIB_SEJOUR, LIB_PAIEMENT, CANAL_DIRECT, MAX_LOGEMENTS,
    iso, versDate, ajout, ecart, joursDansMois, estDate, debutMois, moisSuivant,
    lireMontant, euros, saisieMontant, lirePct, pct, saisiePct, repartir,
    nuits, estActive, personnes, nuitsDansPeriode, chevauche, conflits, enConflit, controlerChevauchement,
    canalDe, logementDe, brut, commission, net, tarifTaxe, taxeSejour, aRecevoir, recu, acompteAttendu, dateSolde, etatPaiement,
    etatSejour, occupeLaNuit, menages, ventiler, stats, parMois, moisVides, jour,
    nouvelId, normaliserLogement, normaliserCanal, normaliserReservation, normaliser, etatVide,
    effacerVoyageur, effacerAnciens, peutSupprimerLogement, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
