// Vidéo 014 · Notes et moyennes · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue ordinateur. Profil ?demo=droit-l1 (étudiante fictive en L1 de droit). Toutes les valeurs contrôlées (moyenne, note nécessaire) sont LUES dans l'application après chaque geste.
// Version brute uniquement (décision de Quentin du 17/11/2026) : interaction seule, sans texte, sans musique ni
// bruitage, plans tenus 2 à 3 s pour qu'Odélia y pose sa voix au montage.
export const config = {
  nom: '014-notes-odelia',
  produit: 'NTS', type: 'démonstration', titre: 'Partiels de L1 : quelle note me faut-il ?',
  app: '/templates/notes/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 1280, hauteur: 1000,
  marque: 'QME · Notes et moyennes', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: null, muet: true,
};
const T = 60000 / 110;
const MOYENNE = '.tuiles .tuile:first-child';
const SIMULER = '.bloc-simu [data-vue="simulateur"]';
const RESULTAT = '#sim-resultat .resultat';

export async function preparer(v) {
  await v.fermerDialogues(); await v.page.waitForTimeout(800); await v.fermerDialogues();
  v.moyenne = (await v.lire(`${MOYENNE} b`)).replace(/\s+/g, '');
  if (!/^9,\d\d\/20$/.test(v.moyenne)) throw new Error(`Démo inattendue : moyenne ${v.moyenne}`);
  await v.S('cadrer', null);
  await v.S('fenetre', true);
}

export async function jouer(v) {
  const { S, pause } = v;
  const temps = (n = 1) => pause(n * T);
  // Rectangle (coordonnées de l'application) autour d'un élément, élargi : les paragraphes pleine largeur empêchent le zoom.
  const zone = (sel, g = 0, h = 0, d = 0, b = 0) => v.appli.evaluate(([s, g, h, d, b]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left - g, y: r.top - h, w: r.width + g + d, h: r.height + h + b }; }, [sel, g, h, d, b]);
  // 1. La moyenne provisoire, sous 10.
  await v.temps(); await S('cadrer', MOYENNE, { max: 2.4, marge: 50 });
  await temps(3);
  // 2. Le simulateur.
  await S('suivre', 2.0);
  await v.cliquer(SIMULER, { ms: 560 });
  await S('cacherCurseur'); await pause(350);
  const note = (await v.lire(`${RESULTAT} .gros b`)).trim();
  const phrase = await v.lire(RESULTAT);
  if (!/^\d+,\d\d$/.test(note) || !/à chaque épreuve cochée \(4\)/.test(phrase)) throw new Error(`Simulation inattendue : ${phrase}`);
  await S('cadrer', await zone(`${RESULTAT} .gros`, 16, 46, 430, 16), { max: 2.6, marge: 20 });
  await temps(5);
}
