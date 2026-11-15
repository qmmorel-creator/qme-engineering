// Vidéo 006 · Suivi des abonnements · « Une box partagée à deux : seule votre part compte dans les totaux. »
// Type : réglage (le nombre de parts d'un abonnement change le calcul du coût mensuel, annuel et des totaux).
// Données : démo intégrée du template (foyer fictif, aucun nom de marque). Toutes les valeurs affichées par
// l'habillage (coût de la ligne, totaux par mois et par an) sont LUES dans l'application réelle après le geste.

export const config = {
  nom: '006-abonnements-partage',
  produit: 'ABN', type: 'réglage', titre: 'Un abonnement partagé : seule votre part compte',
  app: '/templates/abonnements/?demo',
  largeur: 1280, hauteur: 1600,
  marque: 'QME · Suivi des abonnements',
  url: 'qm-engineering.fr/templates/abonnements',
  affiche: 1.8,
  // Musique de la vidéo de présentation QME (« Corporate », litesaturation, licence Pixabay : usage commercial sans attribution).
  musique: { fichier: 'docs/videos/musique/corporate-litesaturation.m4a', bpm: 110, premierTemps: 0.534, debut: 20.170, volume: 0.6 },
};
const T = 60000 / 110; // un temps en ms

const BOX = 'Box internet (fibre)';
const TUILES = '.tuiles:not(.tuiles-3)';
const PAR_MOIS = `${TUILES} > .tuile:nth-child(1)`;
const PAR_AN = `${TUILES} > .tuile:nth-child(2)`;
const ONGLET = (vue) => `nav.onglets button[data-vue="${vue}"]`;
const PARTS = 'dialog[open] input[name="parts"]';
const PARTAGE = 'dialog[open] fieldset.cadre-champs:has(input[name="parts"])';
const ENREGISTRER = 'dialog[open] button[value="ok"]';
let LIGNE = ''; // calculé dans preparer à partir du NOM de l'abonnement (position dans la liste), jamais d'un identifiant généré

export async function preparer(v) {
  const { appli, page } = v;
  await v.fermerDialogues(); // guide d'accueil du premier lancement, hors caméra
  // Totaux de départ (Aperçu).
  v.mois0 = (await v.lire(`${PAR_MOIS} b`)).trim();
  v.an0 = (await v.lire(`${PAR_AN} b`)).trim();
  // Position de la box dans l'onglet Abonnements, retrouvée par son nom.
  await appli.click(ONGLET('abonnements')); await page.waitForTimeout(300);
  const pos = await appli.$$eval('section.groupe-cat', (ss, nom) => {
    for (let i = 0; i < ss.length; i++) {
      const lis = [...ss[i].querySelectorAll('li.ligne-abo')];
      const j = lis.findIndex((l) => l.querySelector('.ligne-info b')?.textContent.trim() === nom);
      if (j >= 0) return [i + 1, j + 1];
    }
    return null;
  }, BOX);
  if (!pos) throw new Error(`Abonnement « ${BOX} » absent de la démo`);
  LIGNE = `section.groupe-cat:nth-of-type(${pos[0]}) li.ligne-abo:nth-child(${pos[1]})`;
  const nomLu = (await v.lire(`${LIGNE} .ligne-info b`)).trim();
  const detail = await v.lire(`${LIGNE} .ligne-detail`);
  const cout = (await v.lire(`${LIGNE} .ligne-cout b`)).trim();
  if (nomLu !== BOX || /ma part/i.test(detail) || !/^34,99/.test(cout) || !v.mois0 || !v.an0) {
    throw new Error(`Données de démo inattendues : ${JSON.stringify({ nomLu, detail, cout, mois0: v.mois0, an0: v.an0 })}`);
  }
  await appli.click(ONGLET('apercu')); await page.waitForTimeout(300);
  await v.S('cadrer', null);
  await v.S('fenetre', false);
}

