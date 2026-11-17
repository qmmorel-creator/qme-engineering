// Vidéo 015 · Planning de révision · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue téléphone (390 × 844). Profil ?demo=droit-l1. Compte à rebours, chapitre du jour, mots-clés retrouvés : LUS dans
// l'application.
// Version brute uniquement (décision de Quentin du 17/11/2026) : interaction seule, sans texte, sans musique ni
// bruitage, plans tenus 2 à 3 s pour qu'Odélia y pose sa voix au montage.
export const config = {
  nom: '015-revision-session-odelia',
  produit: 'REV', type: 'démonstration', titre: 'Quoi réviser aujourd\'hui, jusqu\'au partiel',
  app: '/templates/revision/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 390, hauteur: 844,
  marque: 'QME · Planning de révision', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: null, muet: true,
};
const T = 60000 / 110;
const EXAMEN = '.examen-carte';
const SESSION = '.jour-titre [data-action="session"]';
const CONSEILS = '.session-conseils';
const COMMENCER = '[data-action="session-suivant"]';
const FEUILLE = '#feuille';
const COMPARER = '[data-action="session-comparer"]';
const COMPARAISON = '.comparaison';

export async function preparer(v) {
  await v.fermerDialogues(); await v.page.waitForTimeout(800); await v.fermerDialogues();
  v.titre = await v.lire('.jour-titre h1');
  v.compte = (await v.lire(`${EXAMEN} .compte`)).trim();
  v.examen = (await v.lire(`${EXAMEN} p:nth-of-type(2)`)).split('·')[0].trim();
  const etat = await v.appli.evaluate(() => window.__revision.etat());
  if (!v.titre.includes('Odélia') || etat.demoProfil !== 'droit-l1' || !/^J-\d+$/.test(v.compte)) throw new Error(`Démo inattendue : ${v.titre} ${v.compte}`);
  await v.S('cadrer', null);
  await v.S('fenetre', true);
}

export async function jouer(v) {
  const { S, pause, appli } = v;
  const temps = (n = 1) => pause(n * T);
  // 1. Le compte à rebours jusqu'au premier partiel.
  await v.temps(); await S('cadrer', EXAMEN, { max: 1.8, marge: 30 });
  await temps(3);
  // 2. La session guidée : ne pas déranger, feuille blanche.
  await S('suivre', 1.6);
  await v.cliquer(SESSION, { ms: 520 });
  await S('cacherCurseur'); await pause(300);
  await S('cadrer', CONSEILS, { max: 1.8, marge: 20 });
  await temps(3);
  await S('suivre', 1.6);
  await v.cliquer(COMMENCER, { ms: 480 });
  await pause(250);
  // 3. De mémoire, puis comparaison aux mots-clés du chapitre.
  const chapitre = await v.lire('.session-chapitre h2');
  const cles = await appli.evaluate((t) => window.__revision.etat().chapitres.find((c) => c.titre === t)?.motsCles || '', chapitre);
  const liste = cles.split(',').map((x) => x.trim()).filter(Boolean);
  if (liste.length < 3) throw new Error(`Mots-clés insuffisants pour « ${chapitre} » : ${cles}`);
  const souvenir = liste.slice(0, 2);
  await S('cadrer', ['.session-chapitre h2', FEUILLE], { max: 1.8, marge: 20 });
  await v.saisir(FEUILLE, `${souvenir.join(', ')}…`, { ms: 420, rapide: true });
  await v.cliquer(COMPARER, { ms: 420 });
  await S('cacherCurseur'); await pause(250);
  const score = (await v.lire(`${COMPARAISON} p b`)).trim();
  if (score !== `${souvenir.length}/${liste.length}`) throw new Error(`Comparaison inattendue : ${score}`);
  await S('cadrer', COMPARAISON, { max: 1.8, marge: 20 });
  await temps(3);
}
