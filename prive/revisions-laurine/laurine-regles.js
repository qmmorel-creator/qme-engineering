// Règles pures de « Révisions QME X Laurine » (sans DOM) : import CSV des matières et choix des jours pour
// déplacer ou regrouper une révision. Exposées en window.RVXR, testées par outils/templates/revisions-laurine.test.mjs.
(() => {
  'use strict';

  // Colonnes du modèle CSV (une ligne = un cours). Seules « matiere » et « cours » sont obligatoires.
  const COLONNES = ['matiere', 'cours', 'examen', 'energie', 'vu_le', 'mots_cles', 'ressources'];
  const MODELE_CSV = [
    COLONNES.join(';'),
    'Biochimie;Enzymologie;15/01/2027;forte;02/11/2026;site actif, Michaelis-Menten, Km, Vmax;https://drive.google.com/drive/folders/mon-dossier',
    'Biochimie;Glycolyse;15/01/2027;forte;;hexokinase, ATP, pyruvate;',
    'Anatomie;Ostéologie du membre supérieur;16/01/2027;moyenne;10/11/2026;scapula, humérus, radius, ulna;https://www.notion.so/ma-page',
    'Sciences humaines et sociales;Éthique et bioéthique;20/01/2027;faible;;autonomie, bienfaisance, consentement;',
  ].join('\r\n') + '\r\n';

  // Prompt à copier dans un assistant (ChatGPT, Claude…) avec le PDF du programme.
  const PROMPT_PDF = `Tu reçois en pièce jointe le PDF de mon programme (ou de mon emploi du temps d'examens).
Transforme-le en un fichier CSV, séparateur point-virgule, encodé en UTF-8, avec exactement cette première ligne :
${COLONNES.join(';')}

Règles :
- une ligne par cours (chapitre), dans l'ordre du programme ;
- « matiere » : le nom de la matière ou de l'UE, identique pour tous ses cours ;
- « cours » : le titre du cours, sans numéro ni puce ;
- « examen » : la date d'examen de la matière au format JJ/MM/AAAA si elle figure dans le PDF, sinon vide ;
- « energie » : laisse vide (je la choisirai moi-même) ;
- « vu_le » : vide ;
- « mots_cles » : 3 à 6 notions clés du cours, séparées par des virgules, seulement si le PDF les donne ;
- « ressources » : vide ;
- n'ajoute aucune ligne de commentaire, aucun titre, aucun texte avant ou après le CSV ;
- si un champ contient un point-virgule, entoure-le de guillemets.
Réponds uniquement avec le contenu du CSV.`;

  const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const ALIAS = {
    matiere: 'matiere', ue: 'matiere', module: 'matiere', discipline: 'matiere',
    cours: 'cours', chapitre: 'cours', titre: 'cours', lecon: 'cours',
    examen: 'examen', date_examen: 'examen', 'date d examen': 'examen', 'date examen': 'examen',
    energie: 'energie', niveau_energie: 'energie',
    vu_le: 'vu_le', 'vu le': 'vu_le', appris: 'vu_le', appris_le: 'vu_le',
    mots_cles: 'mots_cles', 'mots cles': 'mots_cles', 'mots-cles': 'mots_cles', motscles: 'mots_cles',
    ressources: 'ressources', ressource: 'ressources', liens: 'ressources', lien: 'ressources',
  };

  // Découpe un CSV (guillemets doublés, retours à la ligne dans les guillemets) ; séparateur ; , ou tabulation.
  function decouper(texte) {
    const t = String(texte || '').replace(/^﻿/, '');
    const premiere = t.split(/\r?\n/, 1)[0] || '';
    const compte = (c) => premiere.split(c).length - 1;
    const sep = ['\t', ';', ','].sort((a, b) => compte(b) - compte(a))[0];
    const lignes = [];
    let ligne = [], champ = '', guillemets = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (guillemets) {
        if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c;
      } else if (c === '"' && champ === '') guillemets = true;
      else if (c === sep) { ligne.push(champ); champ = ''; } else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i++;
        ligne.push(champ); lignes.push(ligne); ligne = []; champ = '';
      } else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes.filter((l) => l.some((x) => x.trim() !== ''));
  }

  // Date JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ → AAAA-MM-JJ (null si vide ou invalide).
  function lireDate(s) {
    const v = String(s || '').trim();
    if (!v) return { ok: true, date: null };
    let a, m, j;
    let x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
    if (x) [, a, m, j] = x; else if ((x = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v))) [, j, m, a] = x; else return { ok: false };
    a = Number(a.length === 2 ? `20${a}` : a); m = Number(m); j = Number(j);
    const d = new Date(Date.UTC(a, m - 1, j));
    if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return { ok: false };
    return { ok: true, date: `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}` };
  }
  const lireEnergie = (s) => {
    const v = sansAccents(s);
    if (!v) return { ok: true, niveau: null };
    if (/^(forte|fort|haute|elevee|1)$/.test(v)) return { ok: true, niveau: 'forte' };
    if (/^(moyenne|moyen|2)$/.test(v)) return { ok: true, niveau: 'moyenne' };
    if (/^(faible|basse|bas|3)$/.test(v)) return { ok: true, niveau: 'faible' };
    return { ok: false };
  };
  const lireLiens = (s) => String(s || '').split(/[\s|]+/).filter(Boolean).map((u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } });

  // Analyse le CSV : { lignes: [{ n, matiere, cours, examen, energie, vuLe, motsCles, ressources }], erreurs: [{ n, message }], colonnes }.
  // `aujourdhui` (AAAA-MM-JJ) refuse les dates « vu le » dans le futur.
  function analyserCsv(texte, aujourdhui) {
    const brut = decouper(texte);
    const erreurs = [];
    if (!brut.length) return { lignes: [], erreurs: [{ n: 0, message: 'Fichier vide.' }], colonnes: [] };
    const entete = brut[0].map((x) => ALIAS[sansAccents(x).replace(/\s+/g, ' ')] || null);
    const avecEntete = entete.includes('matiere') && entete.includes('cours');
    const colonnes = avecEntete ? entete : COLONNES;
    const idx = (nom) => colonnes.indexOf(nom);
    const lignes = [];
    (avecEntete ? brut.slice(1) : brut).forEach((cellules, k) => {
      const n = k + (avecEntete ? 2 : 1);
      const v = (nom) => (idx(nom) >= 0 ? String(cellules[idx(nom)] ?? '').trim() : '');
      const matiere = v('matiere').slice(0, 60), cours = v('cours').slice(0, 120);
      if (!matiere && !cours) return;
      if (!matiere) { erreurs.push({ n, message: `Ligne ${n} : matière manquante.` }); return; }
      if (!cours) { erreurs.push({ n, message: `Ligne ${n} : titre du cours manquant.` }); return; }
      const ex = lireDate(v('examen')), vu = lireDate(v('vu_le')), en = lireEnergie(v('energie'));
      if (!ex.ok) { erreurs.push({ n, message: `Ligne ${n} : date d'examen illisible (« ${v('examen')} », attendu JJ/MM/AAAA).` }); return; }
      if (!vu.ok) { erreurs.push({ n, message: `Ligne ${n} : date « vu le » illisible (« ${v('vu_le')} »).` }); return; }
      if (vu.date && aujourdhui && vu.date > aujourdhui) { erreurs.push({ n, message: `Ligne ${n} : la date « vu le » est dans le futur.` }); return; }
      if (!en.ok) { erreurs.push({ n, message: `Ligne ${n} : énergie « ${v('energie')} » inconnue (forte, moyenne ou faible).` }); return; }
      const liens = lireLiens(v('ressources'));
      if (liens.includes(null)) { erreurs.push({ n, message: `Ligne ${n} : ressource refusée (adresse https attendue).` }); return; }
      lignes.push({ n, matiere, cours, examen: ex.date, energie: en.niveau, vuLe: vu.date, motsCles: v('mots_cles').slice(0, 1000), ressources: liens.slice(0, 12).map((url) => ({ titre: '', url })) });
    });
    if (lignes.length > 2000) return { lignes: lignes.slice(0, 2000), erreurs: [...erreurs, { n: 0, message: 'Plus de 2 000 cours : seuls les 2 000 premiers sont importés.' }], colonnes };
    return { lignes, erreurs, colonnes };
  }

  // Regroupe les lignes par matière (ordre d'apparition) pour l'aperçu et l'import.
  function grouperCsv(lignes) {
    const groupes = [];
    for (const l of lignes) {
      let g = groupes.find((x) => sansAccents(x.matiere) === sansAccents(l.matiere));
      if (!g) { g = { matiere: l.matiere, examen: null, energie: null, cours: [] }; groupes.push(g); }
      if (l.examen && !g.examen) g.examen = l.examen;
      g.cours.push(l);
    }
    // Énergie de la matière : la plus fréquente parmi ses cours renseignés.
    for (const g of groupes) {
      const n = {};
      g.cours.forEach((c) => { if (c.energie) n[c.energie] = (n[c.energie] || 0) + 1; });
      g.energie = Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
    }
    return groupes;
  }

  // Jours proposés pour déplacer une révision prévue le `prevue` : de J-3 à J+3 autour, jamais avant aujourd'hui,
  // ni le jour de l'examen de la matière ou après. Renvoie [{ date, ecart }].
  const ajout = (s, n) => { const [a, m, j] = s.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1, j + n)); return d.toISOString().slice(0, 10); };
  function joursDeplacement(prevue, aujourdhui, examen = null, portee = 3) {
    const base = prevue < aujourdhui ? aujourdhui : prevue;
    const jours = [];
    for (let k = -portee; k <= portee; k++) {
      const d = ajout(base, k);
      if (d < aujourdhui || d === base) continue;
      if (examen && d >= examen) continue;
      jours.push({ date: d, ecart: k });
    }
    return jours;
  }

  // Chapitres de la même matière prévus dans les `portee` jours autour de `date` (hors `sauf`), à regrouper ce jour-là.
  function aRegrouper(chapitres, matiereId, date, aujourdhui, sauf, portee = 3) {
    const min = ajout(date, -portee) < aujourdhui ? aujourdhui : ajout(date, -portee), max = ajout(date, portee);
    return chapitres.filter((c) => c.id !== sauf && c.matiereId === matiereId && c.prochaine && c.prochaine !== date && c.prochaine >= min && c.prochaine <= max);
  }

  // Réordonne une liste d'identifiants : déplace `id` à la position de `cible` (glisser-déposer) ou d'un cran.
  function deplacerDans(ids, id, vers) {
    const l = ids.filter((x) => x !== id);
    const i = ids.indexOf(id);
    if (i < 0) return ids;
    let pos;
    if (typeof vers === 'number') pos = Math.max(0, Math.min(l.length, i + vers));
    else if (l.indexOf(vers) < 0) return ids;
    else pos = l.indexOf(vers) + (i < ids.indexOf(vers) ? 1 : 0); // vers le bas : après la cible ; vers le haut : avant
    l.splice(pos, 0, id);
    return l;
  }

  const api = { COLONNES, MODELE_CSV, PROMPT_PDF, decouper, lireDate, analyserCsv, grouperCsv, joursDeplacement, aRegrouper, deplacerDans };
  if (typeof window !== 'undefined') window.RVXR = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
