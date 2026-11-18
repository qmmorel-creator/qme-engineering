// Vidéo 016 · Planner horaire · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue ordinateur. Profil ?demo=droit-l1 : semaine de CM, TD, BU et révisions ; bilan de la semaine précédente
// (révisions faites / prévues), LU dans l'application.
// Version brute uniquement (décision de Quentin du 17/11/2026) : interaction seule, sans texte, sans musique ni
// bruitage, plans tenus 2 à 3 s pour qu'Odélia y pose sa voix au montage.
export const config = {
  nom: '016-planner-semaine-odelia',
  produit: 'PHR', type: 'démonstration', titre: 'Ma semaine de L1, prévu et réalisé',
  app: '/templates/planner/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 1280, hauteur: 1000,
  marque: 'QME · Planner horaire', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: null, muet: true,
};
const T = 60000 / 110;
const GRILLE = 'main';
const BILAN = 'button.onglet[data-vue="bilan"]';
const PREC = '[data-action="bilan-prec"]';
const REVISIONS = '.barres-cats .barre-cat:nth-child(2)';

export async function preparer(v) {
  await v.fermerDialogues(); await v.page.waitForTimeout(800); await v.fermerDialogues();
  const texte = await v.lire('main');
  if (!/CM Introduction au droit/.test(texte) || !/BU · fiches et révisions/.test(texte)) throw new Error('Démo inattendue : semaine de L1 absente');
  await v.S('cadrer', null);
  await v.S('fenetre', true);
}

export async function jouer(v) {
  const { S, pause } = v;
  const temps = (n = 1) => pause(n * T);
  // 1. La semaine type, puis la journée d'aujourd'hui.
  await v.temps(); await S('cadrer', GRILLE, { max: 1.2, marge: 10 });
  await temps(4);
  // 2. Le bilan de la semaine dernière.
  await S('suivre', 1.8);
  await v.cliquer(BILAN, { ms: 560 });
  await pause(250);
  await v.cliquer(PREC, { ms: 480 });
  await S('cacherCurseur'); await pause(300);
  const ligne = (await v.lire(REVISIONS)).replace(/\s+/g, ' ').trim();
  const m = ligne.match(/^Révisions (.+) \/ (.+)$/);
  const taux = (await v.lire('.tuiles .tuile:nth-child(3) b')).replace(/\s+/g, '');
  if (!m || !/^\d+%$/.test(taux)) throw new Error(`Bilan inattendu : ${ligne} / ${taux}`);
  // Ligne pleine largeur : on cadre sur ses 640 premiers pixels, tuiles comprises, pour un vrai zoom.
  const z = await v.appli.evaluate((sel) => { const t = document.querySelector('.tuiles').getBoundingClientRect(), r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left, y: t.top, w: Math.min(640, r.width), h: r.bottom - t.top }; }, REVISIONS);
  await S('cadrer', z, { max: 2.2, marge: 20 });
  await temps(4);
}
