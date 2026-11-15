// Vidéo 003 · Planning de révision · « 8 chapitres ajoutés d'un coup : tout tombe le même jour ? »
// Type : démonstration (du geste de saisie au planning de la semaine rempli). Données : démo intégrée du template
// (élève fictive de terminale). Toutes les valeurs affichées par l'habillage (nombre de révisions par jour, maximum
// par jour, jours, titres) sont LUES dans l'application réelle, avant et après le geste.

export const config = {
  nom: '003-revision-chapitres',
  produit: 'REV', type: 'démonstration', titre: '8 chapitres d\'un coup : tout tombe le même jour ?',
  app: '/templates/revision/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning de révision',
  url: 'qm-engineering.fr/templates/revision',
  affiche: 1.8,
  // Musique identique au modèle (gantt-retard) : « Corporate », litesaturation, licence Pixabay.
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

// Huit chapitres de philosophie (programme de terminale), un par ligne : la saisie groupée de l'application.
const CHAPITRES = ['L\'art', 'Le temps', 'La vérité', 'L\'État', 'La raison', 'Le travail', 'La liberté', 'La nature'];
const NOUVEAU = '.vue-tete [data-action="chapitre-nouveau"]';
const TITRE = 'dialog[open] textarea[name="titre"]';
const MATIERE = 'dialog[open] select[name="matiere"]';
const AJOUTER = 'dialog[open] button[value="ok"]';
const DETAIL = '.jour-detail';
const cellule = (j) => `.cellule[data-jour="${j}"]`;

// « lundi 16 novembre : 2 révisions » → { jour: 'Lundi', n: 2 }
const etiquette = async (v, j) => {
  const t = await v.appli.$eval(cellule(j), (e) => e.getAttribute('aria-label'));
  const m = t.match(/^(\S+) [^:]+: (\d+) révision/);
  if (!m) throw new Error(`Étiquette de jour inattendue : ${t}`);
  return { jour: m[1][0].toUpperCase() + m[1].slice(1), n: Number(m[2]), texte: t };
};

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  await appli.click('button[data-vue="planning"]'); await page.waitForTimeout(400);
  // Demain et après-demain, lus dans le calendrier (l'« aujourd'hui » de l'application est la date du tournage).
  const futurs = await appli.$$eval('.cellule:not(.passe):not(.aujourdhui)', (cs) => cs.map((c) => c.dataset.jour));
  [v.j1, v.j2] = futurs;
  v.max = Number((await v.lire('.vue-tete p')).match(/Au-delà de (\d+) révisions par jour/)?.[1]);
  v.a1 = await etiquette(v, v.j1); v.a2 = await etiquette(v, v.j2);
  // Le cas montré : demain a déjà des révisions, et 8 de plus dépassent le maximum par jour.
  if (!v.max || v.a1.n < 1 || v.a1.n + CHAPITRES.length <= v.max || v.a2.n + v.a1.n + CHAPITRES.length - v.max > v.max) {
    throw new Error(`Données de démo inattendues : max ${v.max}, ${v.a1.texte}, ${v.a2.texte}`);
  }
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause, page } = v;
  const temps = (n = 1) => pause(n * T);
  const C1 = cellule(v.j1), C2 = cellule(v.j2);

  // Accroche : un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Partiels de décembre :', `*${CHAPITRES.length}_chapitres* ajoutés d'un coup.`, '!Tout tombe *le_même_jour ?*'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', `Où vont *${CHAPITRES.length} chapitres* ajoutés d'un coup ?`);
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Le planning de départ : demain
  await v.temps(); son('zoom'); await S('cadrer', [C1, C2], { max: 2.4, marge: 220 });
  await v.temps(); son('pop');
  await S('anneau', 'j1', C1, { etiquette: `${v.a1.jour} : ${v.a1.n} révision${v.a1.n > 1 ? 's' : ''}`, cote: 'dessus', marge: 4 });
  await S('legende', `Demain, <b>${v.a1.n} révision${v.a1.n > 1 ? 's' : ''}</b> déjà prévue${v.a1.n > 1 ? 's' : ''}.`);
  await temps(2);
  await S('retirer', 'j1');

  // Geste : bouton « Chapitre », un titre par ligne
  await v.temps(); await S('legende', `Un chapitre par ligne : <b>${CHAPITRES.length} d'un coup</b>.`);
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer(NOUVEAU, { ms: 560 });
  await pause(250);
  const matiere = await v.appli.$eval(MATIERE, (s) => s.selectedOptions[0].textContent.trim());
  if (matiere !== 'Philosophie') throw new Error(`Matière proposée inattendue : ${matiere}`);
  await v.cliquer(TITRE, { ms: 520 });
  son('zoom', 0.6); await S('cadrer', 'dialog[open] .modale-corps', { max: 1.9, marge: 40 });
  const texte = CHAPITRES.join('\n');
  for (const c of texte) {
    await S('touche', c === '\n' ? 'Entrée ⏎' : c);
    son('touche', 0.8); await page.keyboard.type(c); await pause(c === '\n' ? 90 : 55);
  }
  const saisi = await v.lire(TITRE);
  if (saisi.split('\n').length !== CHAPITRES.length) throw new Error(`Saisie incomplète : ${saisi}`);
  await v.temps();
  son('zoom', 0.6); await S('suivre', 2.2);
  await v.cliquer(AJOUTER, { ms: 520 });
  await pause(300);
  const toast = await v.lire('.toast');
  if (!toast.includes(`${CHAPITRES.length} chapitres ajoutés`)) throw new Error(`Ajout non confirmé : ${toast}`);
  await S('cacherCurseur');

  // Résultat : demain au maximum, le reste glisse au lendemain
  son('dezoom'); await S('cadrer', [C1, C2], { max: 2.4, marge: 220 });
  const b1 = await etiquette(v, v.j1), b2 = await etiquette(v, v.j2);
  const decales = b2.n - v.a2.n;
  if (b1.n !== v.max || decales !== v.a1.n + CHAPITRES.length - v.max) throw new Error(`Résultat inattendu : ${b1.texte}, ${b2.texte}`);
  await v.temps();
  await S('flash', C1, 'var(--rose)');
  son('pop'); await S('avantApres', 'c1', C1, `${v.a1.n}`, `${b1.n}`, { couleur: 'var(--rouge)', cote: 'dessus', note: `maximum : ${v.max} par jour` });
  son('trait', 0.6); await S('souligner', 's1', `${C1} .nb`, 'var(--rouge)');
  await temps(2);
  await S('flash', C2, 'var(--vert)');
  son('eclat'); await S('eclat', C2, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await S('avantApres', 'c2', C2, `${v.a2.n}`, `${b2.n}`, { couleur: 'var(--vert)', cote: 'dessous', note: `${decales} décalées au lendemain` });
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `Pas plus de ${v.max} par jour`, `${b1.jour} : ${b1.n} · ${b2.jour} : ${b2.n}`, 'var(--vert)');
  await temps(2.6);
  await S('tamponFin'); await S('retirer');

  // Navigation : le détail du jour d'après
  await v.temps(); await S('legende', `Le détail du <b>${b2.jour.toLowerCase()}</b>, en un clic.`);
  son('zoom', 0.7); await S('suivre', 2.2);
  await v.cliquer(C2, { ms: 520 });
  await pause(250);
  son('zoom'); await S('cadrer', DETAIL, { max: 2.2, marge: 80 });
  const titres = await v.appli.$$eval(`${DETAIL} .ligne b`, (bs) => bs.map((b) => b.textContent.trim()));
  const resume = await v.lire(`${DETAIL} h2 span`);
  if (titres.join() !== CHAPITRES.slice(-decales).join()) throw new Error(`Détail inattendu : ${titres.join(', ')}`);
  await v.temps();
  await S('flash', DETAIL, 'var(--ciel)');
  son('pop'); await S('anneau', 'd', `${DETAIL} h2`, { couleur: 'var(--vert)', etiquette: `${b2.jour} : ${resume}`, cote: 'dessus', pulse: false, marge: 4 });
  son('trait', 0.6); await S('souligner', 's2', `${DETAIL} .ligne:last-of-type b`, 'var(--vert)');
  await S('legende', `<b>${titres.join('</b> et <b>')}</b> : première révision ${b2.jour.toLowerCase()}.`);
  await temps(3);
  await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning de révision', sous: 'Vos chapitres répartis jour par jour,<br>sans journée surchargée.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
