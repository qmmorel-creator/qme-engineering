// Simulateur leasing ou achat QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.VTR) et par les tests Node (vm).
// Montants en centimes (le prix du km supplémentaire peut avoir une décimale : 8,5 = 0,085 €),
// taux en pour cent par an (5.9 = 5,90 %), durées en mois, kilométrages en km par an.
(function (racine) {
  'use strict';

  const TYPES = ['comptant', 'credit', 'loa', 'lld'];
  const LIB_TYPE = { comptant: 'Comptant', credit: 'Crédit', loa: 'LOA', lld: 'LLD' };
  // Couleurs des scénarios, dans cet ordre fixe (palette validée avec le script du skill dataviz :
  // écart minimal entre voisines suffisant, complété par la légende, les étiquettes et le tableau).
  const COULEURS = ['#2F6DB5', '#C2502F', '#1E9467', '#C9A000', '#7A4FB8', '#C2457A'];
  const MAX_SCENARIOS = COULEURS.length;
  const DUREE_MIN = 6, DUREE_MAX = 120;
  const KM_MAX = 200000;

  // ---------- Saisie et affichage ----------
  const deux = (n) => String(n).padStart(2, '0');
  // « 1 234,56 », « 1234.5 € » → centimes entiers ; null si vide ou illisible.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // Prix d'un km : « 0,085 » → 8.5 centimes (trois décimales en euros au plus).
  function lirePrixKm(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]|\/km/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Math.round(Number(s) * 1000) / 10;
  }
  // « 5,9 », « 5.90 % » → 5.9 ; borné à 0–100.
  function lireTaux(saisie) {
    const s = String(saisie ?? '').replace(/[\s %]/g, '').replace(',', '.');
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
  // Espaces insécables : un montant ou un kilométrage ne se coupe jamais en fin de ligne.
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  function euros(c, { centimes = true } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < -0.5;
    const n = Math.abs(Math.round(c));
    if (!centimes) return `${neg ? '−' : ''}${milliers(Math.round(n / 100))}\u00a0€`;
    return `${neg ? '−' : ''}${milliers(Math.floor(n / 100))},${deux(n % 100)}\u00a0€`;
  }
  const eurosKm = (c) => (c === null || c === undefined ? '–' : `${(c / 100).toFixed(3).replace(/0$/, '').replace('.', ',')}\u00a0€/km`);
  const km = (n) => `${milliers(Math.round(n))}\u00a0km`;
  const pct = (t) => (t === null || t === undefined ? '–' : `${String(Math.round(t * 100) / 100).replace('.', ',')}\u00a0%`);
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)));
  const saisiePrixKm = (c) => (c === null || c === undefined ? '' : String(c / 100).replace('.', ','));
  const saisieTaux = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
  function duree(mois) {
    const a = Math.floor(mois / 12), m = mois % 12;
    if (!a) return `${mois} mois`;
    return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
  }

  // ---------- Formules financières ----------
  // Mensualité d'un crédit amortissable à échéances constantes (formule d'annuité) :
  // M = C × r / (1 − (1 + r)^−n), r = taux annuel / 12. Taux nul : C / n. Résultat en centimes, arrondi.
  function mensualite(capital, tauxAnnuel, n) {
    if (!(capital > 0) || !(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital / n);
    return Math.round((capital * r) / (1 - (1 + r) ** -n));
  }
  // Capital restant dû après k mensualités (mensualité exacte, non arrondie).
  function capitalRestant(capital, tauxAnnuel, n, k) {
    if (!(capital > 0) || k >= n) return 0;
    if (k <= 0) return capital;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital * (1 - k / n));
    const m = (capital * r) / (1 - (1 + r) ** -n);
    return Math.max(0, Math.round(capital * (1 + r) ** k - (m * ((1 + r) ** k - 1)) / r));
  }
  // Coût des intérêts sur toute la durée du crédit : mensualités payées − capital emprunté.
  const coutInterets = (capital, tauxAnnuel, n) => (capital > 0 && n > 0 ? mensualite(capital, tauxAnnuel, n) * n - capital : 0);

  // Valeur de revente estimée après « mois » mois : décote linéaire la première année, puis décote
  // annuelle composée. Hypothèse de calcul, pas une cote du marché.
  // Ajustement kilométrique facultatif : la valeur baisse de « perteKm » centimes par km parcouru
  // au-delà de « kmNormal » km par an (et monte d'autant en deçà), bornée entre 0 et le prix.
  function valeurEstimee(prix, mois, decote1, decote2, { kmAn = 0, kmNormal = 0, perteKm = 0 } = {}) {
    if (!(prix > 0)) return 0;
    if (mois <= 0) return prix;
    const d1 = Math.min(100, Math.max(0, decote1 || 0)) / 100, d2 = Math.min(100, Math.max(0, decote2 || 0)) / 100;
    const base = mois <= 12 ? prix * (1 - (d1 * mois) / 12) : prix * (1 - d1) * (1 - d2) ** ((mois - 12) / 12);
    const ajust = perteKm > 0 && kmNormal > 0 ? (((kmAn - kmNormal) * mois) / 12) * perteKm : 0;
    return Math.round(Math.min(prix, Math.max(0, base - ajust)));
  }
  // Gain qu'aurait rapporté l'argent versé au départ, placé à « taux » % par an (intérêts composés).
  const coutOpportunite = (montant, taux, mois) => (montant > 0 && taux > 0 && mois > 0 ? Math.round(montant * ((1 + taux / 100) ** (mois / 12) - 1)) : 0);
  // Kilomètres au-delà du forfait annuel sur toute la durée.
  const kmDepasses = (kmAn, forfaitAn, mois) => (forfaitAn > 0 && kmAn > forfaitAn ? Math.round(((kmAn - forfaitAn) * mois) / 12) : 0);

  // ---------- Scénario ----------
  // Ce qui manque pour calculer un scénario (liste vide : complet).
  function manques(p, s) {
    const m = [];
    const prix = prixDe(p, s);
    if (s.type === 'comptant' || s.type === 'credit') {
      if (!(prix > 0)) m.push('le prix');
    }
    if (s.type === 'credit') {
      if (s.taux === null || s.taux === undefined) m.push('le taux');
      if (!(s.dureeCredit > 0)) m.push('la durée du crédit');
      if (prix > 0 && s.apport > prix) m.push('un apport inférieur au prix');
    }
    if (s.type === 'loa' || s.type === 'lld') {
      if (!(s.loyer > 0)) m.push('le loyer mensuel');
      if (s.type === 'loa' && s.leverOption && !(s.optionAchat > 0)) m.push('le montant de l\'option d\'achat');
      if (s.type === 'loa' && s.leverOption && !(p.prix > 0)) m.push('le prix du véhicule (pour sa valeur à la fin)');
    }
    return m;
  }
  const prixDe = (p, s) => (s.prix > 0 ? s.prix : p.prix);
  const proprietaire = (s) => s.type === 'comptant' || s.type === 'credit' || (s.type === 'loa' && s.leverOption);

  // Calcule un scénario sur la période de la comparaison (p.duree mois).
  // options.kmAn remplace le kilométrage de la comparaison (recherche des seuils).
  // Renvoie les postes de coût, le coût total net, le coût mensuel équivalent, le coût au km et la
  // courbe des décaissements cumulés mois par mois (cumul[0] = versé au départ).
  function calculer(p, s, options = {}) {
    const N = p.duree;
    const kmAn = options.kmAn ?? p.kmAn;
    const manque = manques(p, s);
    const r = { id: s.id, type: s.type, complet: !manque.length, manque, duree: N, kmAn };
    if (manque.length) return r;
    const prix = prixDe(p, s);
    const entretienMois = s.entretienInclus && (s.type === 'loa' || s.type === 'lld') ? 0 : (p.entretienAn || 0) / 12;
    const assurance = s.assuranceMois || 0;
    const frais = s.fraisDossier || 0;
    let depart = 0, paiementMois = () => 0, nbPaiements = 0;
    let mensu = 0, interets = 0, capital = 0, restantDu = 0;
    if (s.type === 'comptant') {
      depart = prix + frais;
    } else if (s.type === 'credit') {
      capital = Math.max(0, prix - (s.apport || 0));
      depart = (s.apport || 0) + frais;
      mensu = mensualite(capital, s.taux, s.dureeCredit);
      interets = coutInterets(capital, s.taux, s.dureeCredit);
      nbPaiements = Math.min(s.dureeCredit, N);
      paiementMois = (m) => (m <= s.dureeCredit ? mensu : 0);
      restantDu = s.dureeCredit > N ? capitalRestant(capital, s.taux, s.dureeCredit, N) : 0;
    } else {
      depart = (s.premierLoyer || 0) + frais;
      // Premier loyer au départ, puis un loyer par mois jusqu'à la fin du contrat (N − 1 loyers).
      nbPaiements = Math.max(0, N - 1);
      paiementMois = (m) => (m <= N - 1 ? s.loyer : 0);
    }
    const cumul = [depart];
    let paiements = 0, assurances = 0, entretiens = 0;
    for (let m = 1; m <= N; m++) {
      const pm = paiementMois(m);
      paiements += pm; assurances += assurance; entretiens += entretienMois;
      cumul.push(cumul[m - 1] + pm + assurance + entretienMois);
    }
    // Fin de la période.
    const kmSup = s.type === 'lld' || (s.type === 'loa' && !s.leverOption) ? kmDepasses(kmAn, s.kmForfait, N) : 0;
    const coutKmSup = Math.round(kmSup * (s.prixKmSup || 0));
    const option = s.type === 'loa' && s.leverOption ? s.optionAchat : 0;
    const restitution = s.type === 'lld' || (s.type === 'loa' && !s.leverOption) ? (s.fraisRestitution || 0) : 0;
    // Valeur du véhicule à la fin : à partir du prix de la comparaison (une remise ne change pas sa cote).
    const valeurFinale = proprietaire(s) ? valeurEstimee(p.prix > 0 ? p.prix : prix, N, p.decote1, p.decote2, { kmAn, kmNormal: p.kmNormal, perteKm: p.perteKm }) : 0;
    const fin = option + coutKmSup + restitution + restantDu;
    cumul[N] += fin;
    const opportunite = p.placement > 0 ? coutOpportunite(depart, p.placement, N) : 0;
    const decaissements = cumul[N];
    const net = Math.round(decaissements + opportunite - valeurFinale);
    const kmTotal = (kmAn * N) / 12;
    const postes = [
      ['depart', s.type === 'comptant' ? 'Paiement comptant' : s.type === 'credit' ? 'Apport' : 'Premier loyer', depart - frais],
      ['frais', 'Frais de dossier et annexes', frais],
      ['paiements', s.type === 'credit' ? `Mensualités (${nbPaiements} × ${euros(mensu)})` : s.type === 'comptant' ? 'Mensualités ou loyers' : `Loyers (${nbPaiements} × ${euros(s.loyer)})`, paiements],
      ['assurance', 'Assurance', assurances],
      ['entretien', entretienMois ? 'Entretien' : 'Entretien (inclus dans le loyer)', Math.round(entretiens)],
      ['option', 'Option d\'achat levée', option],
      ['restantDu', 'Capital restant dû remboursé à la revente', restantDu],
      ['kmSup', kmSup ? `Kilomètres supplémentaires (${km(kmSup)})` : 'Kilomètres supplémentaires', coutKmSup],
      ['restitution', 'Frais de remise en état à la restitution', restitution],
      ['opportunite', `Coût d'opportunité de l'argent versé au départ${p.placement > 0 ? ` (placé à ${pct(p.placement)})` : ''}`, opportunite],
      ['valeur', proprietaire(s) ? 'Valeur de revente estimée (déduite)' : 'Valeur de revente (tu rends la voiture)', -valeurFinale],
    ];
    return Object.assign(r, {
      prix, depart, frais, mensualite: mensu, interets, capital, nbPaiements, paiements, assurances, entretiens: Math.round(entretiens),
      option, restantDu, kmSup, coutKmSup, restitution, valeurFinale, opportunite,
      decaissements: Math.round(decaissements), net, mensuel: Math.round(net / N), parKm: kmTotal > 0 ? net / kmTotal : null,
      cumul: cumul.map(Math.round), postes, proprietaire: proprietaire(s),
      interetsPeriode: s.type === 'credit' ? Math.round(paiements + restantDu - capital) : 0,
    });
  }

  // Tous les scénarios complets d'une comparaison, du moins cher au plus cher.
  function comparer(p, options = {}) {
    const tous = p.scenarios.map((s) => calculer(p, s, options));
    const complets = tous.filter((x) => x.complet).sort((a, b) => a.net - b.net);
    const min = complets[0]?.net ?? null;
    complets.forEach((x, i) => { x.rang = i + 1; x.ecart = x.net - min; });
    return { tous, complets, moinsCher: complets[0] || null, incomplets: tous.filter((x) => !x.complet) };
  }

  // Kilométrages annuels où deux scénarios échangent leur place (coûts nets égaux), entre min et max.
  // Les coûts sont affines par morceaux en km : balayage par pas puis dichotomie au km près.
  function seuilsKm(p, idA, idB, { min = 0, max = 60000, pas = 250 } = {}) {
    const a = p.scenarios.find((s) => s.id === idA), b = p.scenarios.find((s) => s.id === idB);
    if (!a || !b) return [];
    const diff = (k) => { const x = calculer(p, a, { kmAn: k }), y = calculer(p, b, { kmAn: k }); return x.complet && y.complet ? x.net - y.net : null; };
    const res = [];
    let k0 = min, d0 = diff(min);
    if (d0 === null) return [];
    for (let k = min + pas; k <= max; k += pas) {
      const d = diff(k);
      if (d0 !== 0 && Math.sign(d) !== Math.sign(d0) && d !== 0) {
        let lo = k0, hi = k;
        while (hi - lo > 1) { const mi = Math.floor((lo + hi) / 2); if (Math.sign(diff(mi)) === Math.sign(d0)) lo = mi; else hi = mi; }
        res.push({ km: hi, avant: d0 < 0 ? idA : idB, apres: d0 < 0 ? idB : idA });
      }
      if (d !== 0) { k0 = k; d0 = d; }
    }
    return res;
  }

  // Pour le scénario le moins cher au kilométrage actuel : le kilométrage à partir duquel chaque autre
  // scénario le devient (au-dessus ou au-dessous du kilométrage actuel), s'il existe dans 0–60 000 km/an.
  function seuilsDuMoinsCher(p) {
    const c = comparer(p);
    if (!c.moinsCher || c.complets.length < 2) return [];
    const ref = c.moinsCher.id;
    return c.complets.slice(1).map((x) => {
      const s = seuilsKm(p, ref, x.id);
      const plusProche = s.sort((u, v) => Math.abs(u.km - p.kmAn) - Math.abs(v.km - p.kmAn))[0];
      return { id: x.id, km: plusProche ? plusProche.km : null, sens: plusProche ? (plusProche.km > p.kmAn ? 'au-dessus' : 'au-dessous') : null };
    });
  }

  // Le scénario le moins cher selon le kilométrage annuel, par plages : [{ de, a, id }] (a inclus,
  // bornes affinées au km près). Le reste des hypothèses est inchangé.
  function plagesKm(p, { min = 0, max = 60000, pas = 250 } = {}) {
    const gagnant = (k) => comparer(p, { kmAn: k }).moinsCher?.id ?? null;
    const plages = [];
    let debut = min, courant = gagnant(min);
    if (courant === null) return [];
    for (let k = min + pas; k <= max; k += pas) {
      const g = gagnant(k);
      if (g !== courant) {
        let lo = k - pas, hi = k;
        while (hi - lo > 1) { const mi = Math.floor((lo + hi) / 2); if (gagnant(mi) === courant) lo = mi; else hi = mi; }
        plages.push({ de: debut, a: lo, id: courant });
        debut = hi; courant = g;
      }
    }
    plages.push({ de: debut, a: max, id: courant });
    return plages;
  }

  // Alertes d'un scénario : dépassement ou forfait surdimensionné, crédit plus long que la détention…
  function alertes(p, s) {
    const l = [];
    if ((s.type === 'loa' || s.type === 'lld') && s.kmForfait > 0) {
      if (p.kmAn > s.kmForfait) {
        const d = kmDepasses(p.kmAn, s.kmForfait, p.duree);
        const leve = s.type === 'loa' && s.leverOption;
        l.push({ niveau: leve ? 'info' : 'alerte', texte: leve ? `Tu dépasses le forfait de ${km(p.kmAn - s.kmForfait)} par an : sans effet si tu lèves l'option (à vérifier au contrat), mais la voiture vaudra moins.` : `Dépassement estimé : ${km(d)} sur ${duree(p.duree)}, soit ${euros(Math.round(d * (s.prixKmSup || 0)), { centimes: false })}.` });
      } else if (p.kmAn < s.kmForfait * 0.8) {
        l.push({ niveau: 'info', texte: `Forfait de ${km(s.kmForfait)} par an pour ${km(p.kmAn)} parcourus : un forfait plus bas ferait sans doute baisser le loyer.` });
      }
    }
    if ((s.type === 'loa' || s.type === 'lld') && !(s.kmForfait > 0)) l.push({ niveau: 'info', texte: 'Forfait kilométrique non saisi : le dépassement n\'est pas compté.' });
    if (s.type === 'credit' && s.dureeCredit > p.duree) l.push({ niveau: 'info', texte: `Crédit sur ${duree(s.dureeCredit)} pour ${duree(p.duree)} de détention : le capital restant dû est remboursé à la revente.` });
    if (s.type === 'credit' && s.dureeCredit && s.dureeCredit < p.duree) l.push({ niveau: 'info', texte: `Crédit soldé après ${duree(s.dureeCredit)} : plus de mensualité ensuite.` });
    return l;
  }

  // ---------- Identifiants et normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const centimes = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' && Number(v) >= 0 ? Math.round(Number(v)) : null);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : defaut; };
  const tauxOuNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(100, Math.max(0, Number(v))));
  const structuredCloneSimple = (o) => JSON.parse(JSON.stringify(o));

  function normaliserScenario(x, i = 0, utilisees = []) {
    const s = x && typeof x === 'object' ? x : {};
    const type = TYPES.includes(s.type) ? s.type : 'comptant';
    let couleur = entier(s.couleur, 0, COULEURS.length - 1, null);
    if (couleur !== null && utilisees.includes(couleur)) couleur = null;
    if (couleur === null) couleur = [...COULEURS.keys()].find((k) => !utilisees.includes(k)) ?? (i % COULEURS.length);
    return {
      id: String(s.id || nouvelId()), type, couleur,
      nom: texte(s.nom, 60) || LIB_TYPE[type],
      prix: centimes(s.prix), // comptant et crédit : prix de l'offre (sinon celui de la comparaison)
      apport: centimes(s.apport) ?? 0,
      taux: tauxOuNull(s.taux),
      dureeCredit: entier(s.dureeCredit, 0, 120, 0),
      premierLoyer: centimes(s.premierLoyer) ?? 0,
      loyer: centimes(s.loyer) ?? 0,
      optionAchat: centimes(s.optionAchat) ?? 0,
      leverOption: type === 'loa' && !!s.leverOption,
      kmForfait: entier(s.kmForfait, 0, KM_MAX, 0),
      prixKmSup: Number.isFinite(Number(s.prixKmSup)) && Number(s.prixKmSup) >= 0 ? Math.round(Number(s.prixKmSup) * 10) / 10 : 0,
      entretienInclus: (type === 'loa' || type === 'lld') && !!s.entretienInclus,
      assuranceMois: centimes(s.assuranceMois) ?? 0,
      fraisDossier: centimes(s.fraisDossier) ?? 0,
      fraisRestitution: centimes(s.fraisRestitution) ?? 0,
      note: texte(s.note, 300),
    };
  }

  function normaliserProjet(x, defauts = {}) {
    const p = x && typeof x === 'object' ? x : {};
    const d = { duree: 48, kmAn: 15000, decote1: 20, decote2: 12, entretienAn: 50000, assuranceMois: 6000, placement: null, kmNormal: 15000, perteKm: 5, ...defauts };
    const scenarios = [];
    for (const [i, s] of (Array.isArray(p.scenarios) ? p.scenarios : []).slice(0, MAX_SCENARIOS).entries()) scenarios.push(normaliserScenario(s, i, scenarios.map((y) => y.couleur)));
    const questions = {};
    if (p.questions && typeof p.questions === 'object') for (const [k, v] of Object.entries(p.questions)) if (v) questions[texte(k, 40)] = true;
    return {
      id: String(p.id || nouvelId()),
      nom: texte(p.nom, 60) || 'Ma voiture',
      prix: centimes(p.prix),
      duree: entier(p.duree, DUREE_MIN, DUREE_MAX, d.duree),
      kmAn: entier(p.kmAn, 0, KM_MAX, d.kmAn),
      decote1: tauxOuNull(p.decote1) ?? d.decote1,
      decote2: tauxOuNull(p.decote2) ?? d.decote2,
      entretienAn: centimes(p.entretienAn) ?? d.entretienAn,
      assuranceMois: centimes(p.assuranceMois) ?? d.assuranceMois,
      placement: p.placement === undefined ? d.placement : tauxOuNull(p.placement),
      kmNormal: entier(p.kmNormal, 0, KM_MAX, d.kmNormal),
      perteKm: Number.isFinite(Number(p.perteKm)) && p.perteKm !== null && Number(p.perteKm) >= 0 ? Math.round(Number(p.perteKm) * 10) / 10 : d.perteKm,
      scenarios, questions,
      note: texte(p.note, 300),
    };
  }

  function etatVide() { return { version: 1, projets: [], actif: null }; }

  function normaliser(d, defauts = {}) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const projets = (Array.isArray(d.projets) ? d.projets : []).slice(0, 20).map((p) => normaliserProjet(p, defauts));
    const actif = projets.some((p) => p.id === d.actif) ? d.actif : (projets[0]?.id ?? null);
    return { ...v, ...d, version: 1, projets, actif };
  }

  // Scénario par défaut d'un type pour une comparaison (montants de l'offre à compléter).
  function scenarioDefaut(p, type, utilisees = []) {
    const base = { type, nom: LIB_TYPE[type], assuranceMois: p.assuranceMois };
    if (type === 'credit') Object.assign(base, { dureeCredit: p.duree, taux: null });
    if (type === 'loa') Object.assign(base, { leverOption: true });
    if (type === 'lld') Object.assign(base, { entretienInclus: true });
    if (type === 'loa' || type === 'lld') Object.assign(base, { kmForfait: Math.ceil(p.kmAn / 5000) * 5000 || 10000 });
    return normaliserScenario(base, utilisees.length, utilisees);
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(p) {
    const c = comparer(p);
    const res = c.tous;
    const noms = p.scenarios.map((s) => s.nom);
    const lignes = [['Poste', ...noms]];
    const cles = ['depart', 'frais', 'paiements', 'assurance', 'entretien', 'option', 'restantDu', 'kmSup', 'restitution', 'opportunite', 'valeur'];
    const libs = { depart: 'Versé au départ', frais: 'Frais de dossier', paiements: 'Mensualités ou loyers', assurance: 'Assurance', entretien: 'Entretien', option: 'Option d\'achat', restantDu: 'Capital restant dû', kmSup: 'Kilomètres supplémentaires', restitution: 'Frais de restitution', opportunite: 'Coût d\'opportunité', valeur: 'Valeur de revente (déduite)' };
    for (const k of cles) lignes.push([libs[k], ...res.map((x) => (x.complet ? nombreCsv(x.postes.find((y) => y[0] === k)[2]) : ''))]);
    lignes.push(['Coût total net', ...res.map((x) => (x.complet ? nombreCsv(x.net) : 'à compléter'))]);
    lignes.push(['Coût mensuel équivalent', ...res.map((x) => (x.complet ? nombreCsv(x.mensuel) : ''))]);
    lignes.push(['Coût au km', ...res.map((x) => (x.complet && x.parKm !== null ? (x.parKm / 100).toFixed(3).replace('.', ',') : ''))]);
    lignes.push([]);
    lignes.push(['Hypothèses', `${p.nom} ; prix ${nombreCsv(p.prix)} € ; ${p.duree} mois ; ${p.kmAn} km/an ; décote ${p.decote1} % puis ${p.decote2} %/an ; placement ${p.placement ?? 'non'}`]);
    return '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.VTR = {
    TYPES, LIB_TYPE, COULEURS, MAX_SCENARIOS, DUREE_MIN, DUREE_MAX, KM_MAX,
    lireMontant, lirePrixKm, lireTaux, lireEntier, euros, eurosKm, km, pct, duree, milliers,
    saisieMontant, saisiePrixKm, saisieTaux,
    mensualite, capitalRestant, coutInterets, valeurEstimee, coutOpportunite, kmDepasses,
    manques, prixDe, proprietaire, calculer, comparer, seuilsKm, seuilsDuMoinsCher, plagesKm, alertes,
    nouvelId, normaliserScenario, normaliserProjet, normaliser, etatVide, scenarioDefaut, versCsv,
    structuredCloneSimple,
  };
})(typeof window !== 'undefined' ? window : globalThis);
