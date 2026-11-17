// Vidéo 016 · Planner horaire · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue ordinateur. Profil ?demo=droit-l1 : semaine de CM, TD, BU et révisions ; bilan de la semaine précédente
// (révisions faites / prévues), LU dans l'application. Versions habillée et brute (VIDEO_BRUT=1).
const BRUT = process.env.VIDEO_BRUT === '1';
export const config = {
  nom: `016-planner-semaine-odelia${BRUT ? '-brut' : ''}`,
  produit: 'PHR', type: 'démonstration', titre: 'Ma semaine de L1, prévu et réalisé',
  app: '/templates/planner/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 1280, hauteur: 1000,
  marque: 'QME · Planner horaire', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: BRUT ? null : { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
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
  await v.S('fenetre', BRUT);
}

export async function jouer(v) {
  const { S, pause } = v;
  const H = BRUT ? async () => {} : S;
  const son = BRUT ? () => {} : v.son;
  const temps = (n = 1) => pause(n * T);
  if (!BRUT) {
    son('whoosh', 0.6);
    await S('accroche', ['Cours, TD, BU :', 'ma *semaine*', 'tient dans un écran.'], T / 2);
    await v.temps(); son('whoosh'); await S('accrocheSortie');
    await v.temps(); await S('fenetre', true);
  }
  // 1. La semaine type, puis la journée d'aujourd'hui.
  await v.temps(); son('zoom'); await S('cadrer', GRILLE, { max: 1.2, marge: 10 });
  await H('legende', 'CM, TD, BU, <b>révisions</b> et sport, bloc par bloc.');
  await temps(BRUT ? 2 : 2.5);
  // 2. Le bilan de la semaine dernière.
  await H('legende', 'Le dimanche, <b>le bilan</b> : prévu et fait.');
  son('zoom', 0.7); await S('suivre', 1.8);
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
  son('zoom', 0.6); await S('cadrer', z, { max: 2.2, marge: 20 });
  await H('flash', REVISIONS, 'var(--bleu)');
  son('pop'); await H('anneau', 'r', REVISIONS, { couleur: 'var(--bleu)', etiquette: `${m[1]} faites`, cote: 'dessous', marge: 6 });
  await H('legende', `Révisions : <b>${m[1]}</b> faites sur ${m[2]} prévues (${taux} au total).`);
  await temps(BRUT ? 2 : 3); await H('retirer');
  if (!BRUT) {
    await v.temps(); son('whoosh'); await S('volet'); await S('legende', null);
    await S('outro', { titre: 'Planner horaire', sous: 'Dans le Pack Étudiant.<br>qm-engineering.fr/demo/odelia', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
    son('ding', 0.6); await temps(3);
  }
}
