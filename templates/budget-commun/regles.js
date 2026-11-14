// Budget commun QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.BCM) et par les tests Node (vm).
// Tous les montants sont des centimes entiers : aucune erreur d'arrondi dans les calculs.
// Moteur commun : aussi chargé par le planificateur de voyage (templates/voyage/) ; après toute modification,
// lancer aussi outils/templates/voyage.test.mjs.
(function (racine) {
  'use strict';

  // ---------- Montants ----------
  // « 1 234,56 », « 12.5 », « 12 € », « 0,05 » → centimes entiers ; null si illisible.
  function versCentimes(saisie) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) ? Math.round(saisie * 100) : null;
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(/^\+/, '');
    if (!/^-?\d+(?:[.,]\d{0,2})?$/.test(s)) return null;
    const negatif = s.startsWith('-');
    const [ent, dec = ''] = s.replace('-', '').split(/[.,]/);
    const c = Number(ent) * 100 + Number((dec + '00').slice(0, 2));
    return negatif ? -c : c;
  }

  // Affichage à la française : 1 234,56 € (espace fine insécable comme séparateur de milliers).
  function euros(c, { signe = false } = {}) {
    const n = Math.abs(Math.round(c));
    const ent = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const s = `${ent},${String(n % 100).padStart(2, '0')} €`;
    if (c < 0) return `−${s}`;
    return signe && c > 0 ? `+${s}` : s;
  }

  // ---------- Répartition ----------
  // Partage un montant selon des poids entiers positifs, méthode du plus fort reste :
  // la somme des parts vaut exactement le montant. À reste égal, l'ordre de la liste départage.
  function repartirPoids(montant, ids, poids) {
    const W = poids.reduce((s, p) => s + BigInt(p), 0n);
    if (!ids.length || W <= 0n) return null;
    const M = BigInt(montant);
    const base = poids.map((p) => (M * BigInt(p)) / W);
    const restes = poids.map((p, i) => ({ i, r: (M * BigInt(p)) % W }));
    let manque = M - base.reduce((s, b) => s + b, 0n);
    restes.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
    for (let k = 0; manque > 0n; k++, manque--) base[restes[k % restes.length].i] += 1n;
    const quotes = {};
    ids.forEach((id, i) => { quotes[id] = Number(base[i]); });
    return quotes;
  }

  const MODES = ['egale', 'prorata', 'parts', 'montants'];

  // participants : [{ id, revenu (centimes ou null) }] ; options : { parts: {id: n}, montants: {id: c} }.
  // Renvoie { quotes, mode, note } ou { erreur }.
  function repartir(montant, participants, mode, options = {}) {
    if (!Number.isInteger(montant) || montant <= 0) return { erreur: 'Montant invalide.' };
    if (!participants.length) return { erreur: 'Choisis au moins une personne concernée.' };
    const ids = participants.map((p) => p.id);
    const egale = () => repartirPoids(montant, ids, ids.map(() => 1));
    if (mode === 'prorata') {
      const rev = participants.map((p) => (Number.isInteger(p.revenu) && p.revenu > 0 ? p.revenu : 0));
      if (rev.some((r) => r === 0)) return { quotes: egale(), mode: 'egale', note: 'Revenu manquant : partage à parts égales.' };
      return { quotes: repartirPoids(montant, ids, rev), mode };
    }
    if (mode === 'parts') {
      // Parts décimales admises (1,5) : converties en centièmes entiers.
      const p = ids.map((id) => Math.round(Math.max(0, Number(options.parts?.[id] ?? 1)) * 100));
      if (p.some((x) => !Number.isFinite(x))) return { erreur: 'Parts invalides.' };
      if (p.reduce((s, x) => s + x, 0) <= 0) return { erreur: 'Indique au moins une part.' };
      return { quotes: repartirPoids(montant, ids, p), mode };
    }
    if (mode === 'montants') {
      const quotes = {};
      let somme = 0;
      for (const id of ids) {
        const c = options.montants?.[id] ?? 0;
        if (!Number.isInteger(c) || c < 0) return { erreur: 'Montants personnalisés invalides.' };
        quotes[id] = c; somme += c;
      }
      if (somme !== montant) return { erreur: `Les montants répartis font ${euros(somme)} au lieu de ${euros(montant)}.`, ecart: montant - somme };
      return { quotes, mode };
    }
    return { quotes: egale(), mode: 'egale' };
  }

  // Quotes d'une dépense : celles enregistrées si elles tombent juste, sinon recalculées.
  function quotesDepense(d, membres) {
    const somme = d.quotes ? Object.values(d.quotes).reduce((s, c) => s + c, 0) : -1;
    if (d.quotes && somme === d.montant) return d.quotes;
    const r = d.repartition || {};
    const parts = (r.participants?.length ? r.participants : membres.map((m) => m.id))
      .map((id) => membres.find((m) => m.id === id)).filter(Boolean);
    const res = repartir(d.montant, parts, r.mode, r);
    return res.quotes || repartir(d.montant, parts, 'egale').quotes || {};
  }

  // ---------- Soldes et équilibrage ----------
  // Solde > 0 : on doit de l'argent à cette personne ; < 0 : elle doit de l'argent au foyer.
  function soldes(membres, depenses, virements = []) {
    const s = {};
    membres.forEach((m) => { s[m.id] = 0; });
    const plus = (id, c) => { s[id] = (s[id] || 0) + c; };
    for (const d of depenses) {
      plus(d.payeur, d.montant);
      for (const [id, c] of Object.entries(quotesDepense(d, membres))) plus(id, -c);
    }
    for (const v of virements) { plus(v.de, v.montant); plus(v.a, -v.montant); }
    return s;
  }

  // Nombre minimal de virements : n soldes non nuls − nombre maximal de sous-groupes de somme nulle.
  // Programmation dynamique sur les sous-ensembles (au plus 12 personnes non soldées).
  function equilibrer(s) {
    const ids = Object.keys(s).filter((id) => s[id] !== 0);
    const n = ids.length;
    if (!n) return [];
    if (n > 12) return glouton(ids.map((id) => ({ id, v: s[id] })));
    const N = 1 << n;
    const somme = new Array(N).fill(0), dp = new Array(N).fill(0);
    for (let m = 1; m < N; m++) {
      const b = 31 - Math.clz32(m & -m);
      somme[m] = somme[m & (m - 1)] + s[ids[b]];
      let best = -1;
      for (let i = 0; i < n; i++) if (m & (1 << i)) best = Math.max(best, dp[m ^ (1 << i)]);
      dp[m] = best + (somme[m] === 0 ? 1 : 0);
    }
    // Reconstruction : ordre d'ajout dont les préfixes de somme nulle délimitent les groupes.
    const ordre = [];
    for (let m = N - 1; m; ) {
      let choix = -1;
      for (let i = 0; i < n; i++) if ((m & (1 << i)) && (choix < 0 || dp[m ^ (1 << i)] > dp[m ^ (1 << choix)])) choix = i;
      ordre.unshift(choix);
      m ^= 1 << choix;
    }
    const virements = [];
    let groupe = [], cumul = 0;
    for (const i of ordre) {
      groupe.push({ id: ids[i], v: s[ids[i]] }); cumul += s[ids[i]];
      if (cumul === 0) { virements.push(...glouton(groupe)); groupe = []; }
    }
    if (groupe.length) virements.push(...glouton(groupe));
    return virements;
  }

  // Le plus gros débiteur paie le plus gros créancier, jusqu'à zéro (k − 1 virements au plus).
  function glouton(groupe) {
    const g = groupe.map((x) => ({ ...x }));
    const res = [];
    for (;;) {
      const deb = g.filter((x) => x.v < 0).sort((a, b) => a.v - b.v || a.id.localeCompare(b.id))[0];
      const cre = g.filter((x) => x.v > 0).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id))[0];
      if (!deb || !cre) break;
      const m = Math.min(-deb.v, cre.v);
      res.push({ de: deb.id, a: cre.id, montant: m });
      deb.v += m; cre.v -= m;
    }
    return res;
  }

  // ---------- Mois ----------
  const deux = (n) => String(n).padStart(2, '0');
  const moisDe = (date) => String(date).slice(0, 7);
  function ajoutMois(mois, n) {
    const [a, m] = mois.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`;
  }
  const joursDansMois = (mois) => { const [a, m] = mois.split('-').map(Number); return new Date(a, m, 0).getDate(); };

  // Dépenses récurrentes à créer jusqu'au mois « AAAA-MM » (inclus) ou jusqu'au jour « AAAA-MM-JJ »
  // (inclus) : une par mois et par récurrente, identifiant déterministe (deux appareils génèrent la
  // même), jamais recréée si supprimée. Horodatage vide : deux générations identiques ne font pas conflit.
  function genererRecurrentes(recurrentes, depenses, supprimes, limite, membres, horodatage = '') {
    const jusqua = String(limite).slice(0, 7);
    const jourMax = String(limite).length === 10 ? String(limite) : null;
    const existants = new Set(depenses.map((d) => d.id));
    const nouvelles = [];
    for (const r of recurrentes) {
      if (r.actif === false || !r.debut || !Number.isInteger(r.montant) || r.montant <= 0) continue;
      const fin = r.fin && r.fin < jusqua ? r.fin : jusqua;
      for (let m = r.debut, garde = 0; m <= fin && garde < 600; m = ajoutMois(m, 1), garde++) {
        const id = `r-${r.id}-${m}`;
        if (existants.has(id) || (supprimes && supprimes[id])) continue;
        const jour = Math.min(Math.max(1, r.jour || 1), joursDansMois(m));
        if (jourMax && `${m}-${deux(jour)}` > jourMax) continue;
        const d = {
          id, recurrente: r.id, date: `${m}-${deux(jour)}`, libelle: r.libelle, montant: r.montant,
          payeur: r.payeur, categorie: r.categorie, repartition: structuredCloneSimple(r.repartition || { mode: 'egale' }),
          modifLe: horodatage,
        };
        d.quotes = quotesDepense({ ...d, quotes: null }, membres);
        nouvelles.push(d);
        existants.add(id);
      }
    }
    return nouvelles;
  }
  const structuredCloneSimple = (o) => JSON.parse(JSON.stringify(o));

  // Bilan d'un mois : total, par catégorie, et pour chaque personne ce qu'elle a payé et sa part.
  function bilanMois(depenses, mois, membres) {
    const liste = depenses.filter((d) => moisDe(d.date) === mois);
    const parCategorie = {}, parMembre = {};
    membres.forEach((m) => { parMembre[m.id] = { paye: 0, part: 0 }; });
    let total = 0;
    for (const d of liste) {
      total += d.montant;
      parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
      (parMembre[d.payeur] ||= { paye: 0, part: 0 }).paye += d.montant;
      for (const [id, c] of Object.entries(quotesDepense(d, membres))) (parMembre[id] ||= { paye: 0, part: 0 }).part += c;
    }
    return { mois, total, nb: liste.length, parCategorie, parMembre };
  }

  // ---------- Fusion (conflit entre deux appareils) ----------
  // Chaque élément porte un id et modifLe (ISO) ; les suppressions laissent une trace dans
  // « supprimes » {id: date}. Union des deux versions : la modification la plus récente l'emporte,
  // une suppression ne l'emporte que si elle est postérieure à la dernière modification.
  // Aucune dépense ajoutée d'un côté n'est perdue.
  const COLLECTIONS = ['membres', 'categories', 'depenses', 'recurrentes', 'virements'];
  const OBJETS = ['foyer', 'reglages'];

  function fusionner(local, serveur) {
    if (!serveur) return { etat: local, conflits: 0, ajouts: 0 };
    if (!local) return { etat: serveur, conflits: 0, ajouts: 0 };
    const supprimes = { ...(serveur.supprimes || {}) };
    for (const [id, t] of Object.entries(local.supprimes || {})) if (!supprimes[id] || t > supprimes[id]) supprimes[id] = t;
    const etat = { ...serveur, ...local, supprimes };
    let conflits = 0, ajouts = 0;
    for (const cle of COLLECTIONS) {
      const a = Array.isArray(local[cle]) ? local[cle] : [];
      const b = Array.isArray(serveur[cle]) ? serveur[cle] : [];
      const parId = new Map();
      const ordre = [];
      for (const x of b) { parId.set(x.id, x); ordre.push(x.id); }
      for (const x of a) {
        const y = parId.get(x.id);
        if (!y) { parId.set(x.id, x); ordre.push(x.id); continue; }
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
        conflits++;
        if ((x.modifLe || '') >= (y.modifLe || '')) parId.set(x.id, x);
      }
      etat[cle] = ordre.map((id) => parId.get(id)).filter((x) => {
        const t = supprimes[x.id];
        return !t || t < (x.modifLe || '');
      });
      ajouts += etat[cle].length - b.filter((x) => etat[cle].some((y) => y.id === x.id)).length;
    }
    for (const cle of OBJETS) {
      const x = local[cle], y = serveur[cle];
      if (x && y) etat[cle] = (x.modifLe || '') >= (y.modifLe || '') ? x : y;
      else etat[cle] = x || y;
    }
    delete etat.majLe;
    return { etat, conflits, ajouts };
  }

  racine.BCM = {
    versCentimes, euros, repartirPoids, repartir, quotesDepense, MODES,
    soldes, equilibrer, moisDe, ajoutMois, joursDansMois, genererRecurrentes, bilanMois, fusionner,
  };
})(typeof window !== 'undefined' ? window : globalThis);
