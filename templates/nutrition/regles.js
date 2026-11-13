// Nutrition et dépense énergétique QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.NTR) et par les tests Node (vm).
(function (racine) {
  'use strict';

  // Ordre des valeurs nutritionnelles partout dans l'application (pour 100 g dans la base).
  const NUTRIMENTS = ['kcal', 'prot', 'gluc', 'lip', 'fib', 'suc', 'sel'];

  // ---------- Dates (AAAA-MM-JJ, comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  // Les n jours qui finissent à « fin » (inclus), du plus ancien au plus récent.
  const joursJusqua = (fin, n) => Array.from({ length: n }, (_, i) => ajout(fin, i - n + 1));
  // Lundi de la semaine qui contient le jour.
  const lundi = (s) => { const j = (versDate(s).getDay() + 6) % 7; return ajout(s, -j); };

  // ---------- Recherche ----------
  // Minuscules, sans accents ni ligatures : « Œuf » et « oeuf » se trouvent pareil.
  function sansAccents(s) {
    return String(s ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Filtre une liste d'objets { nom } : tous les mots de la requête doivent apparaître.
  // Tri : nom qui commence par le premier mot, puis mot entier, puis nom le plus court.
  function rechercher(liste, requete, max = 60) {
    const mots = sansAccents(requete).split(/[\s,;'’()-]+/).filter(Boolean);
    if (!mots.length) return [];
    const res = [];
    for (const el of liste) {
      const n = el.cle || sansAccents(el.nom);
      if (!mots.every((m) => n.includes(m))) continue;
      let score = n.length;
      if (n.startsWith(mots[0])) score -= 1000;
      else if (new RegExp(`(^|[^a-z0-9])${mots[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n)) score -= 500;
      res.push([score, el]);
    }
    return res.sort((a, b) => a[0] - b[0]).slice(0, max).map((x) => x[1]);
  }

  // ---------- Profil ----------
  // Âge en années à partir de l'année de naissance (seule donnée demandée : minimisation).
  const ageEn = (annee, jour) => (annee ? Number(jour.slice(0, 4)) - Number(annee) : null);
  const estMineur = (annee, jour) => annee != null && ageEn(annee, jour) < 18;

  // Métabolisme de base (Mifflin-St Jeor 1990, Am J Clin Nutr 51:241).
  // Complet : homme 10 P + 6,25 T − 5 A + 5 ; femme 10 P + 6,25 T − 5 A − 161.
  // Poids seul (même publication, équation sur le poids, R² 0,56) : 15,1 P + 371, signalée comme dégradée.
  function metabolismeBase({ sexe, age, taille, poids } = {}) {
    if (!(poids > 0)) return null;
    if ((sexe === 'h' || sexe === 'f') && age > 0 && taille > 0) {
      const kcal = 10 * poids + 6.25 * taille - 5 * age + (sexe === 'h' ? 5 : -161);
      return { kcal, methode: 'mifflin', degrade: false, horsPopulation: age < 19 || age > 78 };
    }
    return { kcal: 15.1 * poids + 371, methode: 'poids', degrade: true, horsPopulation: false };
  }

  function facteurActivite(profil, activites) {
    if (profil?.facteurPerso > 0) return profil.facteurPerso;
    return (activites.find((a) => a.id === profil?.activite) || activites[0]).facteur;
  }

  // Dépense d'une séance : (MET − 1) × poids (kg) × durée (h). Le « − 1 » retire le repos déjà compté.
  const depenseSport = (met, poids, minutes) => (poids > 0 && minutes > 0 ? Math.max(0, met - 1) * poids * minutes / 60 : 0);

  // Dernière pesée connue à cette date ; à défaut, la première pesée enregistrée.
  function poidsAu(pesees, jour) {
    if (!pesees?.length) return null;
    const triees = [...pesees].sort((a, b) => a.j.localeCompare(b.j));
    let p = null;
    for (const x of triees) { if (x.j <= jour) p = x; else break; }
    return (p || triees[0]).kg;
  }

  // Dépense du jour : repos (métabolisme × facteur, ou saisie manuelle) + séances du jour.
  function depenseJour({ profil, pesees, seances, jour, activites }) {
    const poids = poidsAu(pesees, jour);
    const sport = (seances || []).filter((s) => s.j === jour).reduce((t, s) => t + depenseSport(s.met, poids, s.min), 0);
    if (profil?.depenseManuelle > 0) {
      return { base: null, facteur: null, repos: profil.depenseManuelle, sport, total: profil.depenseManuelle + sport, methode: 'manuelle', degrade: false, poids };
    }
    const mb = metabolismeBase({ sexe: profil?.sexe, age: ageEn(profil?.annee, jour), taille: profil?.taille, poids });
    if (!mb) return { base: null, facteur: null, repos: null, sport, total: null, methode: null, degrade: true, poids };
    const facteur = facteurActivite(profil, activites);
    const repos = mb.kcal * facteur;
    return { base: mb.kcal, facteur, repos, sport, total: repos + sport, methode: mb.methode, degrade: mb.degrade, horsPopulation: mb.horsPopulation, poids };
  }

  // ---------- Objectif ----------
  // Facteur calorique visé : perte → 1 − écart %, prise → 1 + écart %, maintien → 1.
  function facteurVise(objectif, ecartPct) {
    const e = Math.max(0, Number(ecartPct) || 0) / 100;
    return objectif === 'perte' ? 1 - e : objectif === 'prise' ? 1 + e : 1;
  }
  const cibleKcal = (depense, objectif, ecartPct) => (depense > 0 ? depense * facteurVise(objectif, ecartPct) : null);
  // Facteur calorique : calories mangées ÷ calories dépensées.
  const facteurCalorique = (mange, depense) => (depense > 0 ? mange / depense : null);
  // Le jour respecte-t-il l'objectif ? perte : facteur ≤ visé ; prise : facteur ≥ visé ; maintien : sans jugement.
  function respecte(facteur, objectif, ecartPct) {
    if (facteur == null || objectif === 'maintien') return null;
    const v = facteurVise(objectif, ecartPct);
    return objectif === 'perte' ? facteur <= v : facteur >= v;
  }
  // Seuil d'alerte (HAS 2011 : régimes à moins de 1 000 kcal par jour non indiqués sauf cas exceptionnels).
  const cibleTresBasse = (kcal, seuil) => kcal != null && kcal < seuil;

  // ---------- Aliments ----------
  // Ligne compacte de la base Ciqual → instantané gardé dans les données de l'utilisateur.
  // [code, nom, groupe, kcal, prot, gluc, lip, fib, suc, sel]
  const depuisCiqual = (ligne, groupes) => ({ n: ligne[1], g: groupes[ligne[2]] || '', v: ligne.slice(3, 10) });

  // Valeurs pour une quantité en grammes ; une valeur absente de la base compte 0 et rend le total incomplet.
  function valeurs(aliment, q) {
    const r = { incomplet: false };
    NUTRIMENTS.forEach((k, i) => {
      const v = aliment?.v?.[i];
      if (v == null) r.incomplet = true;
      r[k] = (v || 0) * (Number(q) || 0) / 100;
    });
    return r;
  }

  function totaux(entrees, aliments) {
    const t = { incomplet: false, n: 0 };
    NUTRIMENTS.forEach((k) => { t[k] = 0; });
    for (const e of entrees || []) {
      const v = valeurs(aliments[e.c], e.q);
      NUTRIMENTS.forEach((k) => { t[k] += v[k]; });
      if (v.incomplet || !aliments[e.c]) t.incomplet = true;
      t.n++;
    }
    return t;
  }

  // Copie des entrées d'un jour vers un autre (nouveaux identifiants).
  const copierJour = (journal, de, vers, uid) => journal.filter((e) => e.j === de).map((e) => ({ ...e, id: uid(), j: vers }));

  // ---------- Bilan ----------
  // Pour chaque jour : mangé, dépensé, facteur. Les jours sans saisie de repas sont « vides »
  // et exclus des moyennes (un jour non noté n'est pas un jour à 0 kcal).
  function bilan({ etat, jours, activites }) {
    const parJour = new Map();
    for (const e of etat.journal) { if (!parJour.has(e.j)) parJour.set(e.j, []); parJour.get(e.j).push(e); }
    const lignes = jours.map((j) => {
      const entrees = parJour.get(j) || [];
      const t = totaux(entrees, etat.aliments);
      const d = depenseJour({ profil: etat.profil, pesees: etat.pesees, seances: etat.seances, jour: j, activites });
      const vide = !entrees.length;
      return { j, vide, mange: t.kcal, totaux: t, depense: d.total, sport: d.sport, facteur: vide ? null : facteurCalorique(t.kcal, d.total) };
    });
    const pleins = lignes.filter((l) => !l.vide);
    const somme = (f) => pleins.reduce((s, l) => s + (f(l) || 0), 0);
    const mange = somme((l) => l.mange), depense = somme((l) => l.depense);
    const moy = (k) => (pleins.length ? somme((l) => l.totaux[k]) / pleins.length : null);
    return {
      lignes,
      joursNotes: pleins.length,
      moyenneMange: pleins.length ? mange / pleins.length : null,
      moyenneDepense: pleins.length ? depense / pleins.length : null,
      // Facteur de la période : total mangé ÷ total dépensé sur les jours notés.
      facteur: pleins.length ? facteurCalorique(mange, depense) : null,
      macros: Object.fromEntries(NUTRIMENTS.map((k) => [k, moy(k)])),
    };
  }

  // Variation de poids entre la première et la dernière pesée d'une période.
  function variationPoids(pesees, de, a) {
    const p = (pesees || []).filter((x) => x.j >= de && x.j <= a).sort((x, y) => x.j.localeCompare(y.j));
    if (p.length < 2) return null;
    return { de: p[0], a: p.at(-1), kg: p.at(-1).kg - p[0].kg };
  }

  // ---------- Menus et liste de courses ----------
  const totauxMenu = (menu, aliments) => totaux(menu.items, aliments);

  // Semaine : 7 cases (lundi → dimanche), chacune un identifiant de menu ou null.
  // Liste de courses : quantités additionnées par aliment, triées par rayon (groupe Ciqual) puis par nom.
  function listeCourses(menus, semaine, aliments) {
    const parCode = new Map();
    (semaine || []).forEach((id) => {
      const m = menus.find((x) => x.id === id);
      if (!m) return;
      for (const it of m.items) {
        const a = aliments[it.c];
        const l = parCode.get(it.c) || { c: it.c, nom: a?.n || 'Aliment inconnu', groupe: a?.g || (a?.perso ? 'mes aliments' : ''), q: 0, fois: 0 };
        l.q += Number(it.q) || 0; l.fois++;
        parCode.set(it.c, l);
      }
    });
    return [...parCode.values()].sort((x, y) => x.groupe.localeCompare(y.groupe, 'fr') || x.nom.localeCompare(y.nom, 'fr'));
  }

  // Quantité lisible pour les courses : grammes jusqu'à 1 kg, puis kilos.
  const quantiteCourses = (g) => (g >= 1000 ? `${String(Math.round(g / 100) / 10).replace('.', ',')} kg` : `${Math.round(g)} g`);

  racine.NTR = {
    NUTRIMENTS, iso, versDate, ajout, ecart, joursJusqua, lundi,
    sansAccents, rechercher, ageEn, estMineur, metabolismeBase, facteurActivite, depenseSport, poidsAu, depenseJour,
    facteurVise, cibleKcal, facteurCalorique, respecte, cibleTresBasse,
    depuisCiqual, valeurs, totaux, copierJour, bilan, variationPoids, totauxMenu, listeCourses, quantiteCourses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
