// Vivre sans voiture QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.SVT) et par les tests Node (vm).
// Montants en centimes, taux en pour cent, durées en mois (sauf mention), distances en km.
// Aucune donnée de marché : tous les montants viennent de la saisie (valeurs d'exemple signalées).
(function (racine) {
  'use strict';

  const DETENTIONS = ['achat', 'credit', 'loa', 'lld'];
  const LIB_DETENTION = { achat: 'Achetée', credit: 'À crédit', loa: 'LOA', lld: 'LLD' };
  // Façons de sortir de la voiture, selon le mode de détention.
  const SORTIES = {
    achat: ['vente'],
    credit: ['vente'],
    loa: ['rachat-revente', 'option-finale', 'restitution'],
    lld: ['restitution-anticipee', 'fin-contrat'],
  };
  const LIB_SORTIE = {
    vente: 'Vendre la voiture',
    'rachat-revente': 'Racheter au barème puis revendre',
    'option-finale': 'Attendre la fin, lever l\'option et revendre',
    restitution: 'Attendre la fin et rendre la voiture',
    'restitution-anticipee': 'Rendre la voiture avant la fin (indemnité)',
    'fin-contrat': 'Attendre la fin du contrat et rendre la voiture',
  };
  // Couleurs des scénarios, dans cet ordre fixe (palette validée avec le script du skill dataviz :
  // un écart daltonien de 7,2 entre vert et rouge et un jaune peu contrasté, compensés par la
  // légende, des tirets différents par scénario et le tableau des données).
  const COULEURS = ['#2F6DB5', '#C2502F', '#1E9467', '#C9A000', '#7A4FB8'];
  const MAX_SCENARIOS = COULEURS.length;
  const HORIZON_MIN = 1, HORIZON_MAX = 15;
  const COULEUR_VOITURE = '#C2502F', COULEUR_SANS = '#2F6DB5';

  // ---------- Saisie et affichage ----------
  const deux = (n) => String(n).padStart(2, '0');
  // « 1 234,56 », « 1234.5 € » → centimes entiers ; null si vide ou illisible.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // « 1,859 » € le litre → 185.9 centimes (trois décimales en euros au plus).
  function lirePrixUnitaire(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]|\/(l|km|kwh|h)/gi, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Math.round(Number(s) * 1000) / 10;
  }
  // « 5,9 », « 30 % » → 5.9 ; borné à 0–100.
  function lireTaux(saisie) {
    const s = String(saisie ?? '').replace(/[\s %]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 100 ? Math.round(n * 1000) / 1000 : null;
  }
  // « 6,5 » L/100 km → 6.5 (décimal libre, 0–100).
  function lireDecimal(saisie, max = 100) {
    const s = String(saisie ?? '').replace(/[\s ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    const n = Number(s);
    return n <= max ? n : null;
  }
  function lireEntier(saisie, min, max) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '');
    if (!/^-?\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= min && n <= max ? n : null;
  }
  // Espaces insécables : un montant ne se coupe jamais en fin de ligne.
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function euros(c, { centimes = false, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < -0.5;
    const n = Math.abs(Math.round(c));
    const pre = neg ? '−' : (signe && n > 0 ? '+ ' : '');
    if (!centimes) return `${pre}${milliers(Math.round(n / 100))} €`;
    return `${pre}${milliers(Math.floor(n / 100))},${deux(n % 100)} €`;
  }
  const pct = (t) => (t === null || t === undefined ? '–' : `${String(Math.round(t * 100) / 100).replace('.', ',')} %`);
  const km = (n) => `${milliers(Math.round(n))} km`;
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)));
  const saisieUnitaire = (c) => (c === null || c === undefined ? '' : String(Math.round(c * 10) / 1000).replace('.', ','));
  const saisieDecimal = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
  function duree(mois) {
    if (mois <= 0) return 'tout de suite';
    const a = Math.floor(mois / 12), m = mois % 12;
    if (!a) return `${mois} mois`;
    return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
  }

  // ---------- Formules financières ----------
  // Mensualité d'un prêt à échéances constantes : M = C × r / (1 − (1 + r)^−n), r = taux / 12.
  function mensualite(capital, tauxAnnuel, n) {
    if (!(capital > 0) || !(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return capital / n;
    return (capital * r) / (1 - (1 + r) ** -n);
  }
  // Taux annuel implicite (en %) d'un capital remboursé par n mensualités constantes M (centimes).
  // Recherche par dichotomie entre 0 et 100 % ; null si les montants sont incohérents.
  function tauxImplicite(capital, mens, n) {
    if (!(capital > 0) || !(mens > 0) || !(n > 0)) return null;
    if (mens * n < capital - 0.5) return null; // rembourse moins que le capital : taux négatif
    if (Math.abs(mens * n - capital) < 0.5) return 0;
    let lo = 0, hi = 100;
    for (let i = 0; i < 80; i++) {
      const mi = (lo + hi) / 2;
      if (mensualite(capital, mi, n) > mens) hi = mi; else lo = mi;
    }
    return Math.round(((lo + hi) / 2) * 1000) / 1000;
  }
  // Intérêts payés sur les k prochaines mensualités d'un prêt (capital restant, taux, n restantes).
  function interetsSur(capital, tauxAnnuel, n, k) {
    if (!(capital > 0) || !(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return 0;
    const m = mensualite(capital, tauxAnnuel, n);
    let reste = capital, total = 0;
    for (let i = 0; i < Math.min(k, n); i++) { const it = reste * r; total += it; reste -= m - it; }
    return Math.round(total);
  }
  // Valeur estimée dans « mois » mois, à « dep » % de perte par an (composée). Hypothèse, pas une cote.
  const valeurFuture = (valeur, dep, mois) => (valeur > 0 ? Math.round(valeur * (1 - Math.min(100, Math.max(0, dep || 0)) / 100) ** (Math.max(0, mois) / 12)) : 0);

  // Barème de rachat d'une LOA : lignes { loyer: n, valeur } (après le loyer n). La valeur est un montant
  // en centimes, ou un % du prix du véhicule si l'unité est « pct ». Entre deux lignes : interpolation
  // linéaire ; avant la première ou après la dernière : valeur de la ligne la plus proche.
  function rachatAuBareme(loa, loyerN) {
    const lignes = (loa.bareme || []).filter((l) => l.loyer >= 0 && l.valeur > 0).slice().sort((a, b) => a.loyer - b.loyer);
    if (!lignes.length) return null;
    const conv = (v) => (loa.unite === 'pct' ? (loa.prixVehicule > 0 ? Math.round((loa.prixVehicule * v) / 100) : null) : v);
    if (loyerN <= lignes[0].loyer) return conv(lignes[0].valeur);
    const der = lignes[lignes.length - 1];
    if (loyerN >= der.loyer) return conv(der.valeur);
    for (let i = 1; i < lignes.length; i++) {
      const a = lignes[i - 1], b = lignes[i];
      if (loyerN <= b.loyer) {
        const v = a.valeur + ((b.valeur - a.valeur) * (loyerN - a.loyer)) / (b.loyer - a.loyer);
        const c = conv(v);
        return c === null ? null : Math.round(c);
      }
    }
    return null;
  }

  // Amortissement implicite d'une LOA (si le prix comptant et le barème sont saisis) : en assimilant
  // la LOA à un prêt du prix comptant (moins le premier loyer), remboursé par les loyers jusqu'au
  // loyer n puis par le rachat à ce moment, on retrouve le taux annuel implicite. Approximation :
  // les services facultatifs sont exclus des loyers, le premier loyer est payé au départ.
  function amortissementLoa(loa) {
    if (!(loa.prixVehicule > 0) || !(loa.loyer > 0) || !(loa.duree > 0)) return null;
    const capital = loa.prixVehicule - (loa.premierLoyer || 0);
    if (!(capital > 0)) return null;
    const fin = loa.option > 0 ? loa.option : null;
    if (fin === null) return null;
    const n = Math.max(1, loa.duree - 1);
    // VA des loyers + VA de l'option = capital ; dichotomie sur le taux.
    const va = (t) => { const r = t / 1200; let s = 0; for (let k = 1; k <= n; k++) s += loa.loyer / (1 + r) ** k; return s + fin / (1 + r) ** n; };
    if (va(0) < capital) return { taux: null, total: (loa.premierLoyer || 0) + loa.loyer * n + fin, surcout: (loa.premierLoyer || 0) + loa.loyer * n + fin - loa.prixVehicule };
    let lo = 0, hi = 100;
    for (let i = 0; i < 80; i++) { const mi = (lo + hi) / 2; if (va(mi) > capital) lo = mi; else hi = mi; }
    const taux = Math.round(((lo + hi) / 2) * 100) / 100;
    // Tableau : capital restant après chaque loyer.
    const r = taux / 1200;
    let reste = capital;
    const lignes = [];
    for (let k = 1; k <= n; k++) {
      const interet = reste * r;
      const amorti = loa.loyer - interet;
      reste -= amorti;
      lignes.push({ loyer: k + 1, interet: Math.round(interet), amorti: Math.round(amorti), reste: Math.round(reste) });
    }
    const total = (loa.premierLoyer || 0) + loa.loyer * n + fin;
    return { taux, lignes, total, surcout: total - loa.prixVehicule, interets: Math.round(lignes.reduce((s, l) => s + l.interet, 0)) };
  }

  // ---------- Coût annuel de la voiture ----------
  // Carburant ou recharge par an : (a) montant saisi, ou (b) km × consommation / 100 × prix unitaire.
  function carburantAn(v) {
    if (v.carburantMode === 'km') return Math.round(((v.kmAn || 0) * (v.conso || 0) * (v.prixEnergie || 0)) / 100);
    return v.carburantAn || 0;
  }
  // Postes du coût annuel de la voiture que l'on garde (centimes par an).
  // Crédit : seuls les intérêts sont un coût ; la part de capital remboursée reste dans la valeur de
  // la voiture, dont la baisse est déjà comptée (« perte de valeur »). LOA et LLD : loyers et services,
  // sans perte de valeur (la voiture appartient au loueur) ; garder la voiture = continuer avec un
  // contrat équivalent.
  function coutVoiture(v) {
    const postes = [];
    const ajout = (cle, lib, val) => postes.push([cle, lib, Math.round(val || 0)]);
    if (v.detention === 'achat' || v.detention === 'credit') ajout('perte', `Perte de valeur (${pct(v.depreciation)} par an)`, ((v.valeur || 0) * (v.depreciation || 0)) / 100);
    if (v.detention === 'credit') {
      const t = tauxImplicite(v.capitalRestant, v.mensualite, v.moisRestants);
      ajout('interets', 'Intérêts du crédit (12 prochains mois)', t === null ? 0 : interetsSur(v.capitalRestant, t, v.moisRestants, 12));
    }
    if (v.detention === 'loa' || v.detention === 'lld') {
      ajout('loyers', 'Loyers', (v.loyer || 0) * 12);
      ajout('services', 'Services du contrat (facultatifs)', (v.servicesMois || 0) * 12);
    }
    ajout('assurance', 'Assurance', v.assurance);
    ajout('entretien', 'Entretien et pneus', v.entretien);
    ajout('controle', 'Contrôle technique (lissé)', v.controle);
    ajout('carburant', v.carburantMode === 'km' ? `Carburant ou recharge (${km(v.kmAn || 0)} par an)` : 'Carburant ou recharge', carburantAn(v));
    ajout('stationnement', 'Stationnement, garage', v.stationnement);
    ajout('peages', 'Péages', v.peages);
    ajout('divers', 'Lavage, amendes et divers', v.divers);
    return { postes, total: postes.reduce((s, p) => s + p[2], 0) };
  }

  // ---------- Coût annuel sans voiture ----------
  // « deja » : ce qui est déjà dépensé aujourd'hui avec la voiture (abonnement, vélo) : déduit, car ce
  // n'est pas une dépense nouvelle.
  function coutLocation(r, facteur = 1) {
    const joursLoues = (r.joursLocation || 0) + (r.semainesLocation || 0) * 7;
    const location = ((r.joursLocation || 0) * (r.prixJour || 0) + (r.semainesLocation || 0) * (r.prixSemaine || 0) + joursLoues * (r.franchiseJour || 0)) * facteur;
    const carburant = ((r.kmLocation || 0) * (r.prixKmLocation || 0));
    return { joursLoues, location: Math.round(location), carburant: Math.round(carburant) };
  }
  function coutSansVoiture(r, { facteurLocation = 1, urgences = 0 } = {}) {
    const postes = [];
    const ajout = (cle, lib, val) => postes.push([cle, lib, Math.round(val || 0)]);
    const t = r.transports || {};
    const abonnements = (t.abonnes || 0) * (t.prixAbonnement || 0) * 12 * (1 - Math.min(100, t.partEmployeur || 0) / 100);
    ajout('transports', 'Transports en commun', Math.max(0, abonnements + (t.enfants || 0) + (t.tickets || 0) - (t.deja || 0)));
    const v = r.velo || {};
    const amort = v.achat > 0 && v.dureeAns > 0 ? Math.max(0, v.achat - (v.aides || 0)) / v.dureeAns : 0;
    ajout('velo', 'Vélo (achat amorti, entretien, assurance vol)', Math.max(0, amort + (v.entretien || 0) + (v.assurance || 0) - (v.deja || 0)));
    const l = coutLocation(r, facteurLocation);
    ajout('location', `Location de voiture (${l.joursLoues} jour${l.joursLoues > 1 ? 's' : ''} par an, franchise comprise)`, l.location);
    ajout('carburantLocation', 'Carburant des locations', l.carburant);
    const a = r.autopartage || {};
    ajout('autopartage', 'Autopartage', (a.abonnement || 0) + (a.heures || 0) * (a.prixHeure || 0) + (a.km || 0) * (a.prixKm || 0));
    ajout('taxis', 'Taxis ou VTC', (r.taxis || 0) * (r.prixTaxi || 0));
    ajout('train', 'Surcoût de train', r.train);
    ajout('livraisons', 'Livraisons de courses', (r.livraisons || 0) * (r.prixLivraison || 0));
    ajout('urgences', 'Parades d\'urgence (coûts saisis)', urgences);
    for (const x of r.autres || []) if (x.montant) ajout(`autre-${x.id}`, x.libelle || 'Autre dépense', x.montant);
    return { postes, total: postes.reduce((s, p) => s + p[2], 0), joursLoues: l.joursLoues };
  }
  // Achats faits une seule fois au moment de se passer de la voiture (rehausseur pliable, cape…).
  const equipementUnique = (r) => (r.equipement || []).reduce((s, x) => s + (x.montant || 0), 0);
  // Temps perdu (ou gagné) : minutes par jour ouvré / 60 × valeur d'une heure × jours ouvrés.
  const coutTemps = (t) => (t && t.valeurHeure > 0 && t.minutes ? Math.round(((t.minutes / 60) * t.valeurHeure * (t.jours || 0))) : 0);

  // ---------- Sortie de la voiture ----------
  // Renvoie { mois, cout, detail, possible, raison, venteNette } :
  // mois = mois depuis aujourd'hui avant la sortie (tant que la voiture reste, le gain n'a pas commencé) ;
  // cout = coût de la sortie (négatif : la sortie rapporte de l'argent par rapport au fait de garder).
  // Un paiement déjà fait (apport, premier loyer) n'entre pas : il est le même quelle que soit la décision.
  function sortie(v, s) {
    const lignes = [];
    const ligne = (lib, val) => lignes.push([lib, Math.round(val)]);
    const res = (mois, cout, extra = {}) => ({ mois, cout: Math.round(cout), lignes, possible: true, raison: '', venteNette: 0, ...extra });
    const venteCanal = (valeur) => {
      const ecart = s.canal === 'professionnel' ? (s.ecartPro || 0) : (s.ecartParticulier || 0);
      return Math.round(valeur * (1 - ecart / 100));
    };
    if (v.detention === 'achat' || v.detention === 'credit') {
      const mois = Math.max(0, s.delai || 0);
      const valeur = valeurFuture(v.valeur, v.depreciation, mois);
      const remise = Math.round((valeur * (s.remise || 0)) / 100);
      ligne('Remise de négociation', remise);
      ligne('Frais de vente (annonce, contrôle, réparations)', s.frais || 0);
      const venteNette = valeur - remise - (s.frais || 0);
      const capital = v.detention === 'credit' ? Math.round(capitalApres(v, mois)) : 0;
      if (capital) lignes.push(['Capital restant dû remboursé à la vente (pour mémoire, déjà dans la valeur)', capital]);
      return res(mois, remise + (s.frais || 0), { venteNette: venteNette - capital, valeurVente: valeur });
    }
    if (v.detention === 'loa') {
      const L = v.loa;
      const restants = Math.max(0, L.duree - L.loyersPayes);
      if (s.mode === 'rachat-revente') {
        const n = Math.max(L.loyersPayes, L.premierRachat || 0, s.loyerSortie || 0);
        if (n > L.duree) return { mois: restants, cout: 0, lignes, possible: false, raison: 'Le loyer choisi dépasse la durée du contrat.' };
        const mois = n - L.loyersPayes;
        const rachat = rachatAuBareme(L, n);
        if (rachat === null) return { mois, cout: 0, lignes, possible: false, raison: L.unite === 'pct' && !(L.prixVehicule > 0) ? 'Saisis le prix du véhicule pour un barème en %.' : 'Saisis le barème de rachat du contrat.' };
        const valeur = valeurFuture(v.valeur, v.depreciation, mois);
        const vente = venteCanal(valeur);
        ligne(`Rachat au barème après le loyer ${n}`, rachat);
        ligne(`Revente le même jour (${s.canal === 'professionnel' ? 'à un professionnel' : 'à un particulier'})`, -vente);
        ligne('Frais de vente', s.frais || 0);
        return res(mois, rachat - vente + (s.frais || 0), { venteNette: vente - rachat - (s.frais || 0), loyerSortie: n, rachat, valeurVente: vente });
      }
      if (s.mode === 'option-finale') {
        const valeur = valeurFuture(v.valeur, v.depreciation, restants);
        const vente = venteCanal(valeur);
        ligne('Option d\'achat finale', L.option || 0);
        ligne(`Revente (${s.canal === 'professionnel' ? 'à un professionnel' : 'à un particulier'})`, -vente);
        ligne('Frais de vente', s.frais || 0);
        if (!(L.option > 0)) return { mois: restants, cout: 0, lignes, possible: false, raison: 'Saisis le montant de l\'option d\'achat finale.' };
        return res(restants, (L.option || 0) - vente + (s.frais || 0), { venteNette: vente - L.option - (s.frais || 0), valeurVente: vente });
      }
      // restitution en fin de contrat
      const kmSup = Math.max(0, s.kmSup || 0);
      ligne('Frais de remise en état', s.remiseEnEtat || 0);
      ligne(`Kilomètres au-delà du forfait (${km(kmSup)})`, kmSup * (s.prixKmSup || 0));
      return res(restants, (s.remiseEnEtat || 0) + kmSup * (s.prixKmSup || 0));
    }
    if (v.detention === 'lld') {
      const L = v.lld;
      const restants = Math.max(0, L.duree - L.loyersPayes);
      if (s.mode === 'restitution-anticipee') {
        const mois = Math.min(restants, Math.max(0, s.delai || 0));
        const apres = restants - mois;
        const indemnite = s.indemniteMode === 'montant' ? (s.indemnite || 0) : Math.round(((v.loyer || 0) * apres * (s.indemnitePct || 0)) / 100);
        ligne(s.indemniteMode === 'montant' ? 'Indemnité de résiliation (montant saisi)' : `Indemnité : ${pct(s.indemnitePct)} des ${apres} loyers restants`, indemnite);
        ligne('Frais de remise en état', s.remiseEnEtat || 0);
        return res(mois, indemnite + (s.remiseEnEtat || 0));
      }
      ligne('Frais de remise en état', s.remiseEnEtat || 0);
      ligne('Kilomètres au-delà du forfait', Math.max(0, s.kmSup || 0) * (s.prixKmSup || 0));
      return res(restants, (s.remiseEnEtat || 0) + Math.max(0, s.kmSup || 0) * (s.prixKmSup || 0));
    }
    return res(0, 0);
  }
  // Capital restant dû d'un crédit dans « mois » mois (taux implicite des mensualités saisies).
  function capitalApres(v, mois) {
    const C = v.capitalRestant || 0, n = v.moisRestants || 0, M = v.mensualite || 0;
    if (!(C > 0) || !(n > 0) || mois >= n) return mois >= n ? 0 : C;
    const t = tauxImplicite(C, M, n);
    if (t === null || t === 0) return C * (1 - mois / n);
    const r = t / 1200;
    return Math.max(0, C * (1 + r) ** mois - (M * ((1 + r) ** mois - 1)) / r);
  }

  // ---------- Scénario complet ----------
  // Ce qui manque pour calculer (liste vide : complet).
  function manques(sc) {
    const v = sc.voiture, m = [];
    if ((v.detention === 'achat' || v.detention === 'credit' || sc.sortie.mode === 'rachat-revente' || sc.sortie.mode === 'option-finale') && !(v.valeur > 0)) m.push('la valeur de revente de la voiture');
    if (v.detention === 'credit' && (!(v.mensualite > 0) || !(v.moisRestants > 0) || !(v.capitalRestant > 0))) m.push('la mensualité, la durée et le capital restant du crédit');
    if ((v.detention === 'loa' || v.detention === 'lld') && !(v[v.detention].duree > 0)) m.push('la durée du contrat');
    if ((v.detention === 'loa' || v.detention === 'lld') && !(v.loyer > 0)) m.push('le loyer mensuel');
    return m;
  }

  // Calcule un scénario sur l'horizon (années). commun = { temps, placement, urgences (centimes/an) }.
  function calculer(sc, commun = {}, options = {}) {
    const horizon = commun.horizon || 5;
    const manque = manques(sc);
    const r = { id: sc.id, complet: !manque.length, manque, horizon };
    if (manque.length) return r;
    const cv = coutVoiture(sc.voiture);
    const cs = coutSansVoiture(sc.remplacement, { facteurLocation: options.facteurLocation || 1, urgences: commun.urgences || 0 });
    const temps = coutTemps(commun.temps);
    const so = options.sortie ? options.sortie : sortie(sc.voiture, sc.sortie);
    const placement = commun.placement > 0 && so.venteNette > 0 ? Math.round((so.venteNette * commun.placement) / 100) : 0;
    const gainAn = cv.total - cs.total - temps + placement;
    const equip = equipementUnique(sc.remplacement);
    const N = horizon * 12;
    const cumul = [];
    for (let m = 0; m <= N; m++) cumul.push(cumulAu(m, so, gainAn, equip));
    // Délai pour que le gain mensuel rembourse le coût de sortie et l'équipement.
    const unique = so.cout + equip;
    const amorti = gainAn > 0 ? (unique > 0 ? so.mois + Math.ceil(unique / (gainAn / 12)) : so.mois) : null;
    return Object.assign(r, {
      voiture: cv, sans: cs, temps, placement, gainAn, gainMois: Math.round(gainAn / 12), equipement: equip, sortie: so,
      cumul, cumulFin: cumul[N], amorti, possible: so.possible,
    });
  }
  // Gain cumulé au mois m : 0 tant que la voiture est là ; à la sortie, coût de sortie et équipement ;
  // ensuite le gain mensuel s'ajoute chaque mois.
  function cumulAu(m, so, gainAn, equip) {
    if (m < so.mois) return 0;
    return Math.round(-so.cout - equip + (gainAn / 12) * (m - so.mois));
  }

  // Sensibilité : gain si la location coûte 30 % plus cher ; jours de location supplémentaires
  // possibles avant que l'option sans voiture coûte plus cher que la voiture.
  function sensibilite(sc, commun) {
    const base = calculer(sc, commun);
    if (!base.complet) return null;
    const plus30 = calculer(sc, commun, { facteurLocation: 1.3 });
    const r = sc.remplacement;
    const l = coutLocation(r);
    const carbJour = l.joursLoues > 0 ? l.carburant / l.joursLoues : 0;
    const coutJour = (r.prixJour || 0) + (r.franchiseJour || 0) + carbJour;
    const joursEnPlus = base.gainAn > 0 && coutJour > 0 ? Math.floor(base.gainAn / coutJour) : 0;
    return { gainAn: base.gainAn, gainAnPlus30: plus30.gainAn, joursEnPlus, coutJour: Math.round(coutJour), joursLoues: l.joursLoues };
  }

  // Meilleur moment de sortie : balaie les sorties possibles et garde celle qui laisse le plus grand
  // gain cumulé à l'horizon. Renvoie la liste triée et la meilleure.
  function meilleureSortie(sc, commun) {
    const v = sc.voiture;
    const essais = [];
    const essayer = (s) => {
      const so = sortie(v, s);
      if (!so.possible) return;
      const x = calculer(sc, commun, { sortie: so });
      if (x.complet) essais.push({ s, so, cumulFin: x.cumulFin, gainAn: x.gainAn, lib: libelleSortie(v, s, so) });
    };
    if (v.detention === 'achat' || v.detention === 'credit') for (const d of [0, 3, 6, 12, 24]) essayer({ ...sc.sortie, mode: 'vente', delai: d });
    else if (v.detention === 'loa') {
      const L = v.loa;
      const debut = Math.max(L.loyersPayes, L.premierRachat || 0);
      for (let n = debut; n <= L.duree; n++) essayer({ ...sc.sortie, mode: 'rachat-revente', loyerSortie: n });
      essayer({ ...sc.sortie, mode: 'option-finale' });
      essayer({ ...sc.sortie, mode: 'restitution' });
    } else if (v.detention === 'lld') {
      const restants = Math.max(0, v.lld.duree - v.lld.loyersPayes);
      for (let d = 0; d < restants; d += Math.max(1, Math.floor(restants / 24))) essayer({ ...sc.sortie, mode: 'restitution-anticipee', delai: d });
      essayer({ ...sc.sortie, mode: 'fin-contrat' });
    }
    essais.sort((a, b) => b.cumulFin - a.cumulFin);
    return { meilleure: essais[0] || null, essais };
  }
  function libelleSortie(v, s, so) {
    if (s.mode === 'vente') return so.mois ? `Vendre dans ${duree(so.mois)}` : 'Vendre maintenant';
    if (s.mode === 'rachat-revente') return `Racheter et revendre après le loyer ${so.loyerSortie}${so.mois ? ` (dans ${duree(so.mois)})` : ' (maintenant)'}`;
    if (s.mode === 'option-finale') return `Lever l'option et revendre dans ${duree(so.mois)}`;
    if (s.mode === 'restitution' || s.mode === 'fin-contrat') return `Rendre la voiture à la fin du contrat, dans ${duree(so.mois)}`;
    if (s.mode === 'restitution-anticipee') return so.mois ? `Rendre la voiture dans ${duree(so.mois)}, avec indemnité` : 'Rendre la voiture maintenant, avec indemnité';
    return LIB_SORTIE[s.mode] || '';
  }

  // ---------- Score de faisabilité ----------
  // questions : [{ id, poids, bloquant, condition }] ; reponses : { id: 'oui' | 'non' | 'so' }.
  // Score = poids des « oui » / poids des questions répondues et applicables × 100.
  // Verdict bloquant si une question bloquante applicable est à « non ».
  function faisabilite(questions, reponses, foyer = {}) {
    const applicable = (q) => !q.condition || (q.condition === 'enfants' && (foyer.enfants || []).length > 0) || (q.condition === 'velo' && foyer.velo !== 'aucun');
    let total = 0, oui = 0, sansReponse = 0;
    const bloquants = [], aRegler = [];
    for (const q of questions) {
      if (!applicable(q)) continue;
      const r = reponses[q.id];
      if (r === 'so') continue;
      if (r !== 'oui' && r !== 'non') { sansReponse++; if (q.bloquant) aRegler.push(q); continue; }
      total += q.poids;
      if (r === 'oui') oui += q.poids;
      else if (q.bloquant) bloquants.push(q);
    }
    const score = total ? Math.round((oui / total) * 100) : null;
    const verdict = bloquants.length ? 'bloquant' : score === null ? 'inconnu' : score >= 70 ? 'favorable' : score >= 45 ? 'a-preparer' : 'difficile';
    return { score, verdict, bloquants, aRegler, sansReponse };
  }

  // Urgences applicables (selon le foyer), non couvertes, triées par gravité puis ordre de la base.
  const ORDRE_GRAVITE = { bloquant: 0, anticiper: 1, favorable: 2 };
  function urgencesOuvertes(urgences, etat, foyer = {}) {
    const applicable = (u) => !u.condition || (u.condition === 'enfants' && (foyer.enfants || []).length > 0) || (u.condition === 'velo' && foyer.velo !== 'aucun') || (u.condition === 'contrat' && foyer.contrat);
    return urgences.filter(applicable).filter((u) => etat[u.id]?.statut !== 'couvert')
      .map((u, i) => ({ u, i })).sort((a, b) => ORDRE_GRAVITE[a.u.gravite] - ORDRE_GRAVITE[b.u.gravite] || a.i - b.i).map((x) => x.u);
  }
  const coutUrgences = (etat) => Object.values(etat || {}).reduce((s, x) => s + (x && x.cout > 0 ? x.cout : 0), 0);

  // ---------- Phase de test ----------
  // Dépenses notées pendant la phase de test, ramenées à l'année, comparées au coût sans voiture prévu.
  function bilanTest(test, coutPrevuAn, aujourdhui = new Date()) {
    if (!test || !test.debut) return null;
    const debut = new Date(`${test.debut}T00:00:00`);
    const jours = Math.max(1, Math.floor((aujourdhui - debut) / 86400000) + 1);
    const depenses = (test.journal || []).reduce((s, x) => s + (x.montant || 0), 0);
    const parAn = Math.round((depenses / jours) * 365);
    const finPrevue = new Date(debut); finPrevue.setMonth(finPrevue.getMonth() + (test.duree || 2));
    return { jours, depenses, parAn, ecart: coutPrevuAn != null ? parAn - coutPrevuAn : null, termine: aujourdhui >= finPrevue, finPrevue, nb: (test.journal || []).length };
  }

  // ---------- Identifiants et normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const c0 = (v, defaut = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : defaut);
  const dec = (v, max, defaut = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(max, Math.round(Number(v) * 1000) / 1000) : defaut);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== null && v !== '' && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const choix = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
  const objet = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

  function normaliserVoiture(x, d = {}) {
    const v = objet(x);
    const detention = choix(v.detention, DETENTIONS, d.detention || 'achat');
    const contrat = (c, dc = {}) => {
      const o = objet(c);
      return {
        duree: entier(o.duree, 0, 120, dc.duree ?? 0), loyersPayes: entier(o.loyersPayes, 0, 120, dc.loyersPayes ?? 0),
        premierLoyer: c0(o.premierLoyer, dc.premierLoyer ?? 0), option: c0(o.option, dc.option ?? 0),
        premierRachat: entier(o.premierRachat, 0, 120, dc.premierRachat ?? 0), prixVehicule: c0(o.prixVehicule, dc.prixVehicule ?? 0),
        unite: choix(o.unite, ['montant', 'pct'], dc.unite || 'montant'),
        bareme: (Array.isArray(o.bareme) ? o.bareme : (dc.bareme || [])).slice(0, 60).map((l) => ({ loyer: entier(objet(l).loyer, 0, 120, 0), valeur: dec(objet(l).valeur, 1e10, 0) })).filter((l) => l.valeur > 0),
        kmForfait: entier(o.kmForfait, 0, 200000, dc.kmForfait ?? 0),
      };
    };
    return {
      detention,
      valeur: c0(v.valeur, d.valeur ?? 0), depreciation: dec(v.depreciation, 100, d.depreciation ?? 0),
      mensualite: c0(v.mensualite, d.mensualite ?? 0), moisRestants: entier(v.moisRestants, 0, 120, d.moisRestants ?? 0), capitalRestant: c0(v.capitalRestant, d.capitalRestant ?? 0),
      loyer: c0(v.loyer, d.loyer ?? 0), servicesMois: c0(v.servicesMois, d.servicesMois ?? 0),
      loa: contrat(v.loa, d.loa), lld: contrat(v.lld, d.lld),
      assurance: c0(v.assurance, d.assurance ?? 0), entretien: c0(v.entretien, d.entretien ?? 0), controle: c0(v.controle, d.controle ?? 0),
      carburantMode: choix(v.carburantMode, ['euros', 'km'], d.carburantMode || 'km'), carburantAn: c0(v.carburantAn, d.carburantAn ?? 0),
      kmAn: entier(v.kmAn, 0, 200000, d.kmAn ?? 0), conso: dec(v.conso, 100, d.conso ?? 0), energie: choix(v.energie, ['l', 'kwh'], d.energie || 'l'), prixEnergie: dec(v.prixEnergie, 100000, d.prixEnergie ?? 0),
      stationnement: c0(v.stationnement, d.stationnement ?? 0), peages: c0(v.peages, d.peages ?? 0), divers: c0(v.divers, d.divers ?? 0),
    };
  }

  function normaliserSortie(x, detention, d = {}) {
    const s = objet(x);
    const modes = SORTIES[detention] || ['vente'];
    return {
      mode: choix(s.mode, modes, choix(d.mode, modes, modes[0])),
      delai: entier(s.delai, 0, 120, d.delai ?? 0), loyerSortie: entier(s.loyerSortie, 0, 120, d.loyerSortie ?? 0),
      remise: dec(s.remise, 100, d.remise ?? 0), frais: c0(s.frais, d.frais ?? 0),
      canal: choix(s.canal, ['particulier', 'professionnel'], d.canal || 'particulier'),
      ecartParticulier: dec(s.ecartParticulier, 100, d.ecartParticulier ?? 0), ecartPro: dec(s.ecartPro, 100, d.ecartPro ?? 0),
      remiseEnEtat: c0(s.remiseEnEtat, d.remiseEnEtat ?? 0), kmSup: entier(s.kmSup, 0, 500000, d.kmSup ?? 0), prixKmSup: dec(s.prixKmSup, 10000, d.prixKmSup ?? 0),
      indemniteMode: choix(s.indemniteMode, ['pct', 'montant'], d.indemniteMode || 'pct'), indemnitePct: dec(s.indemnitePct, 100, d.indemnitePct ?? 0), indemnite: c0(s.indemnite, d.indemnite ?? 0),
    };
  }

  function normaliserRemplacement(x, d = {}) {
    const r = objet(x);
    const t = objet(r.transports), dt = objet(d.transports);
    const v = objet(r.velo), dv = objet(d.velo);
    const a = objet(r.autopartage), da = objet(d.autopartage);
    const lignes = (l, def) => (Array.isArray(l) ? l : (def || [])).slice(0, 20).map((y) => ({ id: String(objet(y).id || nouvelId()), libelle: texte(objet(y).libelle, 60), montant: c0(objet(y).montant, 0) }));
    return {
      transports: { abonnes: entier(t.abonnes, 0, 10, dt.abonnes ?? 0), prixAbonnement: c0(t.prixAbonnement, dt.prixAbonnement ?? 0), partEmployeur: dec(t.partEmployeur, 100, dt.partEmployeur ?? 0), enfants: c0(t.enfants, dt.enfants ?? 0), tickets: c0(t.tickets, dt.tickets ?? 0), deja: c0(t.deja, dt.deja ?? 0) },
      velo: { achat: c0(v.achat, dv.achat ?? 0), aides: c0(v.aides, dv.aides ?? 0), dureeAns: entier(v.dureeAns, 0, 30, dv.dureeAns ?? 0), entretien: c0(v.entretien, dv.entretien ?? 0), assurance: c0(v.assurance, dv.assurance ?? 0), deja: c0(v.deja, dv.deja ?? 0) },
      joursLocation: entier(r.joursLocation, 0, 366, d.joursLocation ?? 0), prixJour: c0(r.prixJour, d.prixJour ?? 0),
      semainesLocation: entier(r.semainesLocation, 0, 52, d.semainesLocation ?? 0), prixSemaine: c0(r.prixSemaine, d.prixSemaine ?? 0),
      franchiseJour: c0(r.franchiseJour, d.franchiseJour ?? 0), kmLocation: entier(r.kmLocation, 0, 200000, d.kmLocation ?? 0), prixKmLocation: dec(r.prixKmLocation, 10000, d.prixKmLocation ?? 0),
      autopartage: { abonnement: c0(a.abonnement, da.abonnement ?? 0), heures: entier(a.heures, 0, 8760, da.heures ?? 0), prixHeure: c0(a.prixHeure, da.prixHeure ?? 0), km: entier(a.km, 0, 100000, da.km ?? 0), prixKm: dec(a.prixKm, 10000, da.prixKm ?? 0) },
      taxis: entier(r.taxis, 0, 1000, d.taxis ?? 0), prixTaxi: c0(r.prixTaxi, d.prixTaxi ?? 0),
      train: c0(r.train, d.train ?? 0), livraisons: entier(r.livraisons, 0, 1000, d.livraisons ?? 0), prixLivraison: c0(r.prixLivraison, d.prixLivraison ?? 0),
      autres: lignes(r.autres, d.autres), equipement: lignes(r.equipement, d.equipement),
    };
  }

  function normaliserScenario(x, i = 0, utilisees = [], defauts = {}) {
    const s = objet(x);
    const voiture = normaliserVoiture(s.voiture, defauts.voiture);
    let couleur = entier(s.couleur, 0, COULEURS.length - 1, null);
    if (couleur !== null && utilisees.includes(couleur)) couleur = null;
    if (couleur === null) couleur = [...COULEURS.keys()].find((k) => !utilisees.includes(k)) ?? (i % COULEURS.length);
    return {
      id: String(s.id || nouvelId()), couleur, nom: texte(s.nom, 60) || `Scénario ${i + 1}`,
      voiture, sortie: normaliserSortie(s.sortie, voiture.detention, defauts.sortie), remplacement: normaliserRemplacement(s.remplacement, defauts.remplacement),
      note: texte(s.note, 300),
    };
  }

  function normaliserFoyer(x) {
    const f = objet(x);
    return {
      adultes: entier(f.adultes, 1, 10, 1), conducteurs: entier(f.conducteurs, 0, 10, 1),
      enfants: (Array.isArray(f.enfants) ? f.enfants : []).slice(0, 8).map((a) => entier(a, 0, 25, 0)),
      velo: choix(f.velo, ['electrique', 'classique', 'aucun'], 'aucun'), veloQuotidien: !!f.veloQuotidien,
      equipementVelo: Object.fromEntries(['siege', 'sacoches', 'panier', 'remorque', 'cargo'].map((k) => [k, !!objet(f.equipementVelo)[k]])),
      transports: !!f.transports, teletravail: entier(f.teletravail, 0, 7, 0), dureeTrajet: entier(f.dureeTrajet, 0, 600, 0),
      urgencesNuit: texte(f.urgencesNuit, 80), kmAn: entier(f.kmAn, 0, 200000, 0), partTravail: dec(f.partTravail, 100, 0),
      vacances: entier(f.vacances, 0, 52, 0), weekends: entier(f.weekends, 0, 104, 0), grosAchats: entier(f.grosAchats, 0, 365, 0),
      contrat: !!f.contrat,
    };
  }

  function etatVide() {
    return {
      version: 1, foyer: normaliserFoyer({}), reponses: {}, scenarios: [], actif: null, horizon: 5,
      temps: { minutes: 0, valeurHeure: 0, jours: 220 }, placement: 0,
      urgences: {}, quotidien: {}, equipementOk: {}, comptes: {}, calendrier: {}, semaine: null,
      test: { debut: '', duree: 2, journal: [] }, questionnaireFait: false,
    };
  }

  function normaliser(d, defauts = {}) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const scenarios = [];
    for (const [i, s] of (Array.isArray(d.scenarios) ? d.scenarios : []).slice(0, MAX_SCENARIOS).entries()) scenarios.push(normaliserScenario(s, i, scenarios.map((y) => y.couleur), defauts));
    const actif = scenarios.some((s) => s.id === d.actif) ? d.actif : (scenarios[0]?.id ?? null);
    const reponses = {};
    for (const [k, r] of Object.entries(objet(d.reponses))) if (['oui', 'non', 'so'].includes(r)) reponses[texte(k, 40)] = r;
    const urgences = {};
    for (const [k, u] of Object.entries(objet(d.urgences))) { const o = objet(u); urgences[texte(k, 40)] = { statut: choix(o.statut, ['couvert', 'a-prevoir'], 'a-prevoir'), cout: c0(o.cout, 0), note: texte(o.note, 200) }; }
    const drapeaux = (o) => Object.fromEntries(Object.entries(objet(o)).filter(([, x]) => x).map(([k, x]) => [texte(k, 40), x === true ? true : texte(x, 20)]));
    const t = objet(d.temps);
    const te = objet(d.test);
    return {
      ...v, ...d, version: 1, scenarios, actif, foyer: normaliserFoyer(d.foyer), reponses,
      horizon: entier(d.horizon, HORIZON_MIN, HORIZON_MAX, 5),
      temps: { minutes: entier(t.minutes, -240, 240, 0), valeurHeure: c0(t.valeurHeure, 0), jours: entier(t.jours, 0, 366, 220) },
      placement: dec(d.placement, 20, 0),
      urgences, quotidien: drapeaux(d.quotidien), equipementOk: drapeaux(d.equipementOk), comptes: drapeaux(d.comptes), calendrier: drapeaux(d.calendrier),
      semaine: Array.isArray(d.semaine) ? d.semaine.slice(0, 7).map((j) => texte(j, 160)) : null,
      test: {
        debut: /^\d{4}-\d{2}-\d{2}$/.test(te.debut || '') ? te.debut : '', duree: entier(te.duree, 1, 24, 2),
        journal: (Array.isArray(te.journal) ? te.journal : []).slice(0, 500).map((j) => { const o = objet(j); return { id: String(o.id || nouvelId()), date: /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : '', type: choix(o.type, ['location', 'train', 'taxi', 'autopartage', 'livraison', 'transports', 'autre'], 'autre'), montant: c0(o.montant, 0), note: texte(o.note, 120) }; }),
      },
      questionnaireFait: !!d.questionnaireFait,
    };
  }

  // Valeurs communes à tous les scénarios, pour calculer().
  const commun = (E) => ({ horizon: E.horizon, temps: E.temps, placement: E.placement, urgences: coutUrgences(E.urgences) });

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(E) {
    const co = commun(E);
    const res = E.scenarios.map((s) => ({ s, x: calculer(s, co) }));
    const lignes = [['Scénario', ...res.map(({ s }) => s.nom)]];
    const ligne = (lib, f) => lignes.push([lib, ...res.map(({ x }) => (x.complet ? f(x) : 'à compléter'))]);
    ligne('Mode de détention', (x) => LIB_DETENTION[E.scenarios.find((s) => s.id === x.id).voiture.detention]);
    ligne('Coût annuel de la voiture (€)', (x) => nombreCsv(x.voiture.total));
    ligne('Coût annuel sans voiture (€)', (x) => nombreCsv(x.sans.total));
    ligne('Coût du temps (€ par an)', (x) => nombreCsv(x.temps));
    ligne('Placement de la vente (€ par an)', (x) => nombreCsv(x.placement));
    ligne('Gain annuel (€)', (x) => nombreCsv(x.gainAn));
    ligne('Gain mensuel (€)', (x) => nombreCsv(x.gainMois));
    ligne('Mois avant la sortie', (x) => x.sortie.mois);
    ligne('Coût de sortie (€)', (x) => nombreCsv(x.sortie.cout));
    ligne('Équipement acheté une fois (€)', (x) => nombreCsv(x.equipement));
    ligne(`Gain cumulé sur ${E.horizon} ans (€)`, (x) => nombreCsv(x.cumulFin));
    lignes.push([]);
    lignes.push(['Détail', 'Poste', ...res.map(({ s }) => s.nom)]);
    const postes = (cote) => { const cles = []; res.forEach(({ x }) => x.complet && x[cote].postes.forEach(([k, lib]) => { if (!cles.some((c) => c[0] === k)) cles.push([k, lib]); })); return cles; };
    for (const [cote, nom] of [['voiture', 'Avec la voiture'], ['sans', 'Sans voiture']]) for (const [k, lib] of postes(cote)) lignes.push([nom, lib, ...res.map(({ x }) => (x.complet ? nombreCsv((x[cote].postes.find((p) => p[0] === k) || [0, 0, 0])[2]) : ''))]);
    lignes.push([]);
    lignes.push(['Hypothèses', `horizon ${E.horizon} ans ; temps ${E.temps.minutes} min par jour ouvré à ${nombreCsv(E.temps.valeurHeure)} € l'heure ; placement ${E.placement} % ; simulation, pas un conseil financier`]);
    return '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.SVT = {
    DETENTIONS, LIB_DETENTION, SORTIES, LIB_SORTIE, COULEURS, MAX_SCENARIOS, HORIZON_MIN, HORIZON_MAX, COULEUR_VOITURE, COULEUR_SANS,
    lireMontant, lirePrixUnitaire, lireTaux, lireDecimal, lireEntier, euros, pct, km, duree, milliers,
    saisieMontant, saisieUnitaire, saisieDecimal,
    mensualite, tauxImplicite, interetsSur, valeurFuture, rachatAuBareme, amortissementLoa, capitalApres,
    carburantAn, coutVoiture, coutLocation, coutSansVoiture, equipementUnique, coutTemps, sortie,
    manques, calculer, cumulAu, sensibilite, meilleureSortie, libelleSortie, faisabilite, urgencesOuvertes, coutUrgences, bilanTest,
    nouvelId, normaliserVoiture, normaliserSortie, normaliserRemplacement, normaliserScenario, normaliserFoyer, normaliser, etatVide, commun, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
