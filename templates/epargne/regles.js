// Objectif d'épargne et fonds d'urgence QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.EPG) et par les tests Node (vm).
// Montants en centimes entiers ; taux en pourcentage annuel saisi par l'utilisateur (2,5 = 2,5 %) ;
// mois « AAAA-MM », dates « AAAA-MM-JJ ». Aucun taux de marché ni de livret n'est intégré.
(function (racine) {
  'use strict';

  const CAPITALISATIONS = ['mensuelle', 'annuelle'];
  const MAX_MOIS = 600; // 50 ans : au-delà, l'objectif est déclaré hors d'atteinte

  // ---------- Montants ----------
  // « 1 234,56 », « 12.5 », « 12 € » → centimes entiers ; null si illisible ou négatif.
  function versCentimes(saisie) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) && saisie >= 0 ? Math.round(saisie * 100) : null;
    const s = String(saisie ?? '').replace(/[\s\u00a0\u202f€]/g, '').replace(/^\+/, '');
    if (!/^\d+(?:[.,]\d{0,2})?$/.test(s)) return null;
    const [ent, dec = ''] = s.split(/[.,]/);
    return Number(ent) * 100 + Number((dec + '00').slice(0, 2));
  }
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  function euros(c, { signe = false } = {}) {
    const n = Math.abs(Math.round(c));
    const s = `${milliers(Math.floor(n / 100))},${String(n % 100).padStart(2, '0')} €`;
    if (c < 0) return `−${s}`;
    return signe && c > 0 ? `+${s}` : s;
  }
  function eurosRonds(c, { signe = false } = {}) {
    const n = Math.round(Math.abs(c) / 100);
    const s = `${milliers(n)} €`;
    if (c < 0 && n) return `−${s}`;
    return signe && n && c > 0 ? `+${s}` : s;
  }
  // Valeur d'un montant pour un champ de saisie : 123450 → « 1234,50 ».
  const versSaisie = (c) => (Number.isInteger(c) ? `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}` : '');

  // « 2,5 », « 2.5 % », « 0 » → 2.5 ; null si illisible, négatif ou au-delà de 30 % (saisie manifestement fausse).
  function lireTaux(saisie) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) && saisie >= 0 && saisie <= 30 ? Math.round(saisie * 1000) / 1000 : null;
    const s = String(saisie ?? '').replace(/[\s\u00a0\u202f%]/g, '');
    if (s === '') return 0;
    if (!/^\d{1,2}(?:[.,]\d{0,3})?$/.test(s)) return null;
    const v = Number(s.replace(',', '.'));
    return v <= 30 ? v : null;
  }
  const tauxTexte = (t) => `${String(Math.round(t * 1000) / 1000).replace('.', ',')} %`;

  // ---------- Mois et dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const moisDe = (d) => (d && typeof d.getFullYear === 'function' ? `${d.getFullYear()}-${deux(d.getMonth() + 1)}` : String(d).slice(0, 7));
  const jourDe = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  function ajoutMois(mois, n) {
    const [a, m] = mois.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`;
  }
  function ecartMois(de, a) {
    const [a1, m1] = de.split('-').map(Number);
    const [a2, m2] = a.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  }
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
  // « 37 mois » → « 3 ans et 1 mois ».
  function dureeTexte(n) {
    if (n <= 0) return '0 mois';
    const a = Math.floor(n / 12), m = n % 12;
    const ta = a ? `${a} an${a > 1 ? 's' : ''}` : '';
    const tm = m ? `${m} mois` : '';
    return ta && tm ? `${ta} et ${tm}` : ta || tm;
  }

  // ---------- Intérêts composés ----------
  // Intérêts d'un mois sur le solde : solde × taux annuel ÷ 12, arrondis au centime.
  const interetsMois = (solde, taux) => (solde > 0 && taux > 0 ? Math.round((solde * taux) / 1200) : 0);

  // Projection mois par mois, à partir du mois `debut` (le premier versement à venir).
  // p : { solde, versement, taux, capitalisation ('mensuelle' | 'annuelle'), debut, cible,
  //       extras: [{ mois, montant }] (montant négatif = retrait prévu), horizon (mois minimum à simuler),
  //       arretAtteint (true : plus de versement une fois la cible atteinte, dernier versement ajusté), max,
//       premier (versement du premier mois s'il diffère du versement régulier) }
  // Chaque mois : intérêts calculés sur le solde de début de mois ; en capitalisation mensuelle ils
  // s'ajoutent tout de suite, en annuelle ils s'accumulent et sont crédités en décembre (comme un livret).
  // Puis le versement du mois et les versements ou retraits ponctuels.
  // Retour : { mois: [...], atteint: 'AAAA-MM' | null, dejaAtteint, duree, verseAuTerme, interetsAuTerme, jamais }
  function projeter(p) {
    const { versement = 0, taux = 0, capitalisation = 'mensuelle', debut, cible = 0, extras = [], horizon = 0, arretAtteint = true, max = MAX_MOIS, premier } = p;
    let solde = Math.max(0, Math.round(p.solde || 0));
    let courus = 0, cumulVerse = 0, cumulInterets = 0;
    const res = { debut, depart: solde, mois: [], atteint: null, dejaAtteint: cible > 0 && solde >= cible, duree: 0, verseAuTerme: 0, interetsAuTerme: 0, jamais: false };
    if (res.dejaAtteint) { res.atteint = ajoutMois(debut, -1); }
    const ext = extras.filter((x) => x && estMois(x.mois) && x.mois >= debut && Number.isFinite(x.montant) && x.montant !== 0);
    const derniereExtra = ext.reduce((m, x) => (x.mois > m ? x.mois : m), debut);
    const impossible = () => versement <= 0 && taux <= 0 && derniereExtra <= res.mois.at(-1)?.mois;
    for (let i = 0; i < max; i++) {
      const atteint = res.atteint !== null;
      if (i >= horizon && (atteint || cible <= 0 || impossible())) break;
      const mois = ajoutMois(debut, i);
      const s0 = solde;
      const it = interetsMois(solde, taux);
      let credites = 0;
      if (capitalisation === 'annuelle') courus += it;
      else { solde += it; credites = it; }
      // `premier` : versement du premier mois s'il diffère (reste à verser du mois en cours).
      const prevuMois = i === 0 && Number.isFinite(premier) ? Math.max(0, premier) : versement;
      let verse = prevuMois > 0 && !(arretAtteint && atteint) ? prevuMois : 0;
      if (arretAtteint && !atteint && cible > 0 && verse > 0) {
        // Dernier versement ajusté : juste ce qui manque (les intérêts annuels non crédités ne comptent pas).
        verse = Math.min(verse, Math.max(0, cible - solde));
      }
      let ponctuel = 0;
      for (const x of ext) if (x.mois === mois && !(arretAtteint && atteint && x.montant > 0)) ponctuel += x.montant;
      solde += verse;
      if (ponctuel < 0) ponctuel = -Math.min(-ponctuel, solde);
      solde += ponctuel;
      if (capitalisation === 'annuelle' && mois.endsWith('-12')) { solde += courus; credites = courus; courus = 0; }
      cumulVerse += verse + Math.max(0, ponctuel);
      cumulInterets += credites;
      res.mois.push({ mois, index: i, debut: s0, interets: credites, courus, verse, ponctuel, solde, cumulVerse, cumulInterets });
      if (!atteint && cible > 0 && solde >= cible) {
        res.atteint = mois; res.duree = i + 1; res.verseAuTerme = cumulVerse; res.interetsAuTerme = cumulInterets;
      }
    }
    if (cible > 0 && res.atteint === null) res.jamais = true;
    return res;
  }

  // Solde projeté à la fin d'un mois donné (dernier connu si le mois dépasse la projection).
  function soldeAu(proj, mois) {
    if (!proj.mois.length || mois < proj.debut) return proj.depart;
    const m = proj.mois.find((x) => x.mois === mois);
    return m ? m.solde : proj.mois.at(-1).solde;
  }

  // Versement mensuel minimal (arrondi à l'euro supérieur) pour atteindre la cible au plus tard en `fin`.
  // 0 si déjà atteinte ; null si `fin` est avant le premier mois du plan.
  function versementPour(p, fin) {
    const cible = p.cible || 0;
    if (cible <= 0 || (p.solde || 0) >= cible) return 0;
    if (!estMois(fin) || fin < p.debut) return null;
    const ok = (v) => { const r = projeter({ ...p, versement: v, horizon: 0 }); return r.atteint !== null && r.atteint <= fin; };
    let lo = 0, hi = Math.max(100, cible - (p.solde || 0));
    if (ok(0)) return 0;
    while (!ok(hi)) hi *= 2;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid; }
    return Math.ceil(hi / 100) * 100;
  }

  // ---------- Objectifs ----------
  const somme = (liste, cle = 'montant') => liste.reduce((s, x) => s + (Number.isInteger(x?.[cle]) ? x[cle] : 0), 0);
  // Dépenses essentielles mensuelles d'un fonds d'urgence (somme des postes saisis).
  const depensesMensuelles = (o) => somme(o?.urgence?.depenses || []);
  // Montant visé : fonds d'urgence = dépenses × mois ; sinon somme des postes du budget, ou montant saisi.
  function cibleObjectif(o) {
    if (o.urgence) return Math.round(depensesMensuelles(o) * (o.urgence.mois || 0));
    if (o.postes && o.postes.length) return somme(o.postes);
    return Math.max(0, o.cible | 0);
  }
  const mouvementsDe = (o, mouvements) => mouvements.filter((m) => m.objectifId === o.id);
  // Solde réel : solde de départ + versements − retraits + intérêts reçus, jusqu'à une date incluse.
  function soldeReel(o, mouvements, jusqua = '9999-12-31') {
    return Math.max(0, (o.soldeInitial | 0) + mouvementsDe(o, mouvements).filter((m) => m.date <= jusqua).reduce((s, m) => s + m.montant, 0));
  }
  // Courbe réelle : point de départ puis un point par mouvement, triés par date.
  function historiqueSolde(o, mouvements) {
    let s = o.soldeInitial | 0;
    const pts = [{ date: `${o.debut}-01`, solde: s, mouvement: null }];
    for (const m of [...mouvementsDe(o, mouvements)].sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)))) {
      s = Math.max(0, s + m.montant);
      pts.push({ date: m.date, solde: s, mouvement: m });
    }
    return pts;
  }
  // Solde réel en fin de chaque mois, de `de` à `a` inclus.
  function soldesMensuels(o, mouvements, de, a) {
    const n = ecartMois(de, a);
    const out = [];
    for (let i = 0; i <= n; i++) { const m = ajoutMois(de, i); out.push({ mois: m, solde: soldeReel(o, mouvements, `${m}-31`) }); }
    return out;
  }

  // Versements ponctuels prévus d'un objectif (prime, remboursement… ou retrait prévu).
  const extrasDe = (o, prevus) => prevus.filter((x) => x.objectifId === o.id).map((x) => ({ mois: x.mois, montant: x.montant }));

  // Projection de l'objectif depuis son solde réel, à partir du mois `courant`.
  // Ce qui a déjà été versé ce mois-ci est déduit du versement régulier du mois.
  function projectionObjectif(o, mouvements, prevus, courant, opts = {}) {
    const solde = soldeReel(o, mouvements);
    const reste = Math.max(0, (o.versement | 0) - verseDuMois(o, mouvements, courant));
    const p = projeter({ solde, versement: o.versement | 0, premier: reste, taux: o.taux || 0, capitalisation: o.capitalisation, cible: cibleObjectif(o), debut: courant, extras: extrasDe(o, prevus), ...opts });
    return { ...p, solde };
  }

  // Statut d'un objectif : 'atteint', 'dans-les-temps', 'en-retard', 'sans-date', 'pause' ou 'jamais'.
  function statutObjectif(o, mouvements, prevus, courant) {
    const cible = cibleObjectif(o);
    const solde = soldeReel(o, mouvements);
    const proj = projectionObjectif(o, mouvements, prevus, courant);
    const base = { cible, solde, reste: Math.max(0, cible - solde), part: cible > 0 ? Math.min(1, solde / cible) : 0, atteint: proj.atteint, proj };
    if (cible <= 0) return { ...base, statut: 'sans-cible' };
    if (solde >= cible) return { ...base, statut: 'atteint' };
    if (proj.jamais) return { ...base, statut: (o.versement | 0) > 0 ? 'jamais' : 'pause', necessaire: o.dateCible ? versementPour({ solde, taux: o.taux, capitalisation: o.capitalisation, cible, debut: courant, extras: extrasDe(o, prevus) }, o.dateCible) : null };
    if (!o.dateCible) return { ...base, statut: 'sans-date' };
    const necessaire = versementPour({ solde, taux: o.taux, capitalisation: o.capitalisation, cible, debut: courant, extras: extrasDe(o, prevus) }, o.dateCible);
    if (proj.atteint <= o.dateCible) return { ...base, statut: 'dans-les-temps', avance: ecartMois(proj.atteint, o.dateCible), necessaire };
    return { ...base, statut: 'en-retard', retard: ecartMois(o.dateCible, proj.atteint), necessaire };
  }

  // ---------- Jalons ----------
  // Paliers : pourcentages de la cible ; pour un fonds d'urgence, aussi 1, 3 et 6 mois de dépenses couverts.
  function jalons(o, pourcentages = [10, 25, 50, 75, 100]) {
    const cible = cibleObjectif(o);
    if (cible <= 0) return [];
    const liste = pourcentages.map((p) => ({ id: `p${p}`, libelle: p === 100 ? 'Objectif atteint' : `${p} %`, montant: Math.round((cible * p) / 100) }));
    if (o.urgence) {
      const dep = depensesMensuelles(o);
      for (const n of [1, 3, 6]) if (dep > 0 && n < o.urgence.mois) liste.push({ id: `m${n}`, libelle: `${n} mois couvert${n > 1 ? 's' : ''}`, montant: dep * n });
    }
    const vus = new Set();
    return liste.sort((a, b) => a.montant - b.montant || a.id.localeCompare(b.id)).filter((j) => (vus.has(j.montant) ? false : vus.add(j.montant)));
  }
  // Chaque jalon : date de franchissement réelle (d'après l'historique) ou mois prévu (d'après la projection).
  function etatJalons(o, mouvements, proj) {
    const hist = historiqueSolde(o, mouvements);
    return jalons(o).map((j) => {
      const reel = hist.find((h) => h.solde >= j.montant);
      if (reel) return { ...j, atteintLe: reel.date, depart: reel.mouvement === null };
      const p = proj ? proj.mois.find((m) => m.solde >= j.montant) : null;
      return { ...j, atteintLe: null, prevuLe: p ? p.mois : null };
    });
  }

  // ---------- Fonds d'urgence ----------
  // Mois de dépenses couverts par le solde, à une décimale près (arrondi inférieur).
  const moisCouverts = (solde, depenses) => (depenses > 0 ? Math.floor((solde / depenses) * 10) / 10 : 0);
  // Repère de taille du fonds : mois de la situation choisie + 1 par facteur coché, borné de 3 à 12.
  function moisConseilles(reponses, questions) {
    const sit = questions.situations.find((s) => s.id === reponses?.situation) || questions.situations[0];
    const plus = questions.facteurs.filter((f) => reponses?.facteurs?.includes(f.id)).reduce((s, f) => s + f.plus, 0);
    return Math.max(3, Math.min(12, sit.mois + plus));
  }

  // ---------- Suivi du mois ----------
  const verseDuMois = (o, mouvements, mois) => mouvementsDe(o, mouvements).filter((m) => m.type === 'versement' && m.date.startsWith(mois)).reduce((s, m) => s + m.montant, 0);
  // Ce qui est prévu pour l'objectif ce mois-ci : versement régulier + versements ponctuels positifs.
  // Rien n'est prévu si l'objectif était déjà atteint au début du mois.
  function prevuDuMois(o, mouvements, prevus, mois) {
    const cible = cibleObjectif(o);
    const debutMois = soldeReel(o, mouvements, `${ajoutMois(mois, -1)}-31`);
    if (cible > 0 && debutMois >= cible) return 0;
    const ponctuels = prevus.filter((x) => x.objectifId === o.id && x.mois === mois && x.montant > 0).reduce((s, x) => s + x.montant, 0);
    const brut = (o.versement | 0) + ponctuels;
    return cible > 0 ? Math.min(brut, Math.max(0, cible - debutMois)) : brut;
  }
  function etatDuMois(o, mouvements, prevus, mois) {
    const prevu = prevuDuMois(o, mouvements, prevus, mois);
    const verse = verseDuMois(o, mouvements, mois);
    const statut = prevu <= 0 ? (verse > 0 ? 'fait' : 'rien') : verse >= prevu ? 'fait' : verse > 0 ? 'partiel' : 'afaire';
    return { prevu, verse, reste: Math.max(0, prevu - verse), statut };
  }
  // Rythme des `n` derniers mois complets (avant `courant`) : versé contre prévu (versement régulier seul).
  function rythme(o, mouvements, courant, n = 3) {
    const depuis = ajoutMois(courant, -n) < o.debut ? o.debut : ajoutMois(courant, -n);
    const nb = Math.max(0, ecartMois(depuis, courant));
    if (!nb || !(o.versement > 0)) return null;
    let verse = 0;
    for (let i = 0; i < nb; i++) verse += verseDuMois(o, mouvements, ajoutMois(depuis, i));
    const prevu = (o.versement | 0) * nb;
    return { mois: nb, prevu, verse, ecart: verse - prevu };
  }

  // ---------- Scénarios ----------
  // Compare plusieurs hypothèses pour un objectif, depuis le même solde et le même mois.
  // scenarios : [{ nom, versement, taux, apport }] ; apport = somme versée tout de suite en plus.
  function comparerScenarios(base, scenarios) {
    const { solde, cible, debut, capitalisation, extras = [], dateCible = null } = base;
    const sims = scenarios.map((s) => projeter({ solde: solde + (s.apport | 0), versement: s.versement | 0, taux: s.taux || 0, capitalisation, cible, debut, extras }));
    const durees = sims.filter((x) => x.atteint && !x.dejaAtteint).map((x) => x.duree);
    const horizon = Math.min(MAX_MOIS, Math.max(12, dateCible ? ecartMois(debut, dateCible) + 1 : 0, Math.round((Math.max(0, ...durees) || 24) * 1.15) + 1));
    return scenarios.map((s, i) => {
      const sim = sims[i];
      const longue = projeter({ solde: solde + (s.apport | 0), versement: s.versement | 0, taux: s.taux || 0, capitalisation, cible, debut, extras, horizon, arretAtteint: false });
      return {
        ...s, sim, longue,
        atteint: sim.atteint, dejaAtteint: sim.dejaAtteint, duree: sim.duree, jamais: sim.jamais,
        totalVerse: (s.apport | 0) + sim.verseAuTerme, interets: sim.interetsAuTerme,
        aDate: dateCible ? soldeAu(longue, dateCible) : null,
        horizon,
      };
    });
  }

  // ---------- Plan d'ensemble ----------
  const actif = (o) => !o.archive;
  // Versements réguliers prévus par mois, tous objectifs actifs non atteints.
  function totalVersements(objectifs, mouvements) {
    return objectifs.filter(actif).filter((o) => { const c = cibleObjectif(o); return !(c > 0 && soldeReel(o, mouvements) >= c); }).reduce((s, o) => s + (o.versement | 0), 0);
  }
  // Plan des `n` prochains mois : versement prévu par objectif (s'arrête à l'atteinte de chaque cible).
  function planVersements(objectifs, mouvements, prevus, courant, n = 12) {
    const projs = objectifs.filter(actif).map((o) => ({ o, p: projectionObjectif(o, mouvements, prevus, courant, { horizon: n }) }));
    return Array.from({ length: n }, (_, i) => {
      const mois = ajoutMois(courant, i);
      const lignes = projs.map(({ o, p }) => { const m = p.mois.find((x) => x.mois === mois); return { id: o.id, montant: m ? m.verse + Math.max(0, m.ponctuel) : 0, atteint: p.atteint === mois }; }).filter((l) => l.montant > 0 || l.atteint);
      return { mois, lignes, total: lignes.reduce((s, l) => s + l.montant, 0) };
    });
  }

  // ---------- Export ----------
  const csvNombre = (c) => (c / 100).toFixed(2).replace('.', ',');
  const csvTexte = (s) => (/[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const TYPES_MVT = { versement: 'Versement', retrait: 'Retrait', interets: 'Intérêts reçus' };
  function csvMouvements(objectifs, mouvements) {
    const nom = new Map(objectifs.map((o) => [o.id, o.nom]));
    const lignes = [['Date', 'Objectif', 'Type', 'Montant', 'Note'].join(';')];
    for (const m of [...mouvements].sort((a, b) => a.date.localeCompare(b.date))) {
      lignes.push([m.date, csvTexte(nom.get(m.objectifId) || 'Objectif supprimé'), TYPES_MVT[m.type] || m.type, csvNombre(m.montant), csvTexte(m.note || '')].join(';'));
    }
    return lignes.join('\r\n');
  }

  // ---------- État ----------
  const etatVide = () => ({ version: 1, prenom: '', capacite: 0, objectifs: [], prevus: [], mouvements: [] });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const cent = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
    const signe = (x) => (Number.isInteger(x) ? x : 0);
    const lignes = (x) => tab(x).filter((p) => p && p.id).map((p) => ({ nom: '', ...p, montant: cent(p.montant) }));
    const objectifs = tab(d.objectifs).filter((o) => o && o.id).map((o) => ({
      type: 'autre', nom: 'Objectif', note: '', support: '', dateCible: null, archive: false, ...o,
      cible: cent(o.cible), soldeInitial: cent(o.soldeInitial), versement: cent(o.versement),
      taux: lireTaux(o.taux) ?? 0,
      capitalisation: CAPITALISATIONS.includes(o.capitalisation) ? o.capitalisation : 'mensuelle',
      debut: estMois(o.debut) ? o.debut : moisDe(new Date()),
      dateCible: estMois(o.dateCible) ? o.dateCible : null,
      postes: lignes(o.postes),
      urgence: o.urgence && typeof o.urgence === 'object' ? {
        mois: Number.isFinite(o.urgence.mois) && o.urgence.mois > 0 ? Math.min(24, Math.round(o.urgence.mois)) : 6,
        depenses: lignes(o.urgence.depenses),
        reponses: o.urgence.reponses && typeof o.urgence.reponses === 'object' ? { situation: String(o.urgence.reponses.situation || ''), facteurs: tab(o.urgence.reponses.facteurs).map(String) } : { situation: '', facteurs: [] },
      } : null,
      scenarios: tab(o.scenarios).slice(0, 3).map((s, i) => ({ nom: typeof s?.nom === 'string' && s.nom ? s.nom : `Scénario ${'ABC'[i]}`, versement: cent(s?.versement), taux: lireTaux(s?.taux) ?? 0, apport: cent(s?.apport) })),
    }));
    const ids = new Set(objectifs.map((o) => o.id));
    return {
      ...v, ...d,
      prenom: typeof d.prenom === 'string' ? d.prenom : '',
      capacite: cent(d.capacite),
      objectifs,
      prevus: tab(d.prevus).filter((x) => x && x.id && estMois(x.mois) && ids.has(x.objectifId)).map((x) => ({ note: '', ...x, montant: signe(x.montant) })),
      mouvements: tab(d.mouvements).filter((x) => x && x.id && estDate(x.date) && x.objectifId).map((x) => ({ note: '', ...x, type: TYPES_MVT[x.type] ? x.type : 'versement', montant: signe(x.montant) })),
    };
  }

  racine.EPG = {
    CAPITALISATIONS, MAX_MOIS, TYPES_MVT,
    versCentimes, euros, eurosRonds, versSaisie, lireTaux, tauxTexte,
    moisDe, jourDe, ajoutMois, ecartMois, estMois, estDate, dureeTexte,
    interetsMois, projeter, soldeAu, versementPour,
    depensesMensuelles, cibleObjectif, soldeReel, historiqueSolde, soldesMensuels, extrasDe,
    projectionObjectif, statutObjectif, jalons, etatJalons,
    moisCouverts, moisConseilles,
    verseDuMois, prevuDuMois, etatDuMois, rythme,
    comparerScenarios, totalVersements, planVersements,
    csvMouvements, etatVide, normaliser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
