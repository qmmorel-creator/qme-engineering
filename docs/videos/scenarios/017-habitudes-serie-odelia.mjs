// Vidéo 017 · Suivi d'habitudes · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue téléphone (390 × 844). Profil ?demo=droit-l1 : la session de révision du jour reste à cocher ; la série
// avant et après le geste est LUE dans l'application. Versions habillée et brute (VIDEO_BRUT=1).
const BRUT = process.env.VIDEO_BRUT === '1';
export const config = {
  nom: `017-habitudes-serie-odelia${BRUT ? '-brut' : ''}`,
  produit: 'HBT', type: 'démonstration', titre: 'Une session de révision par jour, une série qui tient',
  app: '/templates/habitudes/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 390, hauteur: 844,
  marque: 'QME · Suivi d\'habitudes', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: BRUT ? null : { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
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
  await v.S('fenetre', BRUT);
}

export async function jouer(v) {
  const { S, pause } = v;
  const H = BRUT ? async () => {} : S;
  const son = BRUT ? () => {} : v.son;
  const temps = (n = 1) => pause(n * T);
  if (!BRUT) {
    son('whoosh', 0.6);
    await S('accroche', ['Réviser', '*chaque jour*,', 'sans casser la série.'], T / 2);
    await v.temps(); son('whoosh'); await S('accrocheSortie');
    await v.temps(); await S('fenetre', true);
  }
  await v.temps(); son('zoom'); await S('cadrer', LIGNE, { max: 2.0, marge: 30 });
  await H('legende', `Session de révision : <b>${v.avant.replace('série ', '')}</b> d'affilée.`);
  await temps(BRUT ? 1 : 1.5);
  son('zoom', 0.7); await S('suivre', 2.0);
  await v.cliquer(LIGNE, { ms: 520, fx: 0.12 });
  await S('cacherCurseur'); await pause(400);
  const apres = (await v.lire(SERIE)).trim();
  const etat = await v.appli.$eval(LIGNE, (b) => b.getAttribute('aria-pressed'));
  if (etat !== 'true' || apres === v.avant) throw new Error(`Habitude non cochée : ${etat} / ${apres}`);
  son('dezoom'); await S('cadrer', LIGNE, { max: 2.0, marge: 30 });
  await H('flash', LIGNE, 'var(--vert)');
  son('pop'); await H('avantApres', 'a', SERIE, v.avant, apres, { couleur: 'var(--vert)', cote: 'dessous' });
  if (!BRUT) { await v.temps(); son('eclat'); await S('eclat', LIGNE, ['var(--jaune)', 'var(--rouge)', 'var(--bleu)']); }
  await H('legende', `Cochée : <b>${apres.replace('série ', '')}</b>.`);
  await temps(BRUT ? 1.5 : 2.5); await H('retirer');
  if (!BRUT) {
    await v.temps(); son('whoosh'); await S('volet'); await S('legende', null);
    await S('outro', { titre: 'Suivi d\'habitudes', sous: 'Dans le Pack Étudiant.<br>qm-engineering.fr/demo/odelia', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
    son('ding', 0.6); await temps(3);
  }
}
