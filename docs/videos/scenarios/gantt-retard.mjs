// Vidéo 001 · Planning Gantt · « Une tâche prend 3 jours de retard : la fin du chantier bouge-t-elle ? »
// Type : réponse à une question précise. Données : démo intégrée du template (chantier fictif « Rénovation de cuisine »).
// Toutes les valeurs affichées par l'habillage (marges, dates de fin, écart) sont LUES dans l'application réelle.

export const config = {
  nom: 'gantt-retard',
  app: '/templates/gantt/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning Gantt',
  url: 'qm-engineering.fr/templates/gantt',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  // 110 BPM, premier temps à 0,534 s ; départ au 36e temps (20,17 s), dans la partie pleine du morceau.
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const tache = (nom) => `[data-ligne]:has(input[data-champ="nom"][value="${nom}"])`;
const PLATRERIE = 'Plâtrerie et reprise des murs';
const POSE = 'Pose des meubles';
const BANDEAU = '.gl-planning span';
const FIN = (texte) => texte.split('→')[1].split('·')[0].trim(); // « 12/10 → 02/12 · ouvrés » → « 02/12 »

// Jours ouvrés (lundi-vendredi) entre deux dates jj/mm de la même année ; aucun férié entre fin novembre et mi-décembre.
function ecartOuvres(de, a, annee = 2026) {
  const d = ([j, m]) => new Date(Date.UTC(annee, m - 1, j));
  let x = d(de.split('/').map(Number)), y = d(a.split('/').map(Number)), n = 0;
  while (x < y) { x = new Date(x.getTime() + 864e5); if (![0, 6].includes(x.getUTCDay())) n++; }
  return n;
}

export async function preparer(v) {
  const { appli, page } = v;
  // Fermer le guide d'accueil (premier lancement), hors caméra.
  await appli.locator('dialog[open] button', { hasText: '×' }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(300);
  // Marges réelles, lues dans l'onglet « Chemin critique », puis retour au Gantt.
  await appli.click('button[data-vue="critique"]'); await page.waitForTimeout(300);
  v.marges = await appli.$$eval('table tbody tr', (rs) => Object.fromEntries(rs.map((r) => {
    const c = [...r.cells].map((x) => x.innerText.trim());
    return [c[1].replace(/^◆\s*/, '').replace(/\s*Critique$/i, ''), Number(c[7])];
  })));
  await appli.click('button[data-vue="gantt"]'); await page.waitForTimeout(300);
  if (v.marges[PLATRERIE] == null || v.marges[POSE] !== 0) throw new Error(`Données de démo inattendues : ${JSON.stringify(v.marges)}`);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);        // attendre n temps
  const FINT = (nom) => `${tache(nom)} .c-fin`;
  const DUREE = (nom) => `${tache(nom)} [data-champ="duree"]`;

  // Accroche : un mot par demi-temps (un seul son d'entrée, pas un par mot)
  const lignes = ['Une tâche prend', '*3_jours* de retard.', '!La fin du chantier *bouge ?*'];
  son('whoosh', 0.6);
  await S('accroche', lignes, T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Un retard décale-t-il la *fin* ?');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Zoom sur la date de fin du chantier
  await v.temps(); son('zoom'); await S('cadrer', BANDEAU, { max: 2.4, marge: 190 });
  const fin0 = FIN(await v.lire(BANDEAU));
  await v.temps(); son('pop'); await S('anneau', 'fin', BANDEAU, { etiquette: `Fin prévue : ${fin0}`, cote: 'dessous', marge: 6 });
  await S('legende', `Un chantier de cuisine, <b>14 tâches</b> liées.`);
  await temps(2);
  await S('retirer', 'fin');

  // Cas 1 : tâche avec de la marge. La caméra suit la souris.
  await v.temps(); await S('legende', `La plâtrerie prend <b>3 jours de plus</b>.`, 'Cas 1');
  son('zoom', 0.7); await S('suivre', 2.3);
  const avant7 = await v.lire(FINT(PLATRERIE));
  await v.saisir(DUREE(PLATRERIE), '6', { ms: 480 });
  await v.temps(2); await v.valider();
  await v.temps();
  const apres7 = await v.lire(FINT(PLATRERIE));
  await S('flash', tache(PLATRERIE), 'var(--ciel)');
  son('pop'); await S('avantApres', 'r', FINT(PLATRERIE), avant7, apres7, { couleur: 'var(--bleu)', note: 'la tâche finit plus tard' });
  await temps(2);
  await S('retirer', 'r');
  son('zoom'); await S('cadrer', BANDEAU, { max: 2.6, marge: 170 });
  const fin1 = FIN(await v.lire(BANDEAU));
  await v.temps();
  await S('flash', BANDEAU, 'var(--vert)');
  son('eclat'); await S('eclat', BANDEAU, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await S('avantApres', 'fin', BANDEAU, fin0, fin1, { couleur: 'var(--vert)', cote: 'dessous', note: fin1 === fin0 ? 'inchangée' : '' });
  son('trait', 0.6); await S('souligner', 's', BANDEAU, 'var(--vert)');
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', fin1 === fin0 ? 'La fin ne bouge pas' : `Fin : ${fin1}`, `${v.marges[PLATRERIE]} jours de marge absorbent le retard`, 'var(--vert)');
  await temps(2.4);
  await S('tamponFin'); await S('retirer');

  // Cas 2 : tâche critique
  await v.temps(); await S('legende', `La pose des meubles prend <b>3 jours de plus</b>.`, 'Cas 2');
  son('zoom', 0.7); await S('suivre', 2.3);
  const avant9 = await v.lire(FINT(POSE));
  await v.saisir(DUREE(POSE), '6', { ms: 480 });
  await v.temps(2); await v.valider();
  await v.temps();
  const apres9 = await v.lire(FINT(POSE));
  await S('flash', tache(POSE), 'var(--rose)');
  son('pop'); await S('avantApres', 'r', FINT(POSE), avant9, apres9, { couleur: 'var(--bleu)', note: 'la tâche finit plus tard' });
  await temps(2);
  await S('retirer', 'r');
  son('zoom'); await S('cadrer', BANDEAU, { max: 2.6, marge: 170 });
  const fin2 = FIN(await v.lire(BANDEAU));
  const ecart = ecartOuvres(fin1, fin2);
  await v.temps();
  await S('flash', BANDEAU, 'var(--rouge)');
  son('alerte', 0.8); await S('avantApres', 'fin', BANDEAU, fin1, fin2, { couleur: 'var(--rouge)', cote: 'dessous', note: `+${ecart} j ouvrés` });
  await v.temps(); son('tampon', 0.6); await S('secouer', 'fin'); await S('coup', 0.05);
  await v.temps(); son('tampon');
  await S('tampon', `La fin recule de ${ecart} jours`, 'Tâche critique : aucune marge', 'var(--rouge)');
  await temps(2.4);
  await S('tamponFin'); await S('retirer');

  // Navigation : l'onglet Chemin critique
  await v.temps(); await S('legende', `Lesquelles surveiller ? L'onglet <b>Chemin critique</b>.`);
  son('dezoom'); await S('suivre', 1.5, 0.15);
  await v.cliquer('button[data-vue="critique"]', { ms: 520 });
  son('zoom'); await S('cadrer', '.tuile:first-child', { max: 2.6, marge: 150 });
  const finCalc = await v.lire('.tuile:first-child .tuile-date');
  await v.temps();
  await S('flash', '.tuile:first-child', 'var(--rose)');
  son('pop'); await S('anneau', 'c1', '.tuile:first-child', { couleur: 'var(--rouge)', etiquette: `Nouvelle fin : ${finCalc}`, cote: 'dessous', pulse: false });
  son('trait', 0.6); await S('souligner', 's', '.tuile:first-child .tuile-date', 'var(--rouge)');
  await temps(2.5);
  await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning Gantt', sous: 'Le chemin critique recalculé<br>à chaque saisie.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
