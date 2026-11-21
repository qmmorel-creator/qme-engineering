// Vidéo 021 · Planning Gantt · « Une date bouge sur le chantier… et tout recaler à la main ? » (IG-158, 07/12/2026)
// Type : problème → solution (référence vidéo du 20/11/2026, REGLES-CONTENU.md § 3 bis).
// Données : démo intégrée du template (chantier fictif « Rénovation de cuisine »).
// Geste réel : la première tâche du planning prend 3 jours de plus ; l'application recale les tâches liées.
// Le nombre de tâches suivantes recalées est LU dans l'application (la démo contient 3 projets : 35 lignes, dont 14 pour la cuisine).

export const config = {
  nom: '021-gantt-date-bouge',
  produit: 'GNT', type: 'problème', titre: 'Une date bouge sur le chantier : tout recaler à la main ?',
  app: '/templates/gantt/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Planning Gantt',
  url: 'qm-engineering.fr/templates/gantt',
  affiche: 1.0,
  musique: 'auto',
  dureeMax: 30,
};
const T = 60000 / 110;

const LIGNES = '[data-ligne]';

const BANDEAU = '.gl-planning span';
const FIN = (texte) => texte.split('→')[1].split('·')[0].trim();

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await page.waitForTimeout(800);
  await v.fermerDialogues();
  v.n = await appli.$$eval(LIGNES, (rs) => rs.length);
  if (v.n < 6) throw new Error(`Démo inattendue : ${v.n} tâches`);
  v.premiere = await appli.$$eval(`${LIGNES} input[data-champ="nom"]`, (is) => is[0].value);
  v.duree0 = await appli.$$eval(`${LIGNES} [data-champ="duree"]`, (is) => Number(is[0].value));
  if (!v.premiere || !(v.duree0 > 0)) throw new Error(`Première tâche illisible : ${v.premiere} / ${v.duree0}`);
  v.fins0 = await appli.$$eval(`${LIGNES} .c-fin`, (cs) => cs.map((c) => c.innerText.trim()));
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500); // fenêtre masquée avant la première image : accroche seule à l'écran
}

export async function jouer(v) {
  const { S, son, pause, appli } = v;
  const temps = (n = 1) => pause(n * T);
  const PREMIERE = `[data-ligne]:has(input[data-champ="nom"][value="${v.premiere}"])`;

  // Accroche : le problème, visible dès la première image.
  son('whoosh', 0.6);
  await S('accroche', ['Une date bouge', 'sur le chantier…', '!et tout le planning', '!est à refaire *à_la_main* ?'], 0);
  await pause(2600);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Une seule saisie. *Tout se recale.*');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Le chantier et sa date de fin
  await v.temps(); son('zoom'); await S('cadrer', BANDEAU, { max: 2.4, marge: 190 });
  const fin0 = FIN(await v.lire(BANDEAU));
  son('pop'); await S('anneau', 'fin', BANDEAU, { etiquette: `Fin prévue : ${fin0}`, cote: 'dessous', marge: 6 });
  await S('legende', `Un chantier de cuisine : <b>les tâches sont liées</b> entre elles.`);
  await temps(2);
  await S('retirer', 'fin');

  // Le geste : la première tâche prend 3 jours de plus
  await v.temps(); await S('legende', `« ${v.premiere} » prend <b>3 jours de plus</b>.`);
  son('zoom', 0.7); await S('suivre', 2.3);
  await v.saisir(`${PREMIERE} [data-champ="duree"]`, String(v.duree0 + 3), { ms: 480 });
  await v.temps(2); await v.valider();
  await v.temps();
  const fins1 = await appli.$$eval(`${LIGNES} .c-fin`, (cs) => cs.map((c) => c.innerText.trim()));
  // Tâches SUIVANTES recalées : celles dont la fin a changé, sans compter la tâche modifiée elle-même.
  const iPremiere = 0;
  const recalees = fins1.filter((f, i) => i !== iPremiere && f !== v.fins0[i]).length;
  if (recalees < 2) throw new Error(`Recalage inattendu : ${recalees} tâche(s)`);
  await S('flash', PREMIERE, 'var(--ciel)');

  // L'effet : les tâches recalées, puis la nouvelle fin
  son('dezoom', 0.6); await S('cadrer', null);
  await S('legende', `<b>${recalees} tâches suivantes</b> recalées en jours ouvrés, fériés compris.`);
  await temps(2.2);
  son('zoom'); await S('cadrer', BANDEAU, { max: 2.6, marge: 170 });
  const fin1 = FIN(await v.lire(BANDEAU));
  await v.temps();
  await S('flash', BANDEAU, 'var(--rouge)');
  son('alerte', 0.8); await S('avantApres', 'fin', BANDEAU, fin0, fin1, { couleur: 'var(--rouge)', cote: 'dessous', note: 'nouvelle fin' });
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', `${recalees} tâches recalées`, 'Une seule saisie, aucune date à reprendre', 'var(--vert)');
  await temps(2.4);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Planning Gantt', sous: 'Une date bouge,<br>le planning suit.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
