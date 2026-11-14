// Suivi de TVA QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.TVA) et par les tests Node (outils/templates/tva.test.mjs).
// Dates locales « AAAA-MM-JJ ». Montants en euros dans l'état, calculs en centimes entiers (aucune erreur
// d'arrondi flottant). Tout ce qui dépend du jour présent reçoit `aujourdhui` : rien n'est lu dans l'horloge.
// Outil d'aide au suivi : ces règles additionnent, comparent et signalent, elles ne remplacent ni la
// déclaration officielle ni l'avis d'un expert-comptable.
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const debutMois = (s) => `${s.slice(0, 7)}-01`;
  const ajoutMois = (s, n) => { const a = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)) - 1 + n; return `${a + Math.floor(m / 12)}-${deux(((m % 12) + 12) % 12 + 1)}-01`; };
  const finMois = (s) => ajout(ajoutMois(debutMois(s), 1), -1);
  const jourDansMois = (mois, jour) => { const f = finMois(mois); return `${mois.slice(0, 7)}-${deux(Math.min(Number(jour) || 1, Number(f.slice(8, 10))))}`; };
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateCourte = (s) => `${deux(versDate(s).getDate())}/${deux(versDate(s).getMonth() + 1)}/${s.slice(0, 4)}`;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // Jours fériés (France métropolitaine, Code du travail art. L3133-1) pour le report des échéances.
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - gg + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  const cacheFeries = new Map();
  function feries(annee) {
    if (!cacheFeries.has(annee)) {
      const p = paques(annee);
      cacheFeries.set(annee, new Set([`${annee}-01-01`, ajout(p, 1), `${annee}-05-01`, `${annee}-05-08`, ajout(p, 39), ajout(p, 50), `${annee}-07-14`, `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`]));
    }
    return cacheFeries.get(annee);
  }
  const ouvrable = (s) => { const j = versDate(s).getDay(); return j !== 0 && j !== 6 && !feries(Number(s.slice(0, 4))).has(s); };
  // Échéance tombant un samedi, un dimanche ou un jour férié : reportée au premier jour ouvrable suivant.
  function reporter(s) { let d = s; for (let i = 0; i < 10 && !ouvrable(d); i++) d = ajout(d, 1); return d; }
  // Deuxième jour ouvré (lundi à vendredi, hors fériés) suivant le 1er mai : date limite de la CA12 d'un
  // exercice clos le 31 décembre (5 mai en 2026, 4 mai en 2027).
  function deuxiemeJourOuvreMai(annee) {
    let d = `${annee}-05-01`, n = 0;
    while (n < 2) { d = ajout(d, 1); if (ouvrable(d)) n++; }
    return d;
  }

  // ---------- Montants (centimes entiers) ----------
  const cts = (x) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) : 0; };
  const eur = (c) => c / 100;
  const arrondi = (x) => eur(cts(x));
  // Taux en pour cent avec au plus deux décimales (20, 5,5, 2,1) → entier en centièmes de point.
  const tauxCent = (t) => Math.round(Number(t) * 100);
  // Arrondi au centime le plus proche, demi-centime vers l'extérieur, en arithmétique entière.
  const divArrondi = (n, d) => (n >= 0 ? Math.floor((n + d / 2) / d) : -Math.floor((-n + d / 2) / d));
  const tvaDeHt = (htC, taux) => divArrondi(htC * tauxCent(taux), 10000);
  // Calcul HT ↔ TTC au centime. `depuis` : 'ht' ou 'ttc'.
  function calculer(depuis, montant, taux) {
    if (depuis === 'ttc') {
      const ttcC = cts(montant);
      const htC = divArrondi(ttcC * 10000, 10000 + tauxCent(taux));
      return { ht: eur(htC), tva: eur(ttcC - htC), ttc: eur(ttcC) };
    }
    const htC = cts(montant), tvaC = tvaDeHt(htC, taux);
    return { ht: eur(htC), tva: eur(tvaC), ttc: eur(htC + tvaC) };
  }
  // Écarts d'une opération saisie : TVA attendue (HT × taux) et cohérence HT + TVA = TTC.
  function ecartsOperation(op, tolerance = 0.01) {
    const attendue = tvaDeHt(cts(op.ht), op.taux);
    const ecartTva = cts(op.tva) - attendue;
    const ecartTtc = cts(op.ht) + cts(op.tva) - cts(op.ttc);
    return { tvaAttendue: eur(attendue), ecartTva: eur(ecartTva), ecartTtc: eur(ecartTtc), tvaKo: Math.abs(ecartTva) > cts(tolerance), ttcKo: ecartTtc !== 0 };
  }

  // ---------- Types et périodes ----------
  const TYPES = ['vente', 'achat', 'frais', 'immo'];
  const sensDe = (type) => (type === 'vente' ? 'collectee' : 'deductible');
  const REGIMES = ['mensuel', 'trimestriel', 'simplifie'];

  // Période qui contient la date, selon le régime.
  function periodeDe(reglages, date) {
    const r = reglages.regime, a = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
    if (r === 'trimestriel') {
      const t = Math.floor((m - 1) / 3);
      const debut = `${a}-${deux(t * 3 + 1)}-01`;
      return { cle: `T-${a}-${t + 1}`, debut, fin: finMois(ajoutMois(debut, 2)), libelle: `${t === 0 ? '1er' : `${t + 1}e`} trimestre ${a}`, court: `T${t + 1} ${a}` };
    }
    if (r === 'simplifie') {
      const m0 = (reglages.clotureMois % 12) + 1; // premier mois de l'exercice
      const a0 = m >= m0 ? a : a - 1;
      const debut = `${a0}-${deux(m0)}-01`, fin = finMois(ajoutMois(debut, 11));
      return { cle: `E-${debut.slice(0, 7)}`, debut, fin, libelle: m0 === 1 ? `Exercice ${a0}` : `Exercice ${dateCourte(debut)} – ${dateCourte(fin)}`, court: m0 === 1 ? String(a0) : `${debut.slice(2, 4)}-${fin.slice(2, 4)}` };
    }
    const debut = `${a}-${deux(m)}-01`;
    return { cle: `M-${a}-${deux(m)}`, debut, fin: finMois(debut), libelle: `${MOIS[m - 1]} ${a}`, court: `${MOIS_C[m - 1]} ${String(a).slice(2)}` };
  }

  // Périodes du suivi : de son début jusqu'à celle qui contient `jusqua` (ou la dernière opération).
  function periodes(etat, jusqua) {
    const r = etat.reglages;
    const dates = (etat.operations || []).map((o) => o.date).filter(Boolean);
    const debut = r.debut || dates.reduce((m, d) => (d < m ? d : m), jusqua);
    const finMax = dates.reduce((m, d) => (d > m ? d : m), jusqua);
    const l = [];
    let p = periodeDe(r, debut);
    while (l.length < 240) {
      l.push({ ...p, echeances: echeancesPeriode(r, p) });
      if (p.fin >= finMax) break;
      p = periodeDe(r, ajout(p.fin, 1));
    }
    return l;
  }

  // Échéances légales d'une période (dates reportées au jour ouvrable suivant).
  function echeancesPeriode(r, p) {
    if (r.regime !== 'simplifie') return { declaration: reporter(jourDansMois(ajoutMois(p.fin, 1), r.jourEcheance)) };
    const a1 = reporter(jourDansMois(ajoutMois(p.debut, 6), r.jourAcompte));
    const a2 = reporter(jourDansMois(ajoutMois(p.debut, 11), r.jourAcompte));
    const ca12 = r.clotureMois === 12
      ? (r.ca12Jour ? reporter(jourDansMois(`${Number(p.fin.slice(0, 4)) + 1}-${deux(r.ca12Mois)}-01`, r.ca12Jour)) : deuxiemeJourOuvreMai(Number(p.fin.slice(0, 4)) + 1))
      : reporter(finMois(ajoutMois(p.fin, r.ca12Delai)));
    return { acompte1: a1, acompte2: a2, declaration: ca12 };
  }

  const dansPeriode = (op, p) => op.date >= p.debut && op.date <= p.fin;

  // Totaux d'une liste d'opérations, en centimes, avec le détail par taux.
  function totaux(ops) {
    const t = { collectee: 0, deductibleBS: 0, deductibleImmo: 0, baseCollectee: 0, baseDeductible: 0, parTaux: new Map(), nombre: ops.length };
    for (const o of ops) {
      const tva = cts(o.tva), ht = cts(o.ht);
      const sens = sensDe(o.type);
      if (sens === 'collectee') { t.collectee += tva; t.baseCollectee += ht; } else if (o.type === 'immo') { t.deductibleImmo += tva; t.baseDeductible += ht; } else { t.deductibleBS += tva; t.baseDeductible += ht; }
      const k = `${sens}|${o.taux}`;
      const x = t.parTaux.get(k) || { sens, taux: o.taux, ht: 0, tva: 0, nombre: 0 };
      x.ht += ht; x.tva += tva; x.nombre += 1;
      t.parTaux.set(k, x);
    }
    return t;
  }

  // Bilan de chaque période, chaîné : le crédit d'une période est reporté sur la suivante (diminué du
  // remboursement demandé). Au réel simplifié, la déclaration annuelle déduit les acomptes versés.
  function bilans(etat, jusqua) {
    const r = etat.reglages, suivi = etat.suivi || {};
    const per = periodes(etat, jusqua);
    const ops = [...(etat.operations || [])].sort((a, b) => a.date.localeCompare(b.date));
    let credit = cts(r.creditInitial);
    let basePrec = null;
    return per.map((p) => {
      const t = totaux(ops.filter((o) => dansPeriode(o, p)));
      const s = suivi[p.cle] || {};
      const deductible = t.deductibleBS + t.deductibleImmo;
      const creditAnterieur = credit;
      const net = t.collectee - deductible - creditAnterieur;
      const b = {
        ...p, nombre: t.nombre,
        collectee: eur(t.collectee), deductibleBS: eur(t.deductibleBS), deductibleImmo: eur(t.deductibleImmo), deductible: eur(deductible),
        baseCollectee: eur(t.baseCollectee), baseDeductible: eur(t.baseDeductible),
        parTaux: [...t.parTaux.values()].sort((x, y) => (x.sens === y.sens ? y.taux - x.taux : x.sens === 'collectee' ? -1 : 1)).map((x) => ({ ...x, ht: eur(x.ht), tva: eur(x.tva) })),
        creditAnterieur: eur(creditAnterieur), net: eur(net), acomptes: [],
      };
      let solde = net;
      if (r.regime === 'simplifie') {
        const base = Number.isFinite(s.base) ? cts(s.base) : basePrec;
        b.baseAcomptes = base === null ? null : eur(base);
        b.dispense = base !== null && base < cts(r.dispenseAcomptes);
        const du = (pct) => (base === null || b.dispense ? 0 : divArrondi(base * Math.round(pct * 100), 10000));
        b.acomptes = [['A1', r.acompte1Pct, p.echeances.acompte1], ['A2', r.acompte2Pct, p.echeances.acompte2]].map(([k, pct, date]) => {
          const cle = `${p.cle}-${k}`, sa = suivi[cle] || {};
          const calcule = du(pct);
          const verse = Number.isFinite(sa.montant) ? cts(sa.montant) : calcule;
          return { cle, numero: k === 'A1' ? 1 : 2, pct, date, calcule: eur(calcule), verse: eur(verse) };
        });
        const totalAcomptes = b.acomptes.reduce((x, a) => x + cts(a.verse), 0);
        b.totalAcomptes = eur(totalAcomptes);
        solde = net - totalAcomptes;
        basePrec = Math.max(0, t.collectee - t.deductibleBS);
      }
      const aPayer = Math.max(0, solde), creditFin = Math.max(0, -solde);
      const rembourse = Math.min(creditFin, Math.max(0, cts(s.remboursement)));
      credit = creditFin - rembourse;
      return { ...b, solde: eur(solde), aPayer: eur(aPayer), creditFin: eur(creditFin), rembourse: eur(rembourse), creditReporte: eur(credit) };
    });
  }

  // ---------- Échéancier et pointage ----------
  // Statut d'une échéance : fait, encours (période pas finie), retard, proche (10 jours), avenir.
  function echeancier(etat, aujourdhui) {
    const suivi = etat.suivi || {};
    const l = [];
    for (const b of bilans(etat, aujourdhui)) {
      for (const a of b.acomptes || []) {
        if (!a.calcule && !Number.isFinite(suivi[a.cle]?.montant)) continue;
        l.push({ cle: a.cle, type: 'acompte', periode: b.cle, libelle: `${a.numero === 1 ? '1er' : '2e'} acompte · ${b.libelle}`, date: a.date, montant: a.calcule, finie: true });
      }
      l.push({ cle: b.cle, type: etat.reglages.regime === 'simplifie' ? 'ca12' : 'ca3', periode: b.cle, libelle: `${etat.reglages.regime === 'simplifie' ? 'CA12' : 'CA3'} · ${b.libelle}`, date: b.echeances.declaration, montant: b.aPayer, credit: b.creditFin, finie: b.fin < aujourdhui });
    }
    return l.map((e) => {
      const s = suivi[e.cle] || {};
      const montantEffectif = Number.isFinite(s.montant) ? s.montant : e.montant;
      const doitPayer = cts(montantEffectif) > 0;
      const fait = e.type === 'acompte' ? !!s.paye || !doitPayer : !!s.declare && (!doitPayer || !!s.paye);
      let statut;
      if (fait) statut = 'fait';
      else if (!e.finie) statut = 'encours';
      else if (e.date < aujourdhui) statut = 'retard';
      else if (ecart(aujourdhui, e.date) <= 10) statut = 'proche';
      else statut = 'avenir';
      return { ...e, declare: s.declare || '', paye: s.paye || '', montantDeclare: Number.isFinite(s.montant) ? s.montant : null, doitPayer, statut };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.cle.localeCompare(b.cle));
  }

  // ---------- Contrôles de cohérence ----------
  const TYPES_CONTROLE = {
    calcul: { nom: 'TVA différente de HT × taux', gravite: 'rouge' },
    total: { nom: 'HT + TVA différent du TTC', gravite: 'rouge' },
    taux: { nom: 'Taux inhabituel', gravite: 'jaune' },
    tardive: { nom: 'Saisie après la déclaration', gravite: 'rouge' },
    horsSuivi: { nom: 'Opération hors période suivie', gravite: 'jaune' },
    future: { nom: 'Opération datée dans le futur', gravite: 'jaune' },
    nonDeclaree: { nom: 'Période non déclarée', gravite: 'rouge' },
    nonPayee: { nom: 'Déclaration non payée', gravite: 'rouge' },
    acompte: { nom: 'Acompte non versé', gravite: 'rouge' },
    ecartDeclare: { nom: 'Montant déclaré différent du calcul', gravite: 'jaune' },
    creditOublie: { nom: 'Crédit reporté non utilisé', gravite: 'jaune' },
    creditDurable: { nom: 'Crédit reporté depuis plusieurs périodes', gravite: 'info' },
    deductible: { nom: 'Déductible supérieure à la collectée', gravite: 'jaune' },
    seuil: { nom: 'Seuil du trimestriel dépassé', gravite: 'jaune' },
    reforme: { nom: 'Régime simplifié : fin annoncée', gravite: 'jaune' },
    acompteBase: { nom: 'TVA de référence des acomptes à saisir', gravite: 'info' },
  };
  const ORDRE = { rouge: 0, jaune: 1, info: 2 };
  const fmtE = (x) => `${String(Number(x).toFixed(2)).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;

  function controles(etat, aujourdhui) {
    const r = etat.reglages, suivi = etat.suivi || {};
    const l = [];
    const add = (type, texte, x = {}) => l.push({ type, gravite: TYPES_CONTROLE[type].gravite, nom: TYPES_CONTROLE[type].nom, texte, ...x });
    const tauxOk = new Set(r.taux.map((t) => tauxCent(t.taux)));
    const bl = bilans(etat, aujourdhui);
    const premier = bl[0]?.debut || '';
    const periodeOp = (o) => bl.find((b) => dansPeriode(o, b));
    for (const o of etat.operations || []) {
      const e = ecartsOperation(o, r.tolerance);
      const lib = `« ${o.libelle || 'Sans libellé'} » du ${dateCourte(o.date)}`;
      if (e.tvaKo) add('calcul', `${lib} : TVA saisie ${fmtE(o.tva)}, HT × ${String(o.taux).replace('.', ',')} % donne ${fmtE(e.tvaAttendue)} (écart ${fmtE(e.ecartTva)}).`, { op: o.id, date: o.date });
      if (e.ttcKo) add('total', `${lib} : ${fmtE(o.ht)} + ${fmtE(o.tva)} ne fait pas ${fmtE(o.ttc)} (écart ${fmtE(e.ecartTtc)}).`, { op: o.id, date: o.date });
      if (!tauxOk.has(tauxCent(o.taux))) add('taux', `${lib} : taux de ${String(o.taux).replace('.', ',')} %, absent de ta liste de taux. Vérifie la facture.`, { op: o.id, date: o.date });
      if (premier && o.date < premier) add('horsSuivi', `${lib} : avant le début du suivi (${dateCourte(premier)}), elle n'est comptée dans aucune période.`, { op: o.id, date: o.date });
      if (o.date > aujourdhui) add('future', `${lib} : datée dans le futur, elle compte dans la période de cette date.`, { op: o.id, date: o.date });
      const p = periodeOp(o);
      const d = p && suivi[p.cle]?.declare;
      if (d && o.creeLe && o.creeLe > d) add('tardive', `${lib} : saisie le ${dateCourte(o.creeLe)}, après la déclaration de ${p.libelle} (${dateCourte(d)}). Elle n'y figure pas : à régulariser sur une prochaine déclaration.`, { op: o.id, date: o.date, periode: p.cle });
    }
    for (const e of echeancier(etat, aujourdhui)) {
      if (e.statut !== 'retard') continue;
      if (e.type === 'acompte') add('acompte', `${e.libelle} : ${fmtE(e.montant)} à verser avant le ${dateCourte(e.date)}, non marqué payé.`, { echeance: e.cle, periode: e.periode, date: e.date });
      else if (!e.declare) add('nonDeclaree', `${e.libelle} : échéance du ${dateCourte(e.date)} passée, déclaration non marquée.`, { echeance: e.cle, periode: e.periode, date: e.date });
      else add('nonPayee', `${e.libelle} : déclarée le ${dateCourte(e.declare)}, paiement de ${fmtE(e.montantDeclare ?? e.montant)} non marqué.`, { echeance: e.cle, periode: e.periode, date: e.date });
    }
    let suiteDed = 0, suiteCredit = 0;
    let annonceDed = false, annonceCredit = false;
    for (const b of bl) {
      const s = suivi[b.cle] || {};
      if (Number.isFinite(s.montant) && Math.abs(cts(s.montant) - cts(b.aPayer)) > cts(r.tolerance)) {
        if (cts(b.creditAnterieur) > 0 && cts(s.montant) > cts(b.aPayer)) add('creditOublie', `${b.libelle} : tu as déclaré ${fmtE(s.montant)} alors que le calcul, crédit antérieur de ${fmtE(b.creditAnterieur)} imputé, donne ${fmtE(b.aPayer)}. As-tu reporté ton crédit ?`, { periode: b.cle, date: b.fin });
        else add('ecartDeclare', `${b.libelle} : montant déclaré ${fmtE(s.montant)}, calcul ${fmtE(b.aPayer)}. Une opération manque peut-être, ou une régularisation a été faite.`, { periode: b.cle, date: b.fin });
      }
      if (b.fin >= aujourdhui) continue; // périodes closes seulement pour les tendances
      suiteDed = cts(b.deductible) > cts(b.collectee) ? suiteDed + 1 : 0;
      if (suiteDed >= r.periodesDeductible && !annonceDed) { annonceDed = true; add('deductible', `TVA déductible supérieure à la collectée sur ${suiteDed} périodes de suite (jusqu'à ${b.libelle}). Normal après un gros investissement ; sinon, vérifie les taux et le classement des opérations.`, { periode: b.cle, date: b.fin }); }
      if (suiteDed < r.periodesDeductible) annonceDed = false;
      suiteCredit = cts(b.creditReporte) > 0 ? suiteCredit + 1 : 0;
      if (suiteCredit >= r.periodesCredit && !annonceCredit) { annonceCredit = true; add('creditDurable', `Crédit de TVA reporté depuis ${suiteCredit} périodes (${fmtE(b.creditReporte)} à fin ${b.libelle}). Un remboursement peut être demandé sous conditions de montant et de délai : à vérifier avec ton expert-comptable.`, { periode: b.cle, date: b.fin }); }
      if (suiteCredit < r.periodesCredit) annonceCredit = false;
    }
    if (r.regime === 'trimestriel') {
      const clos = bl.filter((b) => b.fin < aujourdhui).slice(-4);
      const exigible = clos.reduce((x, b) => x + Math.max(0, cts(b.collectee) - cts(b.deductible)), 0);
      if (clos.length && exigible >= cts(r.seuilTrimestriel)) add('seuil', `TVA nette des ${clos.length} derniers trimestres : ${fmtE(eur(exigible))}, au-delà du seuil de ${fmtE(r.seuilTrimestriel)} pour déclarer par trimestre. En principe, la CA3 devient mensuelle : à vérifier.`, { date: clos[clos.length - 1].fin });
    }
    if (r.regime === 'simplifie') {
      const apres = bl.find((b) => b.debut >= r.finSimplifie);
      if (apres) add('reforme', `${apres.libelle} commence après le ${dateCourte(r.finSimplifie)} : la loi de finances pour 2025 supprime le régime simplifié de TVA à cette date (déclarations mensuelles ou trimestrielles). À vérifier, puis change de régime dans les réglages.`, { periode: apres.cle, date: apres.debut });
      for (const b of bl) if (b.baseAcomptes === null && b.debut <= aujourdhui) add('acompteBase', `${b.libelle} : indique la TVA due l'exercice précédent (avant TVA sur immobilisations) pour calculer les acomptes.`, { periode: b.cle, date: b.debut });
    }
    return l.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite] || String(b.date || '').localeCompare(String(a.date || '')));
  }

  // ---------- CSV ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const NOM_TYPE = { vente: 'Vente', achat: 'Achat', frais: 'Frais', immo: 'Immobilisation' };
  const ENTETE_OPS = ['Date', 'Type', 'Libellé', 'Pièce', 'Montant HT', 'Taux (%)', 'TVA', 'Montant TTC', 'Période', 'Contrôles'];

  function csvOperations(etat, aujourdhui, { debut = '0000-01-01', fin = '9999-12-31' } = {}) {
    const bl = bilans(etat, aujourdhui);
    const cf = new Map();
    for (const c of controles(etat, aujourdhui)) if (c.op) cf.set(c.op, [...(cf.get(c.op) || []), c.nom]);
    const lignes = [ENTETE_OPS];
    for (const o of [...etat.operations].sort((a, b) => a.date.localeCompare(b.date))) {
      if (o.date < debut || o.date > fin) continue;
      lignes.push([o.date, NOM_TYPE[o.type], o.libelle, o.piece || '', o.ht, o.taux, o.tva, o.ttc, bl.find((b) => dansPeriode(o, b))?.libelle || '', (cf.get(o.id) || []).join(', ')]);
    }
    return versCsv(lignes);
  }
  function csvPeriodes(etat, aujourdhui) {
    const suivi = etat.suivi || {};
    const lignes = [['Période', 'Début', 'Fin', 'Échéance', 'TVA collectée', 'TVA déductible (biens et services)', 'TVA déductible (immobilisations)', 'Crédit antérieur', 'TVA nette', 'Acomptes versés', 'À payer', 'Crédit', 'Remboursement demandé', 'Crédit reporté', 'Montant déclaré', 'Déclarée le', 'Payée le']];
    for (const b of bilans(etat, aujourdhui)) {
      const s = suivi[b.cle] || {};
      lignes.push([b.libelle, b.debut, b.fin, b.echeances.declaration, b.collectee, b.deductibleBS, b.deductibleImmo, b.creditAnterieur, b.net, b.totalAcomptes ?? '', b.aPayer, b.creditFin, b.rembourse, b.creditReporte, Number.isFinite(s.montant) ? s.montant : '', s.declare || '', s.paye || '']);
    }
    return versCsv(lignes);
  }
  const LIB_STATUT = { fait: 'Fait', encours: 'Période en cours', retard: 'En retard', proche: 'Bientôt', avenir: 'À venir' };
  function csvEcheancier(etat, aujourdhui) {
    const lignes = [['Échéance', 'Libellé', 'Montant calculé', 'Crédit', 'Montant déclaré', 'Déclarée le', 'Payée le', 'Statut']];
    for (const e of echeancier(etat, aujourdhui)) lignes.push([e.date, e.libelle, e.montant, e.credit ?? '', e.montantDeclare ?? '', e.declare, e.paye, LIB_STATUT[e.statut]]);
    return versCsv(lignes);
  }

  // Lecture d'un CSV (séparateur ; ou , ou tabulation, guillemets doublés).
  function lireCsv(texte) {
    const t = String(texte || '').replace(/^﻿/, '');
    const premiere = t.split(/\r?\n/)[0] || '';
    const sep = premiere.includes(';') ? ';' : premiere.includes('\t') ? '\t' : ',';
    const lignes = [];
    let l = [], champ = '', guil = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (guil) {
        if (ch === '"' && t[i + 1] === '"') { champ += '"'; i++; } else if (ch === '"') guil = false; else champ += ch;
      } else if (ch === '"' && champ === '') guil = true;
      else if (ch === sep) { l.push(champ); champ = ''; } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        l.push(champ); champ = '';
        if (l.some((x) => x.trim() !== '')) lignes.push(l);
        l = [];
      } else champ += ch;
    }
    l.push(champ);
    if (l.some((x) => x.trim() !== '')) lignes.push(l);
    return lignes;
  }
  // Nombre écrit à la française ou à l'anglaise : « 1 234,56 € », « 1234.56 », « -12,5 ».
  function lireNombre(v) {
    let s = String(v ?? '').replace(/[\s  €%]/g, '').replace(/^'/, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function lireDate(v) {
    const s = String(v ?? '').trim();
    if (estDate(s.slice(0, 10))) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!m) return '';
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${a}-${deux(m[2])}-${deux(m[1])}`;
    return estDate(d) ? d : '';
  }
  function lireType(v) {
    const s = plat(v).trim();
    if (/^vent|^recette|^collect/.test(s)) return 'vente';
    if (/^immo/.test(s)) return 'immo';
    if (/^frais|^charge|^depense/.test(s)) return 'frais';
    if (/^achat|^deduct/.test(s)) return 'achat';
    return '';
  }
  // Import des opérations : colonnes reconnues par leur titre (Date, Type, Libellé, Pièce, HT, Taux, TVA, TTC).
  function importerCsv(texte, aujourdhui) {
    const lignes = lireCsv(texte);
    if (!lignes.length) return { operations: [], erreurs: [{ ligne: 0, message: 'Fichier vide.' }] };
    const tete = lignes[0].map((x) => plat(x).replace(/[^a-z]/g, ''));
    const col = (...noms) => tete.findIndex((h) => noms.some((n) => h === n || h.startsWith(n)));
    const C = { date: col('date'), type: col('type', 'sens'), libelle: col('libelle', 'designation', 'description'), piece: col('piece', 'facture', 'reference'), ht: col('montantht', 'ht'), taux: col('taux'), tva: col('tva', 'montanttva'), ttc: col('montantttc', 'ttc') };
    if (C.date < 0 || C.type < 0 || (C.ht < 0 && C.ttc < 0)) return { operations: [], erreurs: [{ ligne: 1, message: 'Colonnes attendues : Date, Type, et Montant HT ou Montant TTC (plus Libellé, Pièce, Taux, TVA si tu les as).' }] };
    const operations = [], erreurs = [];
    lignes.slice(1).forEach((l, i) => {
      const n = i + 2;
      const v = (k) => (C[k] >= 0 ? l[C[k]] : '');
      const date = lireDate(v('date'));
      const type = lireType(v('type'));
      if (!date) { erreurs.push({ ligne: n, message: 'date illisible' }); return; }
      if (!type) { erreurs.push({ ligne: n, message: `type « ${String(v('type')).slice(0, 20)} » inconnu (Vente, Achat, Frais ou Immobilisation)` }); return; }
      const taux = lireNombre(v('taux')) ?? 20;
      let ht = lireNombre(v('ht')), tva = lireNombre(v('tva')), ttc = lireNombre(v('ttc'));
      if (ht === null && ttc === null) { erreurs.push({ ligne: n, message: 'ni HT ni TTC' }); return; }
      if (ht === null) { const c = tva === null ? calculer('ttc', ttc, taux) : { ht: arrondi(ttc - tva), tva, ttc }; ({ ht, tva } = c); }
      if (tva === null) tva = calculer('ht', ht, taux).tva;
      if (ttc === null) ttc = arrondi(ht + tva);
      operations.push(normaliserOperation({ date, type, libelle: v('libelle'), piece: v('piece'), ht, taux, tva, ttc, creeLe: aujourdhui }));
    });
    return { operations, erreurs };
  }

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const txt = (v, n = 120) => String(v ?? '').trim().slice(0, n);
  const ent = (v, min, max, def) => { const n = Math.round(Number(String(v ?? '').replace(',', '.'))); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.min(max, Math.max(min, n)) : def; };
  const reel = (v, min, max, def) => { const n = typeof v === 'number' ? v : lireNombre(v); return n !== null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const montant = (v) => { const n = typeof v === 'number' ? v : lireNombre(v); return n !== null && Number.isFinite(n) ? arrondi(Math.max(-1e9, Math.min(1e9, n))) : 0; };
  const idOk = (v) => (typeof v === 'string' && v ? v.slice(0, 40) : nouvelId());
  function normaliserTaux(l, base) {
    const vus = new Set();
    const out = (Array.isArray(l) ? l : []).map((t) => { const n = typeof t?.taux === 'number' ? t.taux : lireNombre(t?.taux); return { taux: n === null || !Number.isFinite(n) ? -1 : Math.round(n * 100) / 100, nom: txt(t?.nom, 40) }; })
      .filter((t) => t.taux >= 0 && t.taux <= 100 && !vus.has(t.taux) && vus.add(t.taux)).sort((a, b) => b.taux - a.taux).slice(0, 12);
    return out.length ? out : base.reglages.taux.map((t) => ({ ...t }));
  }
  function normaliserReglages(r, base) {
    const d = r && typeof r === 'object' ? r : {};
    const B = base.reglages;
    return {
      societe: txt(d.societe, 80),
      regime: REGIMES.includes(d.regime) ? d.regime : B.regime,
      debut: estDate(d.debut) ? debutMois(d.debut) : '',
      clotureMois: ent(d.clotureMois, 1, 12, B.clotureMois),
      creditInitial: Math.max(0, montant(d.creditInitial ?? B.creditInitial)),
      jourEcheance: ent(d.jourEcheance, 1, 31, B.jourEcheance),
      acompte1Pct: reel(d.acompte1Pct, 0, 100, B.acompte1Pct),
      acompte2Pct: reel(d.acompte2Pct, 0, 100, B.acompte2Pct),
      jourAcompte: ent(d.jourAcompte, 1, 31, B.jourAcompte),
      dispenseAcomptes: reel(d.dispenseAcomptes, 0, 1e7, B.dispenseAcomptes),
      ca12Jour: ent(d.ca12Jour, 0, 31, B.ca12Jour),
      ca12Mois: ent(d.ca12Mois, 1, 12, B.ca12Mois),
      ca12Delai: ent(d.ca12Delai, 1, 12, B.ca12Delai),
      finSimplifie: estDate(d.finSimplifie) ? d.finSimplifie : B.finSimplifie,
      seuilTrimestriel: reel(d.seuilTrimestriel, 0, 1e8, B.seuilTrimestriel),
      tolerance: reel(d.tolerance, 0, 100, B.tolerance),
      periodesDeductible: ent(d.periodesDeductible, 1, 24, B.periodesDeductible),
      periodesCredit: ent(d.periodesCredit, 1, 24, B.periodesCredit),
      taux: normaliserTaux(d.taux ?? B.taux, base),
    };
  }
  function normaliserOperation(x) {
    const o = {
      id: idOk(x?.id), date: estDate(x?.date) ? x.date : '', type: TYPES.includes(x?.type) ? x.type : 'vente',
      libelle: txt(x?.libelle, 120), ht: montant(x?.ht), taux: Math.round(reel(x?.taux, 0, 100, 20) * 100) / 100, tva: montant(x?.tva), ttc: montant(x?.ttc),
    };
    const piece = txt(x?.piece, 40);
    if (piece) o.piece = piece;
    if (estDate(x?.creeLe)) o.creeLe = x.creeLe;
    return o;
  }
  function normaliserSuivi(s) {
    const out = {};
    if (!s || typeof s !== 'object') return out;
    for (const [k, v] of Object.entries(s)) {
      if (!/^[MTE]-\d{4}-\d{1,2}(-A[12])?$/.test(k) || !v || typeof v !== 'object') continue;
      const x = {};
      if (estDate(v.declare)) x.declare = v.declare;
      if (estDate(v.paye)) x.paye = v.paye;
      const m = typeof v.montant === 'number' ? v.montant : null;
      if (m !== null && Number.isFinite(m)) x.montant = montant(m);
      if (Number(v.remboursement) > 0) x.remboursement = montant(v.remboursement);
      if (typeof v.base === 'number' && Number.isFinite(v.base) && v.base >= 0) x.base = montant(v.base);
      const note = txt(v.note, 200);
      if (note) x.note = note;
      if (Object.keys(x).length) out[k] = x;
    }
    return out;
  }
  const etatVide = (base) => ({ version: 1, reglages: normaliserReglages({}, base), operations: [], suivi: {} });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base),
      operations: (Array.isArray(d.operations) ? d.operations : []).map(normaliserOperation).filter((o) => o.date),
      suivi: normaliserSuivi(d.suivi),
    };
  }
  // Validation d'une saisie (message d'erreur ou chaîne vide).
  function validerOperation(o) {
    if (!estDate(o.date)) return 'Indique la date de l\'opération.';
    if (!o.libelle) return 'Indique un libellé (client, fournisseur ou nature).';
    if (!cts(o.ht) && !cts(o.ttc)) return 'Indique un montant HT ou TTC.';
    return '';
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.TVA = {
    deux, iso, versDate, ajout, ecart, estDate, debutMois, ajoutMois, finMois, jourDansMois, JOURS, MOIS, MOIS_C, dateFr, dateCourte, plat, nouvelId,
    paques, feries, ouvrable, reporter, deuxiemeJourOuvreMai,
    cts, eur, arrondi, tvaDeHt, calculer, ecartsOperation,
    TYPES, sensDe, REGIMES, periodeDe, periodes, echeancesPeriode, dansPeriode, totaux, bilans, echeancier,
    TYPES_CONTROLE, controles, LIB_STATUT,
    champCsv, versCsv, csvOperations, csvPeriodes, csvEcheancier, lireCsv, lireNombre, lireDate, lireType, importerCsv,
    normaliserReglages, normaliserOperation, normaliserSuivi, etatVide, normaliser, validerOperation, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
