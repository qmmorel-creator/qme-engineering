// Gestion locative QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.GST) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), mois « AAAA-MM », trimestres « AAAA-Tn ».
// Montants en centimes (entiers). Indices IRL en nombres décimaux, SAISIS par l'utilisateur (aucun intégré).
// Un bail produit chaque mois une échéance (loyer hors charges + provision ou forfait de charges), au
// prorata des jours le premier et le dernier mois ; les paiements soldent les échéances dans l'ordre (FIFO).
(function (racine) {
  'use strict';

  const TYPES_BAIL = ['nu', 'meuble'];
  const LIB_TYPE = { nu: 'Location nue', meuble: 'Location meublée' };
  const MODES_CHARGES = ['provisions', 'forfait'];
  const LIB_STATUT = { avenir: 'À venir', attente: 'Dans le délai', paye: 'Payé', payeRetard: 'Payé en retard', partiel: 'Partiel', impaye: 'Impayé' };
  const LIB_REVISION = { avenir: 'À venir', aFaire: 'À faire', irlManquant: 'Indice à saisir', appliquee: 'Appliquée', perdue: 'Non demandée à temps', dpe: 'Interdite (DPE F ou G)', sansClause: 'Pas de clause' };
  const DPE = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j || 1, joursDansMois(an, mo)))}`;
  }
  const moisSuivant = (m, n = 1) => ajoutMois(`${m}-01`, n).slice(0, 7);
  const finMois = (m) => `${m}-${deux(joursDansMois(Number(m.slice(0, 4)), Number(m.slice(5, 7))))}`;
  const min = (a, b) => (a < b ? a : b);
  const max = (a, b) => (a > b ? a : b);
  // Mois de « de » à « a » inclus (« AAAA-MM »).
  function listeMois(de, a) {
    const l = [];
    for (let m = de; m <= a && l.length < 1200; m = moisSuivant(m)) l.push(m);
    return l;
  }

  // ---------- Montants, indices ----------
  function lireMontant(saisie, { negatif = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.').replace('−', '-');
    if (!s || !(negatif ? /^-?\d+(\.\d{0,2})?$/ : /^\d+(\.\d{0,2})?$/).test(s)) return null;
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
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)},${deux(Math.abs(c) % 100)}`);
  // Indice IRL : « 146,68 » → 146.68 ; null si vide, illisible ou hors de 10 à 1000.
  function lireIndice(saisie) {
    const s = String(saisie ?? '').replace(/[\s ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{1,3})?$/.test(s)) return null;
    const n = Number(s);
    return n >= 10 && n <= 1000 ? n : null;
  }
  const indice = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '–');
  const pct = (t, dec = 1) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${t.toFixed(dec).replace('.', ',')} %`);
  function lireEntier(saisie, mini, maxi) {
    const s = String(saisie ?? '').trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= mini && n <= maxi ? n : null;
  }

  // ---------- Trimestres IRL ----------
  const estTrimestre = (t) => typeof t === 'string' && /^\d{4}-T[1-4]$/.test(t);
  const libelleTrimestre = (t) => (estTrimestre(t) ? `${t.slice(6)}${t.slice(6) === '1' ? 'er' : 'e'} trimestre ${t.slice(0, 4)}` : '–');
  const trimestreDecale = (t, annees) => `${Number(t.slice(0, 4)) + annees}${t.slice(4)}`;
  const valeurIrl = (irl, t) => { const v = (irl || []).find((x) => x.trimestre === t); return v && Number.isFinite(v.valeur) ? v.valeur : null; };
  // Nouveau loyer = loyer × nouvel indice ÷ ancien indice, arrondi au centime (art. 17-1, formule de service-public.gouv.fr).
  function loyerRevise(loyer, ancien, nouveau) {
    if (!Number.isFinite(ancien) || !Number.isFinite(nouveau) || ancien <= 0 || nouveau <= 0) return null;
    return Math.round((loyer * nouveau) / ancien);
  }

  // ---------- Bail : loyer en vigueur, échéances ----------
  const bailDe = (etat, id) => (etat.baux || []).find((b) => b.id === id) || null;
  const bienDe = (etat, id) => (etat.biens || []).find((b) => b.id === id) || null;
  const finEffective = (b) => b.sortie || b.fin || null; // dernier jour d'occupation
  const actifLe = (b, d) => b.debut <= d && (!finEffective(b) || finEffective(b) >= d);
  const modifsTriees = (b) => [...(b.modifs || [])].sort((x, y) => x.date.localeCompare(y.date));
  // Loyer hors charges et charges en vigueur à une date : dernière modification datée au plus tard ce jour-là.
  function loyerA(b, d) {
    let loyer = b.loyerHC, charges = b.charges;
    for (const m of modifsTriees(b)) {
      if (m.date > d) break;
      if (Number.isFinite(m.loyerHC)) loyer = m.loyerHC;
      if (Number.isFinite(m.charges)) charges = m.charges;
    }
    return { loyerHC: loyer, charges };
  }
  // Date d'échéance du mois : jour d'échéance du bail (borné à la fin du mois), jamais avant l'entrée.
  function echeance(b, mois) {
    const j = Math.min(b.jourEcheance || 1, joursDansMois(Number(mois.slice(0, 4)), Number(mois.slice(5, 7))));
    return max(`${mois}-${deux(j)}`, b.debut);
  }
  // Part du mois occupée (prorata des jours calendaires) : 1 pour un mois entier.
  function prorata(b, mois) {
    const debutMois = `${mois}-01`, fin = finMois(mois);
    const de = max(b.debut, debutMois), a = min(finEffective(b) || fin, fin);
    if (a < de) return 0;
    return (ecart(de, a) + 1) / joursDansMois(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)));
  }
  // Échéances mensuelles jusqu'au mois « jusqua » inclus, puis les régularisations de charges appliquées.
  function echeances(b, jusqua) {
    if (!b || !estDate(b.debut)) return [];
    const dernier = finEffective(b) ? min(finEffective(b).slice(0, 7), jusqua) : jusqua;
    const l = listeMois(b.debut.slice(0, 7), dernier).map((mois) => {
      const date = echeance(b, mois);
      const v = loyerA(b, date);
      const p = prorata(b, mois);
      const loyer = Math.round(v.loyerHC * p), charges = Math.round(v.charges * p);
      return { id: `m-${mois}`, type: 'loyer', mois, date, loyer, charges, montant: loyer + charges, prorata: p };
    }).filter((x) => x.prorata > 0);
    for (const r of b.reguls || []) {
      if (r.montant > 0 && r.date.slice(0, 7) <= jusqua) l.push({ id: `r-${r.id}`, type: 'regul', mois: r.date.slice(0, 7), date: r.date, loyer: 0, charges: r.montant, montant: r.montant, annee: r.annee });
    }
    return l.sort((x, y) => x.date.localeCompare(y.date) || (x.type === 'loyer' ? -1 : 1));
  }
  // Crédits : paiements du locataire et remboursements de charges dus (régularisation négative).
  function credits(etat, b) {
    const p = (etat.paiements || []).filter((x) => x.bail === b.id).map((x) => ({ id: x.id, date: x.date, montant: x.montant, type: 'paiement' }));
    for (const r of b.reguls || []) if (r.montant < 0) p.push({ id: `r-${r.id}`, date: r.date, montant: -r.montant, type: 'regul' });
    return p.sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
  }
  // Affectation FIFO : chaque crédit solde la plus ancienne échéance. Renvoie les échéances complétées
  // (paye, reste, soldeLe, part loyer et charges payées, détail des paiements) et l'avance restante.
  function affecter(dus, creds) {
    const l = dus.map((d) => ({ ...d, paye: 0, reste: d.montant, soldeLe: null, parts: [] }));
    let i = 0, avance = 0;
    for (const c of creds) {
      let r = c.montant;
      while (r > 0 && i < l.length) {
        const d = l[i];
        const x = Math.min(r, d.reste);
        d.paye += x; d.reste -= x; r -= x;
        d.parts.push({ date: c.date, montant: x, type: c.type, id: c.id });
        if (d.reste === 0) { d.soldeLe = c.date; i++; }
      }
      avance += r;
    }
    // Répartition loyer / charges de ce qui est payé, au prorata de l'échéance (pour le récapitulatif annuel).
    for (const d of l) d.partsDetail = d.parts.map((p) => { const lo = d.montant ? Math.round((p.montant * d.loyer) / d.montant) : 0; return { ...p, loyer: lo, charges: p.montant - lo }; });
    return { lignes: l, avance };
  }
  function statutLigne(d, auj, tolerance) {
    if (d.date > auj && d.reste > 0) return d.paye > 0 ? 'partiel' : 'avenir';
    if (d.reste === 0) return d.soldeLe && ecart(d.date, d.soldeLe) > tolerance ? 'payeRetard' : 'paye';
    if (ecart(d.date, auj) <= tolerance) return 'attente';
    return d.paye > 0 ? 'partiel' : 'impaye';
  }
  // Compte d'un bail à une date : lignes avec statut, total échu, payé, reste échu (impayé), avance, retard.
  function compte(etat, bailId, auj, { jusqua } = {}) {
    const b = bailDe(etat, bailId);
    if (!b) return null;
    const tol = etat.reglages?.tolerance ?? 5;
    const { lignes, avance } = affecter(echeances(b, jusqua || moisSuivant(auj.slice(0, 7))), credits(etat, b).filter((c) => c.date <= auj));
    for (const d of lignes) d.statut = statutLigne(d, auj, tol);
    const echues = lignes.filter((d) => d.date <= auj);
    const enRetard = echues.filter((d) => d.reste > 0 && ecart(d.date, auj) > tol);
    const plusAncienne = enRetard[0] || null;
    const retard = plusAncienne ? ecart(plusAncienne.date, auj) : 0;
    return {
      bail: b, lignes,
      du: echues.reduce((s, d) => s + d.montant, 0),
      paye: echues.reduce((s, d) => s + d.paye, 0),
      reste: echues.reduce((s, d) => s + d.reste, 0),
      impaye: enRetard.reduce((s, d) => s + d.reste, 0),
      enRetard, plusAncienne, retard, avance,
      palier: palier(retard, etat.reglages?.paliers),
    };
  }
  // Palier de relance (0, 1, 2) atteint pour un retard en jours ; null si aucun.
  function palier(retard, paliers = [5, 15, 30]) {
    let p = null;
    (paliers || []).forEach((j, i) => { if (retard > 0 && retard >= j) p = i; });
    return p;
  }
  // Ligne du mois « mois » d'un bail (échéance de loyer), ou null.
  const ligneDuMois = (c, mois) => c?.lignes.find((d) => d.type === 'loyer' && d.mois === mois) || null;

  // ---------- Quittance et reçu ----------
  const LIB_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const libelleMois = (m) => `${LIB_MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const dateTexte = (d) => `${Number(d.slice(8))}${d.slice(8) === '01' ? 'er' : ''} ${LIB_MOIS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  const nomsLocataires = (etat, b) => (b.locataires || []).map((id) => (etat.locataires || []).find((l) => l.id === id)?.nom).filter(Boolean).join(' et ') || 'le locataire';
  // Données d'une quittance du mois : « quittance » si l'échéance est entièrement payée, « reçu » si partielle
  // (art. 21 de la loi du 6 juillet 1989), null si rien n'est payé.
  function quittance(etat, bailId, mois, auj) {
    const c = compte(etat, bailId, auj, { jusqua: max(mois, auj.slice(0, 7)) });
    const d = ligneDuMois(c, mois);
    if (!d || d.paye <= 0) return null;
    const b = c.bail, bien = bienDe(etat, b.bien);
    const debut = max(`${mois}-01`, b.debut), fin = min(finMois(mois), finEffective(b) || finMois(mois));
    const recu = d.reste > 0;
    const pd = d.partsDetail.filter((p) => p.type === 'paiement');
    return {
      type: recu ? 'recu' : 'quittance', mois, debut, fin,
      bailleur: etat.bailleur?.nom || '', adresseBailleur: etat.bailleur?.adresse || '',
      locataires: nomsLocataires(etat, b), adresse: bien?.adresse || bien?.nom || '',
      loyer: d.loyer, charges: d.charges, montant: d.montant, paye: d.paye, reste: d.reste,
      payeLoyer: d.partsDetail.reduce((s, p) => s + p.loyer, 0), payeCharges: d.partsDetail.reduce((s, p) => s + p.charges, 0),
      datePaiement: pd.length ? pd.at(-1).date : d.soldeLe, forfait: b.modeCharges === 'forfait', faitLe: auj,
    };
  }
  function texteQuittance(q) {
    if (!q) return '';
    const titre = q.type === 'recu' ? `REÇU DE PAIEMENT PARTIEL · ${libelleMois(q.mois).toUpperCase()}` : `QUITTANCE DE LOYER · ${libelleMois(q.mois).toUpperCase()}`;
    const ch = q.forfait ? 'Forfait de charges' : 'Provision sur charges';
    const l = [titre, '',
      `Bailleur : ${q.bailleur || '[ton nom]'}${q.adresseBailleur ? `, ${q.adresseBailleur}` : ''}`,
      `Locataire : ${q.locataires}`,
      `Logement : ${q.adresse}`,
      `Période : du ${dateTexte(q.debut)} au ${dateTexte(q.fin)}`, ''];
    if (q.type === 'quittance') {
      l.push(`Je soussigné(e) ${q.bailleur || '[ton nom]'}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${q.locataires} la somme de ${euros(q.montant)} au titre du loyer et des charges de la période ci-dessus, et lui en donne quittance, sous réserve de tous mes droits.`, '',
        `Loyer hors charges : ${euros(q.loyer)}`, `${ch} : ${euros(q.charges)}`, `Total payé : ${euros(q.montant)}`);
    } else {
      l.push(`Je soussigné(e) ${q.bailleur || '[ton nom]'}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${q.locataires} la somme de ${euros(q.paye)}, en paiement partiel du loyer et des charges de la période ci-dessus (total dû ${euros(q.montant)}). Ce reçu ne vaut pas quittance. Reste dû : ${euros(q.reste)}.`, '',
        `Dont loyer hors charges : ${euros(q.payeLoyer)}`, `Dont ${ch.toLowerCase()} : ${euros(q.payeCharges)}`);
    }
    if (q.datePaiement) l.push(`Date du paiement : ${dateTexte(q.datePaiement)}`);
    l.push('', `Fait le ${dateTexte(q.faitLe)}`, 'Signature du bailleur :', '', 'Document remis gratuitement (art. 21 de la loi du 6 juillet 1989).');
    return l.join('\n');
  }

  // ---------- Relances ----------
  function remplir(modele, v) { return String(modele || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)); }
  function texteRelance(etat, bailId, niveau, modeles, auj) {
    const c = compte(etat, bailId, auj);
    if (!c || !c.enRetard.length) return null;
    const b = c.bail, bien = bienDe(etat, b.bien);
    const m = modeles[Math.max(0, Math.min(modeles.length - 1, niveau))];
    const detail = c.enRetard.map((d) => `- ${d.type === 'regul' ? `Régularisation des charges ${d.annee || ''}`.trim() : `Loyer et charges de ${libelleMois(d.mois)}`} (échéance du ${dateTexte(d.date)}) : ${euros(d.reste)}${d.paye ? ` restant sur ${euros(d.montant)}` : ''}`).join('\n');
    const v = { locataire: nomsLocataires(etat, b), adresse: bien?.adresse || bien?.nom || '', montant: euros(c.impaye), mois: c.plusAncienne.type === 'regul' ? 'la régularisation des charges' : libelleMois(c.plusAncienne.mois), depuis: dateTexte(c.plusAncienne.date), bailleur: etat.bailleur?.nom || '[ton nom]', date: dateTexte(auj), detail };
    return { objet: remplir(m.objet, v), texte: remplir(m.texte, v), titre: m.titre, note: m.note || '' };
  }

  // ---------- Révisions annuelles ----------
  // Échéancier des révisions d'un bail : une par anniversaire de la date d'effet, jusqu'à la prochaine à venir.
  // Formule : loyer en vigueur × IRL(trimestre, année) ÷ IRL(même trimestre, année précédente).
  function revisions(etat, bailId, auj) {
    const b = bailDe(etat, bailId);
    if (!b || !estDate(b.debut)) return [];
    const reg = etat.reglages || {};
    const bien = bienDe(etat, b.bien);
    const dpe = ['F', 'G'].includes(bien?.dpe) && (b.signeLe || b.debut) >= (reg.dateGelDpe || '2022-08-24');
    const limiteMois = reg.limiteRevisionMois ?? 12;
    const l = [];
    const fin = finEffective(b);
    for (let k = 1; k < 100; k++) {
      const date = ajoutMois(b.debut, 12 * k);
      if (fin && date > fin) break;
      const tr = estTrimestre(b.trimestreIrl) ? trimestreDecale(b.trimestreIrl, k) : null;
      const trAncien = tr ? trimestreDecale(tr, -1) : null;
      const ancien = trAncien ? valeurIrl(etat.irl, trAncien) : null;
      const nouveau = tr ? valeurIrl(etat.irl, tr) : null;
      const limite = ajout(ajoutMois(date, limiteMois), -1);
      const faite = (b.modifs || []).find((m) => m.motif === 'revision' && m.revisionDe === date) || null;
      const base = loyerA(b, ajout(date, -1)).loyerHC;
      const calcule = loyerRevise(base, ancien, nouveau);
      let statut;
      if (!b.clauseRevision) statut = 'sansClause';
      else if (faite) statut = 'appliquee';
      else if (dpe) statut = 'dpe';
      else if (auj > limite) statut = 'perdue';
      else if (ecart(auj, date) > 45) statut = 'avenir';
      else if (calcule === null) statut = 'irlManquant';
      else statut = 'aFaire';
      l.push({ date, limite, trimestre: tr, trimestreAncien: trAncien, ancien, nouveau, base, loyer: faite ? faite.loyerHC : calcule, hausse: calcule !== null ? calcule - base : null, statut, appliqueeLe: faite?.date || null, modif: faite?.id || null });
      if (date > auj) break;
    }
    return l;
  }
  // Révision à appliquer : modification datée (date de la demande, jamais avant la date de révision).
  function appliquerRevision(b, rev, dateDemande) {
    if (!rev || rev.loyer === null || !estDate(dateDemande)) return null;
    const date = max(dateDemande, rev.date);
    if (date > rev.limite) return null;
    return { date, loyerHC: rev.loyer, charges: null, motif: 'revision', revisionDe: rev.date, trimestre: rev.trimestre, ancien: rev.ancien, nouveau: rev.nouveau };
  }

  // ---------- Régularisation des charges ----------
  const joursAnnee = (a) => ecart(`${a}-01-01`, `${a + 1}-01-01`);
  // Jours d'occupation d'un bail dans une année civile.
  function joursOccupes(b, annee) {
    const de = max(b.debut, `${annee}-01-01`), a = min(finEffective(b) || `${annee}-12-31`, `${annee}-12-31`);
    return a < de ? 0 : ecart(de, a) + 1;
  }
  // Provisions appelées sur l'année (échéances de loyer) comparées au réel récupérable du bien, au prorata
  // des jours d'occupation de ce bail. Solde > 0 : complément dû par le locataire ; < 0 : à lui rembourser.
  function regularisation(etat, bailId, annee) {
    const b = bailDe(etat, bailId);
    if (!b) return null;
    const jours = joursOccupes(b, annee);
    const part = jours / joursAnnee(annee);
    const provisions = echeances({ ...b, reguls: [] }, `${annee}-12`).filter((d) => d.mois.startsWith(`${annee}-`)).reduce((s, d) => s + d.charges, 0);
    const deps = (etat.depenses || []).filter((d) => d.bien === b.bien && d.date.startsWith(`${annee}-`) && d.recuperable > 0);
    const reelBien = deps.reduce((s, d) => s + d.recuperable, 0);
    const reel = Math.round(reelBien * part);
    const deja = (b.reguls || []).find((r) => r.annee === annee) || null;
    return { annee, forfait: b.modeCharges === 'forfait', jours, part, provisions, reelBien, reel, solde: reel - provisions, depenses: deps, appliquee: deja };
  }
  // Nouvelle provision mensuelle proposée : réel de l'année ramené à 12 mois d'occupation, arrondi à l'euro.
  const provisionProposee = (rg) => (rg && rg.jours ? Math.round((rg.reel * 365) / rg.jours / 12 / 100) * 100 : null);

  // ---------- Dépôt de garantie ----------
  function depot(etat, b) {
    const reg = etat.reglages || {};
    const mois = b.type === 'meuble' ? (reg.depotMoisMeuble ?? 2) : (reg.depotMoisNu ?? 1);
    const plafond = b.loyerHC * mois;
    const res = { montant: b.depot || 0, plafond, mois, depasse: (b.depot || 0) > plafond, limite: null, retardMois: 0, penalite: 0, restitue: b.restitution || null };
    if (b.sortie) {
      const delai = b.edlConforme === false ? (reg.restitutionNonConforme ?? 2) : (reg.restitutionConforme ?? 1);
      res.limite = ajoutMois(b.sortie, delai);
      res.delai = delai;
    }
    return res;
  }
  // Retard de restitution à une date : mois commencés après la limite, pénalité de 10 % du loyer HC par mois.
  function retardRestitution(etat, b, auj) {
    const d = depot(etat, b);
    if (!d.limite || !d.montant) return { ...d, retardMois: 0, penalite: 0 };
    const jusqua = d.restitue?.date || auj;
    if (jusqua <= d.limite) return { ...d, retardMois: 0, penalite: 0 };
    let n = 0;
    while (ajoutMois(d.limite, n) < jusqua && n < 240) n++;
    const pctR = etat.reglages?.penaliteRetardPct ?? 10;
    return { ...d, retardMois: n, penalite: Math.round((b.loyerHC * pctR * n) / 100) };
  }

  // ---------- Rendement (avant impôt) ----------
  // Brut : loyers hors charges sur 12 mois ÷ prix de revient (prix + frais + travaux d'acquisition).
  // Net : (loyers − charges annuelles non récupérables du bien) ÷ prix de revient. Hors crédit et hors impôt.
  // Avec crédit : effort ou excédent mensuel = (loyers − charges non récupérables − mensualités × 12) ÷ 12.
  function rendement(etat, bienId, auj) {
    const bien = bienDe(etat, bienId);
    if (!bien) return null;
    const bail = (etat.baux || []).filter((b) => b.bien === bienId && actifLe(b, auj)).sort((x, y) => y.debut.localeCompare(x.debut))[0] || null;
    const loyers = bail ? loyerA(bail, auj).loyerHC * 12 : 0;
    const prix = (bien.prixAchat || 0) + (bien.fraisAchat || 0) + (bien.travauxAchat || 0);
    const charges = (bien.coproNonRecup || 0) + (bien.taxeFonciere || 0) + (bien.assurance || 0) + (bien.autresCharges || 0);
    const credit = bien.credit && bien.credit.mensualite > 0 && (!bien.credit.fin || bien.credit.fin >= auj) ? bien.credit.mensualite : 0;
    return {
      bien, bail, loyers, prix, charges, credit,
      brut: prix > 0 && loyers > 0 ? (loyers / prix) * 100 : null,
      net: prix > 0 && loyers > 0 ? ((loyers - charges) / prix) * 100 : null,
      mensuel: Math.round((loyers - charges - credit * 12) / 12),
      vacant: !bail,
    };
  }

  // ---------- Récapitulatif annuel (aide à la déclaration, aucun calcul d'impôt) ----------
  function recapAnnuel(etat, annee, auj) {
    const parBien = (etat.biens || []).map((bien) => {
      let loyers = 0, charges = 0;
      for (const b of (etat.baux || []).filter((x) => x.bien === bien.id)) {
        const c = compte(etat, b.id, max(auj, `${annee}-12-31`), { jusqua: max(`${annee}-12`, auj.slice(0, 7)) });
        for (const d of c.lignes) for (const p of d.partsDetail) if (p.type === 'paiement' && p.date.startsWith(`${annee}-`)) { loyers += p.loyer; charges += p.charges; }
      }
      const deps = (etat.depenses || []).filter((d) => d.bien === bien.id && d.date.startsWith(`${annee}-`));
      const cats = {};
      for (const d of deps) {
        const x = cats[d.categorie] || (cats[d.categorie] = { total: 0, recuperable: 0, n: 0 });
        x.total += d.montant; x.recuperable += d.recuperable || 0; x.n += 1;
      }
      return { bien, loyers, charges, encaisse: loyers + charges, depenses: deps.reduce((s, d) => s + d.montant, 0), recuperable: deps.reduce((s, d) => s + (d.recuperable || 0), 0), cats };
    });
    const tot = (k) => parBien.reduce((s, x) => s + x[k], 0);
    return { annee, parBien, loyers: tot('loyers'), charges: tot('charges'), encaisse: tot('encaisse'), depenses: tot('depenses'), recuperable: tot('recuperable') };
  }

  // ---------- Synthèse du tableau de bord ----------
  function synthese(etat, auj) {
    const mois = auj.slice(0, 7);
    const baux = (etat.baux || []).filter((b) => (etat.biens || []).some((x) => x.id === b.bien));
    const comptes = baux.map((b) => compte(etat, b.id, auj));
    const actifs = comptes.filter((c) => actifLe(c.bail, auj) || ligneDuMois(c, mois));
    const lignesMois = actifs.map((c) => ({ c, d: ligneDuMois(c, mois) })).filter((x) => x.d);
    const attenduMois = lignesMois.reduce((s, x) => s + x.d.montant, 0);
    const encaisseMois = (etat.paiements || []).filter((p) => p.date.startsWith(mois) && p.date <= auj && baux.some((b) => b.id === p.bail)).reduce((s, p) => s + p.montant, 0);
    const retards = comptes.filter((c) => c.impaye > 0).sort((x, y) => y.retard - x.retard);
    const revs = baux.filter((b) => !finEffective(b) || finEffective(b) >= auj).flatMap((b) => revisions(etat, b.id, auj).filter((r) => ['aFaire', 'irlManquant'].includes(r.statut)).map((r) => ({ ...r, bail: b })));
    const depots = baux.filter((b) => b.sortie && b.depot > 0 && !b.restitution).map((b) => ({ bail: b, ...retardRestitution(etat, b, auj) }));
    const finsBail = baux.filter((b) => b.fin && !b.sortie && b.fin >= auj && ecart(auj, b.fin) <= 120).map((b) => ({ bail: b, date: b.fin }));
    const biensVacants = (etat.biens || []).filter((bien) => !baux.some((b) => b.bien === bien.id && actifLe(b, auj)));
    return { mois, comptes, actifs, lignesMois, attenduMois, encaisseMois, retards, impaye: retards.reduce((s, c) => s + c.impaye, 0), revs, depots, finsBail, biensVacants };
  }

  // ---------- Normalisation (tolérante aux anciennes versions) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const cts = (v, defaut = 0) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? defaut : Math.round(Number(v)));
  const ctsPos = (v, defaut = 0) => { const n = cts(v, defaut); return n === null ? null : Math.max(0, n); };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const lst = (v) => (Array.isArray(v) ? v : []);

  function normaliserBien(x, i = 0) {
    const b = x && typeof x === 'object' ? x : {};
    const cr = b.credit && typeof b.credit === 'object' ? b.credit : null;
    return {
      id: texte(b.id, 40) || nouvelId(), nom: texte(b.nom, 60).trim() || `Bien ${i + 1}`, adresse: texte(b.adresse, 160),
      type: texte(b.type, 40), surface: entier(b.surface, 0, 10000, 0), dpe: DPE.includes(b.dpe) ? b.dpe : '',
      dateAchat: dateOuNull(b.dateAchat), prixAchat: ctsPos(b.prixAchat), fraisAchat: ctsPos(b.fraisAchat), travauxAchat: ctsPos(b.travauxAchat),
      coproAnnuel: ctsPos(b.coproAnnuel), coproNonRecup: ctsPos(b.coproNonRecup), taxeFonciere: ctsPos(b.taxeFonciere), assurance: ctsPos(b.assurance), autresCharges: ctsPos(b.autresCharges),
      credit: cr && ctsPos(cr.mensualite) > 0 ? { mensualite: ctsPos(cr.mensualite), fin: dateOuNull(cr.fin), capital: ctsPos(cr.capital) } : null,
      note: texte(b.note, 300),
    };
  }
  function normaliserLocataire(x) {
    const l = x && typeof x === 'object' ? x : {};
    return { id: texte(l.id, 40) || nouvelId(), nom: texte(l.nom, 80).trim() || 'Locataire', contact: texte(l.contact, 120), efface: !!l.efface };
  }
  function normaliserModif(m) {
    return { id: texte(m?.id, 40) || nouvelId(), date: dateOuNull(m?.date) || '1970-01-01', loyerHC: Number.isFinite(m?.loyerHC) ? ctsPos(m.loyerHC) : null, charges: Number.isFinite(m?.charges) ? ctsPos(m.charges) : null, motif: ['revision', 'regularisation', 'autre'].includes(m?.motif) ? m.motif : 'autre', revisionDe: dateOuNull(m?.revisionDe), trimestre: estTrimestre(m?.trimestre) ? m.trimestre : null, ancien: Number.isFinite(m?.ancien) ? m.ancien : null, nouveau: Number.isFinite(m?.nouveau) ? m.nouveau : null };
  }
  function normaliserBail(x, auj) {
    const b = x && typeof x === 'object' ? x : {};
    const debut = dateOuNull(b.debut) || auj;
    const fin = dateOuNull(b.fin), sortie = dateOuNull(b.sortie);
    return {
      id: texte(b.id, 40) || nouvelId(), bien: texte(b.bien, 40), locataires: lst(b.locataires).map((v) => texte(v, 40)).filter(Boolean).slice(0, 6),
      type: TYPES_BAIL.includes(b.type) ? b.type : 'nu', debut, signeLe: dateOuNull(b.signeLe), fin: fin && fin >= debut ? fin : null, sortie: sortie && sortie >= debut ? sortie : null,
      loyerHC: ctsPos(b.loyerHC), charges: ctsPos(b.charges), modeCharges: MODES_CHARGES.includes(b.modeCharges) ? b.modeCharges : 'provisions',
      depot: ctsPos(b.depot), jourEcheance: entier(b.jourEcheance, 1, 28, 1),
      clauseRevision: b.clauseRevision === undefined ? true : !!b.clauseRevision, trimestreIrl: estTrimestre(b.trimestreIrl) ? b.trimestreIrl : null,
      modifs: lst(b.modifs).map(normaliserModif),
      reguls: lst(b.reguls).map((r) => ({ id: texte(r?.id, 40) || nouvelId(), annee: entier(r?.annee, 1990, 2200, 2000), date: dateOuNull(r?.date) || debut, montant: cts(r?.montant) })).filter((r) => r.montant !== 0),
      relances: lst(b.relances).map((r) => ({ date: dateOuNull(r?.date) || debut, niveau: entier(r?.niveau, 0, 2, 0) })),
      edlConforme: b.edlConforme === false ? false : b.edlConforme === true ? true : null,
      restitution: b.restitution && estDate(b.restitution.date) ? { date: b.restitution.date, montant: ctsPos(b.restitution.montant), retenue: texte(b.restitution.retenue, 200) } : null,
      note: texte(b.note, 300),
    };
  }
  function normaliserPaiement(x, auj) {
    const p = x && typeof x === 'object' ? x : {};
    return { id: texte(p.id, 40) || nouvelId(), bail: texte(p.bail, 40), date: dateOuNull(p.date) || auj, montant: ctsPos(p.montant), mode: texte(p.mode, 20) || 'virement', note: texte(p.note, 120) };
  }
  function normaliserDepense(x, auj) {
    const d = x && typeof x === 'object' ? x : {};
    const montant = ctsPos(d.montant);
    return { id: texte(d.id, 40) || nouvelId(), bien: texte(d.bien, 40), date: dateOuNull(d.date) || auj, categorie: texte(d.categorie, 30) || 'autre', libelle: texte(d.libelle, 120), montant, recuperable: Math.min(montant, ctsPos(d.recuperable)) };
  }
  function etatVide(defauts = {}) {
    const d = JSON.parse(JSON.stringify(defauts));
    return { version: 1, bailleur: { nom: '', adresse: '' }, reglages: { ...(d.reglages || {}) }, irl: [], biens: [], locataires: [], baux: [], paiements: [], depenses: [] };
  }
  function normaliserReglages(r, dv) {
    const x = r && typeof r === 'object' ? r : {};
    const p = lst(x.paliers).map((n) => entier(n, 1, 365, null)).filter((n) => n !== null);
    return {
      tolerance: entier(x.tolerance, 0, 60, dv.tolerance ?? 5),
      paliers: p.length === 3 && p[0] < p[1] && p[1] < p[2] ? p : (dv.paliers || [5, 15, 30]),
      depotMoisNu: entier(x.depotMoisNu, 0, 6, dv.depotMoisNu ?? 1), depotMoisMeuble: entier(x.depotMoisMeuble, 0, 6, dv.depotMoisMeuble ?? 2),
      restitutionConforme: entier(x.restitutionConforme, 0, 12, dv.restitutionConforme ?? 1), restitutionNonConforme: entier(x.restitutionNonConforme, 0, 12, dv.restitutionNonConforme ?? 2),
      penaliteRetardPct: entier(x.penaliteRetardPct, 0, 100, dv.penaliteRetardPct ?? 10),
      dateGelDpe: dateOuNull(x.dateGelDpe) || dv.dateGelDpe || '2022-08-24',
      limiteRevisionMois: entier(x.limiteRevisionMois, 1, 60, dv.limiteRevisionMois ?? 12),
      verifieLe: dateOuNull(x.verifieLe) || dv.verifieLe || null,
    };
  }
  function normaliser(d, auj, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return { ...v, reglages: normaliserReglages({}, v.reglages) };
    const irl = [];
    for (const x of lst(d.irl)) if (estTrimestre(x?.trimestre) && Number.isFinite(x?.valeur) && !irl.some((y) => y.trimestre === x.trimestre)) irl.push({ trimestre: x.trimestre, valeur: x.valeur, note: texte(x.note, 80) });
    irl.sort((a, b) => a.trimestre.localeCompare(b.trimestre));
    return {
      version: 1, ...(d.majLe ? { majLe: d.majLe } : {}),
      bailleur: { nom: texte(d.bailleur?.nom, 80), adresse: texte(d.bailleur?.adresse, 160) },
      reglages: normaliserReglages(d.reglages, v.reglages),
      irl,
      biens: lst(d.biens).slice(0, 50).map(normaliserBien),
      locataires: lst(d.locataires).map(normaliserLocataire),
      baux: lst(d.baux).map((x) => normaliserBail(x, auj)),
      paiements: lst(d.paiements).map((x) => normaliserPaiement(x, auj)).filter((p) => p.montant > 0),
      depenses: lst(d.depenses).map((x) => normaliserDepense(x, auj)).filter((p) => p.montant > 0),
    };
  }

  // ---------- RGPD : données des locataires ----------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Effacement : le nom devient « Locataire effacé n », le contact est vidé, les notes des paiements et des
  // baux aussi ; dates et montants restent (comptabilité du bailleur). Renvoie un nouvel état.
  function effacerLocataire(etat, id, n = 1) {
    const e = clone(etat);
    const l = e.locataires.find((x) => x.id === id);
    if (!l) return e;
    Object.assign(l, { nom: `Locataire effacé ${n}`, contact: '', efface: true });
    const baux = e.baux.filter((b) => b.locataires.includes(id));
    for (const b of baux) { b.note = ''; if (b.restitution) b.restitution.retenue = ''; }
    for (const p of e.paiements) if (baux.some((b) => b.id === p.bail)) p.note = '';
    return e;
  }
  // Suppression : retire le locataire des baux (un bail sans locataire reste, avec ses montants).
  function supprimerLocataire(etat, id) {
    const e = clone(etat);
    e.locataires = e.locataires.filter((x) => x.id !== id);
    for (const b of e.baux) b.locataires = b.locataires.filter((x) => x !== id);
    return e;
  }
  // Droit d'accès : la fiche, les baux, les échéances et les paiements du locataire.
  function donneesLocataire(etat, id, auj) {
    const l = etat.locataires.find((x) => x.id === id);
    if (!l) return null;
    const baux = etat.baux.filter((b) => b.locataires.includes(id));
    return {
      exporteLe: auj, locataire: { nom: l.nom, contact: l.contact },
      baux: baux.map((b) => {
        const c = compte(etat, b.id, auj);
        return {
          logement: bienDe(etat, b.bien)?.adresse || bienDe(etat, b.bien)?.nom || '', type: LIB_TYPE[b.type], debut: b.debut, fin: b.fin, sortie: b.sortie,
          loyerHC: b.loyerHC / 100, charges: b.charges / 100, depot: b.depot / 100,
          echeances: c.lignes.map((d) => ({ date: d.date, montant: d.montant / 100, paye: d.paye / 100, statut: LIB_STATUT[d.statut] })),
          paiements: etat.paiements.filter((p) => p.bail === b.id).map((p) => ({ date: p.date, montant: p.montant / 100, mode: p.mode, note: p.note })),
        };
      }),
    };
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const montantCsv = (c) => (Number.isFinite(c) ? (c / 100).toFixed(2).replace('.', ',') : '');
  function versCsv(etat, auj) {
    const tete = ['Bien', 'Locataire', 'Type', 'Échéance', 'Mois', 'Nature', 'Loyer HC', 'Charges', 'Total dû', 'Payé', 'Reste', 'Statut', 'Soldé le'];
    const lignes = [];
    for (const b of etat.baux) {
      const c = compte(etat, b.id, auj);
      const bien = bienDe(etat, b.bien);
      for (const d of c.lignes) lignes.push([bien?.nom || '', nomsLocataires(etat, b), LIB_TYPE[b.type], d.date, d.mois, d.type === 'regul' ? 'Régularisation des charges' : 'Loyer', montantCsv(d.loyer), montantCsv(d.charges), montantCsv(d.montant), montantCsv(d.paye), montantCsv(d.reste), LIB_STATUT[d.statut], d.soldeLe || '']);
    }
    lignes.sort((x, y) => String(x[3]).localeCompare(String(y[3])));
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }
  function depensesCsv(etat, categories) {
    const nomCat = (id) => (categories || []).find((c) => c.id === id)?.nom || id;
    const tete = ['Bien', 'Date', 'Catégorie', 'Libellé', 'Montant', 'Part récupérable'];
    const lignes = [...etat.depenses].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [bienDe(etat, d.bien)?.nom || '', d.date, nomCat(d.categorie), d.libelle, montantCsv(d.montant), montantCsv(d.recuperable)]);
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.GST = {
    TYPES_BAIL, LIB_TYPE, MODES_CHARGES, LIB_STATUT, LIB_REVISION, DPE, LIB_MOIS,
    iso, versDate, ajout, ecart, joursDansMois, estDate, estMois, ajoutMois, moisSuivant, finMois, listeMois,
    lireMontant, euros, saisieMontant, lireIndice, indice, pct, lireEntier,
    estTrimestre, libelleTrimestre, trimestreDecale, valeurIrl, loyerRevise,
    bailDe, bienDe, finEffective, actifLe, loyerA, echeance, prorata, echeances, credits, affecter, statutLigne, compte, palier, ligneDuMois,
    libelleMois, dateTexte, nomsLocataires, quittance, texteQuittance, remplir, texteRelance,
    revisions, appliquerRevision, joursOccupes, regularisation, provisionProposee, depot, retardRestitution, rendement, recapAnnuel, synthese,
    nouvelId, normaliserBien, normaliserLocataire, normaliserBail, normaliserPaiement, normaliserDepense, normaliserReglages, normaliser, etatVide,
    effacerLocataire, supprimerLocataire, donneesLocataire, versCsv, depensesCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
