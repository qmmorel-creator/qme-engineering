// Vidéo 022 · Suivi des abonnements · « Un essai gratuit… puis 179,88 € par an, sans prévenir. » (IG-163, 16/12/2026)
// Type : problème → solution (référence vidéo du 20/11/2026, REGLES-CONTENU.md § 3 bis).
// Données : démo intégrée du template (foyer fictif, aucun nom de marque). Carte « Fin d'essai » de l'Aperçu.
// Geste réel : « À résilier » sur l'essai qui devient payant ; la tuile Économies se met à jour.
// Prix annuel, délai et économies sont LUS dans l'application, jamais écrits à l'avance.

export const config = {
  nom: '022-abonnements-fin-essai',
  produit: 'ABN', type: 'problème', titre: 'Un essai gratuit qui devient payant sans prévenir',
  app: '/templates/abonnements/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Suivi des abonnements',
  url: 'qm-engineering.fr/templates/abonnements',
  affiche: 1.0,
  musique: 'auto',
  dureeMax: 30,
};
const T = 60000 / 110;
const ECO = '.tuiles:not(.tuiles-3) > .tuile:nth-child(4)';
let CARTE = '';

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues();
  await page.waitForTimeout(800);
  await v.fermerDialogues();
  const k = await appli.$$eval('.decisions > article.decision', (as) => as.findIndex((a) => /essai/i.test(a.querySelector('.etiquette')?.textContent || '')));
  if (k < 0) throw new Error('Aucune carte « Fin d\'essai » dans la démo.');
  CARTE = `.decisions > article.decision:nth-child(${k + 1})`;
  v.nom = await appli.$eval(`${CARTE} .decision-corps b`, (e) => e.textContent.trim());
  v.prix = (await v.lire(`${CARTE} .montant-mini`)).replace(/\s*par an$/, '').trim();
  const texte = await appli.$eval(`${CARTE} .decision-corps`, (e) => e.textContent); // v.lire renverrait la valeur (vide) du bouton
  v.jours = (texte.match(/dans (\d+) jours?/) || [])[1];
  if (!v.prix || !v.jours) throw new Error(`Carte inattendue : ${v.prix} / ${texte}`);
  v.eco0 = await v.lire(`${ECO} b`);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
  await page.waitForTimeout(1500); // fenêtre masquée avant la première image : accroche seule à l'écran
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);

  // Accroche : le problème chiffré, visible dès la première image.
  son('whoosh', 0.6);
  await S('accroche', ['Un essai gratuit…', `!puis *${v.prix.replace(/\s/g, '_')}*`, '!par an,', 'sans prévenir.'], 0);
  await pause(2600);
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Le suivi prévient *avant*.');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // La carte « Fin d'essai »
  await v.temps(); son('zoom'); await S('cadrer', CARTE, { max: 2.4, marge: 60 });
  son('pop'); await S('anneau', 'c', CARTE, { couleur: 'var(--rouge)', etiquette: `Payant dans ${v.jours} jours`, cote: 'dessous', marge: 6 });
  await S('legende', `Fin d'essai : <b>à décider avant</b> le premier prélèvement.`);
  await temps(2.4);
  await S('retirer', 'c');

  // Le geste : « À résilier »
  await v.temps(); await S('legende', `On ne le garde pas : <b>À résilier</b>.`);
  await S('suivre', 2.2);
  await v.cliquer(`${CARTE} [data-action="a-resilier"]`, { ms: 520 });
  await pause(300);

  // L'effet : les économies de l'année
  son('dezoom', 0.6); await S('cadrer', ECO, { max: 2.2, marge: 60 });
  const eco1 = await v.lire(`${ECO} b`);
  if (eco1 === v.eco0) throw new Error(`Économies inchangées : ${eco1}`);
  await v.temps();
  await S('flash', ECO, 'var(--jaune)');
  son('pop'); await S('avantApres', 'e', `${ECO} b`, v.eco0, eco1, { couleur: 'var(--vert)', cote: 'dessous', note: 'économies par an' });
  await S('eclat', ECO, ['var(--jaune)', 'var(--bleu)', 'var(--rouge)']);
  await S('legende', `<b>${v.prix}</b> par an décidés à temps.`);
  await temps(1.6);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Décidé à temps', `${v.prix} par an, avant le premier prélèvement`, 'var(--vert)');
  await temps(2.2);
  await S('tamponFin'); await S('retirer'); await S('cacherCurseur');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Suivi des abonnements', sous: 'Chaque fin d\'essai,<br>signalée à temps.', url: 'Essai gratuit · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(3);
}
