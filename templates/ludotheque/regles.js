// Ludothèque · règles métier pures (aucun accès au DOM ni au stockage). window.JDS, testé par
// outils/templates/ludotheque.test.mjs.
// Suggestions : filtres stricts (jeu possédé, non prêté, nombre de joueurs, temps disponible avec une
// tolérance de 15 %, âge du plus jeune, complexité maximale), puis score expliqué :
// 50 points de base, +15 par catégorie souhaitée, +10 par mécanique souhaitée, +4 par point de note
// personnelle, +20 si le jeu n'a pas été joué depuis 90 jours (ou jamais), −20 s'il a été joué
// dans les 7 derniers jours, +10 si sa durée occupe au moins la moitié du temps disponible.
// « À ressortir » : jeu possédé depuis plus de 6 mois (ou date inconnue) sans partie depuis 12 mois.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const STATUTS = ['possede', 'decouvrir', 'sorti'];
  const TOLERANCE = 1.15;

  // ---------- Statistiques d'un jeu ----------
  function statsJeu(jeu, parties, auj) {
    const ps = parties.filter((p) => p.jeuId === jeu.id).sort((a, b) => b.date.localeCompare(a.date));
    const derniere = ps[0]?.date ?? null;
    const unAn = O.ajout(auj, -365);
    const durees = ps.filter((p) => p.duree > 0).map((p) => p.duree);
    return {
      nb: ps.length, derniere, joursDepuis: derniere ? O.ecart(derniere, auj) : null,
      douzeMois: ps.filter((p) => p.date >= unAn).length,
      dureeMoyenne: durees.length ? Math.round(durees.reduce((s, x) => s + x, 0) / durees.length) : null,
    };
  }
  function aRessortir(jeu, parties, auj) {
    if (jeu.statut !== 'possede') return false;
    const ancien = !jeu.acquisLe || O.ecart(jeu.acquisLe, auj) > 182;
    return ancien && statsJeu(jeu, parties, auj).douzeMois === 0;
  }

  // ---------- Statistiques de la collection ----------
  function statistiques(e, auj) {
    const possedes = e.jeux.filter((j) => j.statut === 'possede');
    const parJeu = possedes.map((j) => ({ jeu: j, ...statsJeu(j, e.parties, auj) }));
    const joues12 = parJeu.filter((x) => x.douzeMois > 0).length;
    const mois = [];
    for (let i = 11; i >= 0; i--) {
      const cle = O.ajoutMois(`${auj.slice(0, 7)}-01`, -i).slice(0, 7);
      mois.push({ mois: cle, nb: e.parties.filter((p) => p.date.slice(0, 7) === cle).length });
    }
    const parCategorie = B().categories.map((c) => ({ id: c.id, nom: c.nom, jeux: possedes.filter((j) => j.categories.includes(c.id)).length, parties: e.parties.filter((p) => possedes.find((j) => j.id === p.jeuId)?.categories.includes(c.id)).length })).filter((x) => x.jeux);
    return {
      possedes: possedes.length, extensions: possedes.reduce((s, j) => s + j.extensions.filter((x) => x.possede).length, 0),
      decouvrir: e.jeux.filter((j) => j.statut === 'decouvrir').length, pretes: possedes.filter((j) => j.pretA).length,
      parties: e.parties.length, parties12: e.parties.filter((p) => p.date >= O.ajout(auj, -365)).length,
      tauxUtilisation: possedes.length ? Math.round((joues12 / possedes.length) * 100) : null,
      top: [...parJeu].filter((x) => x.nb).sort((a, b) => b.nb - a.nb || (b.derniere || '').localeCompare(a.derniere || '')).slice(0, 10),
      jamais: parJeu.filter((x) => !x.nb).map((x) => x.jeu),
      aRessortir: possedes.filter((j) => aRessortir(j, e.parties, auj)),
      mois, parCategorie,
    };
  }

  // ---------- Suggestions ----------
  // critères : { joueurs, temps (min), age (plus jeune joueur), complexiteMax, categories[], mecaniques[] }
  function suggestions(e, criteres, auj) {
    const c = criteres;
    const res = [];
    for (const j of e.jeux) {
      if (j.statut !== 'possede' || j.pretA) continue;
      if (c.joueurs && (c.joueurs < j.joueursMin || c.joueurs > j.joueursMax)) continue;
      if (c.temps && j.duree > c.temps * TOLERANCE) continue;
      if (c.age && j.age > c.age) continue;
      if (c.complexiteMax && j.complexite > c.complexiteMax) continue;
      const s = statsJeu(j, e.parties, auj);
      let score = 50;
      const raisons = [];
      const cats = (c.categories || []).filter((x) => j.categories.includes(x));
      if (cats.length) { score += 15 * cats.length; raisons.push(`${cats.map((x) => B().categories.find((y) => y.id === x)?.nom.toLowerCase()).join(', ')} comme demandé`); }
      const mecs = (c.mecaniques || []).filter((x) => j.mecaniques.includes(x));
      if (mecs.length) { score += 10 * mecs.length; raisons.push(`mécanique${mecs.length > 1 ? 's' : ''} ${mecs.join(', ').toLowerCase()}`); }
      if (j.note) { score += 4 * j.note; if (j.note >= 4) raisons.push(`ta note : ${j.note}/5`); }
      if (s.joursDepuis === null) { score += 20; raisons.push('jamais joué'); }
      else if (s.joursDepuis > 90) { score += 20; raisons.push(`pas joué depuis ${s.joursDepuis} jours`); }
      else if (s.joursDepuis <= 7) { score -= 20; raisons.push('joué cette semaine'); }
      if (c.temps && j.duree >= c.temps * 0.5) score += 10;
      if (c.temps && j.duree > c.temps) raisons.push(`un peu plus long que prévu (${j.duree} min)`);
      res.push({ jeu: j, score, raisons, stats: s });
    }
    return res.sort((a, b) => b.score - a.score || a.jeu.nom.localeCompare(b.jeu.nom, 'fr'));
  }

  // ---------- Validation ----------
  function validerJeu(j) {
    if (!O.texte(j.nom)) return 'Donne un nom au jeu.';
    if (!Number.isInteger(j.joueursMin) || j.joueursMin < 1 || j.joueursMin > 100) return 'Joueurs minimum : nombre entier de 1 à 100.';
    if (!Number.isInteger(j.joueursMax) || j.joueursMax < j.joueursMin || j.joueursMax > 100) return 'Joueurs maximum : au moins égal au minimum, 100 au plus.';
    if (!(j.duree > 0 && j.duree <= 1440)) return 'Durée moyenne : de 1 à 1 440 minutes.';
    if (!Number.isInteger(j.complexite) || j.complexite < 1 || j.complexite > 5) return 'Complexité : de 1 à 5.';
    if (!Number.isInteger(j.age) || j.age < 0 || j.age > 99) return 'Âge conseillé : de 0 à 99 ans.';
    return null;
  }

  // ---------- Normalisation ----------
  function normaliserJeu(j) {
    j = j && typeof j === 'object' ? j : {};
    const min = O.entier(j.joueursMin, 1, 100, 1);
    return {
      id: O.idValide(j.id), nom: O.texte(j.nom, 100) || 'Jeu sans nom', statut: O.choix(j.statut, STATUTS, 'possede'),
      joueursMin: min, joueursMax: Math.max(min, O.entier(j.joueursMax, 1, 100, Math.max(min, 4))), duree: O.entier(j.duree, 1, 1440, 30),
      complexite: O.entier(j.complexite, 1, 5, 2), age: O.entier(j.age, 0, 99, 8),
      categories: [...new Set(O.tableau(j.categories))].filter((c) => B().categories.some((x) => x.id === c)),
      mecaniques: [...new Set(O.tableau(j.mecaniques).map((m) => O.texte(m, 50)).filter(Boolean))].slice(0, 12),
      extensions: O.tableau(j.extensions).slice(0, 40).map((x) => ({ id: O.idValide(x?.id), nom: O.texte(x?.nom, 80) || 'Extension', possede: x?.possede !== false })),
      emplacement: O.texte(j.emplacement, 80), pretA: O.texte(j.pretA, 60), pretLe: j.pretA ? O.dateOuNull(j.pretLe) : null,
      note: O.entier(j.note, 0, 5, 0), acquisLe: O.dateOuNull(j.acquisLe), commentaire: O.texte(j.commentaire, 500),
    };
  }
  const etatVide = () => ({ version: 1, jeux: [], parties: [] });
  function normaliser(d) {
    if (!d || typeof d !== 'object') return etatVide();
    const jeux = O.tableau(d.jeux).slice(0, 2000).map(normaliserJeu);
    const ids = new Set(jeux.map((j) => j.id));
    return {
      ...d, version: 1, jeux,
      parties: O.tableau(d.parties).slice(0, 10000).filter((p) => ids.has(p?.jeuId) && O.estDate(p?.date)).map((p) => ({
        id: O.idValide(p.id), jeuId: p.jeuId, date: p.date, joueurs: O.entier(p.joueurs, 1, 100, null), duree: O.entier(p.duree, 1, 1440, null),
        gagnant: O.texte(p.gagnant, 80), extensions: O.tableau(p.extensions).filter((x) => typeof x === 'string').slice(0, 20), commentaire: O.texte(p.commentaire, 300),
      })),
    };
  }

  // ---------- Exports CSV ----------
  const LIB_STATUT = { possede: 'Possédé', decouvrir: 'À découvrir', sorti: 'Sorti de la collection' };
  function csvJeux(e, auj) {
    const nomsCat = (ids) => ids.map((c) => B().categories.find((x) => x.id === c)?.nom).join(' | ');
    return [['Jeu', 'Statut', 'Joueurs min', 'Joueurs max', 'Durée (min)', 'Complexité (1-5)', 'Âge', 'Catégories', 'Mécaniques', 'Extensions possédées', 'Emplacement', 'Prêté à', 'Prêté le', 'Note (0-5)', 'Acquis le', 'Parties', 'Dernière partie', 'Commentaire'],
      ...e.jeux.map((j) => { const s = statsJeu(j, e.parties, auj); return [j.nom, LIB_STATUT[j.statut], j.joueursMin, j.joueursMax, j.duree, j.complexite, j.age, nomsCat(j.categories), j.mecaniques.join(' | '), j.extensions.filter((x) => x.possede).map((x) => x.nom).join(' | '), j.emplacement, j.pretA, j.pretLe || '', j.note || '', j.acquisLe || '', s.nb, s.derniere || '', j.commentaire]; })];
  }
  function csvParties(e) {
    const nom = (id) => e.jeux.find((j) => j.id === id)?.nom || '';
    return [['Date', 'Jeu', 'Joueurs', 'Durée (min)', 'Gagnant', 'Extensions', 'Commentaire'],
      ...[...e.parties].sort((a, b) => b.date.localeCompare(a.date)).map((p) => [p.date, nom(p.jeuId), p.joueurs ?? '', p.duree ?? '', p.gagnant, p.extensions.join(' | '), p.commentaire])];
  }

  racine.JDS = { STATUTS, LIB_STATUT, TOLERANCE, statsJeu, aRessortir, statistiques, suggestions, validerJeu, normaliserJeu, etatVide, normaliser, csvJeux, csvParties };
})(typeof window !== 'undefined' ? window : globalThis);
