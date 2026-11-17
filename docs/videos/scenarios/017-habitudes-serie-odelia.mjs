// Vidéo 017 · Suivi d'habitudes · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue téléphone (390 × 844). Profil ?demo=droit-l1 : la session de révision du jour reste à cocher ; la série
// avant et après le geste est LUE dans l'application.
// Version brute uniquement (décision de Quentin du 17/11/2026) : interaction seule, sans texte, sans musique ni
// bruitage, plans tenus 2 à 3 s pour qu'Odélia y pose sa voix au montage.
export const config = {
  nom: '017-habitudes-serie-odelia',
  produit: 'HBT', type: 'démonstration', titre: 'Une session de révision par jour, une série qui tient',
  app: '/templates/habitudes/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 390, hauteur: 844,
  marque: 'QME · Suivi d\'habitudes', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: null, muet: true,
};
const T = 60000 / 110;
const LIGNE = 'button.cocher[aria-label^="Session de révision"]';
const SERIE = `${LIGNE} .ligne-nom span`;

export async function preparer(v) {
  await v.fermerDialogues(); await v.page.waitForTimeout(800); await v.fermerDialogues();
  v.titre = await v.lire('h1');
  v.avant = (await v.lire(SERIE)).trim();
  if (!v.titre.includes('Odélia') || !/^série \d+ jours$/.test(v.avant)) throw new Error(`Démo inattendue : ${v.titre} / ${v.avant}`);
  // La ligne est plus bas dans la liste : on la fait défiler hors caméra.
  await v.appli.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), LIGNE);
  await v.S('cadrer', null);
  await v.S('fenetre', true);
}

export async function jouer(v) {
  const { S, pause } = v;
  const temps = (n = 1) => pause(n * T);
  await v.temps(); await S('cadrer', LIGNE, { max: 2.0, marge: 30 });
  await temps(3);
  await S('suivre', 2.0);
  await v.cliquer(LIGNE, { ms: 520, fx: 0.12 });
  await S('cacherCurseur'); await pause(400);
  const apres = (await v.lire(SERIE)).trim();
  const etat = await v.appli.$eval(LIGNE, (b) => b.getAttribute('aria-pressed'));
  if (etat !== 'true' || apres === v.avant) throw new Error(`Habitude non cochée : ${etat} / ${apres}`);
  await S('cadrer', LIGNE, { max: 2.0, marge: 30 });
  await temps(3);
}
