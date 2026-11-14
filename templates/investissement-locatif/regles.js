// Rentabilité d'un investissement locatif QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RNT) et par les tests Node (vm).
// Montants en centimes entiers, taux en pour cent par an (3.45 = 3,45 %), durées en mois, vacance en mois par an.
// Crédit : mêmes formules que la capacité d'emprunt (templates/emprunt/regles.js) : annuité, assurance, capital restant dû.
// Tous les résultats sont AVANT IMPÔT : la fiscalité des loyers est hors calcul (signalé dans l'interface).
(function (racine) {
  'use strict';

  // Couleurs des biens, dans cet ordre fixe (palette validée par le script du skill dataviz, reprise du
  // simulateur leasing et de la capacité d'emprunt ; complétée par les noms, la légende et les tableaux).
  const COULEURS = ['#2F6DB5', '#C2502F', '#1E9467', '#C9A000', '#7A4FB8'];
  const MAX_BIENS = COULEURS.length;
  const MAX_LOTS = 8;
  const DUREE_MAX_ANS = 35;
  const LOCATIONS = ['nu', 'meuble', 'colocation', 'saisonnier'];

  // ---------- Saisie et affichage ----------
  const deux = (n) => String(n).padStart(2, '0');
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  function lireTaux(saisie) {
    const s = String(saisie ?? '').replace(/[\s  %]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 100 ? Math.round(n * 1000) / 1000 : null;
  }
  function lireEntier(saisie, min, max) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '');
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= min && n <= max ? n : null;
  }
  // Mois de vacance : 0 à 12, au demi-mois près (« 1,5 »).
  function lireMois(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!/^\d+(\.\d)?$/.test(s)) return null;
    const n = Number(s);
    return n <= 12 ? Math.round(n * 2) / 2 : null;
  }
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < -0.5;
    const plus = signe && c > 0.5 ? '+ ' : '';
    const n = Math.abs(Math.round(c));
    if (!centimes) return `${neg ? '−' : plus}${neg && signe ? ' ' : ''}${milliers(Math.round(n / 100))} €`;
    return `${neg ? '−' : plus}${neg && signe ? ' ' : ''}${milliers(Math.floor(n / 100))},${deux(n % 100)} €`;
  }
  const pct = (t, dec = 2) => (t === null || t === undefined || Number.isNaN(t) || !Number.isFinite(t) ? '–' : `${String(Math.round(t * 10 ** dec) / 10 ** dec).replace('.', ',')} %`);
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)));
  const saisieTaux = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
  function duree(mois) {
    if (!(mois > 0)) return '–';
    const a = Math.floor(mois / 12), m = mois % 12;
    if (!a) return `${mois} mois`;
    return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
  }
  const moisTexte = (m) => `${String(m).replace('.', ',')} mois`;

  // ---------- Formules du crédit (reprises de templates/emprunt) ----------
  function mensualite(capital, tauxAnnuel, n) {
    if (!(capital > 0) || !(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital / n);
    return Math.round((capital * r) / (1 - (1 + r) ** -n));
  }
  function capitalRestant(capital, tauxAnnuel, n, k) {
    if (!(capital > 0) || k >= n) return 0;
    if (k <= 0) return capital;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital * (1 - k / n));
    const m = (capital * r) / (1 - (1 + r) ** -n);
    return Math.max(0, Math.round(capital * (1 + r) ** k - (m * ((1 + r) ** k - 1)) / r));
  }
  const assuranceMois = (base, tauxAss, quotite = 100) => (base > 0 && tauxAss > 0 ? Math.round((base * tauxAss * (quotite || 0)) / 120000) : 0);

  // ---------- Acquisition ----------
  function fraisNotaire(b) {
    if (b.notaireMode === 'saisi') return b.notaireMontant || 0;
    return Math.round(((b.prix || 0) * (b.notairePct || 0)) / 100);
  }
  function acquisition(b) {
    const notaire = fraisNotaire(b);
    const postes = [
      ['prix', 'Prix d\'achat', b.prix || 0],
      ['notaire', b.notaireMode === 'saisi' ? 'Frais de notaire (montant saisi)' : `Frais de notaire estimés (${pct(b.notairePct || 0, 1)} du prix, hypothèse)`, notaire],
      ['fraisAgence', 'Frais d\'agence', b.fraisAgence || 0],
      ['travaux', 'Travaux', b.travaux || 0],
      ['mobilier', 'Mobilier et équipement', b.mobilier || 0],
      ['fraisBancaires', 'Frais bancaires (dossier, garantie, courtage)', b.fraisBancaires || 0],
      ['autresFrais', 'Autres frais', b.autresFrais || 0],
    ];
    return { postes, notaire, total: postes.reduce((s, p) => s + p[2], 0) };
  }

  // ---------- Loyers ----------
  // Loyers annuels théoriques (sans vacance) et encaissés (vacance déduite ; en saisonnier, les nuits louées
  // tiennent déjà compte des périodes vides).
  function revenus(b) {
    if (b.location === 'saisonnier') {
      const theorique = Math.round((b.prixNuit || 0) * (b.nuits || 0));
      return { theorique, encaisse: theorique, vacance: 0, mensuelTheorique: Math.round(theorique / 12) };
    }
    const mensuel = (b.lots || []).reduce((s, l) => s + (l.loyer || 0), 0);
    const theorique = mensuel * 12;
    const encaisse = Math.round((mensuel * (12 - Math.min(12, b.vacance || 0))));
    return { theorique, encaisse, vacance: theorique - encaisse, mensuelTheorique: mensuel };
  }

  // ---------- Charges du propriétaire (par an) ----------
  function charges(b, encaisse = revenus(b).encaisse) {
    const gestion = Math.round((encaisse * (b.gestionPct || 0)) / 100);
    const postes = [
      ['taxeFonciere', 'Taxe foncière', b.taxeFonciere || 0],
      ['copro', 'Copropriété non récupérable', b.copro || 0],
      ['pno', 'Assurance propriétaire non occupant', b.pno || 0],
      ['gli', 'Assurance loyers impayés', b.gli || 0],
      ['gestion', `Gestion ou conciergerie (${pct(b.gestionPct || 0, 1)} des loyers)`, gestion],
      ['entretien', 'Entretien et petites réparations', b.entretien || 0],
      ['exploitation', 'Énergie, internet, ménage', b.exploitation || 0],
      ['autresCharges', 'Autres charges', b.autresCharges || 0],
    ];
    return { postes, gestion, total: postes.reduce((s, p) => s + p[2], 0) };
  }

  // ---------- Financement ----------
  // Montant emprunté : saisi, ou coût total − apport. Mensualité et assurance de la première année.
  function credit(b, coutTotal = acquisition(b).total) {
    const f = b.financement || {};
    if (f.mode !== 'credit') return { mode: 'comptant', montant: 0, apport: coutTotal, mensualite: 0, assurance: 0, mensuelTotal: 0, annuel: 0, interetsAn1: 0, capitalAn1: 0 };
    const montant = f.montant !== null && f.montant !== undefined ? f.montant : Math.max(0, coutTotal - (f.apport || 0));
    const n = f.dureeMois || 0;
    const m = mensualite(montant, f.taux, n);
    // Assurance : sur capital initial (constante) ou sur capital restant dû (moyenne de la première année).
    let ass = assuranceMois(montant, f.tauxAssurance, f.quotite);
    if (f.assuranceMode === 'crd' && montant > 0 && n > 0) {
      let s = 0;
      for (let k = 0; k < Math.min(12, n); k++) s += assuranceMois(capitalRestant(montant, f.taux, n, k), f.tauxAssurance, f.quotite);
      ass = Math.round(s / Math.min(12, n));
    }
    const k12 = Math.min(12, n);
    const capitalAn1 = montant - capitalRestant(montant, f.taux, n, k12);
    const interetsAn1 = Math.max(0, m * k12 - capitalAn1);
    return { mode: 'credit', montant, apport: Math.max(0, coutTotal - montant), mensualite: m, assurance: ass, mensuelTotal: m + ass, annuel: (m + ass) * 12, interetsAn1, capitalAn1, dureeMois: n, taux: f.taux, coutTotal: m * n - montant };
  }

  // ---------- Ce qu'il manque pour calculer ----------
  function manques(b) {
    const m = [];
    if (!(b.prix > 0)) m.push('le prix d\'achat');
    const r = revenus(b);
    if (!(r.theorique > 0)) m.push(b.location === 'saisonnier' ? 'le prix d\'une nuit et les nuits louées' : 'le loyer');
    if (b.taxeFonciere === null || b.taxeFonciere === undefined) m.push('la taxe foncière (0 si aucune)');
    const f = b.financement || {};
    if (f.mode === 'credit') {
      if (f.taux === null || f.taux === undefined) m.push('le taux du crédit');
      if (!(f.dureeMois > 0)) m.push('la durée du crédit');
      if (f.tauxAssurance === null || f.tauxAssurance === undefined) m.push('le taux d\'assurance (0 si aucune)');
    }
    return m;
  }

  // ---------- Analyse complète d'un bien ----------
  function analyser(b) {
    const manque = manques(b);
    const res = { id: b.id, complet: !manque.length, manque };
    const a = acquisition(b);
    const r = revenus(b);
    const c = charges(b, r.encaisse);
    const cr = credit(b, a.total);
    Object.assign(res, { acquisition: a, revenus: r, charges: c, credit: cr, coutTotal: a.total });
    if (manque.length) return res;
    const netAnnuel = r.encaisse - c.total;
    const cashflowAnnuel = netAnnuel - cr.annuel;
    const cashflowMensuel = Math.round(cashflowAnnuel / 12);
    Object.assign(res, {
      rendementBrut: (r.theorique / b.prix) * 100,
      rendementBrutCout: (r.theorique / a.total) * 100,
      netAnnuel,
      rendementNet: (netAnnuel / a.total) * 100,
      cashflowAnnuel, cashflowMensuel,
      effortMensuel: Math.max(0, -cashflowMensuel),
      // Rendement des fonds propres avant impôt : cash-flow annuel / apport mobilisé.
      rendementApport: cr.apport > 0 ? (cashflowAnnuel / cr.apport) * 100 : null,
      prixM2: b.surface > 0 ? Math.round(b.prix / b.surface) : null,
      loyerM2: b.surface > 0 && b.location !== 'saisonnier' ? Math.round(r.mensuelTheorique / b.surface) : null,
    });
    return res;
  }

  // ---------- Prix maximal pour un rendement visé ----------
  // Brut : prix = loyers théoriques / cible. Net : coût total(p) = p × (1 + k) + F, k = part des frais de notaire et
  // d'agence dans le prix (suivent le prix), F = travaux, mobilier, frais bancaires et autres frais (fixes).
  function prixMax(b, cible, type = 'net') {
    if (!(cible > 0) || !(b.prix > 0)) return null;
    const x = analyser(b);
    if (!x.complet) return null;
    let prix;
    if (type === 'brut') prix = x.revenus.theorique / (cible / 100);
    else {
      const k = (fraisNotaire(b) + (b.fraisAgence || 0)) / b.prix;
      const F = (b.travaux || 0) + (b.mobilier || 0) + (b.fraisBancaires || 0) + (b.autresFrais || 0);
      prix = (x.netAnnuel / (cible / 100) - F) / (1 + k);
    }
    prix = Math.max(0, Math.floor(prix / 100) * 100); // à l'euro inférieur
    const actuel = type === 'brut' ? x.rendementBrut : x.rendementNet;
    return { prix, ecart: prix - b.prix, atteint: actuel >= cible, actuel, cible, type, impossible: prix <= 0 };
  }

  // ---------- Sensibilité ----------
  // Chaque scénario part du bien saisi et change une hypothèse. « Vacance + 1 mois » en saisonnier : 30 nuits de moins.
  function varier(b, sc) {
    const v = JSON.parse(JSON.stringify(b));
    if (sc.loyer) {
      v.lots = (v.lots || []).map((l) => ({ ...l, loyer: Math.round((l.loyer || 0) * (1 + sc.loyer / 100)) }));
      v.prixNuit = Math.round((v.prixNuit || 0) * (1 + sc.loyer / 100));
    }
    if (sc.vacance) {
      if (v.location === 'saisonnier') v.nuits = Math.max(0, (v.nuits || 0) - 30 * sc.vacance);
      else v.vacance = Math.min(12, (v.vacance || 0) + sc.vacance);
    }
    if (sc.taux && v.financement?.mode === 'credit') v.financement.taux = (v.financement.taux || 0) + sc.taux;
    return v;
  }
  const SCENARIOS = [
    { id: 'base', nom: 'Hypothèses saisies' },
    { id: 'loyer', nom: 'Loyer − 10 %', loyer: -10 },
    { id: 'vacance', nom: 'Vacance + 1 mois', vacance: 1 },
    { id: 'taux', nom: 'Taux + 1 point', taux: 1, credit: true },
    { id: 'cumul', nom: 'Les trois à la fois', loyer: -10, vacance: 1, taux: 1 },
  ];
  function sensibilite(b) {
    const base = analyser(b);
    if (!base.complet) return null;
    const avecCredit = b.financement?.mode === 'credit';
    return SCENARIOS.filter((s) => avecCredit || !s.credit).map((s) => {
      const x = s.id === 'base' ? base : analyser(varier(b, s));
      return {
        id: s.id, nom: s.id === 'cumul' && !avecCredit ? 'Les deux à la fois' : s.nom,
        rendementNet: x.rendementNet, cashflowMensuel: x.cashflowMensuel, effortMensuel: x.effortMensuel,
        ecartCashflow: x.cashflowMensuel - base.cashflowMensuel, ecartRendement: x.rendementNet - base.rendementNet,
      };
    });
  }

  // ---------- Comparaison ----------
  function comparer(biens) {
    const tous = biens.map(analyser);
    const complets = tous.filter((x) => x.complet);
    const parNet = complets.slice().sort((a, b) => b.rendementNet - a.rendementNet);
    const parCash = complets.slice().sort((a, b) => b.cashflowMensuel - a.cashflowMensuel);
    parNet.forEach((x, i) => { x.rangNet = i + 1; });
    parCash.forEach((x, i) => { x.rangCash = i + 1; });
    return { tous, complets, incomplets: tous.filter((x) => !x.complet), meilleurNet: parNet[0] || null, meilleurCash: parCash[0] || null };
  }

  // Alertes d'un bien analysé.
  function alertes(b, x) {
    const l = [];
    if (!x.complet) return l;
    if (x.cashflowMensuel < 0) l.push({ niveau: 'info', texte: `Cash-flow négatif : ${euros(-x.cashflowMensuel, { centimes: false })} à ajouter chaque mois (effort d'épargne), avant impôt.` });
    if (b.location !== 'saisonnier' && !(b.vacance > 0)) l.push({ niveau: 'info', texte: 'Aucune vacance locative comptée : même un bon bien reste parfois vide entre deux locataires.' });
    if (!(b.entretien > 0)) l.push({ niveau: 'info', texte: 'Aucun entretien prévu : une provision annuelle évite les mauvaises surprises.' });
    if (b.notaireMode !== 'saisi') l.push({ niveau: 'info', texte: `Frais de notaire estimés à ${pct(b.notairePct || 0, 1)} du prix (hypothèse) : saisis le montant du notaire dès que tu l'as.` });
    if (b.location === 'saisonnier' && b.nuits > 365) l.push({ niveau: 'alerte', texte: 'Plus de 365 nuits louées par an : vérifie la saisie.' });
    if (b.financement?.mode === 'credit' && x.credit.montant > x.coutTotal) l.push({ niveau: 'alerte', texte: 'Le montant emprunté dépasse le coût total de l\'opération.' });
    return l;
  }

  // ---------- Identifiants et normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const centimes = (v) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== null && v !== '' && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const tauxOuNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(100, Math.max(0, Number(v))));
  const mois = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Math.min(12, Math.max(0, Math.round(Number(v) * 2) / 2)));

  function normaliserFinancement(x) {
    const f = x && typeof x === 'object' ? x : {};
    return {
      mode: f.mode === 'comptant' ? 'comptant' : 'credit',
      apport: centimes(f.apport) ?? 0,
      montant: centimes(f.montant), // null : coût total − apport
      taux: tauxOuNull(f.taux),
      dureeMois: entier(f.dureeMois, 0, DUREE_MAX_ANS * 12, 0),
      tauxAssurance: tauxOuNull(f.tauxAssurance),
      assuranceMode: f.assuranceMode === 'crd' ? 'crd' : 'initial',
      quotite: entier(f.quotite, 0, 200, 100),
    };
  }

  function normaliserBien(x, i = 0, utilisees = [], notaireBase = {}) {
    const b = x && typeof x === 'object' ? x : {};
    let couleur = entier(b.couleur, 0, COULEURS.length - 1, null);
    if (couleur !== null && utilisees.includes(couleur)) couleur = null;
    if (couleur === null) couleur = [...COULEURS.keys()].find((k) => !utilisees.includes(k)) ?? (i % COULEURS.length);
    const etat = b.etat === 'neuf' ? 'neuf' : 'ancien';
    const lots = (Array.isArray(b.lots) ? b.lots : []).slice(0, MAX_LOTS).map((l, k) => ({ libelle: texte(l?.libelle, 40) || `Lot ${k + 1}`, loyer: centimes(l?.loyer) ?? 0 })).filter((l) => l.loyer > 0 || (Array.isArray(b.lots) && b.lots.length === 1));
    const verifs = {};
    if (b.verifs && typeof b.verifs === 'object') for (const [k, v] of Object.entries(b.verifs)) if (v) verifs[texte(k, 40)] = true;
    return {
      id: String(b.id || nouvelId()), couleur,
      nom: texte(b.nom, 60) || `Bien ${String.fromCharCode(65 + i)}`,
      note: texte(b.note, 300),
      location: LOCATIONS.includes(b.location) ? b.location : 'nu',
      etat,
      surface: b.surface === null || b.surface === undefined || b.surface === '' || !(Number(b.surface) > 0) ? null : Math.min(10000, Math.round(Number(b.surface) * 10) / 10),
      prix: centimes(b.prix) ?? 0,
      notaireMode: b.notaireMode === 'saisi' ? 'saisi' : 'estime',
      notairePct: tauxOuNull(b.notairePct) ?? notaireBase[etat] ?? null,
      notaireMontant: centimes(b.notaireMontant) ?? 0,
      fraisAgence: centimes(b.fraisAgence) ?? 0,
      travaux: centimes(b.travaux) ?? 0,
      mobilier: centimes(b.mobilier) ?? 0,
      fraisBancaires: centimes(b.fraisBancaires) ?? 0,
      autresFrais: centimes(b.autresFrais) ?? 0,
      lots: lots.length ? lots : [{ libelle: 'Logement', loyer: 0 }],
      vacance: mois(b.vacance),
      prixNuit: centimes(b.prixNuit) ?? 0,
      nuits: entier(b.nuits, 0, 366, 0),
      taxeFonciere: centimes(b.taxeFonciere),
      copro: centimes(b.copro) ?? 0,
      pno: centimes(b.pno) ?? 0,
      gli: centimes(b.gli) ?? 0,
      gestionPct: tauxOuNull(b.gestionPct) ?? 0,
      entretien: centimes(b.entretien) ?? 0,
      exploitation: centimes(b.exploitation) ?? 0,
      autresCharges: centimes(b.autresCharges) ?? 0,
      financement: normaliserFinancement(b.financement),
      verifs,
    };
  }

  function etatVide() { return { version: 1, biens: [], actif: null, cible: { taux: null, type: 'net' } }; }

  function normaliser(d, base = {}) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const biens = [];
    for (const [i, b] of (Array.isArray(d.biens) ? d.biens : []).slice(0, MAX_BIENS).entries()) biens.push(normaliserBien(b, i, biens.map((y) => y.couleur), base.notaire || {}));
    const c = d.cible && typeof d.cible === 'object' ? d.cible : {};
    return {
      ...v, ...d, version: 1,
      biens,
      actif: biens.some((b) => b.id === d.actif) ? d.actif : (biens[0]?.id ?? null),
      cible: { taux: tauxOuNull(c.taux), type: c.type === 'brut' ? 'brut' : 'net' },
    };
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const tauxCsv = (t) => (t === null || t === undefined || !Number.isFinite(t) ? '' : t.toFixed(2).replace('.', ','));
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function csvComparaison(biens, base = {}) {
    const c = comparer(biens);
    const l = [['Avant impôt : la fiscalité des loyers n\'est pas calculée'], ['', ...biens.map((b) => b.nom)]];
    const ligne = (lib, f, toujours = false) => l.push([lib, ...c.tous.map((x, i) => (x.complet || toujours ? f(x, biens[i]) : 'à compléter'))]);
    ligne('Type de location', (x, b) => base.locations?.[b.location]?.nom || b.location, true);
    ligne('Prix d\'achat', (x, b) => nombreCsv(b.prix), true);
    ligne('Coût total d\'acquisition', (x) => nombreCsv(x.coutTotal), true);
    ligne('Loyers annuels théoriques', (x) => nombreCsv(x.revenus.theorique), true);
    ligne('Loyers annuels encaissés', (x) => nombreCsv(x.revenus.encaisse), true);
    ligne('Charges annuelles', (x) => nombreCsv(x.charges.total), true);
    ligne('Mensualité du crédit assurance comprise', (x) => nombreCsv(x.credit.mensuelTotal), true);
    ligne('Rendement brut (%)', (x) => tauxCsv(x.rendementBrut));
    ligne('Rendement net de charges (%)', (x) => tauxCsv(x.rendementNet));
    ligne('Cash-flow mensuel avant impôt', (x) => nombreCsv(x.cashflowMensuel));
    ligne('Effort d\'épargne mensuel', (x) => nombreCsv(x.effortMensuel));
    return csv(l);
  }

  racine.RNT = {
    COULEURS, MAX_BIENS, MAX_LOTS, DUREE_MAX_ANS, LOCATIONS, SCENARIOS,
    lireMontant, lireTaux, lireEntier, lireMois, euros, pct, duree, moisTexte, milliers, saisieMontant, saisieTaux,
    mensualite, capitalRestant, assuranceMois,
    fraisNotaire, acquisition, revenus, charges, credit, manques, analyser, prixMax, varier, sensibilite, comparer, alertes,
    nouvelId, normaliserBien, normaliserFinancement, normaliser, etatVide, csvComparaison,
  };
})(typeof window !== 'undefined' ? window : globalThis);
