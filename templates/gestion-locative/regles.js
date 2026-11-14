// Gestion locative QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.GRT) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), mois « AAAA-MM », montants en centimes
// (entiers), indices IRL en nombres à deux décimales. Un bail court de son début à sa fin (incluse) ;
// sans fin, il est en cours. Une échéance par mois occupé, au jour d'échéance du bail.
(function (racine) {
  'use strict';

  const TYPES = ['vide', 'meuble', 'mobilite'];
  const LIB_TYPE = { vide: 'Location vide', meuble: 'Location meublée', mobilite: 'Bail mobilité' };
  const DEPOT_MAX = { vide: 1, meuble: 2, mobilite: null }; // mois de loyer hors charges (F31269)
  const LIB_ECHEANCE = { payee: 'Payé', partielle: 'Partiel', aujourdhui: 'Dû aujourd\'hui', aVenir: 'À venir', retard: 'En retard' };
  const LIB_REVISION = { aVenir: 'À venir', aDemander: 'À demander', appliquee: 'Appliquée', ignoree: 'Non appliquée', perdue: 'Perdue', bloquee: 'Bloquée' };
  const LIB_PALIER = ['', 'Rappel amiable', 'Relance', 'Mise en demeure'];
  const MAX_BIENS = 10;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j || 1); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const moisDe = (s) => s.slice(0, 7);
  function moisSuivant(m, n = 1) {
    const a = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
    return `${a + Math.floor(mo / 12)}-${deux(((mo % 12) + 12) % 12 + 1)}`;
  }
  const premierJour = (m) => `${m}-01`;
  const dernierJour = (m) => `${m}-${deux(joursDansMois(Number(m.slice(0, 4)), Number(m.slice(5, 7))))}`;
  // Même jour, n mois plus tard (borné à la fin du mois : 31/01 + 1 mois = 28 ou 29/02).
  function ajoutMois(s, n) {
    const m = moisSuivant(moisDe(s), n);
    const j = Math.min(Number(s.slice(8, 10)), joursDansMois(Number(m.slice(0, 4)), Number(m.slice(5, 7))));
    return `${m}-${deux(j)}`;
  }
  const ajoutAns = (s, n) => ajoutMois(s, 12 * n);
  const maxDate = (a, b) => (a > b ? a : b);
  const minDate = (a, b) => (a < b ? a : b);
  const joursAnnee = (a) => (new Date(a, 1, 29).getDate() === 29 ? 366 : 365);
  // Jours communs (bornes incluses) entre [a1, a2] et [b1, b2].
  const joursCommuns = (a1, a2, b1, b2) => { const d = maxDate(a1, b1), f = minDate(a2, b2); return f < d ? 0 : ecart(d, f) + 1; };

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
  const pct = (t, dec = 1) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${t.toFixed(dec).replace('.', ',')} %`);
  // Indice IRL : « 145,17 » → 145.17 ; null si illisible ou hors de 50–500.
  function lireIndice(saisie) {
    const s = String(saisie ?? '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d{2,3}(\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s);
    return n >= 50 && n <= 500 ? Math.round(n * 100) / 100 : null;
  }
  const indice = (n) => (Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '–');
  // Partage un total en parts proportionnelles à des poids, au centime, sans perte.
  function repartir(total, poids) {
    const somme = poids.reduce((s, p) => s + p, 0);
    if (!somme) return poids.map((_, i) => (i === poids.length - 1 ? total : 0));
    let cumul = 0, precedent = 0;
    return poids.map((p) => { cumul += p; const v = Math.round((total * cumul) / somme); const part = v - precedent; precedent = v; return part; });
  }

  // ---------- Trimestres IRL ----------
  // « 2026-T2 » ; fin du trimestre « 2026-06-30 ».
  const estTrimestre = (s) => typeof s === 'string' && /^\d{4}-T[1-4]$/.test(s);
  const finTrimestre = (s) => dernierJour(`${s.slice(0, 4)}-${deux(Number(s.slice(6)) * 3)}`);
  const trimestrePrecedentAnnee = (s) => `${Number(s.slice(0, 4)) - 1}-${s.slice(5)}`;
  const libTrimestre = (s) => `${s.slice(6)}${s.slice(6) === '1' ? 'er' : 'e'} trimestre ${s.slice(0, 4)}`;
  const valeurIrl = (irl, trimestre, zone) => (irl || []).find((x) => x.trimestre === trimestre && x.zone === zone)?.valeur ?? null;

  // ---------- Baux : loyer en vigueur, échéances ----------
  const finBail = (b) => b.fin || '9999-12-31';
  const actifLe = (b, d) => b.debut <= d && d <= finBail(b);
  const actifDansMois = (b, m) => b.debut <= dernierJour(m) && finBail(b) >= premierJour(m);
  // Loyer et charges en vigueur à une date : dernier changement daté au plus tard ce jour-là.
  function enVigueur(b, d) {
    let v = { date: b.debut, loyer: b.loyer, charges: b.charges, motif: 'Début du bail' };
    for (const h of [...(b.historique || [])].sort((x, y) => x.date.localeCompare(y.date))) if (h.date <= d) v = h;
    return v;
  }
  // Date d'échéance du mois : jour d'échéance du bail (borné à la fin du mois), au plus tôt le début du bail.
  function dateEcheance(b, m) {
    const j = Math.min(b.jourEcheance || 1, joursDansMois(Number(m.slice(0, 4)), Number(m.slice(5, 7))));
    return maxDate(`${m}-${deux(j)}`, b.debut);
  }
  // Échéance d'un mois : loyer et charges en vigueur à la date d'échéance, au prorata des jours occupés.
  function echeance(b, m, reglages = {}) {
    if (!actifDansMois(b, m)) return null;
    const date = dateEcheance(b, m);
    const v = enVigueur(b, date);
    const jm = joursDansMois(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
    const jours = joursCommuns(b.debut, finBail(b), premierJour(m), dernierJour(m));
    const prorata = reglages.prorata !== false && jours < jm;
    const loyer = prorata ? Math.round((v.loyer * jours) / jm) : v.loyer;
    const charges = prorata ? Math.round((v.charges * jours) / jm) : v.charges;
    return { bail: b.id, mois: m, date, loyer, charges, du: loyer + charges, jours, joursMois: jm, prorata };
  }
  // Échéances d'un bail, du premier mois au mois « jusqua » inclus (et jamais après la fin du bail).
  function echeances(b, jusqua, reglages) {
    const res = [];
    let m = moisDe(b.debut);
    const fin = b.fin ? minDate(moisDe(b.fin), jusqua) : jusqua;
    for (let i = 0; m <= fin && i < 1200; i++, m = moisSuivant(m)) { const e = echeance(b, m, reglages); if (e) res.push(e); }
    return res;
  }

  // ---------- Paiements et état d'une échéance ----------
  const payePour = (paiements, bailId, m) => (paiements || []).filter((p) => p.bail === bailId && p.mois === m).reduce((s, p) => s + p.montant, 0);
  function palier(joursRetard, seuils = [5, 15, 30]) { let n = 0; seuils.forEach((s) => { if (joursRetard >= s) n++; }); return n; }
  function situation(e, paiements, t, reglages = {}) {
    const paye = payePour(paiements, e.bail, e.mois);
    const reste = Math.max(0, e.du - paye);
    let etat;
    if (reste === 0) etat = 'payee';
    else if (e.date > t) etat = paye ? 'partielle' : 'aVenir';
    else if (e.date === t) etat = paye ? 'partielle' : 'aujourdhui';
    else etat = 'retard';
    const joursRetard = etat === 'retard' ? ecart(e.date, t) : 0;
    return { ...e, paye, reste, trop: Math.max(0, paye - e.du), etat, joursRetard, palier: etat === 'retard' ? palier(joursRetard, reglages.relances) : 0, partiel: paye > 0 && reste > 0 };
  }
  // Toutes les échéances échues ou du mois « jusqua », avec leur situation.
  function situations(etat, t, jusqua = moisDe(t)) {
    const res = [];
    for (const b of etat.baux) for (const e of echeances(b, jusqua, etat.reglages)) res.push(situation(e, etat.paiements, t, etat.reglages));
    return res;
  }
  const impayes = (etat, t) => situations(etat, t).filter((s) => s.etat === 'retard').sort((a, b) => a.date.localeCompare(b.date));

  // Document de paiement : quittance si l'échéance est payée en entier, reçu si elle l'est en partie.
  // Le détail loyer / charges est celui de l'échéance (F35247 : la quittance distingue loyer et charges).
  function documentPaiement(etat, bailId, m, t) {
    const b = etat.baux.find((x) => x.id === bailId);
    if (!b) return null;
    const e = echeance(b, m, etat.reglages);
    if (!e) return null;
    const s = situation(e, etat.paiements, t, etat.reglages);
    if (!s.paye) return null;
    const bien = etat.biens.find((x) => x.id === b.bien);
    const pmts = (etat.paiements || []).filter((p) => p.bail === bailId && p.mois === m).sort((x, y) => x.date.localeCompare(y.date));
    return {
      type: s.reste ? 'recu' : 'quittance', mois: m, du: e.du, loyer: e.loyer, charges: e.charges, paye: s.paye, reste: s.reste,
      periodeDebut: maxDate(premierJour(m), b.debut), periodeFin: minDate(dernierJour(m), finBail(b)),
      dernierPaiement: pmts[pmts.length - 1]?.date || null, paiements: pmts,
      bailleur: etat.reglages.bailleurNom, bailleurAdresse: etat.reglages.bailleurAdresse,
      locataire: b.locataires, bien: bien?.nom || '', adresse: bien?.adresse || '', modeCharges: b.modeCharges,
    };
  }

  // ---------- Révision annuelle (F1311) ----------
  // Date de révision d'une année : date convenue (« MM-JJ ») ou anniversaire du début du bail.
  function dateRevision(b, annee) {
    const mmjj = b.revision?.date && /^\d{2}-\d{2}$/.test(b.revision.date) ? b.revision.date : b.debut.slice(5);
    const m = `${annee}-${mmjj.slice(0, 2)}`;
    return `${m}-${deux(Math.min(Number(mmjj.slice(3)), joursDansMois(annee, Number(mmjj.slice(0, 2)))))}`;
  }
  // Révision impossible : pas de clause, bail mobilité, ou DPE F ou G coché.
  function blocageRevision(b) {
    if (b.type === 'mobilite') return 'Révision interdite en bail mobilité.';
    if (!b.revision?.clause) return 'Le bail ne prévoit pas de révision.';
    if (b.revision.dpeFG) return 'Logement classé F ou G au DPE : révision interdite (bail signé, renouvelé ou reconduit depuis le 24/08/2022 en métropole).';
    return null;
  }
  // Indices d'une révision : nouveau = valeur la plus récente du trimestre de référence saisie pour un
  // trimestre achevé avant la date de révision ; ancien = même trimestre de l'année précédente.
  function indicesRevision(b, D, irl, zone) {
    const q = b.revision?.trimestre || 1;
    const candidats = (irl || []).filter((x) => x.zone === zone && x.trimestre.endsWith(`T${q}`) && finTrimestre(x.trimestre) < D).sort((x, y) => y.trimestre.localeCompare(x.trimestre));
    let annee = Number(D.slice(0, 4));
    while (finTrimestre(`${annee}-T${q}`) >= D) annee--;
    const attendu = `${annee}-T${q}`;
    const n = candidats[0];
    if (!n) return { manque: attendu, trimestreNouveau: attendu };
    const tA = trimestrePrecedentAnnee(n.trimestre);
    const a = valeurIrl(irl, tA, zone);
    if (a === null) return { manque: tA, trimestreNouveau: n.trimestre, irlNouveau: n.valeur, trimestreAncien: tA };
    return { trimestreNouveau: n.trimestre, irlNouveau: n.valeur, trimestreAncien: tA, irlAncien: a, retardIndice: n.trimestre < attendu };
  }
  // Nouveau loyer = loyer × nouveau ÷ ancien, arrondi au centime.
  const nouveauLoyer = (loyer, irlNouveau, irlAncien) => Math.round((loyer * irlNouveau) / irlAncien);
  // Occurrences de révision d'un bail jusqu'à la prochaine à venir, avec leur état à la date t.
  function revisions(b, t, irl = [], zone = 'metropole') {
    const res = [];
    const bloc = blocageRevision(b);
    const annee0 = Number(b.debut.slice(0, 4));
    const fin = b.fin || '9999-12-31';
    for (let a = annee0; a <= Number(t.slice(0, 4)) + 1; a++) {
      const D = dateRevision(b, a);
      if (D <= b.debut || D > fin) continue;
      const limite = ajout(ajoutAns(D, 1), -1);
      const fait = (b.revisions || []).find((r) => r.date === D);
      let etat;
      if (fait) etat = fait.statut;
      else if (bloc) etat = 'bloquee';
      else if (D > t) etat = 'aVenir';
      else if (t > limite) etat = 'perdue';
      else etat = 'aDemander';
      const loyer = enVigueur(b, D).loyer;
      const ind = fait ? { trimestreNouveau: fait.trimestreNouveau, irlNouveau: fait.irlNouveau, trimestreAncien: fait.trimestreAncien, irlAncien: fait.irlAncien } : indicesRevision(b, D, irl, zone);
      const calc = !fait && ind.irlAncien && ind.irlNouveau ? nouveauLoyer(loyer, ind.irlNouveau, ind.irlAncien) : null;
      res.push({ bail: b.id, date: D, limite, etat, loyer: fait ? fait.ancienLoyer : loyer, nouveau: fait ? fait.nouveauLoyer : calc, ...ind, fait: fait || null, joursRestants: ecart(t, limite) });
      if (D > t) break;
    }
    return res;
  }
  // Occurrence à traiter : la plus ancienne « à demander », sinon la prochaine à venir.
  function revisionCourante(b, t, irl, zone) {
    const l = revisions(b, t, irl, zone);
    return l.find((r) => r.etat === 'aDemander') || l.find((r) => r.etat === 'aVenir') || l.find((r) => r.etat === 'bloquee' && r.date > t) || l[l.length - 1] || null;
  }
  // Appliquer une révision demandée le « demandeLe » : effet à cette date, jamais avant la date de révision,
  // refusée après la limite d'un an (F1311 : pas de rétroactivité, révision perdue au-delà d'un an).
  function appliquerRevision(b, D, demandeLe, irl, zone) {
    const bloc = blocageRevision(b);
    if (bloc) return { ok: false, erreur: bloc };
    if (!estDate(demandeLe)) return { ok: false, erreur: 'Indique la date de la demande au locataire.' };
    const limite = ajout(ajoutAns(D, 1), -1);
    if (demandeLe > limite) return { ok: false, erreur: `Demande après le ${limite} : la révision de cette année est perdue (plus d'un an après la date de révision).` };
    if ((b.revisions || []).some((r) => r.date === D)) return { ok: false, erreur: 'Cette révision est déjà enregistrée.' };
    const ind = indicesRevision(b, D, irl, zone);
    if (ind.manque) return { ok: false, erreur: `Indice IRL du ${libTrimestre(ind.manque)} non saisi.`, manque: ind.manque };
    const dateEffet = maxDate(D, demandeLe);
    const avant = enVigueur(b, dateEffet);
    const ancienLoyer = enVigueur(b, D).loyer;
    const nouveau = nouveauLoyer(ancienLoyer, ind.irlNouveau, ind.irlAncien);
    const enr = { date: D, statut: 'appliquee', demandeLe, dateEffet, ancienLoyer, nouveauLoyer: nouveau, trimestreNouveau: ind.trimestreNouveau, irlNouveau: ind.irlNouveau, trimestreAncien: ind.trimestreAncien, irlAncien: ind.irlAncien };
    const bail = { ...b, revisions: [...(b.revisions || []), enr], historique: [...(b.historique || []).filter((h) => h.date !== dateEffet), { date: dateEffet, loyer: nouveau, charges: avant.charges, motif: `Révision IRL ${ind.trimestreNouveau}` }] };
    return { ok: true, bail, revision: enr };
  }
  const ignorerRevision = (b, D) => ({ ...b, revisions: [...(b.revisions || []).filter((r) => r.date !== D), { date: D, statut: 'ignoree' }] });
  // Annule une révision enregistrée (et le changement de loyer qu'elle a créé).
  function annulerRevision(b, D) {
    const r = (b.revisions || []).find((x) => x.date === D);
    if (!r) return b;
    return { ...b, revisions: b.revisions.filter((x) => x.date !== D), historique: (b.historique || []).filter((h) => !(r.statut === 'appliquee' && h.date === r.dateEffet && h.loyer === r.nouveauLoyer)) };
  }

  // ---------- Dépôt de garantie (F31269) ----------
  function depotMax(b) { const m = DEPOT_MAX[b.type]; return m === null || m === undefined ? 0 : m * b.loyer; }
  function controleDepot(b) {
    if (b.type === 'mobilite' && b.depot > 0) return 'Dépôt de garantie interdit en bail mobilité.';
    const max = depotMax(b);
    if (b.type !== 'mobilite' && b.depot > max) return `Au-delà du maximum : ${DEPOT_MAX[b.type]} mois de loyer hors charges, soit ${euros(max)}.`;
    return null;
  }
  // Restitution : 1 mois après la remise des clés si l'état des lieux de sortie est conforme, 2 mois sinon.
  function etatDepot(b, t) {
    const s = b.sortie || {};
    if (!b.depot) return { etat: 'aucun' };
    if (!s.remiseCles) return { etat: 'conserve' };
    const limite = ajoutMois(s.remiseCles, s.conforme === false ? 2 : 1);
    const retenues = (s.retenues || []).reduce((x, r) => x + r.montant, 0);
    const aRendre = Math.max(0, b.depot - retenues);
    if (s.restitueLe) return { etat: 'restitue', limite, retenues, aRendre, restitue: s.restitue ?? aRendre, enRetard: s.restitueLe > limite };
    const retard = t > limite ? ecart(limite, t) : 0;
    // Mois de retard commencés (information : la majoration suppose une mise en demeure du locataire).
    let moisRetard = 0;
    while (retard && ajoutMois(limite, moisRetard) < t && moisRetard < 600) moisRetard++;
    return { etat: retard ? 'enRetard' : 'aRestituer', limite, retenues, aRendre, joursRestants: ecart(t, limite), moisRetard, majorationIndicative: moisRetard * Math.round(enVigueur(b, s.remiseCles).loyer / 10) };
  }

  // ---------- Dépenses, régularisation des charges, rendement ----------
  const depensesAnnee = (etat, bienId, annee) => (etat.depenses || []).filter((d) => d.bien === bienId && d.date.startsWith(`${annee}-`));
  // Part loyer / charges d'un montant d'échéance.
  function moisAnnee(annee) { return Array.from({ length: 12 }, (_, i) => `${annee}-${deux(i + 1)}`); }
  // Régularisation annuelle d'un bail à provisions (F947) : charges récupérables du bien sur l'année au
  // prorata des jours du bail, moins les provisions appelées. Positif : complément à demander ; négatif :
  // trop-perçu à rendre. Forfait : rien à régulariser.
  function regularisation(etat, bailId, annee) {
    const b = etat.baux.find((x) => x.id === bailId);
    if (!b) return null;
    const debutA = `${annee}-01-01`, finA = `${annee}-12-31`;
    const jours = joursCommuns(b.debut, finBail(b), debutA, finA);
    if (!jours) return null;
    if (b.modeCharges === 'forfait') return { bail: b.id, annee, forfait: true, jours };
    const provisions = moisAnnee(annee).map((m) => echeance(b, m, etat.reglages)).filter(Boolean).reduce((s, e) => s + e.charges, 0);
    const deps = depensesAnnee(etat, b.bien, annee).filter((d) => d.recuperable);
    const ja = joursAnnee(annee);
    const parCategorie = {};
    deps.forEach((d) => { parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant; });
    const cats = Object.keys(parCategorie);
    const totalBien = deps.reduce((s, d) => s + d.montant, 0);
    const reel = Math.round((totalBien * jours) / ja);
    const parts = repartir(reel, cats.map((c) => parCategorie[c]));
    return {
      bail: b.id, annee, forfait: false, jours, joursAnnee: ja, debut: maxDate(debutA, b.debut), fin: minDate(finA, finBail(b)),
      totalBien, reel, provisions, solde: reel - provisions, detail: cats.map((c, i) => ({ categorie: c, total: parCategorie[c], part: parts[i] })),
      faite: b.regularisations?.[annee] || null,
    };
  }
  const coutBien = (bien) => (bien.prixAchat || 0) + (bien.fraisAchat || 0) + (bien.travaux || 0);
  // Bilan d'un bien sur une année civile.
  function bilanBien(etat, bienId, annee, t) {
    const bien = etat.biens.find((x) => x.id === bienId);
    const baux = etat.baux.filter((b) => b.bien === bienId);
    let loyers = 0, charges = 0, encaisse = 0, impaye = 0;
    for (const b of baux) for (const m of moisAnnee(annee)) {
      const e = echeance(b, m, etat.reglages);
      if (!e) continue;
      const s = situation(e, etat.paiements, t, etat.reglages);
      loyers += e.loyer; charges += e.charges; encaisse += Math.min(s.paye, e.du);
      if (s.etat === 'retard') impaye += s.reste;
    }
    const deps = depensesAnnee(etat, bienId, annee);
    const recup = deps.filter((d) => d.recuperable).reduce((s, d) => s + d.montant, 0);
    const nonRecup = deps.filter((d) => !d.recuperable).reduce((s, d) => s + d.montant, 0);
    const debutA = bien?.dateAchat && bien.dateAchat > `${annee}-01-01` ? bien.dateAchat : `${annee}-01-01`;
    const finA = `${annee}-12-31`;
    const total = debutA > finA ? 0 : ecart(debutA, finA) + 1;
    let occupes = 0;
    if (total) for (let d = debutA; d <= finA; d = ajout(d, 1)) if (baux.some((b) => actifLe(b, d))) occupes++;
    const cout = bien ? coutBien(bien) : 0;
    return {
      bien: bienId, annee, loyers, charges, encaisse, impaye, recup, nonRecup, depenses: recup + nonRecup, cout,
      brut: cout ? (loyers / cout) * 100 : null, net: cout ? ((loyers - nonRecup) / cout) * 100 : null,
      cashflow: encaisse - recup - nonRecup, joursVacants: total - occupes, joursPeriode: total,
    };
  }
  function bilan(etat, annee, t) {
    const parBien = etat.biens.map((b) => bilanBien(etat, b.id, annee, t));
    const somme = (k) => parBien.reduce((s, x) => s + x[k], 0);
    const cout = somme('cout'), loyers = somme('loyers'), nonRecup = somme('nonRecup');
    return { annee, parBien, loyers, charges: somme('charges'), encaisse: somme('encaisse'), impaye: somme('impaye'), recup: somme('recup'), nonRecup, cout, cashflow: somme('cashflow'),
      brut: cout ? (loyers / cout) * 100 : null, net: cout ? ((loyers - nonRecup) / cout) * 100 : null };
  }

  // ---------- Alertes du jour ----------
  function alertes(etat, t) {
    const res = { impayes: impayes(etat, t), revisions: [], depots: [], regularisations: [], finsBail: [], irlManquants: [] };
    const manq = new Set();
    for (const b of etat.baux) {
      // Bail terminé : plus de révision à demander (elle ne s'appliquerait qu'après la demande).
      const r = b.fin && b.fin < t ? null : revisionCourante(b, t, etat.irl, etat.reglages.zoneIrl);
      if (r && (r.etat === 'aDemander' || (r.etat === 'aVenir' && ecart(t, r.date) <= 45))) {
        res.revisions.push(r);
        if (r.manque) manq.add(r.manque);
      }
      const d = etatDepot(b, t);
      if (d.etat === 'aRestituer' || d.etat === 'enRetard') res.depots.push({ bail: b.id, ...d });
      const annee = Number(t.slice(0, 4)) - 1;
      const rg = regularisation(etat, b.id, annee);
      if (rg && !rg.forfait && !rg.faite && (rg.totalBien || rg.provisions)) res.regularisations.push(rg);
      if (!b.fin && b.finPrevue && b.finPrevue >= t && ecart(t, b.finPrevue) <= (etat.reglages.alerteFinBail ?? 90)) res.finsBail.push({ bail: b.id, date: b.finPrevue, jours: ecart(t, b.finPrevue) });
    }
    res.irlManquants = [...manq].sort();
    return res;
  }

  // ---------- Modèles de textes ----------
  const remplir = (modele, vars) => String(modele || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null || vars[k] === '' ? `[${k}]` : String(vars[k])));

  // ---------- Normalisation ----------
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const centimes = (v, def = 0) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : def);
  const texte = (v, max = 200) => String(v ?? '').slice(0, max);
  function normaliserBien(b = {}) {
    return { id: b.id || nouvelId(), nom: texte(b.nom, 60) || 'Bien sans nom', adresse: texte(b.adresse, 160), type: texte(b.type, 40) || 'Appartement',
      surface: Number.isFinite(b.surface) && b.surface > 0 ? Math.round(b.surface * 10) / 10 : null,
      prixAchat: centimes(b.prixAchat), fraisAchat: centimes(b.fraisAchat), travaux: centimes(b.travaux), dateAchat: estDate(b.dateAchat) ? b.dateAchat : null, note: texte(b.note, 300) };
  }
  function normaliserBail(b = {}, t = '2026-01-01') {
    const type = TYPES.includes(b.type) ? b.type : 'vide';
    const debut = estDate(b.debut) ? b.debut : t;
    const rv = b.revision || {};
    const s = b.sortie || {};
    return {
      id: b.id || nouvelId(), bien: b.bien || '', locataires: texte(b.locataires, 120), type, debut,
      fin: estDate(b.fin) && b.fin >= debut ? b.fin : null, finPrevue: estDate(b.finPrevue) ? b.finPrevue : null,
      loyer: centimes(b.loyer), charges: centimes(b.charges), modeCharges: b.modeCharges === 'forfait' || type === 'mobilite' ? 'forfait' : 'provision',
      jourEcheance: Number.isInteger(b.jourEcheance) && b.jourEcheance >= 1 && b.jourEcheance <= 31 ? b.jourEcheance : 1,
      depot: type === 'mobilite' ? 0 : centimes(b.depot),
      revision: { clause: type === 'mobilite' ? false : rv.clause !== false, trimestre: [1, 2, 3, 4].includes(rv.trimestre) ? rv.trimestre : 1, date: typeof rv.date === 'string' && /^\d{2}-\d{2}$/.test(rv.date) ? rv.date : null, dpeFG: !!rv.dpeFG },
      historique: (Array.isArray(b.historique) ? b.historique : []).filter((h) => estDate(h.date)).map((h) => ({ date: h.date, loyer: centimes(h.loyer), charges: centimes(h.charges), motif: texte(h.motif, 80) })),
      revisions: (Array.isArray(b.revisions) ? b.revisions : []).filter((r) => estDate(r.date) && ['appliquee', 'ignoree'].includes(r.statut)),
      regularisations: b.regularisations && typeof b.regularisations === 'object' ? b.regularisations : {},
      sortie: { remiseCles: estDate(s.remiseCles) ? s.remiseCles : null, conforme: s.conforme !== false, restitueLe: estDate(s.restitueLe) ? s.restitueLe : null,
        restitue: Number.isFinite(s.restitue) ? centimes(s.restitue) : null, retenues: (Array.isArray(s.retenues) ? s.retenues : []).filter((r) => Number.isFinite(r.montant)).map((r) => ({ libelle: texte(r.libelle, 80), montant: centimes(r.montant) })) },
      efface: !!b.efface, note: texte(b.note, 300),
    };
  }
  function normaliser(d, t, defauts) {
    const e = etatVide(defauts);
    if (!d || typeof d !== 'object') return e;
    e.reglages = { ...e.reglages, ...(d.reglages || {}) };
    if (!Array.isArray(e.reglages.relances) || e.reglages.relances.length !== 3) e.reglages.relances = [...defauts.reglages.relances];
    e.biens = (Array.isArray(d.biens) ? d.biens : []).slice(0, MAX_BIENS).map(normaliserBien);
    const ids = new Set(e.biens.map((b) => b.id));
    e.baux = (Array.isArray(d.baux) ? d.baux : []).map((b) => normaliserBail(b, t)).filter((b) => ids.has(b.bien));
    const baux = new Set(e.baux.map((b) => b.id));
    e.paiements = (Array.isArray(d.paiements) ? d.paiements : []).filter((p) => baux.has(p.bail) && estMois(p.mois) && estDate(p.date) && Number.isFinite(p.montant) && p.montant > 0).map((p) => ({ id: p.id || nouvelId(), bail: p.bail, mois: p.mois, date: p.date, montant: Math.round(p.montant), note: texte(p.note, 120) }));
    e.depenses = (Array.isArray(d.depenses) ? d.depenses : []).filter((x) => ids.has(x.bien) && estDate(x.date) && Number.isFinite(x.montant)).map((x) => ({ id: x.id || nouvelId(), bien: x.bien, date: x.date, categorie: texte(x.categorie, 40) || 'autre', montant: centimes(x.montant), recuperable: !!x.recuperable, note: texte(x.note, 160) }));
    e.irl = (Array.isArray(d.irl) ? d.irl : []).filter((x) => estTrimestre(x.trimestre) && Number.isFinite(x.valeur)).map((x) => ({ trimestre: x.trimestre, valeur: Math.round(x.valeur * 100) / 100, zone: ['metropole', 'corse', 'dom'].includes(x.zone) ? x.zone : 'metropole' }));
    e.relancesFaites = (Array.isArray(d.relancesFaites) ? d.relancesFaites : []).filter((r) => baux.has(r.bail) && estMois(r.mois) && estDate(r.date));
    e.quittances = d.quittances && typeof d.quittances === 'object' ? d.quittances : {};
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  function etatVide(defauts) {
    return { version: 1, reglages: structuredCloneSimple(defauts.reglages), biens: [], baux: [], paiements: [], depenses: [], irl: [], relancesFaites: [], quittances: {} };
  }
  function structuredCloneSimple(o) { return JSON.parse(JSON.stringify(o)); }
  // Ajoute ou remplace un indice (même trimestre et même zone).
  function majIrl(irl, trimestre, valeur, zone) {
    return [...(irl || []).filter((x) => !(x.trimestre === trimestre && x.zone === zone)), { trimestre, valeur, zone }].sort((a, b) => b.trimestre.localeCompare(a.trimestre));
  }

  // ---------- Données des locataires ----------
  function effacerLocataire(etat, bailId) {
    return { ...etat, baux: etat.baux.map((b) => (b.id === bailId ? { ...b, locataires: 'Locataire effacé', note: '', efface: true } : b)) };
  }
  // Efface les locataires des baux terminés avant « avant ».
  function effacerAnciens(etat, avant) {
    let n = 0;
    const baux = etat.baux.map((b) => { if (b.fin && b.fin < avant && !b.efface) { n++; return { ...b, locataires: 'Locataire effacé', note: '', efface: true }; } return b; });
    return { etat: { ...etat, baux }, n };
  }
  const peutSupprimerBien = (etat, bienId) => !etat.baux.some((b) => b.bien === bienId) && !(etat.depenses || []).some((d) => d.bien === bienId);
  // Deux baux du même bien ne se chevauchent pas (colocation à baux multiples : hors périmètre).
  function chevauchementBail(etat, candidat) {
    return etat.baux.find((b) => b.id !== candidat.id && b.bien === candidat.bien && b.debut <= finBail(candidat) && candidat.debut <= finBail(b)) || null;
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function csvEcheances(etat, t, jusqua = moisDe(t)) {
    const tete = ['Bien', 'Locataire', 'Mois', 'Échéance', 'Loyer', 'Charges', 'Dû', 'Payé', 'Reste', 'État'];
    const lignes = situations(etat, t, jusqua).sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
      const b = etat.baux.find((x) => x.id === s.bail);
      const bien = etat.biens.find((x) => x.id === b.bien);
      return [bien?.nom || '', b.locataires, s.mois, s.date, nombreCsv(s.loyer), nombreCsv(s.charges), nombreCsv(s.du), nombreCsv(s.paye), nombreCsv(s.reste), LIB_ECHEANCE[s.etat]];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }
  function csvDepenses(etat, categories = []) {
    const nom = (id) => categories.find((c) => c.id === id)?.nom || id;
    const tete = ['Date', 'Bien', 'Catégorie', 'Montant', 'Récupérable', 'Note'];
    const lignes = [...etat.depenses].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [d.date, etat.biens.find((x) => x.id === d.bien)?.nom || '', nom(d.categorie), nombreCsv(d.montant), d.recuperable ? 'oui' : 'non', d.note]);
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.GRT = {
    TYPES, LIB_TYPE, DEPOT_MAX, LIB_ECHEANCE, LIB_REVISION, LIB_PALIER, MAX_BIENS,
    iso, versDate, ajout, ecart, joursDansMois, estDate, estMois, moisDe, moisSuivant, premierJour, dernierJour, ajoutMois, ajoutAns, joursAnnee, joursCommuns,
    lireMontant, euros, saisieMontant, pct, lireIndice, indice, repartir,
    estTrimestre, finTrimestre, trimestrePrecedentAnnee, libTrimestre, valeurIrl, majIrl,
    finBail, actifLe, actifDansMois, enVigueur, dateEcheance, echeance, echeances,
    payePour, palier, situation, situations, impayes, documentPaiement,
    dateRevision, blocageRevision, indicesRevision, nouveauLoyer, revisions, revisionCourante, appliquerRevision, ignorerRevision, annulerRevision,
    depotMax, controleDepot, etatDepot,
    depensesAnnee, moisAnnee, regularisation, coutBien, bilanBien, bilan, alertes, remplir,
    nouvelId, normaliserBien, normaliserBail, normaliser, etatVide,
    effacerLocataire, effacerAnciens, peutSupprimerBien, chevauchementBail, csvEcheances, csvDepenses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