export async function jouer(v) {
  const { S, son, pause } = v;
  const temps = (n = 1) => pause(n * T);
  const COUT = `${LIGNE} .ligne-cout b`;

  // Accroche : un mot par demi-temps, un seul son d'entrée
  son('whoosh', 0.6);
  await S('accroche', ['Une box partagée', 'en *colocation*.', '!Vous la comptez *en_entier ?*'], T / 2);
  await v.temps();
  son('whoosh'); await S('accrocheSortie');
  await S('question', 'Seule *votre part* compte');
  await v.temps(); son('whoosh', 0.7); await S('fenetre', true);

  // Les totaux de départ
  await v.temps(); son('zoom'); await S('cadrer', PAR_MOIS, { max: 2.4, marge: 150 });
  await v.temps(); son('pop');
  await S('anneau', 'm', PAR_MOIS, { etiquette: `Par mois : ${v.mois0}`, cote: 'dessous', marge: 6, pulse: false });
  await S('legende', `Tous les abonnements du foyer, <b>ramenés au mois</b>.`);
  await temps(2);
  await S('retirer', 'm');

  // Le réglage : la box est partagée à deux
  await v.temps(); await S('legende', `La box internet est partagée <b>à deux</b>.`);
  son('zoom', 0.7); await S('suivre', 1.8);
  await v.cliquer(ONGLET('abonnements'), { ms: 520 });
  await v.temps(2);
  const avant = (await v.lire(COUT)).trim();
  await S('suivre', 2.2);
  await v.cliquer(`${LIGNE} .ligne-info`, { ms: 560, fx: 0.25 });
  await temps(1);
  await S('suivre', 2.4);
  await v.saisir(PARTS, '2', { ms: 520 });
  await S('anneau', 'p', PARTAGE, { etiquette: 'Nombre de parts : 2', cote: 'dessus', pulse: false });
  await temps(1.5);
  await S('retirer', 'p');
  await v.cliquer(ENREGISTRER, { ms: 560 });
  await S('cacherCurseur');

  // Effet local : la ligne de la box (nom + étiquette « Partagé · 2 parts »), puis son coût
  const apres = (await v.lire(COUT)).trim();
  if (apres === avant) throw new Error(`Le coût de la box n'a pas changé (${avant})`);
  const etiquette = await v.lire(`${LIGNE} .ligne-etiquettes`);
  if (!/2 parts/i.test(etiquette)) throw new Error(`Étiquette de partage absente : ${etiquette}`);
  son('dezoom', 0.6); await S('cadrer', LIGNE, { max: 2.4, marge: 40 });
  await S('flash', LIGNE, 'var(--ciel)');
  await v.temps(); await temps(0.5);
  son('zoom'); await S('cadrer', `${LIGNE} .ligne-droite`, { max: 2.2, marge: 230 });
  son('pop'); await S('avantApres', 'r', COUT, avant, apres, { couleur: 'var(--bleu)', cote: 'dessus', note: 'votre part par mois' });
  await temps(2.5);
  await S('retirer', 'r');

  // Effet global : retour à l'Aperçu
  await v.temps(); await S('legende', `Les totaux se recalculent <b>tout seuls</b>.`);
  son('dezoom'); await S('suivre', 1.6, 0.15);
  await v.cliquer(ONGLET('apercu'), { ms: 560 });
  await S('cacherCurseur');
  son('zoom'); await S('cadrer', PAR_MOIS, { max: 2.4, marge: 150 });
  const mois1 = (await v.lire(`${PAR_MOIS} b`)).trim();
  const an1 = (await v.lire(`${PAR_AN} b`)).trim();
  if (mois1 === v.mois0 || an1 === v.an0) throw new Error(`Totaux inchangés : ${v.mois0} → ${mois1}, ${v.an0} → ${an1}`);
  await v.temps();
  await S('flash', PAR_MOIS, 'var(--vert)');
  son('pop'); await S('avantApres', 'm', `${PAR_MOIS} b`, v.mois0, mois1, { couleur: 'var(--vert)', cote: 'dessous', note: 'par mois' });
  await temps(2);
  await S('retirer', 'm');
  son('glisse', 0.5); await S('cadrer', PAR_AN, { max: 2.4, marge: 150 });
  await S('flash', PAR_AN, 'var(--vert)');
  son('pop'); await S('avantApres', 'a', `${PAR_AN} b`, v.an0, an1, { couleur: 'var(--vert)', cote: 'dessous', note: 'par an' });
  son('trait', 0.6); await S('souligner', 's', `${PAR_AN} b`, 'var(--vert)');
  son('eclat'); await S('eclat', PAR_AN, ['var(--vert)', 'var(--jaune)', 'var(--bleu)']);
  await v.temps(); son('tampon'); son('ding', 0.7);
  await S('tampon', 'Seule votre part compte', `Box : ${apres} par mois au lieu de ${avant}`, 'var(--vert)');
  await temps(3);
  await S('tamponFin'); await S('retirer');

  // Fin
  await v.temps(); son('whoosh'); await S('volet');
  await S('legende', null);
  await S('outro', { titre: 'Suivi des abonnements', sous: 'Votre part, ramenée au mois<br>et à l\'année.', url: 'Démo gratuite · <b>qm-engineering.fr</b>' });
  son('ding', 0.6);
  await temps(4);
}
