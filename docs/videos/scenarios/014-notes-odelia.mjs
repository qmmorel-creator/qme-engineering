// Vidéo 014 · Notes et moyennes · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue ordinateur. Profil ?demo=droit-l1 (étudiante fictive en L1 de droit). Toutes les valeurs affichées par
// l'habillage (moyenne, note nécessaire, simulation) sont LUES dans l'application après chaque geste.
// Deux versions : habillée (accroche, légendes, musique) et brute (VIDEO_BRUT=1 : interaction seule, sans texte ;
// le son est retiré après le rendu) pour qu'Odélia y pose sa voix.
const BRUT = process.env.VIDEO_BRUT === '1';
export const config = {
  nom: `014-notes-odelia${BRUT ? '-brut' : ''}`,
  produit: 'NTS', type: 'démonstration', titre: 'Partiels de L1 : quelle note me faut-il ?',
  app: '/templates/notes/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 1280, hauteur: 1000,
  marque: 'QME · Notes et moyennes', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: BRUT ? null : { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110;
const MOYENNE = '.tuiles .tuile:first-child';
const SIMULER = '.bloc-simu [data-vue="simulateur"]';
const RESULTAT = '#sim-resultat .resultat';
const TABLEAU = '#sim-resultat table';

export async function preparer(v) {
  await v.fermerDialogues(); await v.page.waitForTimeout(800); await v.fermerDialogues();
  v.moyenne = (await v.lire(`${MOYENNE} b`)).replace(/\s+/g, '');
  if (!/^9,\d\d\/20$/.test(v.moyenne)) throw new Error(`Démo inattendue : moyenne ${v.moyenne}`);
  await v.S('cadrer', null);
  await v.S('fenetre', BRUT);
}

export async function jouer(v) {
  const { S, pause } = v;
  const H = BRUT ? async () => {} : S; // habillage (textes, emphases) : absent de la version brute
  const son = BRUT ? () => {} : v.son;
  const temps = (n = 1) => pause(n * T);
  // Rectangle (coordonnées de l'application) autour d'un élément, élargi : les paragraphes pleine largeur empêchent le zoom.
  const zone = (sel, g = 0, h = 0, d = 0, b = 0) => v.appli.evaluate(([s, g, h, d, b]) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left - g, y: r.top - h, w: r.width + g + d, h: r.height + h + b }; }, [sel, g, h, d, b]);
  if (!BRUT) {
    son('whoosh', 0.6);
    await S('accroche', ['Partiels de L1 :', 'quelle note', 'il me *faut* ?'], T / 2);
    await v.temps(); son('whoosh'); await S('accrocheSortie');
    await v.temps(); await S('fenetre', true);
  }
  // 1. La moyenne provisoire, sous 10.
  await v.temps(); son('zoom'); await S('cadrer', MOYENNE, { max: 2.4, marge: 50 });
  son('pop'); await H('anneau', 'm', MOYENNE, { couleur: 'var(--rouge)', etiquette: 'Sous 10', cote: 'dessous', marge: 6 });
  await H('legende', `Notes de TD saisies : <b>${v.moyenne.replace('/20', '')}</b> de moyenne.`);
  await temps(BRUT ? 1.5 : 2.5); await H('retirer');
  // 2. Le simulateur.
  await H('legende', 'La note à viser aux partiels, <b>calculée</b>.');
  son('zoom', 0.7); await S('suivre', 2.0);
  await v.cliquer(SIMULER, { ms: 560 });
  await S('cacherCurseur'); await pause(350);
  const note = (await v.lire(`${RESULTAT} .gros b`)).trim();
  const phrase = await v.lire(RESULTAT);
  if (!/^\d+,\d\d$/.test(note) || !/à chaque épreuve cochée \(4\)/.test(phrase)) throw new Error(`Simulation inattendue : ${phrase}`);
  son('zoom', 0.6); await S('cadrer', await zone(`${RESULTAT} .gros`, 16, 46, 430, 16), { max: 2.6, marge: 20 });
  await H('flash', RESULTAT, 'var(--jaune)');
  son('pop'); await H('anneau', 'n', `${RESULTAT} .gros`, { couleur: 'var(--bleu)', etiquette: 'à chaque partiel', cote: 'dessous', marge: 6 });
  await H('legende', `<b>${note}/20</b> à chacun des 4 partiels pour valider le semestre.`);
  await temps(BRUT ? 2 : 3); await H('retirer');
  // 3. Et si j'avais 12 partout ?
  const douze = await v.appli.$$eval(`${TABLEAU} thead th`, (ths) => ths.findIndex((t) => t.textContent.trim() === '12'));
  const avec12 = douze > 0 ? (await v.appli.$$eval(`${TABLEAU} tbody td`, (tds, i) => tds[i - 1]?.textContent.trim(), douze)) : '';
  if (!avec12) throw new Error('Colonne 12 introuvable');
  son('zoom', 0.6); await S('cadrer', [`${TABLEAU} tbody th`, `${TABLEAU} thead th:nth-child(${douze + 1})`, `${TABLEAU} tbody td:nth-child(${douze + 1})`, '#sim-resultat h3'], { max: 2.2, marge: 30 });
  await H('souligner', 's', `${TABLEAU} tbody td:nth-child(${douze + 1})`, 'var(--vert)');
  await H('legende', `Avec 12 partout : <b>${avec12}</b> de moyenne.`);
  await temps(BRUT ? 1.5 : 2.5);
  if (!BRUT) {
    await v.temps(); son('whoosh'); await S('volet'); await S('legende', null);
    await S('outro', { titre: 'Notes et moyennes', sous: 'Dans le Pack Étudiant.<br>qm-engineering.fr/demo/odelia', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
    son('ding', 0.6); await temps(3);
  }
}
