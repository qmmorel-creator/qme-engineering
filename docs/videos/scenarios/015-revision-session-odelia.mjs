// Vidéo 015 · Planning de révision · clip PRIVÉ pour le partenariat Odélia (Yuzu Agency), à intercaler dans ses stories.
// Vue téléphone (390 × 844). Profil ?demo=droit-l1. Compte à rebours, chapitre du jour, mots-clés retrouvés : LUS dans
// l'application. Versions habillée et brute (VIDEO_BRUT=1, sans texte ni son).
const BRUT = process.env.VIDEO_BRUT === '1';
export const config = {
  nom: `015-revision-session-odelia${BRUT ? '-brut' : ''}`,
  produit: 'REV', type: 'démonstration', titre: 'Quoi réviser aujourd\'hui, jusqu\'au partiel',
  app: '/templates/revision/?demo=droit-l1&prenom=Od%C3%A9lia',
  largeur: 390, hauteur: 844,
  marque: 'QME · Planning de révision', url: 'qm-engineering.fr/demo/odelia',
  affiche: 1.2, dureeMax: 25,
  musique: BRUT ? null : { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
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
  await v.S('fenetre', BRUT);
}

export async function jouer(v) {
  const { S, pause, appli } = v;
  const H = BRUT ? async () => {} : S;
  const son = BRUT ? () => {} : v.son;
  const temps = (n = 1) => pause(n * T);
  if (!BRUT) {
    son('whoosh', 0.6);
    await S('accroche', ['Partiels', 'dans *' + v.compte.replace('J-', '') + '_jours* :', 'je révise quoi ?'], T / 2);
    await v.temps(); son('whoosh'); await S('accrocheSortie');
    await v.temps(); await S('fenetre', true);
  }
  // 1. Le compte à rebours jusqu'au premier partiel.
  await v.temps(); son('zoom'); await S('cadrer', EXAMEN, { max: 1.8, marge: 30 });
  son('pop'); await H('anneau', 'e', `${EXAMEN} .compte`, { couleur: 'var(--rouge)', etiquette: v.examen, cote: 'dessous', marge: 6 });
  await H('legende', `Premier partiel : <b>${v.examen}</b>, ${v.compte}.`);
  await temps(BRUT ? 1.5 : 2); await H('retirer');
  // 2. La session guidée : ne pas déranger, feuille blanche.
  await H('legende', 'Les chapitres du jour, <b>en session guidée</b>.');
  son('zoom', 0.7); await S('suivre', 1.6);
  await v.cliquer(SESSION, { ms: 520 });
  await S('cacherCurseur'); await pause(300);
  son('zoom', 0.6); await S('cadrer', CONSEILS, { max: 1.8, marge: 20 });
  await H('flash', CONSEILS, 'var(--jaune)');
  await H('legende', '« Ne pas déranger », puis <b>feuille blanche</b>.');
  await temps(BRUT ? 1.5 : 2);
  await S('suivre', 1.6);
  await v.cliquer(COMMENCER, { ms: 480 });
  await pause(250);
  // 3. De mémoire, puis comparaison aux mots-clés du chapitre.
  const chapitre = await v.lire('.session-chapitre h2');
  const cles = await appli.evaluate((t) => window.__revision.etat().chapitres.find((c) => c.titre === t)?.motsCles || '', chapitre);
  const liste = cles.split(',').map((x) => x.trim()).filter(Boolean);
  if (liste.length < 3) throw new Error(`Mots-clés insuffisants pour « ${chapitre} » : ${cles}`);
  const souvenir = liste.slice(0, 2);
  son('zoom', 0.6); await S('cadrer', ['.session-chapitre h2', FEUILLE], { max: 1.8, marge: 20 });
  await v.saisir(FEUILLE, `${souvenir.join(', ')}…`, { ms: 420, rapide: true });
  await v.cliquer(COMPARER, { ms: 420 });
  await S('cacherCurseur'); await pause(250);
  const score = (await v.lire(`${COMPARAISON} p b`)).trim();
  if (score !== `${souvenir.length}/${liste.length}`) throw new Error(`Comparaison inattendue : ${score}`);
  son('zoom', 0.6); await S('cadrer', COMPARAISON, { max: 1.8, marge: 20 });
  await H('flash', COMPARAISON, 'var(--ciel)');
  son('pop'); await H('anneau', 'c', `${COMPARAISON} p:first-child`, { couleur: 'var(--bleu)', etiquette: `${score} retrouvés`, cote: 'dessus', marge: 6 });
  await H('legende', `« ${chapitre} » : <b>${score}</b> de mémoire.`);
  await temps(BRUT ? 1.5 : 2.5); await H('retirer');
  if (!BRUT) {
    await v.temps(); son('whoosh'); await S('volet'); await S('legende', null);
    await S('outro', { titre: 'Planning de révision', sous: 'Dans le Pack Étudiant.<br>qm-engineering.fr/demo/odelia', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
    son('ding', 0.6); await temps(3);
  }
}
